/**
 * @module api/_lib/push
 * @description Best-effort Web Push delivery for new alerts. Sends a
 * fact-only notification (never a buy/sell instruction) to a channel's
 * subscribed devices so the decision environment surfaces even when the TENKI
 * page is closed (iOS 16.4+ home-screen web app). VAPID signing + payload
 * encryption are handled by the `web-push` library. All failures are swallowed
 * by the caller — a push failure must never fail the webhook.
 */

import webpush from 'web-push';
import type { AlertContract } from '../../domain/src/contracts/alert-contract';
import { pushNotificationTag } from '../../domain/src/policies/alert-policy';
import { DIGEST_PUSH_TAG, buildDigestCopy } from '../../domain/src/policies/digest-push';
import type { StoredPushSubscription } from './store';

/** VAPID credentials, resolved from the environment. */
export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/**
 * Normalizes a VAPID key pasted into an env var. Mobile paste often picks up
 * surrounding whitespace/newlines, a trailing '=', or standard-base64 '+' / '/'
 * — none of which belong in a base64url VAPID key. Cleaning them here makes the
 * setup forgiving instead of failing with a cryptic web-push error.
 *
 * @param value - Raw env value.
 * @returns base64url-normalized key.
 */
export function sanitizeVapidKey(value: string): string {
  return value.replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Resolves VAPID credentials from the environment (keys sanitized).
 *
 * @returns Config, or null when Web Push is not configured.
 */
export function resolveVapidConfig(): VapidConfig | null {
  const subject = (process.env.VAPID_SUBJECT ?? 'mailto:alerts@tenki.app').trim();
  const publicKeyRaw = process.env.VAPID_PUBLIC_KEY;
  const privateKeyRaw = process.env.VAPID_PRIVATE_KEY;
  if (publicKeyRaw === undefined || privateKeyRaw === undefined) {
    return null;
  }
  const publicKey = sanitizeVapidKey(publicKeyRaw);
  const privateKey = sanitizeVapidKey(privateKeyRaw);
  if (publicKey.length === 0 || privateKey.length === 0) {
    return null;
  }
  return { subject, publicKey, privateKey };
}

/** Maximum notification body length (kept short for a lock-screen line). */
const BODY_MAX = 120;

/**
 * Builds the push notification payload for an alert. Fact language only —
 * symbol + condition + the user's own note; no action wording.
 *
 * @param alert - Canonical alert record.
 * @returns Notification content.
 */
export function buildPushPayload(alert: AlertContract): PushPayload {
  const parts = [alert.symbol];
  if (alert.condition !== null) {
    parts.push(alert.condition);
  }
  let body = parts.join(' · ');
  if (alert.note !== null) {
    body = `${body} — ${alert.note}`;
  }
  if (body.length > BODY_MAX) {
    body = `${body.slice(0, BODY_MAX - 1)}…`;
  }
  // 🔴 `tag` 決定裝置上哪兩則會互相取代 —— 判準走 domain 的 policy，
  //    不在這裡自己定義「什麼算同一則」（見 pushNotificationTag 的註解）。
  return {
    title: 'TENKI 決策快訊',
    body,
    url: '/decision-alert/',
    tag: pushNotificationTag(alert.symbol),
  };
}

/** A notification as the service worker reads it (`apps/preview/sw.js`). */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Where the close-of-day reminder lands.
 *
 * 🔴 The decision records live on `/v3/#session` — the page that can actually
 * accept a result. Sending the reminder to `/decision-alert/` (the alert
 * page's default) would drop the user on a page that cannot answer the
 * question the notification just asked.
 *
 * ⚠️ This only works because `sw.js` honours `data.url` **and** treats a
 * window on the target's own path as "found" — both were holes listed in
 * docs/DECISION-RECORD-LOOP.md §4 L2 and both are now closed with harness
 * assertions (`scripts/preview-sw-push.mjs`).
 */
export const DIGEST_PUSH_URL = '/v3/#session';

/**
 * Builds the close-of-day reminder payload.
 *
 * Copy and tag come from the domain policy (one place decides what the user
 * reads and what counts as "the same notification"); only the route is
 * decided here.
 *
 * @param count - Records still awaiting a result.
 * @returns Notification content.
 */
export function buildDigestPushPayload(count: number): PushPayload {
  const copy = buildDigestCopy(count);
  return { title: copy.title, body: copy.body, url: DIGEST_PUSH_URL, tag: DIGEST_PUSH_TAG };
}

/**
 * Sends one payload to every subscription. Returns how many were accepted and
 * the endpoints that are gone (404/410) so the caller can prune them. Other
 * per-subscription errors are ignored (transient).
 *
 * 🔴 One implementation for every kind of notification. Two copies of this
 * loop would drift — and the half that drifts is the dead-endpoint pruning,
 * which fails silently (a channel slowly fills with endpoints nobody can
 * reach, and nothing says so).
 *
 * @param vapid - VAPID credentials.
 * @param subscriptions - Channel's stored subscriptions.
 * @param payload - Notification to deliver.
 * @returns Accepted count and dead endpoints.
 */
export async function sendPushPayload(
  vapid: VapidConfig,
  subscriptions: readonly StoredPushSubscription[],
  payload: PushPayload,
): Promise<{ sent: number; dead: string[] }> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, body);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const errBody = (error as { body?: string }).body;
        console.error(
          `[push] send failed status=${statusCode ?? '?'} body=${(errBody ?? '').slice(0, 120)}`,
        );
        if (statusCode === 404 || statusCode === 410) {
          dead.push(subscription.endpoint);
        }
      }
    }),
  );

  console.log(`[push] sent=${sent} failed=${subscriptions.length - sent} dead=${dead.length}`);
  return { sent, dead };
}

/**
 * Sends an alert push to every subscription.
 *
 * @param vapid - VAPID credentials.
 * @param subscriptions - Channel's stored subscriptions.
 * @param alert - Alert to notify about.
 * @returns Dead endpoints to remove.
 */
export async function sendAlertPush(
  vapid: VapidConfig,
  subscriptions: readonly StoredPushSubscription[],
  alert: AlertContract,
): Promise<string[]> {
  const { dead } = await sendPushPayload(vapid, subscriptions, buildPushPayload(alert));
  return dead;
}
