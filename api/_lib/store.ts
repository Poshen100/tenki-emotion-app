/**
 * @module api/_lib/store
 * @description Tiny fetch-based Upstash Redis REST client for the alert
 * queue. Deliberately dependency-free (no @upstash/redis package) — the
 * REST API is a plain HTTPS call. Alerts are small market-signal records
 * (symbol/price/condition only, never biometric data), capped at 50 with a
 * 24h TTL, in line with the cloud-minimal policy.
 */

import type { AlertContract } from '../../domain/src/contracts/alert-contract';

/** Redis key holding the recent-alert list (newest first). */
export const ALERTS_KEY = 'tenki:alerts:v1';

/** Maximum retained alerts. */
export const ALERTS_MAX = 50;

/** Queue TTL in seconds (refreshed on every push). */
export const ALERTS_TTL_SEC = 86_400;

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
 * Pushes an alert to the head of the queue, trims to ALERTS_MAX, and
 * refreshes the TTL.
 *
 * @param config - Upstash credentials.
 * @param alert - Canonical alert record.
 */
export async function pushAlert(config: UpstashConfig, alert: AlertContract): Promise<void> {
  await command(config, ['lpush', ALERTS_KEY, JSON.stringify(alert)]);
  await command(config, ['ltrim', ALERTS_KEY, '0', String(ALERTS_MAX - 1)]);
  await command(config, ['expire', ALERTS_KEY, String(ALERTS_TTL_SEC)]);
}

/**
 * Lists retained alerts, newest first. Malformed entries are skipped.
 *
 * @param config - Upstash credentials.
 * @returns Parsed alert records.
 */
export async function listAlerts(config: UpstashConfig): Promise<AlertContract[]> {
  const result = await command(config, ['lrange', ALERTS_KEY, '0', String(ALERTS_MAX - 1)]);
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
