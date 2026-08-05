/**
 * @module api/_lib/http
 * @description Minimal request/response typing and body helpers for Vercel
 * Node serverless functions, written locally to keep the API layer
 * dependency-free (no @vercel/node import).
 */

/** Minimal shape of the Vercel Node function request we rely on. */
export interface VercelRequestLike {
  method?: string;
  /** Parsed query string (Vercel populates this). */
  query: Record<string, string | string[] | undefined>;
  /** Parsed body: object for JSON content-type, string for text/plain. */
  body?: unknown;
  /** Incoming headers (used to derive the public host for webhook URLs). */
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Resolves the public host of the deployment from forwarded headers.
 *
 * @param req - Incoming request.
 * @returns Host name, or null when unavailable.
 */
export function getRequestHost(req: VercelRequestLike): string | null {
  const forwarded = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
  return typeof forwarded === 'string' && forwarded.length > 0 ? forwarded : null;
}

/** Query parameter Vercel accepts in place of the bypass header. */
export const PROTECTION_BYPASS_QUERY_KEY = 'x-vercel-protection-bypass';

/**
 * Returns the Protection Bypass for Automation secret, when the project has
 * one generated.
 *
 * Why this exists: Vercel Deployment Protection (SSO) rejects anonymous
 * requests **at the edge**, before any function runs — so a TradingView
 * webhook POST never reaches `/api/alert` and leaves no runtime log at all
 * (2026-08-05: six hours of logs showed only the browser's own polling,
 * zero POSTs). TradingView cannot send custom headers, so the documented
 * escape hatch is the same secret carried as a query parameter. Baking it
 * into the generated webhook URL keeps the user from having to paste it by
 * hand.
 *
 * Returns null when no secret is provisioned, in which case the webhook URL
 * is built exactly as before — this is inert until the founder generates the
 * secret in the Vercel dashboard.
 *
 * @returns The bypass secret, or null when unset.
 */
export function getProtectionBypassSecret(): string | null {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return typeof secret === 'string' && secret.trim().length > 0 ? secret.trim() : null;
}

/** Minimal shape of the Vercel Node function response we rely on. */
export interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  json(payload: unknown): void;
}

/** Result of attempting to read a JSON object body. */
export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * Reads the request body as JSON. TradingView posts the alert message with
 * a text/plain content type, so a string body is parsed here; a JSON
 * content type arrives pre-parsed as an object.
 *
 * For string bodies the JSON object is extracted from the first `{` to the
 * last `}`, so the alert message may carry a plain-text prefix (or suffix)
 * around the JSON. This keeps TradingView's own push notification readable
 * — a human sentence can lead the message and show verbatim on the lock
 * screen, while only the JSON is parsed here. Pure-JSON bodies (brace at
 * index 0) are unaffected.
 *
 * @param req - Incoming request.
 * @returns Parsed value or an error message.
 */
export function readJsonBody(req: VercelRequestLike): JsonBodyResult {
  const body = req.body;

  if (typeof body === 'string') {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end < start) {
      return { ok: false, error: 'body contains no JSON object' };
    }
    try {
      return { ok: true, value: JSON.parse(body.slice(start, end + 1)) };
    } catch {
      return { ok: false, error: 'body is not valid JSON' };
    }
  }

  if (body !== null && typeof body === 'object') {
    return { ok: true, value: body };
  }

  return { ok: false, error: 'missing request body' };
}

/**
 * Returns a single-valued query parameter, or null when absent/repeated.
 *
 * @param req - Incoming request.
 * @param name - Query parameter name.
 * @returns The parameter value or null.
 */
export function getQueryParam(req: VercelRequestLike, name: string): string | null {
  const value = req.query[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Structured alert fields that may be supplied as `?key=` query params. */
const ALERT_QUERY_TEXT_KEYS = ['symbol', 'condition', 'timeframe', 'strategy', 'note'] as const;

/**
 * Assembles the alert payload from the request body and query params so the
 * TradingView alert message can stay pure human text (which shows verbatim
 * on the lock-screen push) while the structured fields travel in the webhook
 * URL's query string. A TradingView alert is inherently per-symbol, so
 * `symbol`/`condition`/`strategy` are known when the alert is created and can
 * be hard-coded in the URL.
 *
 * Precedence: JSON body fields (backward compatible) form the base; a
 * plain-text body becomes `note`; query params then overlay any field they
 * provide. The result is an `AlertPayloadContract`-shaped object passed
 * unchanged to the domain validator — the domain layer is untouched.
 *
 * @param req - Incoming request.
 * @returns Assembled payload for `validateAlertPayloadContract`.
 */
export function assembleAlertPayload(req: VercelRequestLike): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const parsed = readJsonBody(req);
  if (parsed.ok && parsed.value !== null && typeof parsed.value === 'object') {
    Object.assign(payload, parsed.value);
  } else if (typeof req.body === 'string') {
    const text = req.body.trim();
    if (text.length > 0) {
      payload.note = text;
    }
  }

  for (const key of ALERT_QUERY_TEXT_KEYS) {
    const value = getQueryParam(req, key);
    if (value !== null) {
      payload[key] = value;
    }
  }

  const priceParam = getQueryParam(req, 'price');
  if (priceParam !== null) {
    const price = Number(priceParam);
    if (Number.isFinite(price)) {
      payload.price = price;
    }
  }

  return payload;
}

/** Server-generated channel IDs are 32–64 lowercase hex chars. */
const CHANNEL_ID_PATTERN = /^[a-f0-9]{32,64}$/;

/**
 * Reads and format-validates the channel ID. The channel travels as a
 * `?ch=` query parameter because TradingView webhooks cannot send custom
 * headers — the unguessable channel URL is the credential (capability URL),
 * same model as TradingView's own webhook conventions.
 *
 * @param req - Incoming request.
 * @returns The channel ID, or null when absent/malformed.
 */
export function getChannelId(req: VercelRequestLike): string | null {
  const value = getQueryParam(req, 'ch');
  return value !== null && CHANNEL_ID_PATTERN.test(value) ? value : null;
}
