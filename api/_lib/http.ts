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

/**
 * Checks the ingest token. TradingView webhooks cannot send custom headers,
 * so the shared secret travels as a `?token=` query parameter.
 *
 * @param req - Incoming request.
 * @returns True when the token matches `ALERT_INGEST_TOKEN`.
 */
export function isAuthorized(req: VercelRequestLike): boolean {
  const expected = process.env.ALERT_INGEST_TOKEN;
  if (expected === undefined || expected.length === 0) {
    return false;
  }
  return getQueryParam(req, 'token') === expected;
}
