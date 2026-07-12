/**
 * @module api/channel
 * @description Channel registration endpoint (`POST /api/channel`). The
 * device calls this once to obtain its private webhook URL — the returned
 * unguessable channel ID is the credential (capability URL), so no token
 * ever has to be typed. Channels expire after 30 days of inactivity.
 *
 * Entitlement hook: when the account/billing layer lands, this endpoint is
 * where the Premium (`externalAlertBridge`) check plugs in — see
 * docs/TRADINGVIEW-ALERT-SPEC.md §11. Until then registration is open and
 * abuse is bounded by SETNX-gated writes plus per-channel caps/TTLs.
 */

import { getRequestHost } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { registerChannel, resolveUpstashConfig } from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST' });
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

  let channelId: string;
  try {
    channelId = await registerChannel(storage);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'channel registration failed' });
    return;
  }

  const host = getRequestHost(req);
  res.status(200).json({
    ok: true,
    channelId,
    webhookUrl: host !== null ? `https://${host}/api/alert?ch=${channelId}` : null,
  });
}
