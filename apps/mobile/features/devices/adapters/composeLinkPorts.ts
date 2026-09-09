/**
 * @module features/devices/adapters/composeLinkPorts
 * @description Combines one port per provider into the single port the screen
 * and store talk to.
 *
 * Without this, whichever adapter happened to be selected would answer for
 * every row — a chest-strap tap would come back "this source is not provided
 * by Health Connect", which is true of the adapter and meaningless to the user.
 *
 * Pure (no react-native, no native modules), so the routing is unit-tested.
 */

import type { DeviceLinkOutcome, DeviceLinkPort } from '../port';
import type {
  DeviceEnvironment,
  DeviceProviderId,
  DevicePlatformOs,
} from '../types/devices.types';

/** Which port answers for which provider. */
export type LinkPortsByProvider = Partial<Record<DeviceProviderId, DeviceLinkPort>>;

/**
 * @param os - The OS to report in the merged environment.
 * @param ports - One port per provider that has an adapter in this build.
 * @returns A port that routes by provider and merges what each one reports.
 */
export function composeLinkPorts(os: DevicePlatformOs, ports: LinkPortsByProvider): DeviceLinkPort {
  const entries = Object.entries(ports) as [DeviceProviderId, DeviceLinkPort][];

  return {
    describeEnvironment: async (): Promise<DeviceEnvironment> => {
      const described = await Promise.all(entries.map(([, port]) => port.describeEnvironment()));

      return described.reduce<DeviceEnvironment>(
        (merged, env) => ({
          os,
          adapters: { ...merged.adapters, ...env.adapters },
          // Any port that can see the hub is enough to know it is there.
          healthConnectInstalled: merged.healthConnectInstalled || env.healthConnectInstalled,
        }),
        { os, adapters: {}, healthConnectInstalled: false },
      );
    },

    requestAccess: async (providerId, scopes): Promise<DeviceLinkOutcome> => {
      const port = ports[providerId];
      if (!port) {
        return { kind: 'failed', message: '這個版本還沒有裝置連接模組' };
      }
      return port.requestAccess(providerId, scopes);
    },

    disconnect: async (providerId) => {
      await ports[providerId]?.disconnect(providerId);
    },
  };
}
