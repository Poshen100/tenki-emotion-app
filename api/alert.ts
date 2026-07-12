/**
 * @module api/alert
 * @description Webhook ingestion endpoint for external alerts
 * (`POST /api/alert?token=***`). TradingView posts the alert-message JSON
 * here; the payload is validated with the domain schema, normalized into
 * the canonical AlertContract, and queued for device polling.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md §3–§4.
 * Setup guide: docs/TRADINGVIEW-SETUP.md.
 */

import { randomUUID } from 'node:crypto';
import { buildAlertContract } from '../domain/src/contracts/alert-contract';
import { validateAlertPayloadContract } from '../domain/src/schemas/alert-schema';
import { isAuthorized, readJsonBody } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { pushAlert, resolveUpstashConfig } from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'missing or invalid token' });
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

  const body = readJsonBody(req);
  if (!body.ok) {
    res.status(400).json({ ok: false, error: body.error });
    return;
  }

  const validation = validateAlertPayloadContract(body.value);
  if (!validation.success) {
    res.status(400).json({ ok: false, errors: validation.errors });
    return;
  }

  const alert = buildAlertContract(validation.value, {
    id: randomUUID(),
    source: 'tradingview',
    receivedAt: Date.now(),
  });

  try {
    await pushAlert(storage, alert);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'storage write failed' });
    return;
  }

  res.status(200).json({ ok: true, id: alert.id });
}
