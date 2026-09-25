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

import { ALERT_PAYLOAD_MAX_STRING_LENGTH } from '../domain/src/contracts/alert-contract';
import {
  PROTECTION_BYPASS_QUERY_KEY,
  getChannelId,
  getProtectionBypassSecret,
  getRequestHost,
  readJsonBody,
} from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import {
  channelExists,
  registerChannel,
  resolveUpstashConfig,
  setChannelSymbol,
} from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  // `GET /api/channel` exposes only the deployment's Protection Bypass query
  // suffix, so the page can bake it into an already-registered channel's
  // webhook URL without re-pairing. Reachable only through the SSO wall that
  // makes the suffix necessary in the first place — an anonymous caller is
  // bounced at the edge exactly like the webhook it is meant to unblock.
  if (req.method === 'GET') {
    const secret = getProtectionBypassSecret();
    res.status(200).json({
      ok: true,
      bypassQuery: secret === null ? null : `${PROTECTION_BYPASS_QUERY_KEY}=${encodeURIComponent(secret)}`,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST or GET' });
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

  // `POST /api/channel?ch=<ch>` with `{ symbol }` binds a default symbol to an
  // existing channel — a bare webhook URL then inherits it server-side instead
  // of 400-ing on a missing symbol. Without `ch`, this registers a new channel.
  const channelId = getChannelId(req);
  if (channelId !== null) {
    const parsed = readJsonBody(req);
    const raw =
      parsed.ok && parsed.value !== null && typeof parsed.value === 'object'
        ? (parsed.value as { symbol?: unknown }).symbol
        : undefined;
    const symbol = typeof raw === 'string' ? raw.trim() : '';
    if (symbol.length === 0 || symbol.length > ALERT_PAYLOAD_MAX_STRING_LENGTH) {
      res.status(400).json({ ok: false, error: 'symbol must be a non-empty string' });
      return;
    }
    try {
      if (!(await channelExists(storage, channelId))) {
        res.status(404).json({ ok: false, error: 'channel not found or expired — generate a new link in TENKI' });
        return;
      }
      await setChannelSymbol(storage, channelId, symbol);
      res.status(200).json({ ok: true, channelId, symbol });
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'symbol bind failed' });
    }
    return;
  }

  let newChannelId: string;
  try {
    newChannelId = await registerChannel(storage);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'channel registration failed' });
    return;
  }

  const host = getRequestHost(req);
  const secret = getProtectionBypassSecret();
  const bypassQuery =
    secret === null ? null : `${PROTECTION_BYPASS_QUERY_KEY}=${encodeURIComponent(secret)}`;
  const baseUrl = host !== null ? `https://${host}/api/alert?ch=${newChannelId}` : null;
  res.status(200).json({
    ok: true,
    channelId: newChannelId,
    bypassQuery,
    webhookUrl: baseUrl !== null && bypassQuery !== null ? `${baseUrl}&${bypassQuery}` : baseUrl,
  });
}
