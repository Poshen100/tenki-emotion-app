/**
 * @module features/devices/adapters/healthConnectPort
 * @description `DeviceLinkPort` implementation for Android Health Connect.
 *
 * The native library is loaded with `await import()` inside Android-only
 * branches, never at module top level: a top-level import of a native-only
 * package is what breaks the web bundle (docs/PLAYBOOK.md §7), and the web
 * export is how this screen gets reviewed before a device exists.
 *
 * This file also imports nothing from `react-native` — the OS arrives as an
 * argument instead. That is the same repo convention that keeps the node-env
 * jest able to load it: a module the tests touch may not pull in RN.
 *
 * Honesty rules this file must keep — the connection UI believes what it says:
 *   - `describeEnvironment()` reports `health_connect: true` only when the
 *     module actually loaded AND the OS reports the SDK available. A missing
 *     Health Connect app is `hub_not_installed`, ours-to-fix is
 *     `adapter_missing`; the screen says something different for each.
 *   - `requestAccess()` returns exactly the scopes the OS granted — a partial
 *     grant stays partial.
 *   - `disconnect()` does NOT call `revokeAllPermissions()`. The library
 *     documents that revocation does not take effect until the app process
 *     restarts, so an in-app toggle built on it would keep reading data while
 *     claiming to be disconnected. We drop our own state and point the user at
 *     Health Connect, which is the only place the grant really lives.
 */

import type { BiometricPermissionScope } from '@tenki/domain';
import type { DeviceEnvironment, DevicePlatformOs } from '../types/devices.types';
import type { DeviceLinkOutcome, DeviceLinkPort } from '../port';

/** Health Connect record types TENKI reads, grouped by consent bucket. */
export const HEALTH_CONNECT_READ_TYPES: Readonly<
  Record<BiometricPermissionScope, readonly string[]>
> = {
  // The scan window itself.
  scan: ['HeartRate'],
  // Daily context the Edge Score normalizes against.
  context: [
    'RestingHeartRate',
    'HeartRateVariabilityRmssd',
    'RespiratoryRate',
    'OxygenSaturation',
    'SleepSession',
    'Steps',
    'ActiveCaloriesBurned',
  ],
  // Health Connect gates data older than 30 days behind its own permission.
  history: ['ReadHealthDataHistory'],
};

/** One permission as the library expects it. Kept local so this file's types survive a library bump. */
interface HealthConnectPermission {
  accessType: 'read' | 'write';
  recordType: string;
}

/** `SdkAvailabilityStatus.SDK_AVAILABLE` — the only status we may connect on. */
export const SDK_AVAILABLE = 3;

/** Builds the read permissions for the given scopes. */
export function buildReadPermissions(
  scopes: readonly BiometricPermissionScope[],
): HealthConnectPermission[] {
  return scopes.flatMap((scope) =>
    HEALTH_CONNECT_READ_TYPES[scope].map((recordType) => ({
      accessType: 'read' as const,
      recordType,
    })),
  );
}

/**
 * Works out which consent buckets the OS actually granted.
 *
 * A scope counts as granted only when EVERY record type behind it came back —
 * half a bucket is not the bucket, and claiming it would make the screen
 * promise context data it cannot read.
 *
 * @param requested - Scopes the user was asked for.
 * @param granted - Permissions the OS reported granted.
 * @returns The subset of `requested` that is fully covered.
 */
export function resolveGrantedScopes(
  requested: readonly BiometricPermissionScope[],
  granted: readonly HealthConnectPermission[],
): BiometricPermissionScope[] {
  const grantedTypes = new Set(
    granted.filter((p) => p.accessType === 'read').map((p) => p.recordType),
  );

  return requested.filter((scope) =>
    HEALTH_CONNECT_READ_TYPES[scope].every((recordType) => grantedTypes.has(recordType)),
  );
}

/** Turns granted scopes into the outcome the connection machine consumes. */
export function toLinkOutcome(
  requested: readonly BiometricPermissionScope[],
  grantedScopes: readonly BiometricPermissionScope[],
): DeviceLinkOutcome {
  if (grantedScopes.length === 0) return { kind: 'denied' };
  if (grantedScopes.length < requested.length) return { kind: 'partial', scopes: grantedScopes };
  return { kind: 'granted', scopes: grantedScopes };
}

/** Loads the native module, or null when it is not in this build or not Android. */
async function loadHealthConnect(
  os: DevicePlatformOs,
): Promise<typeof import('react-native-health-connect') | null> {
  if (os !== 'android') return null;
  try {
    return await import('react-native-health-connect');
  } catch {
    // No adapter in this build — the screen says so rather than pretending.
    return null;
  }
}

/**
 * Creates the Android port. On any other OS it reports an environment with no
 * adapters, so the screen falls back to "not yet available" rather than
 * throwing.
 *
 * @param os - The OS to report; the catalogue still filters by it.
 * @returns A `DeviceLinkPort` backed by Health Connect.
 */
export function createHealthConnectPort(os: DevicePlatformOs): DeviceLinkPort {
  return {
    describeEnvironment: async (): Promise<DeviceEnvironment> => {
      const healthConnect = await loadHealthConnect(os);
      if (!healthConnect) {
        return { os, adapters: {}, healthConnectInstalled: false };
      }

      try {
        const status = await healthConnect.getSdkStatus();
        const available = status === SDK_AVAILABLE;

        return {
          os,
          // The adapter exists; whether the hub is usable is the other flag.
          adapters: { health_connect: true },
          healthConnectInstalled: available,
        };
      } catch {
        return { os, adapters: { health_connect: true }, healthConnectInstalled: false };
      }
    },

    requestAccess: async (providerId, scopes): Promise<DeviceLinkOutcome> => {
      if (providerId !== 'health_connect') {
        return { kind: 'failed', message: '這個來源不由 Health Connect 提供' };
      }

      const healthConnect = await loadHealthConnect(os);
      if (!healthConnect) {
        return { kind: 'failed', message: '這個版本還沒有裝置連接模組' };
      }

      try {
        const initialized = await healthConnect.initialize();
        if (!initialized) {
          return { kind: 'failed', message: '無法啟動 Health Connect，請確認它已設定完成' };
        }

        const granted = await healthConnect.requestPermission(
          buildReadPermissions(scopes) as Parameters<typeof healthConnect.requestPermission>[0],
        );

        return toLinkOutcome(scopes, resolveGrantedScopes(scopes, granted));
      } catch (error) {
        return {
          kind: 'failed',
          message: error instanceof Error ? error.message : '連接 Health Connect 時發生錯誤',
        };
      }
    },

    disconnect: async () => {
      // Deliberately not revokeAllPermissions() — see the module note above.
      const healthConnect = await loadHealthConnect(os);
      healthConnect?.openHealthConnectSettings();
    },
  };
}
