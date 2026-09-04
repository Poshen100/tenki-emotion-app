/**
 * @module features/devices/port
 * @description The seam between the Devices flow and the OS.
 *
 * Everything above this interface is pure and testable today; everything below
 * it is a native module that needs a Mac and a device. Phase 1's native work
 * implements `DeviceLinkPort` — the screen, the machine and the store do not
 * change when it lands.
 *
 * The default implementation reports "no adapter" for every provider. That is
 * the honest answer in a build with no health-hub bridge: it must never look
 * like a connection that silently returns nothing.
 */

import type {
  DeviceEnvironment,
  DeviceProviderId,
  DevicePlatformOs,
} from './types/devices.types';
import type { BiometricPermissionScope } from '@tenki/domain';

/** Outcome of one permission request, mirroring the machine's events. */
export type DeviceLinkOutcome =
  | { kind: 'granted'; scopes: readonly BiometricPermissionScope[] }
  | { kind: 'partial'; scopes: readonly BiometricPermissionScope[] }
  | { kind: 'denied' }
  | { kind: 'failed'; message: string };

/** What the native layer must provide for the Devices screen to work. */
export interface DeviceLinkPort {
  /** What this build and this device actually offer. */
  describeEnvironment(): DeviceEnvironment;
  /** Asks the OS for the given scopes. Never throws; failures come back typed. */
  requestAccess(
    providerId: DeviceProviderId,
    scopes: readonly BiometricPermissionScope[],
  ): Promise<DeviceLinkOutcome>;
  /** Drops the link and any cached tokens for this provider. */
  disconnect(providerId: DeviceProviderId): Promise<void>;
}

/**
 * Creates the no-adapter port used until the native modules ship.
 *
 * @param os - Which OS to report; the screen still shows the right entries.
 * @returns A port that reports no adapters and refuses every request.
 */
export function createUnwiredLinkPort(os: DevicePlatformOs): DeviceLinkPort {
  return {
    describeEnvironment: () => ({ os, adapters: {}, healthConnectInstalled: false }),
    requestAccess: async () => ({
      kind: 'failed',
      message: '這個版本還沒有裝置連接模組',
    }),
    disconnect: async () => undefined,
  };
}
