/**
 * @module features/devices/store
 * @description Zustand store for the Devices screen: one connection record per
 * provider, driven by the connection machine and the `DeviceLinkPort`.
 *
 * Privacy: this store holds connection state only — which providers are
 * linked, which scopes were granted, when data last arrived. No biometric
 * values pass through it, and nothing here leaves the device.
 */

import type { BiometricPermissionScope } from '@tenki/domain';
import { create } from 'zustand';
import { transition } from '../machine/deviceLinkMachine';
import { DEVICE_PROVIDERS, findProvider, resolveUnavailableReason } from '../providers';
import { createUnwiredLinkPort, type DeviceLinkPort } from '../port';
import type {
  DeviceConnection,
  DeviceEnvironment,
  DeviceProviderId,
} from '../types/devices.types';

type ConnectionMap = Record<DeviceProviderId, DeviceConnection>;

/** A provider starts unavailable: nothing is connectable until the environment says so. */
function createEmptyConnection(): DeviceConnection {
  return {
    state: 'unavailable',
    unavailableReason: 'adapter_missing',
    grantedScopes: [],
    lastSyncAt: null,
    lastSyncDevice: null,
    errorMessage: null,
  };
}

function createEmptyConnections(): ConnectionMap {
  const entries = DEVICE_PROVIDERS.map(
    (provider) => [provider.id, createEmptyConnection()] as const,
  );
  return Object.fromEntries(entries) as ConnectionMap;
}

export interface DevicesState {
  connections: ConnectionMap;
  /** The environment the connections were last reconciled against. */
  environment: DeviceEnvironment | null;
  port: DeviceLinkPort;

  /** Swaps in the real port once the native adapters exist. */
  setPort: (port: DeviceLinkPort) => void;
  /** Reconciles every row against the environment (OS, hub, adapters). */
  syncEnvironment: (environment?: DeviceEnvironment) => void;
  /** Runs one permission request through the port and the machine. */
  connect: (providerId: DeviceProviderId) => Promise<void>;
  /** Drops the link; the row returns to disconnected. */
  disconnect: (providerId: DeviceProviderId) => Promise<void>;
  /** Records that data arrived, for the freshness line. */
  recordSync: (providerId: DeviceProviderId, at: number, device?: string | null) => void;
  reset: () => void;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  connections: createEmptyConnections(),
  environment: null,
  port: createUnwiredLinkPort('ios'),

  setPort: (port) => set({ port }),

  syncEnvironment: (environment) => {
    const env = environment ?? get().port.describeEnvironment();

    set((state) => {
      const next = { ...state.connections };

      for (const provider of DEVICE_PROVIDERS) {
        const current = next[provider.id];
        const reason = resolveUnavailableReason(provider, env);

        if (reason) {
          next[provider.id] = {
            ...current,
            state: transition(current.state, 'BLOCK'),
            unavailableReason: reason,
          };
          continue;
        }

        next[provider.id] = {
          ...current,
          state: transition(current.state, 'UNBLOCK'),
          unavailableReason: null,
        };
      }

      return { connections: next, environment: env };
    });
  },

  connect: async (providerId) => {
    const provider = findProvider(providerId);
    if (!provider) return;

    const before = get().connections[providerId];
    const requesting = transition(before.state, 'REQUEST');
    if (requesting === before.state) return;

    set((state) => ({
      connections: {
        ...state.connections,
        [providerId]: { ...before, state: requesting, errorMessage: null },
      },
    }));

    const outcome = await get().port.requestAccess(providerId, provider.scopes);

    set((state) => {
      const current = state.connections[providerId];
      const patch: DeviceConnection = (() => {
        switch (outcome.kind) {
          case 'granted':
            return {
              ...current,
              state: transition(current.state, 'GRANTED'),
              grantedScopes: outcome.scopes,
              errorMessage: null,
            };
          case 'partial':
            return {
              ...current,
              state: transition(current.state, 'PARTIAL'),
              grantedScopes: outcome.scopes,
              errorMessage: null,
            };
          case 'denied':
            return {
              ...current,
              state: transition(current.state, 'DENIED'),
              grantedScopes: [],
              errorMessage: null,
            };
          case 'failed':
            return {
              ...current,
              state: transition(current.state, 'FAILED'),
              errorMessage: outcome.message,
            };
        }
      })();

      return { connections: { ...state.connections, [providerId]: patch } };
    });
  },

  disconnect: async (providerId) => {
    await get().port.disconnect(providerId);

    set((state) => {
      const current = state.connections[providerId];
      return {
        connections: {
          ...state.connections,
          [providerId]: {
            ...current,
            state: transition(current.state, 'DISCONNECT'),
            grantedScopes: [],
            lastSyncAt: null,
            lastSyncDevice: null,
            errorMessage: null,
          },
        },
      };
    });
  },

  recordSync: (providerId, at, device = null) =>
    set((state) => {
      const current = state.connections[providerId];
      // Only a live connection can have delivered data.
      if (current.state !== 'connected') return {};

      return {
        connections: {
          ...state.connections,
          [providerId]: { ...current, lastSyncAt: at, lastSyncDevice: device },
        },
      };
    }),

  reset: () => set({ connections: createEmptyConnections(), environment: null }),
}));

/** Scopes the user has actually granted across every connected provider. */
export function grantedScopesAcross(
  connections: ConnectionMap,
): readonly BiometricPermissionScope[] {
  const granted = new Set<BiometricPermissionScope>();

  for (const connection of Object.values(connections)) {
    if (connection.state !== 'connected') continue;
    for (const scope of connection.grantedScopes) granted.add(scope);
  }

  return [...granted];
}
