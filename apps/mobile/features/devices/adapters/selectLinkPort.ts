/**
 * @module features/devices/adapters/selectLinkPort
 * @description Picks the `DeviceLinkPort` for the running platform.
 *
 * One place, so the screen never grows platform branches — and so the honest
 * default stays the default: anything without a real adapter gets the unwired
 * port, which reports "no adapter" rather than a connection that never
 * delivers data.
 */

import type { DeviceLinkPort } from '../port';
import { createUnwiredLinkPort } from '../port';
import type { DevicePlatformOs } from '../types/devices.types';
import { createHealthConnectPort } from './healthConnectPort';

/**
 * @param os - The OS the app is running on.
 * @returns The port to use; never throws, never invents an adapter.
 */
export function selectLinkPort(os: DevicePlatformOs): DeviceLinkPort {
  // iOS keeps the unwired port until the HealthKit bridge exists.
  return os === 'android' ? createHealthConnectPort(os) : createUnwiredLinkPort(os);
}
