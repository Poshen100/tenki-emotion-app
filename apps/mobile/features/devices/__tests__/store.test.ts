import type { DeviceLinkOutcome, DeviceLinkPort } from '../port';
import { createUnwiredLinkPort } from '../port';
import { CONNECTION_STALE_MS, formatRelativeAge, formatSyncStatus, isSyncStale } from '../status';
import { grantedScopesAcross, useDevicesStore } from '../store/devicesStore';
import type { DeviceConnection, DeviceEnvironment } from '../types/devices.types';

const NOW = 1_760_000_000_000;

const READY_IOS: DeviceEnvironment = {
  os: 'ios',
  adapters: { apple_health: true, chest_strap: true },
  healthConnectInstalled: false,
};

function fakePort(outcome: DeviceLinkOutcome, env: DeviceEnvironment = READY_IOS): DeviceLinkPort {
  return {
    describeEnvironment: () => env,
    requestAccess: async () => outcome,
    disconnect: async () => undefined,
  };
}

function connection(overrides: Partial<DeviceConnection> = {}): DeviceConnection {
  return {
    state: 'connected',
    unavailableReason: null,
    grantedScopes: ['scan'],
    lastSyncAt: NOW - 60_000,
    lastSyncDevice: 'Apple Watch',
    errorMessage: null,
    ...overrides,
  };
}

beforeEach(() => {
  useDevicesStore.getState().reset();
  useDevicesStore.getState().setPort(createUnwiredLinkPort('ios'));
});

describe('syncEnvironment', () => {
  it('starts every provider unavailable until the environment says otherwise', () => {
    const { connections } = useDevicesStore.getState();
    for (const conn of Object.values(connections)) {
      expect(conn.state).toBe('unavailable');
    }
  });

  it('unblocks only the providers this environment can actually connect', () => {
    useDevicesStore.getState().syncEnvironment(READY_IOS);
    const { connections } = useDevicesStore.getState();

    expect(connections.apple_health.state).toBe('disconnected');
    expect(connections.chest_strap.state).toBe('disconnected');
    expect(connections.health_connect.state).toBe('unavailable');
    expect(connections.health_connect.unavailableReason).toBe('wrong_os');
    expect(connections.garmin_connect.unavailableReason).toBe('second_wave');
  });

  it('falls back to the port when no environment is passed', () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'denied' }));
    useDevicesStore.getState().syncEnvironment();
    expect(useDevicesStore.getState().connections.apple_health.state).toBe('disconnected');
  });

  it('blocks a live connection when its adapter disappears', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'granted', scopes: ['scan'] }));
    useDevicesStore.getState().syncEnvironment(READY_IOS);
    await useDevicesStore.getState().connect('apple_health');
    expect(useDevicesStore.getState().connections.apple_health.state).toBe('connected');

    useDevicesStore.getState().syncEnvironment({ ...READY_IOS, adapters: {} });
    const blocked = useDevicesStore.getState().connections.apple_health;
    expect(blocked.state).toBe('unavailable');
    expect(blocked.unavailableReason).toBe('adapter_missing');
  });
});

describe('connect', () => {
  beforeEach(() => {
    useDevicesStore.getState().syncEnvironment(READY_IOS);
  });

  it('records the granted scopes on success', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'granted', scopes: ['scan', 'context'] }));
    await useDevicesStore.getState().connect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('connected');
    expect(conn.grantedScopes).toEqual(['scan', 'context']);
  });

  it('keeps a partial grant connected, with only the scopes actually given', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'partial', scopes: ['scan'] }));
    await useDevicesStore.getState().connect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('connected');
    expect(conn.grantedScopes).toEqual(['scan']);
  });

  it('leaves a denial recoverable and grants nothing', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'denied' }));
    await useDevicesStore.getState().connect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('denied');
    expect(conn.grantedScopes).toEqual([]);
    expect(conn.errorMessage).toBeNull();
  });

  it('surfaces a failure message instead of a silent dead end', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'failed', message: '連線中斷' }));
    await useDevicesStore.getState().connect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('error');
    expect(conn.errorMessage).toBe('連線中斷');
  });

  it('refuses to request access for a blocked provider', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'granted', scopes: ['scan'] }));
    await useDevicesStore.getState().connect('health_connect');
    expect(useDevicesStore.getState().connections.health_connect.state).toBe('unavailable');
  });

  it('reports no adapter rather than pretending, on the default port', async () => {
    useDevicesStore.getState().setPort(createUnwiredLinkPort('ios'));
    useDevicesStore.getState().syncEnvironment({ ...READY_IOS });
    await useDevicesStore.getState().connect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('error');
    expect(conn.errorMessage).toContain('裝置連接模組');
  });
});

