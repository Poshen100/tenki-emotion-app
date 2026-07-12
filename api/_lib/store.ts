/**
 * @module api/_lib/store
 * @description Tiny fetch-based Upstash Redis REST client for per-channel
 * alert queues. Deliberately dependency-free (no @upstash/redis package) —
 * the REST API is a plain HTTPS call. Alerts are small market-signal records
 * (symbol/price/condition only, never biometric data), capped at 50 per
 * channel with a 24h TTL, in line with the cloud-minimal policy. Channels
 * are unguessable server-generated IDs claimed via SETNX with a sliding
 * 30-day TTL.
 */

import { randomUUID } from 'node:crypto';
import type { AlertContract } from '../../domain/src/contracts/alert-contract';

/** Prefix for per-channel alert lists (newest first). */
export const ALERTS_KEY_PREFIX = 'tenki:alerts:v1:';

/** Prefix for registered-channel marker keys. */
export const CHANNEL_KEY_PREFIX = 'tenki:ch:';

/** Maximum retained alerts per channel. */
export const ALERTS_MAX = 50;

/** Alert queue TTL in seconds (refreshed on every push). */
export const ALERTS_TTL_SEC = 86_400;

/** Channel TTL in seconds (30 days, sliding — refreshed on poll). */
export const CHANNEL_TTL_SEC = 2_592_000;

interface UpstashConfig {
  url: string;
  token: string;
}

/**
 * Resolves Upstash REST credentials from the environment. Supports both
 * the Upstash marketplace naming and the Vercel KV naming.
 *
 * @returns Config, or null when storage is not provisioned.
 */
export function resolveUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url === undefined || url.length === 0 || token === undefined || token.length === 0) {
    return null;
  }
  return { url, token };
}

async function command(config: UpstashConfig, parts: string[]): Promise<unknown> {
  const path = parts.map(encodeURIComponent).join('/');
  const response = await fetch(`${config.url}/${path}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!response.ok) {
    throw new Error(`storage command failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error !== undefined) {
    throw new Error(`storage error: ${payload.error}`);
  }
  return payload.result;
}

/**
 * Registers a fresh channel: generates an unguessable ID server-side and
 * claims it with SETNX (one collision retry) + 30-day TTL.
 *
 * @param config - Upstash credentials.
 * @returns The new channel ID.
 */
export async function registerChannel(config: UpstashConfig): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const channelId = (randomUUID() + randomUUID()).replace(/-/g, '');
    const claimed = await command(config, ['setnx', CHANNEL_KEY_PREFIX + channelId, String(Date.now())]);
    if (claimed === 1) {
      await command(config, ['expire', CHANNEL_KEY_PREFIX + channelId, String(CHANNEL_TTL_SEC)]);
      return channelId;
    }
  }
  throw new Error('channel id collision — retry');
}

/**
 * Checks whether a channel is registered and unexpired.
 *
 * @param config - Upstash credentials.
 * @param channelId - Format-validated channel ID.
 * @returns True when the channel exists.
 */
export async function channelExists(config: UpstashConfig, channelId: string): Promise<boolean> {
  return (await command(config, ['exists', CHANNEL_KEY_PREFIX + channelId])) === 1;
}

/**
 * Slides the channel TTL forward (an actively polling channel never expires).
 *
 * @param config - Upstash credentials.
 * @param channelId - Registered channel ID.
 */
export async function touchChannel(config: UpstashConfig, channelId: string): Promise<void> {
  await command(config, ['expire', CHANNEL_KEY_PREFIX + channelId, String(CHANNEL_TTL_SEC)]);
}

/**
 * Pushes an alert to the head of the channel's queue, trims to ALERTS_MAX,
 * and refreshes the queue TTL.
 *
 * @param config - Upstash credentials.
 * @param channelId - Registered channel ID.
 * @param alert - Canonical alert record.
 */
export async function pushAlert(
  config: UpstashConfig,
  channelId: string,
  alert: AlertContract,
): Promise<void> {
  const key = ALERTS_KEY_PREFIX + channelId;
  await command(config, ['lpush', key, JSON.stringify(alert)]);
  await command(config, ['ltrim', key, '0', String(ALERTS_MAX - 1)]);
  await command(config, ['expire', key, String(ALERTS_TTL_SEC)]);
}

/**
 * Lists the channel's retained alerts, newest first. Malformed entries are
 * skipped.
 *
 * @param config - Upstash credentials.
 * @param channelId - Registered channel ID.
 * @returns Parsed alert records.
 */
export async function listAlerts(
  config: UpstashConfig,
  channelId: string,
): Promise<AlertContract[]> {
  const result = await command(config, [
    'lrange',
    ALERTS_KEY_PREFIX + channelId,
    '0',
    String(ALERTS_MAX - 1),
  ]);
  if (!Array.isArray(result)) {
    return [];
  }

  const alerts: AlertContract[] = [];
  for (const entry of result) {
    if (typeof entry !== 'string') {
      continue;
    }
    try {
      alerts.push(JSON.parse(entry) as AlertContract);
    } catch {
      // Skip malformed entries rather than failing the whole read.
    }
  }
  return alerts;
}
