/**
 * @module api/digest
 * @description The close-of-day reminder's scheduler endpoint
 * (`GET /api/digest`, called by Vercel Cron). For every channel that has a
 * fresh device report, it asks the domain policy whether to remind, and sends
 * at most one push per channel per trading day.
 * Canonical behavior spec: `docs/DECISION-RECORD-LOOP.md` §4 L2.
 *
 * 🔴 **This endpoint decides nothing.** Every judgement lives in
 * `domain/src/policies/digest-push.ts` (`digestDecision`, `nextSilentStreak`,
 * the copy and the tag). What lives here is plumbing: auth, iteration,
 * delivery, bookkeeping. The reason is that the judgements are the part with
 * tests and the part a reader has to trust; a second copy inside the handler
 * would be the one that drifts.
 *
 * 🔴 **The schedule lives in `vercel.json`, which cannot hold a comment, so
 * the reasoning lives here**: `0 1 * * *` (UTC) is ET 20:00 in EST and ET
 * 21:00 in EDT — after the close in both, and still the **same ET trading
 * day**, which is what `digestDecision` compares the device's report against.
 * Measured for four dates across both DST seasons, not reasoned about.
 * It is also 09:00 in UTC+8, where the founder is: the obvious choice,
 * UTC 21:05 (ET 16:05/17:05), lands at 05:05 local — a push in the middle of
 * the night about a session that ended an hour earlier.
 * ⚠️ If the user is ever somewhere else, this one line is the knob; the
 * constraint it must keep is `16 ≤ etHour < 24` at fire time.
 *
 * 🔴 **It never answers with a channel ID.** A channel ID is the credential
 * (capability URL) — a summary that listed them would turn the cron's own
 * response, and any log that captures it, into a key ring. Counts only.
 */

import { timingSafeEqual } from 'node:crypto';
import { resolveTradingDayKey } from '../domain/src/policies/day-cadence';
import type { DigestSkipReason } from '../domain/src/policies/digest-push';
import {
  digestDecision,
  isAfterTradingClose,
  nextSilentStreak,
} from '../domain/src/policies/digest-push';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { buildDigestPushPayload, resolveVapidConfig, sendPushPayload } from './_lib/push';
import {
  listPushSubscriptions,
  loadDigestRecord,
  removePushSubscription,
  resolveUpstashConfig,
  saveDigestSent,
  scanReportingChannels,
} from './_lib/store';

/**
 * Upper bound on SCAN pages in one run.
 *
 * 🔴 A bound, not a page size — `scanReportingChannels` keeps going until the
 * cursor is `'0'`, and this only stops a cursor that never converges from
 * spinning a serverless function until it is killed. Hitting it is reported
 * (`truncated`), never swallowed: a silently half-finished run looks exactly
 * like a finished one.
 */
export const SCAN_PAGE_MAX = 50;

/** What happened for one channel. The policy's reasons, plus delivery facts. */
export type DigestOutcome =
  | DigestSkipReason
  | 'sent'
  | 'no_subscription'
  | 'push_failed'
  | 'channel_error';

/**
 * Whether this request carries the cron secret.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the project has
 * `CRON_SECRET` set. Without that, the endpoint is a button anyone can press.
 *
 * 🔴 **No secret configured ⇒ not authorized.** The tempting shape is
 * "unset = skip the check", and it is how an endpoint ends up open in
 * production: the first deploy that forgets the env var is also the one where
 * nothing complains.
 *
 * @param header - The request's Authorization header, if any.
 * @param secret - The configured secret, or null when unset.
 * @returns True only when a configured secret matches exactly.
 */
