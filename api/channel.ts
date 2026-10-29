/**
 * @module api/channel
 * @description Channel registration endpoint (`POST /api/channel`). The
 * device calls this once to obtain its private webhook URL — the returned
 * unguessable channel ID is the credential (capability URL), so no token
 * ever has to be typed. Channels expire after 30 days of inactivity.
 *
 * Entitlement hook: when the account/billing layer lands, this endpoint is
 * where the Premium (`externalAlertBridge`) check plugs in — see
 * docs/TRADINGVIEW-ALERT-SPEC.md §11. Until then registration is open to
 * anyone; abuse is bounded by SETNX-gated writes, per-channel caps/TTLs, and
 * the per-client creation cap in `domain/policies/channel-rate-limit`.
 *
 * 🔴 That creation cap is load-bearing as of 2026-10-29. Before then this
 * endpoint sat behind Vercel Authentication, so the wall was incidentally
 * doing the job nobody had written. The wall came down (founder's call) so the
 * webhook URL would stop carrying a bypass secret — which means **this file is
 * now the only thing standing in front of an open registration endpoint.**
 */

import { ALERT_PAYLOAD_MAX_STRING_LENGTH } from '../domain/src/contracts/alert-contract';
import { isOverChannelCreationCap } from '../domain/src/policies/channel-rate-limit';
import {
  PROTECTION_BYPASS_QUERY_KEY,
  getChannelId,
  getClientKey,
  getProtectionBypassSecret,
  getRequestHost,
  readJsonBody,
} from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import {
  channelExists,
  countChannelCreation,
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
  // webhook URL without re-pairing.
  //
  // 🔴 This used to say the endpoint was "reachable only through the SSO wall".
  // That stopped being true on 2026-10-29 when the wall came down, and the
  // sentence would have quietly become a false claim about a secret-serving
  // endpoint. It is safe **for the configuration it now runs in**: with
  // protection off there is no bypass secret provisioned, so this returns
  // `null`. If a secret is ever provisioned again while the deployment is
  // public, this branch hands it to anyone who asks — re-gate it then.
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

  // 🔴 Count before registering — see countChannelCreation.
  const clientKey = getClientKey(req);
  try {
    const attempts = await countChannelCreation(storage, clientKey, Date.now());
    if (isOverChannelCreationCap(attempts)) {
      res.status(429).json({
        ok: false,
        error: 'too many links generated from this network — try again in an hour',
      });
      return;
    }
  } catch (error) {
    // 🔴 The counter is the only thing in front of an open endpoint, so a
    // counter that cannot be reached is a closed door, not an open one.
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'rate limiter unavailable',
    });
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