describe('disconnect', () => {
  it('clears the grant and the sync record', async () => {
    useDevicesStore.getState().setPort(fakePort({ kind: 'granted', scopes: ['scan'] }));
    useDevicesStore.getState().syncEnvironment(READY_IOS);
    await useDevicesStore.getState().connect('apple_health');
    useDevicesStore.getState().recordSync('apple_health', NOW, 'Apple Watch');

    await useDevicesStore.getState().disconnect('apple_health');

    const conn = useDevicesStore.getState().connections.apple_health;
    expect(conn.state).toBe('disconnected');
    expect(conn.grantedScopes).toEqual([]);
    expect(conn.lastSyncAt).toBeNull();
  });
});

describe('recordSync', () => {
  it('ignores a sync for a provider that is not connected', () => {
    useDevicesStore.getState().syncEnvironment(READY_IOS);
    useDevicesStore.getState().recordSync('apple_health', NOW, 'Apple Watch');
    expect(useDevicesStore.getState().connections.apple_health.lastSyncAt).toBeNull();
  });
});

describe('grantedScopesAcross', () => {
  it('unions the scopes of connected providers only', () => {
    const scopes = grantedScopesAcross({
      apple_health: connection({ grantedScopes: ['scan', 'context'] }),
      health_connect: connection({ state: 'denied', grantedScopes: ['history'] }),
      chest_strap: connection({ grantedScopes: ['scan'] }),
      garmin_connect: connection({ state: 'unavailable', grantedScopes: ['history'] }),
    });

    expect([...scopes].sort()).toEqual(['context', 'scan']);
  });
});

describe('sync status', () => {
  it('phrases ages the way the rest of the app does', () => {
    expect(formatRelativeAge(30_000)).toBe('剛剛');
    expect(formatRelativeAge(12 * 60_000)).toBe('12 分鐘前');
    expect(formatRelativeAge(3 * 60 * 60_000)).toBe('3 小時前');
    expect(formatRelativeAge(50 * 60 * 60_000)).toBe('2 天前');
    expect(formatRelativeAge(Number.NaN)).toBe('剛剛');
  });

  it('names the device that delivered the data', () => {
    expect(formatSyncStatus(connection({ lastSyncAt: NOW - 12 * 60_000 }), NOW)).toBe(
      'Apple Watch · 12 分鐘前',
    );
  });

  it('drops the device name when the platform did not report one', () => {
    expect(
      formatSyncStatus(connection({ lastSyncAt: NOW - 12 * 60_000, lastSyncDevice: null }), NOW),
    ).toBe('12 分鐘前');
  });

  it('says so plainly when nothing has ever arrived', () => {
    expect(formatSyncStatus(connection({ lastSyncAt: null }), NOW)).toBe('尚未同步');
  });

  it('treats clock skew as just now rather than a negative age', () => {
    expect(formatSyncStatus(connection({ lastSyncAt: NOW + 5_000 }), NOW)).toBe(
      'Apple Watch · 剛剛',
    );
  });

  it('marks a connection stale past the domain freshness window', () => {
    expect(isSyncStale(connection({ lastSyncAt: NOW - CONNECTION_STALE_MS }), NOW)).toBe(false);
    expect(isSyncStale(connection({ lastSyncAt: NOW - CONNECTION_STALE_MS - 1 }), NOW)).toBe(true);
    expect(isSyncStale(connection({ lastSyncAt: null }), NOW)).toBe(true);
  });
});
