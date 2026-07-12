/**
 * @module api/alerts
 * @description Device polling endpoint (`GET /api/alerts?ch=<channelId>&since=<ms>`).
 * Returns the channel's queued alerts newer than `since` (newest first) so
 * the client can feed them through the on-device delivery policy. The
 * server never decides surfacing — zone gating/cooldown/aggregation stay
 * client-side per docs/TRADINGVIEW-ALERT-SPEC.md §5. A successful poll
 * slides the channel's 30-day TTL forward.
 */

import type { AlertContract } from '../domain/src/contracts/alert-contract';
import { getChannelId, getQueryParam } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { channelExists, listAlerts, resolveUpstashConfig, touchChannel } from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method not allowed — use GET' });
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

  const sinceParam = getQueryParam(req, 'since');
  const since = sinceParam !== null ? Number(sinceParam) : 0;
  if (!Number.isFinite(since) || since < 0) {
    res.status(400).json({ ok: false, error: 'since must be a non-negative timestamp in ms' });
    return;
  }

  try {
    if (!(await channelExists(storage, channelId))) {
      res.status(404).json({ ok: false, error: 'channel not found or expired — generate a new link in TENKI' });
      return;
    }

    const alerts: AlertContract[] = await listAlerts(storage, channelId);
    await touchChannel(storage, channelId);

    res.status(200).json({
      ok: true,
      alerts: alerts.filter(alert => alert.receivedAt > since),
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'storage read failed' });
  }
}
