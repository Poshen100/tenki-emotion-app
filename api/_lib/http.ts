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
 * @param req - Incoming request.
 * @returns Parsed value or an error message.
 */
export function readJsonBody(req: VercelRequestLike): JsonBodyResult {
  const body = req.body;

  if (typeof body === 'string') {
    try {
      return { ok: true, value: JSON.parse(body) };
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
