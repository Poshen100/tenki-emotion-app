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
export function buildPushPayload(alert: AlertContract): { title: string; body: string; url: string } {
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
  return { title: 'TENKI 決策快訊', body, url: '/decision-alert/' };
}

/**
 * Sends a push to every subscription. Returns the endpoints that are gone
 * (404/410) so the caller can prune them. Other per-subscription errors are
 * ignored (transient).
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
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const payload = JSON.stringify(buildPushPayload(alert));
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const body = (error as { body?: string }).body;
        console.error(`[push] send failed status=${statusCode ?? '?'} body=${(body ?? '').slice(0, 120)}`);
        if (statusCode === 404 || statusCode === 410) {
          dead.push(subscription.endpoint);
        }
      }
    }),
  );

  console.log(`[push] sent=${sent} failed=${subscriptions.length - sent} dead=${dead.length}`);
  return dead;
}
