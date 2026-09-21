/**
 * @module features/devices/connectedPlatforms
 * @description Reads the live connection map down to the one question the
 * onboarding plan asks: which source platforms does this user actually have?
 *
 * Pure and separate from the store on purpose — the onboarding branch is a
 * decision, and a decision that lives inside a React hook cannot be tested
 * without rendering anything.
 *
 * ⚠️ "Connected" means the link is established AND the scan scope was granted.
 * A provider the user connected but then denied scan access to supplies
 * nothing during a scan, and counting it would route a user away from the
 * finger baseline on the strength of a source that will never produce a
 * reading.
 */

import type { BiometricSourcePlatform } from '@tenki/domain';
import { DEVICE_PROVIDERS } from './providers';
import type { ConnectionMap, DeviceProviderId } from './types/devices.types';

/**
 * The platforms this user has live, scan-capable links to.
 *
 * @param connections - The devices store's connection map.
 * @returns Canonical platforms, in the providers' display order.
 */
export function connectedPlatforms(
  connections: ConnectionMap,
): readonly BiometricSourcePlatform[] {
  const out: BiometricSourcePlatform[] = [];

  for (const provider of DEVICE_PROVIDERS) {
    const connection = connections[provider.id as DeviceProviderId];
    if (connection === undefined || connection.state !== 'connected') continue;
    if (!connection.grantedScopes.includes('scan')) continue;

    out.push(provider.platform);
  }

  return out;
}
