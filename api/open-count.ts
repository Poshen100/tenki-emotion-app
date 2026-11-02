/**
 * @module api/open-count
 * @description Device report endpoint (`POST /api/open-count?ch=<channelId>`
 * with `{ openCount }`). The device tells the server **one integer** — how
 * many of today's decision records still await a result — so the close-of-day
 * reminder (docs/DECISION-RECORD-LOOP.md §4 L2) is a fact rather than a guess.
 *
 * 🔴 **This is the only thing about decisions that ever leaves the device.**
 * No symbol, no judgement, no result, no timestamps of the records themselves.
 * The records live in `localStorage` and stay there (local-first). Founder's
 * call, 2026-10-30, taken because §4 principle 1 ("only remind when it KNOWS
 * something is unrecorded — zero guessing") is impossible for a server that
 * has never seen a record.
 *
 * 🔴 A channel that stops reporting simply stops being eligible: the stored
 * report expires, and the policy refuses to push on a stale number. Going
 * quiet is the designed failure mode, not an outage.
 */

import { getChannelId, readJsonBody } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { channelExists, resolveUpstashConfig, saveOpenCount } from './_lib/store';

/**
 * Upper bound on a single report.
 *
 * 🔴 Not a round number: the store caps a channel at 200 records
 * (`OUTCOME_STORE_KEY_V6` slices to the last 200), so no honest device can
 * report more than that. Anything above it is a malformed or hostile body,
 * and clamping it silently would turn "this is wrong" into "this is 200".
 */
export const OPEN_COUNT_MAX = 200;

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if ((req.method ?? 'GET') !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST' });
    return;
  }

  const channelId = getChannelId(req);
  if (channelId === null) {
    res.status(400).json({ ok: false, error: 'missing or malformed ch parameter' });
    return;
  }

  const parsed = readJsonBody(req);
  const raw =
    parsed.ok && parsed.value !== null && typeof parsed.value === 'object'
      ? (parsed.value as { openCount?: unknown }).openCount
      : undefined;
  // 🔴 Reject, do not coerce. `Number(undefined)` is NaN and `Number(null)` is
  // 0 — the second one would quietly record "nothing left to fill" for a
  // malformed body, which is exactly the fact the reminder acts on.
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > OPEN_COUNT_MAX) {
    res.status(400).json({
      ok: false,
      error: `openCount must be an integer between 0 and ${OPEN_COUNT_MAX}`,
    });
    return;
  }

  const storage = resolveUpstashConfig();
  if (storage === null) {
    res.status(500).json({ ok: false, error: 'storage not provisioned' });
    return;
  }

  try {
    // 🔴 Only registered channels accept writes — same gate as /api/subscribe.
    // Without it this endpoint mints storage for any id anyone invents.
    if (!(await channelExists(storage, channelId))) {
      res.status(404).json({ ok: false, error: 'channel not found or expired' });
      return;
    }
    await saveOpenCount(storage, channelId, raw, Date.now());
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'report failed',
    });
  }
}
