import { UNAVAILABLE_COPY } from '../copy';
import { findProvider } from '../providers';
import { describeRow } from '../rowPresentation';
import type { DeviceConnection, DeviceProvider, DeviceProviderId } from '../types/devices.types';

const NOW = 1_760_000_000_000;

function provider(id: DeviceProviderId): DeviceProvider {
  const found = findProvider(id);
  if (!found) throw new Error(`catalogue is missing ${id}`);
  return found;
}

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

const appleHealth = provider('apple_health');

describe('describeRow', () => {
  it('keeps the description on a blocked row, alongside the reason', () => {
    const row = describeRow(
      appleHealth,
      connection({ state: 'unavailable', unavailableReason: 'adapter_missing' }),
      NOW,
    );

    expect(row.primaryLine).toBe(appleHealth.description);
    expect(row.stateLine).toBe(UNAVAILABLE_COPY.adapter_missing);
    expect(row.blocked).toBe(true);
    expect(row.actionLabel).toBeNull();
  });

  it('never prints the description twice', () => {
    const row = describeRow(appleHealth, connection(), NOW);
    expect(row.primaryLine).toBe(appleHealth.description);
    expect(row.stateLine).toBeNull();
    expect(row.actionLabel).toBe('連接');
  });

  it('keeps the description while a request is in flight, with no action', () => {
    const row = describeRow(appleHealth, connection({ state: 'requesting' }), NOW);
    expect(row.primaryLine).toBe(appleHealth.description);
    expect(row.stateLine).toBe('等待授權…');
    expect(row.actionLabel).toBeNull();
  });

  it('reassures on a denial and still offers a retry', () => {
    const row = describeRow(appleHealth, connection({ state: 'denied' }), NOW);
    expect(row.primaryLine).toBe(appleHealth.description);
    expect(row.stateLine).toContain('相機掃描仍可完整使用');
    expect(row.actionLabel).toBe('再試一次');
  });

  it('shows the real failure message, not a generic one, when there is one', () => {
    expect(
      describeRow(appleHealth, connection({ state: 'error', errorMessage: '連線中斷' }), NOW)
        .stateLine,
    ).toBe('連線中斷');
    expect(describeRow(appleHealth, connection({ state: 'error' }), NOW).stateLine).toBe('連接失敗');
  });

  it('swaps the description for the freshness line once connected', () => {
    const row = describeRow(
      appleHealth,
      connection({
        state: 'connected',
        grantedScopes: ['scan', 'context'],
        lastSyncAt: NOW - 12 * 60_000,
        lastSyncDevice: 'Apple Watch',
      }),
      NOW,
    );

    expect(row.primaryLine).toBe('Apple Watch · 12 分鐘前');
    expect(row.stateLine).toBeNull();
    expect(row.primaryIsStale).toBe(false);
    expect(row.scopes).toEqual(['scan', 'context']);
    expect(row.actionLabel).toBe('中斷連接');
  });

  it('flags a connection whose data has gone quiet', () => {
    const row = describeRow(
      appleHealth,
      connection({ state: 'connected', lastSyncAt: NOW - 40 * 60 * 60_000 }),
      NOW,
    );
    expect(row.primaryIsStale).toBe(true);
  });

  it('shows scope chips only for a live connection', () => {
    for (const state of ['disconnected', 'denied', 'error', 'unavailable'] as const) {
      const row = describeRow(appleHealth, connection({ state, grantedScopes: ['scan'] }), NOW);
      expect(row.scopes).toEqual([]);
    }
  });
});
