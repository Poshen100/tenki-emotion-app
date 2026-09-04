/**
 * @module features/devices/providers
 * @description The Devices screen catalogue and the availability decision.
 *
 * Four entries only, exactly as docs/WEARABLE-INTEGRATION.md §1 prescribes:
 * Apple 健康 (iOS), Health Connect (Android), 心率胸帶 (both), Garmin Connect
 * (second wave). Google Fit is deliberately absent — its API is being retired
 * and Android goes through Health Connect.
 */

import type {
  DeviceEnvironment,
  DeviceProvider,
  DeviceProviderId,
  DeviceUnavailableReason,
} from './types/devices.types';

/**
 * Connection entries in display order: the system health hub for the current
 * OS first (it covers the most devices for one grant), then the chest strap,
 * then the second-wave vendor cloud.
 */
export const DEVICE_PROVIDERS: readonly DeviceProvider[] = [
  {
    id: 'apple_health',
    platform: 'healthkit',
    label: 'Apple 健康',
    description: '讀取 Apple Watch 與已寫入健康 App 的心率、HRV、睡眠與活動',
    os: 'ios',
    wave: 'p0',
    scopes: ['scan', 'context', 'history'],
  },
  {
    id: 'health_connect',
    platform: 'health_connect',
    label: 'Health Connect',
    description: '讀取 Android 健康庫裡的心率、HRV、睡眠、血氧與活動',
    os: 'android',
    wave: 'p0',
    scopes: ['scan', 'context', 'history'],
  },
  {
    id: 'chest_strap',
    platform: 'ble_chest',
    label: '心率胸帶',
    description: '掃描期間直接連線，取得逐拍間隔以提高量測精度',
    os: 'both',
    wave: 'p0',
    scopes: ['scan'],
  },
  {
    id: 'garmin_connect',
    platform: 'garmin_api',
    label: 'Garmin Connect',
    description: '取得健康庫拿不到的 Garmin 專屬每日數據',
    os: 'both',
    wave: 'p1',
    scopes: ['context', 'history'],
  },
];

/** Looks up one provider by id. */
export function findProvider(id: DeviceProviderId): DeviceProvider | null {
  return DEVICE_PROVIDERS.find((provider) => provider.id === id) ?? null;
}

/** The providers shown on a given OS, in display order. */
export function providersForOs(os: DeviceEnvironment['os']): readonly DeviceProvider[] {
  return DEVICE_PROVIDERS.filter((provider) => provider.os === 'both' || provider.os === os);
}

/**
 * Decides whether a provider can be connected right now.
 *
 * Order matters: the reasons are reported most-fundamental first, so the user
 * is never told to install Health Connect on an iPhone.
 *
 * @param provider - The catalogue entry.
 * @param env - What this build and this device actually offer.
 * @returns The blocking reason, or null when the provider can be connected.
 */
export function resolveUnavailableReason(
  provider: DeviceProvider,
  env: DeviceEnvironment,
): DeviceUnavailableReason | null {
  if (provider.os !== 'both' && provider.os !== env.os) {
    return 'wrong_os';
  }

  if (provider.wave === 'p1') {
    return 'second_wave';
  }

  if (provider.id === 'health_connect' && !env.healthConnectInstalled) {
    return 'hub_not_installed';
  }

  if (env.adapters[provider.id] !== true) {
    return 'adapter_missing';
  }

  return null;
}
