import { BIOMETRIC_SOURCE_PLATFORMS } from '@tenki/domain';
import { DEVICES_SCREEN_COPY, UNAVAILABLE_COPY } from '../copy';
import {
  DEVICE_PROVIDERS,
  findProvider,
  providersForOs,
  resolveUnavailableReason,
} from '../providers';
import type { DeviceEnvironment, DeviceProvider, DeviceProviderId } from '../types/devices.types';

function env(overrides: Partial<DeviceEnvironment> = {}): DeviceEnvironment {
  return {
    os: 'ios',
    adapters: {},
    healthConnectInstalled: false,
    ...overrides,
  };
}

describe('catalogue', () => {
  it('offers exactly the four entries the canonical doc prescribes', () => {
    expect(DEVICE_PROVIDERS.map((p) => p.id)).toEqual([
      'apple_health',
      'health_connect',
      'chest_strap',
      'garmin_connect',
    ]);
  });

  it('maps every entry onto a canonical source platform', () => {
    for (const provider of DEVICE_PROVIDERS) {
      expect(BIOMETRIC_SOURCE_PLATFORMS).toContain(provider.platform);
    }
  });

  it('shows the iOS hub only on iOS and the Android hub only on Android', () => {
    expect(providersForOs('ios').map((p) => p.id)).toEqual([
      'apple_health',
      'chest_strap',
      'garmin_connect',
    ]);
    expect(providersForOs('android').map((p) => p.id)).toEqual([
      'health_connect',
      'chest_strap',
      'garmin_connect',
    ]);
  });

  it('looks providers up by id', () => {
    expect(findProvider('chest_strap')?.platform).toBe('ble_chest');
    expect(findProvider('nope' as never)).toBeNull();
  });
});

describe('copy compliance', () => {
  const allCopy = [
    ...DEVICE_PROVIDERS.flatMap((p) => [p.label, p.description]),
    ...Object.values(UNAVAILABLE_COPY),
    ...Object.values(DEVICES_SCREEN_COPY),
  ].join('\n');

  it('says Apple 健康, never Apple 健身', () => {
    expect(allCopy).toContain('Apple 健康');
    expect(allCopy).not.toContain('Apple 健身');
  });

  it('never offers Google Fit', () => {
    expect(allCopy).not.toMatch(/Google\s*Fit/i);
    expect(allCopy).toContain('Health Connect');
  });

  it('carries no medical, emotion-detection or financial framing', () => {
    for (const banned of ['診斷', '治療', '疾病', '偵測情緒', '情緒偵測', '獲利', '交易建議']) {
      expect(allCopy).not.toContain(banned);
    }
  });

  it('states the privacy promise and the escape hatch on the screen itself', () => {
    expect(DEVICES_SCREEN_COPY.privacyNote).toContain('不會上傳');
    expect(DEVICES_SCREEN_COPY.privacyNote).toContain('中斷連接');
    // Camera scan must keep working without any of this.
    expect(DEVICES_SCREEN_COPY.emptyState).toContain('相機掃描仍可完整使用');
  });

  it('blames the missing adapter on us, not on the user', () => {
    expect(UNAVAILABLE_COPY.adapter_missing).toContain('尚未開放連接');
  });
});

function provider(id: DeviceProviderId): DeviceProvider {
  const found = findProvider(id);
  if (!found) throw new Error(`catalogue is missing ${id}`);
  return found;
}

describe('resolveUnavailableReason', () => {
  const appleHealth = provider('apple_health');
  const healthConnect = provider('health_connect');
  const chestStrap = provider('chest_strap');
  const garmin = provider('garmin_connect');

  it('rejects the wrong OS before anything else', () => {
    expect(resolveUnavailableReason(appleHealth, env({ os: 'android' }))).toBe('wrong_os');
    expect(
      resolveUnavailableReason(
        healthConnect,
        env({ os: 'ios', healthConnectInstalled: true, adapters: { health_connect: true } }),
      ),
    ).toBe('wrong_os');
  });

  it('never tells an iPhone user to install Health Connect', () => {
    expect(resolveUnavailableReason(healthConnect, env({ os: 'ios' }))).not.toBe(
      'hub_not_installed',
    );
  });

  it('marks Garmin as second wave even where an adapter exists', () => {
    expect(
      resolveUnavailableReason(garmin, env({ adapters: { garmin_connect: true } })),
    ).toBe('second_wave');
  });

  it('asks for Health Connect setup before blaming the adapter', () => {
    expect(
      resolveUnavailableReason(
        healthConnect,
        env({ os: 'android', healthConnectInstalled: false, adapters: { health_connect: true } }),
      ),
    ).toBe('hub_not_installed');
  });

  it('reports a missing native adapter rather than pretending to connect', () => {
    expect(resolveUnavailableReason(appleHealth, env({ os: 'ios' }))).toBe('adapter_missing');
    expect(resolveUnavailableReason(chestStrap, env())).toBe('adapter_missing');
  });

  it('returns null once the OS, the hub and the adapter all line up', () => {
    expect(
      resolveUnavailableReason(appleHealth, env({ os: 'ios', adapters: { apple_health: true } })),
    ).toBeNull();
    expect(
      resolveUnavailableReason(
        healthConnect,
        env({ os: 'android', healthConnectInstalled: true, adapters: { health_connect: true } }),
      ),
    ).toBeNull();
  });
});
