/**
 * @module api/waitlist
 * @description Early-access list endpoint (`POST /api/waitlist` with
 * `{ email }`). Called by the form at the foot of `/story/`.
 *
 * What is stored: the address and the time it was first submitted, in one
 * hash (`WAITLIST_KEY`). Nothing else — no channel id, no reading, and the
 * caller's network address is used only for the hourly counter key, never
 * written next to the email.
 *
 * The answer is the same whether the address was new or already on the list,
 * so the endpoint cannot be used to ask "is this person signed up?".
 */

import {
  isOverWaitlistCap,
  normalizeWaitlistEmail,
} from '../domain/src/policies/waitlist';
import { getClientKey, readJsonBody } from './_lib/http';
import type { VercelRequestLike, VercelResponseLike } from './_lib/http';
import { countWaitlistSignup, resolveUpstashConfig, saveWaitlistEmail } from './_lib/store';

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if ((req.method ?? 'GET') !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed — use POST' });
    return;
  }

  const parsed = readJsonBody(req);
  const raw =
    parsed.ok && parsed.value !== null && typeof parsed.value === 'object'
      ? (parsed.value as { email?: unknown }).email
      : undefined;
  const email = normalizeWaitlistEmail(raw);
  if (email === null) {
    res.status(400).json({ ok: false, error: 'email must be a valid address' });
    return;
  }

  const storage = resolveUpstashConfig();
  if (storage === null) {
    res.status(500).json({ ok: false, error: 'storage not provisioned' });
    return;
  }

  const now = Date.now();
  try {
    const attempts = await countWaitlistSignup(storage, getClientKey(req), now);
    if (isOverWaitlistCap(attempts)) {
      res.status(429).json({ ok: false, error: 'too many sign-ups from this network — try again in an hour' });
      return;
    }
  } catch (error) {
    // The counter is the only thing in front of an open write endpoint, so a
    // counter that cannot be reached is a closed door.
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'rate limiter unavailable',
    });
    return;
  }

  try {
    await saveWaitlistEmail(storage, email, now);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'sign-up failed',
    });
  }
}
