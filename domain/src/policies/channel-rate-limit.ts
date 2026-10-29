/**
 * @module domain/policies/channel-rate-limit
 * @description Creation cap for alert channels (`POST /api/channel`).
 *
 * 🔴 Why this exists: `api/channel.ts` registers channels with **no identity
 * check** — its own module doc says "registration is open … until the
 * Premium entitlement lands". Until 2026-10-29 that endpoint sat behind
 * Vercel Authentication, so the wall was incidentally doing the job nobody
 * had written. Taking the wall down (founder 2026-10-29, so the webhook URL
 * stops carrying a bypass secret) removes that cover, and this policy is
 * what replaces it.
 *
 * Pure functions — the counter itself lives in Upstash, read and written by
 * `api/_lib/store.ts`. Same idiom as `alert-policy`: state in, decision out.
 */

/** Length of one counting window, seconds. */
export const CHANNEL_CREATE_WINDOW_SEC = 3600;

/**
 * Channel creations allowed per client per window.
 *
 * 🔴 Set from the demand side, then checked against what it bounds —
 * **not picked as a round number** (CLAUDE.md: 只用理論值訂門檻，不算它實際
 * 會遇到的量):
 * - Real demand is **one creation per device, ever** — the id is kept in
 *   `localStorage` and reused. 「重設連結」 adds one each time it is pressed.
 * - Worst honest case is a founder debugging the TradingView hookup, pressing
 *   reset repeatedly: well under ten in an hour.
 * - What 20 bounds: 480 channels/day from one address. Each channel is a
 *   single Redis key with a 30-day sliding TTL, so that is the abuse ceiling
 *   per address, not per attacker.
 */
export const CHANNEL_CREATE_MAX_PER_WINDOW = 20;

/** Prefix for the per-client, per-window counter key. */
export const CHANNEL_RATE_KEY_PREFIX = 'tenki:chrate:v1:';

/**
 * Bucketed counter key for one client in the window containing `nowMs`.
 *
 * 🔴 **The window index is in the key on purpose.** The alternative —
 * one key per client plus `EXPIRE` — leaves the client locked out *forever*
 * if that `EXPIRE` call fails, because the counter never resets. Here a
 * failed `EXPIRE` only leaks a key that nothing reads again once the bucket
 * rolls. Trading "a stale key" for "a permanent lockout" is the whole point.
 *
 * ⚠️ Fixed window, not sliding: a client can spend its budget at the end of
 * one bucket and again at the start of the next, so the real short-term
 * ceiling is 2 × the cap. Stated rather than hidden — bounding abuse does not
 * need a sliding window, and a sliding one costs a second round trip.
 *
 * @param clientKey Caller identity (an address, or the shared unknown bucket).
 * @param nowMs Current time in epoch milliseconds.
 * @returns The Redis key holding this client's count for this window.
 */
export function channelRateKey(clientKey: string, nowMs: number): string {
  const bucket = Math.floor(nowMs / (CHANNEL_CREATE_WINDOW_SEC * 1000));
  return `${CHANNEL_RATE_KEY_PREFIX}${clientKey}:${bucket}`;
}

/**
 * Whether a creation that produced `count` may proceed.
 *
 * `count` is the value **after** incrementing, so the first creation in a
 * window arrives as 1 and the cap is inclusive.
 *
 * 🔴 A non-positive count means the counter could not be read, not that the
 * client is fresh. Letting that through would turn "I could not measure" into
 * "no limit" — the same conversion this repo has already paid for twice
 * (CLAUDE.md: 把「拒答」轉成一個數字). It is refused instead.
 *
 * @param count Counter value after the increment.
 * @returns True when the request is over the cap and must be refused.
 */
export function isOverChannelCreationCap(count: number): boolean {
  if (!Number.isFinite(count) || count < 1) return true;
  return count > CHANNEL_CREATE_MAX_PER_WINDOW;
}
