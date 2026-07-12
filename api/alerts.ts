/**
 * @module api/alerts
 * @description Device polling endpoint (`GET /api/alerts?token=***&since=<ms>`).
 * Returns queued alerts newer than `since` (newest first) so the client can
 * feed them through the on-device delivery policy. The server never decides
 * surfacing — zone gating/cooldown/aggregation stay client-side per
 * docs/TRADINGVIEW-ALERT-SPEC.md §5.
 */

import type { AlertContract } from '../domain/src/contracts/alert-contract';
import { getQueryParam, isAuthorized } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { listAlerts, resolveUpstashConfig } from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method not allowed — use GET' });
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

  const sinceParam = getQueryParam(req, 'since');
  const since = sinceParam !== null ? Number(sinceParam) : 0;
  if (!Number.isFinite(since) || since < 0) {
    res.status(400).json({ ok: false, error: 'since must be a non-negative timestamp in ms' });
    return;
  }

  let alerts: AlertContract[];
  try {
    alerts = await listAlerts(storage);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'storage read failed' });
    return;
  }

  res.status(200).json({
    ok: true,
    alerts: alerts.filter(alert => alert.receivedAt > since),
  });
}
