/**
 * @module domain/policies/waitlist
 * @description Rules for the early-access list (`POST /api/waitlist`).
 *
 * An email address is the one piece of personal data this product asks a
 * visitor to hand over, so the rules are kept narrow on purpose:
 * - it is stored **alone** — no channel id, no reading, no address of the
 *   caller next to it;
 * - it is only ever written because the visitor typed it and pressed the
 *   button on the landing page.
 *
 * Pure functions — the list itself lives in Upstash (`api/_lib/store.ts`).
 */

/** Longest address accepted (RFC 5321 path limit). */
export const WAITLIST_EMAIL_MAX_LENGTH = 254;

/** Hash holding the list: field = address, value = first-seen epoch ms. */
export const WAITLIST_KEY = 'tenki:waitlist:v1';

/** Length of one counting window, seconds. */
export const WAITLIST_WINDOW_SEC = 3600;

/**
 * Sign-ups allowed per client per window.
 *
 * Demand side: one visitor signs up once; a household or office behind one
 * address is a handful. What 10 bounds: 240 writes/day from one address, each
 * a single hash field.
 */
export const WAITLIST_MAX_PER_WINDOW = 10;

/** Prefix for the per-client, per-window counter key. */
export const WAITLIST_RATE_KEY_PREFIX = 'tenki:wlrate:v1:';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalises a submitted address, or refuses it.
 *
 * Shape check only (`something@something.tld`, no whitespace). It does not
 * prove the mailbox exists — nothing short of sending mail does — it only
 * keeps obviously broken input out of the list.
 *
 * @param raw Value from the request body.
 * @returns Trimmed, lower-cased address, or null when it is not usable.
 */
export function normalizeWaitlistEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > WAITLIST_EMAIL_MAX_LENGTH) return null;
  return EMAIL_SHAPE.test(email) ? email : null;
}

/**
 * Bucketed counter key for one client in the window containing `nowMs`.
 * The window index is in the key so a failed `EXPIRE` leaks a dead key
 * instead of locking the client out (same reasoning as `channelRateKey`).
 *
 * @param clientKey Caller bucket from `getClientKey`.
 * @param nowMs Current time in epoch milliseconds.
 * @returns The Redis key holding this client's count for this window.
 */
export function waitlistRateKey(clientKey: string, nowMs: number): string {
  const bucket = Math.floor(nowMs / (WAITLIST_WINDOW_SEC * 1000));
  return `${WAITLIST_RATE_KEY_PREFIX}${clientKey}:${bucket}`;
}

/**
 * Whether a sign-up that produced `count` must be refused.
 *
 * `count` is the value after incrementing. A non-positive or non-finite
 * count means the counter could not be read — that is refused, never treated
 * as "fresh client".
 *
 * @param count Counter value after the increment.
 * @returns True when the request is over the cap.
 */
export function isOverWaitlistCap(count: number): boolean {
  if (!Number.isFinite(count) || count < 1) return true;
  return count > WAITLIST_MAX_PER_WINDOW;
}
