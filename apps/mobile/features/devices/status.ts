/**
 * @module features/devices/status
 * @description Turns a connection into the line the user reads under it —
 * "Apple Watch · 12 分鐘前".
 *
 * Freshness is not a new invention here: a connection counts as stale once its
 * last sync is older than the domain's freshness window for a context metric,
 * so the screen and the engine agree on what "current" means.
 */

import { METRIC_FRESHNESS_MS } from '@tenki/domain';
import { DEVICES_SCREEN_COPY } from './copy';
import type { DeviceConnection } from './types/devices.types';

/**
 * How old a sync may be before the row says so. Borrowed from the domain's
 * resting-heart-rate window (36h) — the cadence of the slowest context metric
 * a health hub feeds, and therefore the point past which a hub has genuinely
 * gone quiet rather than merely not updated yet.
 */
export const CONNECTION_STALE_MS = METRIC_FRESHNESS_MS.resting_heart_rate_bpm;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Formats an age as the relative phrase TENKI uses everywhere.
 *
 * @param ageMs - Age in ms; negative values (clock skew) read as just now.
 * @returns A Traditional Chinese relative-time phrase.
 */
export function formatRelativeAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < MINUTE_MS) return '剛剛';
  if (ageMs < HOUR_MS) return `${Math.floor(ageMs / MINUTE_MS)} 分鐘前`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)} 小時前`;
  return `${Math.floor(ageMs / DAY_MS)} 天前`;
}

/** Whether this connection's data has gone stale. Never synced counts as stale. */
export function isSyncStale(connection: DeviceConnection, now: number): boolean {
  if (connection.lastSyncAt === null) return true;
  return now - connection.lastSyncAt > CONNECTION_STALE_MS;
}

/**
 * Builds the status line under a provider row.
 *
 * A connection that has never delivered data says so plainly rather than
 * showing a reassuring timestamp it does not have.
 *
 * @param connection - The provider's connection record.
 * @param now - Current time (Unix ms).
 * @returns The line to render, device name included when known.
 */
export function formatSyncStatus(connection: DeviceConnection, now: number): string {
  if (connection.lastSyncAt === null) return DEVICES_SCREEN_COPY.neverSynced;

  const age = Math.max(0, now - connection.lastSyncAt);
  const relative = formatRelativeAge(age);

  return connection.lastSyncDevice ? `${connection.lastSyncDevice} · ${relative}` : relative;
}