export function isAuthorizedCron(header: string | undefined, secret: string | null): boolean {
  if (secret === null || secret.length === 0) return false;
  if (typeof header !== 'string') return false;
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const given = Buffer.from(header.slice(prefix.length));
  const want = Buffer.from(secret);
  // Length is compared first because timingSafeEqual throws on a mismatch;
  // that leaks the secret's length and nothing else.
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

function resolveCronSecret(): string | null {
  const secret = process.env.CRON_SECRET;
  return typeof secret === 'string' && secret.trim().length > 0 ? secret.trim() : null;
}

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if ((req.method ?? 'GET') !== 'GET') {
    res.status(405).json({ ok: false, error: 'method not allowed — cron calls GET' });
    return;
  }

  const secret = resolveCronSecret();
  if (secret === null) {
    res.status(503).json({ ok: false, error: 'CRON_SECRET not provisioned' });
    return;
  }
  const authHeader = req.headers?.authorization;
  if (!isAuthorizedCron(Array.isArray(authHeader) ? authHeader[0] : authHeader, secret)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const nowMs = Date.now();
  // The same gate the per-channel policy applies, called once so a manual hit
  // during the session costs one function call instead of a full scan. It is
  // the *same function*, not a second copy of the rule.
  if (!isAfterTradingClose(nowMs)) {
    res.status(200).json({ ok: true, reason: 'before_close', channels: 0 });
    return;
  }

  const storage = resolveUpstashConfig();
  if (storage === null) {
    res.status(500).json({ ok: false, error: 'storage not provisioned' });
    return;
  }
  const vapid = resolveVapidConfig();
  if (vapid === null) {
    // 🔴 Loudly, not quietly: with no VAPID keys this run cannot remind
    // anybody, and a 200 would make a broken deployment look healthy forever.
    res.status(503).json({ ok: false, error: 'web push not configured' });
    return;
  }

  const dayKey = resolveTradingDayKey(nowMs);
  const outcomes: Partial<Record<DigestOutcome, number>> = {};
  const tally = (outcome: DigestOutcome): void => {
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  };

  let channels = 0;
  let cursor = '0';
  let pages = 0;
  let truncated = false;

  try {
    do {
      const page = await scanReportingChannels(storage, cursor);
      cursor = page.cursor;
      pages += 1;
      for (const channelId of page.channelIds) {
        channels += 1;
        try {
          tally(await processChannel(storage, vapid, channelId, dayKey, nowMs));
        } catch (channelError) {
          // One unreachable channel must not cost every other channel its
          // reminder — the loop is the only thing standing between them.
          console.error(
            `[digest] ch=${channelId.slice(0, 8)} failed:`,
            channelError instanceof Error ? channelError.message : channelError,
          );
          tally('channel_error');
        }
      }
      if (cursor !== '0' && pages >= SCAN_PAGE_MAX) {
        truncated = true;
        break;
      }
    } while (cursor !== '0');
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'scan failed',
      channels,
      outcomes,
    });
    return;
  }

  console.log(`[digest] day=${dayKey} channels=${channels} ${JSON.stringify(outcomes)}`);
  res.status(200).json({ ok: true, dayKey, channels, outcomes, truncated });
}

type Storage = NonNullable<ReturnType<typeof resolveUpstashConfig>>;
type Vapid = NonNullable<ReturnType<typeof resolveVapidConfig>>;

/**
 * Runs one channel through the policy and, if it says so, delivers the push.
 *
 * @param storage - Upstash connection.
 * @param vapid - VAPID credentials.
 * @param channelId - Channel to consider.
 * @param dayKey - Today's ET trading day key.
 * @param nowMs - Instant of this run.
 * @returns What happened for this channel.
 */
async function processChannel(
  storage: Storage,
  vapid: Vapid,
  channelId: string,
  dayKey: string,
  nowMs: number,
): Promise<DigestOutcome> {
  const state = await loadDigestRecord(storage, channelId);
  const decision = digestDecision(state, nowMs);
  if (!decision.send) {
    return decision.reason ?? 'channel_error';
  }
  const count = decision.count ?? 0;

  const subscriptions = await listPushSubscriptions(storage, channelId);
  if (subscriptions.length === 0) {
    // 🔴 Not recorded as sent. Nobody was reminded, so "already sent today"
    // must stay false — otherwise a channel with no device would burn its one
    // daily slot and grow a silent streak for a reminder that never existed.
    return 'no_subscription';
  }

  const { sent, dead } = await sendPushPayload(vapid, subscriptions, buildDigestPushPayload(count));
  for (const endpoint of dead) {
    await removePushSubscription(storage, channelId, endpoint);
  }
  if (sent === 0) {
    return 'push_failed';
  }

  await saveDigestSent(
    storage,
    channelId,
    dayKey,
    count,
    nextSilentStreak(state.silentStreak, state.lastSentCount, count),
  );
  return 'sent';
}
