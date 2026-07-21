/**
 * @module api/alert
 * @description Webhook ingestion endpoint for external alerts
 * (`POST /api/alert?ch=<channelId>`). TradingView posts the alert-message
 * JSON here; the payload is validated with the domain schema, normalized
 * into the canonical AlertContract, and queued on the device's private
 * channel. Only registered channels accept writes (SETNX-gated), so random
 * IDs cannot fill storage.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md §3–§4.
 * Setup guide: docs/TRADINGVIEW-SETUP.md.
 */

import { randomUUID } from 'node:crypto';
import { buildAlertContract } from '../domain/src/contracts/alert-contract';
import { validateAlertPayloadContract } from '../domain/src/schemas/alert-schema';
import { assembleAlertPayload, getChannelId } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { resolveVapidConfig, sendAlertPush } from './_lib/push';
import {
  channelExists,
  listPushSubscriptions,
  pushAlert,
  removePushSubscription,
  resolveUpstashConfig,
} from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST' });
    return;
  }

  const channelId = getChannelId(req);
  if (channelId === null) {
    res.status(400).json({ ok: false, error: 'missing or malformed ch parameter' });
    return;
  }

  const storage = resolveUpstashConfig();
  if (storage === null) {
    res.status(500).json({
      ok: false,
      error: 'storage not provisioned — connect Upstash Redis in the Vercel dashboard (see docs/TRADINGVIEW-SETUP.md)',
    });
    return;
  }

  const validation = validateAlertPayloadContract(assembleAlertPayload(req));
  if (!validation.success) {
    res.status(400).json({ ok: false, errors: validation.errors });
    return;
  }

  try {
    if (!(await channelExists(storage, channelId))) {
      res.status(404).json({ ok: false, error: 'channel not found or expired — generate a new link in TENKI' });
      return;
    }

    const alert = buildAlertContract(validation.value, {
      id: randomUUID(),
      source: 'tradingview',
      receivedAt: Date.now(),
    });

    await pushAlert(storage, channelId, alert);

    // Best-effort Web Push to the paired device — never fails the webhook.
    const vapid = resolveVapidConfig();
    if (vapid !== null) {
      try {
        const subscriptions = await listPushSubscriptions(storage, channelId);
        if (subscriptions.length > 0) {
          const dead = await sendAlertPush(vapid, subscriptions, alert);
          for (const endpoint of dead) {
            await removePushSubscription(storage, channelId, endpoint);
          }
        }
      } catch {
        // Push is a best-effort layer on top of the stored alert.
      }
    }

    res.status(200).json({ ok: true, id: alert.id });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'storage write failed' });
  }
}
