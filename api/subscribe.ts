/**
 * @module api/subscribe
 * @description Web Push subscription endpoint
 * (`POST /api/subscribe?ch=<channelId>` to register a browser PushSubscription,
 * `DELETE` to remove one). Subscriptions are stored per channel so a new alert
 * on that channel can be pushed to the paired device even when the TENKI page
 * is closed (iOS 16.4+ home-screen web app). Only registered channels accept
 * writes. Raw biometric data is never involved — a subscription is just the
 * browser's push endpoint + keys.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md §12 (Phase D).
 */

import { getChannelId, readJsonBody } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import {
  channelExists,
  removePushSubscription,
  resolveUpstashConfig,
  savePushSubscription,
} from './_lib/store';
import type { StoredPushSubscription } from './_lib/store';

function parseSubscription(value: unknown): StoredPushSubscription | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const endpoint = candidate.endpoint;
  const keys = candidate.keys as Record<string, unknown> | undefined;
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    keys === undefined ||
    typeof keys.p256dh !== 'string' ||
    typeof keys.auth !== 'string'
  ) {
    return null;
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'POST' && method !== 'DELETE') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST or DELETE' });
    return;
  }

  const channelId = getChannelId(req);
  if (channelId === null) {
    res.status(400).json({ ok: false, error: 'missing or malformed ch parameter' });
    return;
  }

  const storage = resolveUpstashConfig();
  if (storage === null) {
    res.status(500).json({ ok: false, error: 'storage not provisioned' });
    return;
  }

  const body = readJsonBody(req);
  if (!body.ok) {
    res.status(400).json({ ok: false, error: body.error });
    return;
  }

  try {
    if (!(await channelExists(storage, channelId))) {
      res.status(404).json({ ok: false, error: 'channel not found or expired' });
      return;
    }

    if (method === 'DELETE') {
      const endpoint = (body.value as Record<string, unknown>).endpoint;
      if (typeof endpoint !== 'string') {
        res.status(400).json({ ok: false, error: 'missing endpoint' });
        return;
      }
      await removePushSubscription(storage, channelId, endpoint);
      res.status(200).json({ ok: true });
      return;
    }

    const subscription = parseSubscription(body.value);
    if (subscription === null) {
      res.status(400).json({ ok: false, error: 'invalid push subscription' });
      return;
    }
    await savePushSubscription(storage, channelId, subscription);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'storage write failed' });
  }
}
