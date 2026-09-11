import { planOnboardingBaselines } from '@tenki/domain';
import { connectedPlatforms } from '../connectedPlatforms';
import { DEVICE_PROVIDERS } from '../providers';
import type { ConnectionMap, DeviceConnection, DeviceProviderId } from '../types/devices.types';

function connection(overrides: Partial<DeviceConnection> = {}): DeviceConnection {
  return {
    state: 'disconnected',
    unavailableReason: null,
    grantedScopes: [],
    lastSyncAt: null,
    lastSyncDevice: null,
    errorMessage: null,
    ...overrides,
  };
}

function map(overrides: Partial<Record<DeviceProviderId, DeviceConnection>> = {}): ConnectionMap {
  const entries = DEVICE_PROVIDERS.map((p) => [p.id, connection()] as const);
  return { ...Object.fromEntries(entries), ...overrides } as ConnectionMap;
}

describe('which platforms are actually live', () => {
  it('reports nothing for a user who has connected nothing', () => {
    expect(connectedPlatforms(map())).toEqual([]);
  });

  it('maps a connected provider to its canonical platform', () => {
    const connections = map({
      apple_health: connection({ state: 'connected', grantedScopes: ['scan', 'context'] }),
    });

    expect(connectedPlatforms(connections)).toEqual(['healthkit']);
  });

  it('ignores a link that was granted no scan access', () => {
    // 🔴 The case that would otherwise route a phone-only user away from the
    // finger baseline: a connected provider that supplies nothing at scan time.
    const connections = map({
      apple_health: connection({ state: 'connected', grantedScopes: ['history'] }),
    });

    expect(connectedPlatforms(connections)).toEqual([]);
  });

  it('ignores a provider that is denied, unavailable, or still requesting', () => {
    for (const state of ['denied', 'unavailable', 'requesting', 'error'] as const) {
      const connections = map({
        health_connect: connection({ state, grantedScopes: ['scan'] }),
      });
      expect(connectedPlatforms(connections)).toEqual([]);
    }
  });
});

describe('the onboarding branch this feeds', () => {
  it('sends a user with nothing connected through the finger baseline', () => {
    const plan = planOnboardingBaselines({ connectedPlatforms: connectedPlatforms(map()) });

    expect(plan.steps).toEqual(['face_baseline', 'finger_hrv_baseline']);
    expect(plan.fingerRationale).toBe('only_hrv_source');
  });

  it('skips it for a user whose watch is connected for scanning', () => {
    const connections = map({
      apple_health: connection({ state: 'connected', grantedScopes: ['scan'] }),
    });
    const plan = planOnboardingBaselines({ connectedPlatforms: connectedPlatforms(connections) });

    expect(plan.steps).toEqual(['face_baseline']);
  });

  it('still sends them through it when only Garmin Connect is linked', () => {
    // Garmin's cloud is second-wave and supplies no HRV today. A link to it
    // must not be mistaken for an HRV source.
    const connections = map({
      garmin_connect: connection({ state: 'connected', grantedScopes: ['scan', 'context'] }),
    });
    const plan = planOnboardingBaselines({ connectedPlatforms: connectedPlatforms(connections) });

    expect(plan.steps).toContain('finger_hrv_baseline');
  });
});
