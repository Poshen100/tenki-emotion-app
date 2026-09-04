/**
 * @module features/devices/rowPresentation
 * @description Decides what each provider row says, so the screen only renders.
 *
 * Every row keeps its description — including a blocked one. A user looking at
 * a greyed-out 「Apple 健康」 still needs to know what connecting it would give
 * them; hiding that behind the blocking reason turns a roadmap into a dead end.
 *
 * Three slots, in reading order:
 *   title      — the provider name
 *   primary    — what it gives you, or (once connected) how fresh its data is
 *   state      — only when there is something state-specific to say
 */

import { DEVICES_SCREEN_COPY, UNAVAILABLE_COPY } from './copy';
import { primaryAction, type DeviceLinkEvent } from './machine/deviceLinkMachine';
import { formatSyncStatus, isSyncStale } from './status';
import type { DeviceConnection, DeviceProvider } from './types/devices.types';

/** Everything a provider row needs to render. */
export interface RowPresentation {
  title: string;
  /** What the provider offers, or its sync freshness once connected. */
  primaryLine: string;
  /** Blocking reason, permission outcome or error — null when there is none. */
  stateLine: string | null;
  /** True when `primaryLine` is a sync time that has gone stale. */
  primaryIsStale: boolean;
  /** The row's single action, or null when it is not actionable. */
  action: DeviceLinkEvent | null;
  actionLabel: string | null;
  /** Scopes to show as chips; empty unless connected. */
  scopes: readonly string[];
  /** True while the row is blocked by the environment. */
  blocked: boolean;
}

const ACTION_LABELS: Partial<Record<DeviceLinkEvent, string>> = {
  REQUEST: DEVICES_SCREEN_COPY.connectAction,
  RETRY: DEVICES_SCREEN_COPY.retryAction,
  DISCONNECT: DEVICES_SCREEN_COPY.disconnectAction,
};

/**
 * Builds the row's copy from the provider and its connection.
 *
 * @param provider - Catalogue entry.
 * @param connection - Current connection record.
 * @param now - Current time (Unix ms), for the freshness line.
 * @returns Everything the row renders.
 */
export function describeRow(
  provider: DeviceProvider,
  connection: DeviceConnection,
  now: number,
): RowPresentation {
  const blocked = connection.state === 'unavailable';
  const connected = connection.state === 'connected';
  const action = primaryAction(connection.state);

  const stateLine = (() => {
    if (blocked) {
      return connection.unavailableReason ? UNAVAILABLE_COPY[connection.unavailableReason] : null;
    }
    if (connection.state === 'requesting') return '等待授權…';
    if (connection.state === 'denied') return '未授權，相機掃描仍可完整使用';
    if (connection.state === 'error') return connection.errorMessage ?? '連接失敗';
    return null;
  })();

  return {
    title: provider.label,
    primaryLine: connected ? formatSyncStatus(connection, now) : provider.description,
    stateLine,
    primaryIsStale: connected && isSyncStale(connection, now),
    action,
    actionLabel: action ? (ACTION_LABELS[action] ?? null) : null,
    scopes: connected ? connection.grantedScopes : [],
    blocked,
  };
}
