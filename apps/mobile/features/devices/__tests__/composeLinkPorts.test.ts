import { composeLinkPorts } from '../adapters/composeLinkPorts';
import type { DeviceLinkOutcome, DeviceLinkPort } from '../port';
import type { DeviceEnvironment } from '../types/devices.types';

function stubPort(
  env: Partial<DeviceEnvironment>,
  outcome: DeviceLinkOutcome = { kind: 'denied' },
  calls: string[] = [],
): DeviceLinkPort {
  return {
    describeEnvironment: async () => ({
      os: 'android',
      adapters: {},
      healthConnectInstalled: false,
      ...env,
    }),
    requestAccess: async (providerId) => {
      calls.push(`request:${providerId}`);
      return outcome;
    },
    disconnect: async (providerId) => {
      calls.push(`disconnect:${providerId}`);
    },
  };
}

describe('composeLinkPorts', () => {
  it('merges the adapters every port reports', async () => {
    const composed = composeLinkPorts('android', {
      health_connect: stubPort({ adapters: { health_connect: true } }),
      chest_strap: stubPort({ adapters: { chest_strap: true } }),
    });

    const env = await composed.describeEnvironment();
    expect(env.adapters).toEqual({ health_connect: true, chest_strap: true });
    expect(env.os).toBe('android');
  });

  it('takes the hub as installed when any port can see it', async () => {
    const composed = composeLinkPorts('android', {
      health_connect: stubPort({ healthConnectInstalled: true }),
      chest_strap: stubPort({ healthConnectInstalled: false }),
    });

    expect((await composed.describeEnvironment()).healthConnectInstalled).toBe(true);
  });

  it('reports no adapters when it has no ports at all', async () => {
    const env = await composeLinkPorts('android', {}).describeEnvironment();
    expect(env).toEqual({ os: 'android', adapters: {}, healthConnectInstalled: false });
  });

  it('routes a request to the port that owns that provider', async () => {
    const calls: string[] = [];
    const composed = composeLinkPorts('android', {
      health_connect: stubPort({}, { kind: 'granted', scopes: ['scan'] }, calls),
      chest_strap: stubPort({}, { kind: 'denied' }, calls),
    });

    expect(await composed.requestAccess('health_connect', ['scan'])).toEqual({
      kind: 'granted',
      scopes: ['scan'],
    });
    expect(await composed.requestAccess('chest_strap', ['scan'])).toEqual({ kind: 'denied' });
    expect(calls).toEqual(['request:health_connect', 'request:chest_strap']);
  });

  it('says there is no adapter for a provider nobody owns', async () => {
    const composed = composeLinkPorts('android', {
      health_connect: stubPort({}),
    });

    const outcome = await composed.requestAccess('garmin_connect', ['context']);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') expect(outcome.message).toContain('裝置連接模組');
  });

  it('routes disconnect, and stays quiet for a provider it does not own', async () => {
    const calls: string[] = [];
    const composed = composeLinkPorts('android', { chest_strap: stubPort({}, undefined, calls) });

    await composed.disconnect('chest_strap');
    await expect(composed.disconnect('apple_health')).resolves.toBeUndefined();
    expect(calls).toEqual(['disconnect:chest_strap']);
  });
});
