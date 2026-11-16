/**
 * End-to-end check of `POST /api/waitlist`: the real handler against a fake
 * of the Upstash REST surface (the only thing `command()` touches).
 */
import handler from '../waitlist';
import {
  WAITLIST_KEY,
  WAITLIST_MAX_PER_WINDOW,
} from '../../domain/src/policies/waitlist';
import type { VercelRequestLike, VercelResponseLike } from '../_lib/http';

function makeFakeUpstash() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const calls: string[][] = [];
  let failCommand: string | null = null;

  const fetchImpl = async (input: unknown): Promise<unknown> => {
    const parts = new URL(String(input)).pathname
      .replace(/^\//, '')
      .split('/')
      .map(decodeURIComponent);
    calls.push(parts);
    const [cmd, key, a, b] = parts;
    if (failCommand !== null && cmd === failCommand) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    let result: unknown = null;
    if (cmd === 'incr') {
      const next = Number(strings.get(key) ?? '0') + 1;
      strings.set(key, String(next));
      result = next;
    } else if (cmd === 'expire') {
      result = strings.has(key) ? 1 : 0;
    } else if (cmd === 'hsetnx') {
      const hash = hashes.get(key) ?? new Map<string, string>();
      hashes.set(key, hash);
      if (hash.has(a)) {
        result = 0;
      } else {
        hash.set(a, b);
        result = 1;
      }
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };

  return {
    hashes,
    calls,
    fetchImpl,
    failOn(cmd: string | null) {
      failCommand = cmd;
    },
  };
}

function makeRes(): { res: VercelResponseLike; out: { code: number | null; body: unknown } } {
  const out: { code: number | null; body: unknown } = { code: null, body: null };
  const res: VercelResponseLike = {
    status(code: number) {
      out.code = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
    },
  };
  return { res, out };
}

async function send(
  body: unknown,
  ip = '1.2.3.4',
  method = 'POST',
): Promise<{ code: number | null; body: unknown }> {
  const req: VercelRequestLike = {
    method,
    query: {},
    headers: { 'x-vercel-forwarded-for': ip },
    body,
  };
  const { res, out } = makeRes();
  await handler(req, res);
  return out;
}

let fake: ReturnType<typeof makeFakeUpstash>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  fake = makeFakeUpstash();
  (globalThis as { fetch: unknown }).fetch = fake.fetchImpl;
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
});

function list(): Map<string, string> {
  return fake.hashes.get(WAITLIST_KEY) ?? new Map<string, string>();
}

describe('POST /api/waitlist', () => {
  it('stores a normalised address and answers 200', async () => {
    const out = await send({ email: '  Trader@Example.COM ' });
    expect(out.code).toBe(200);
    expect([...list().keys()]).toEqual(['trader@example.com']);
  });

  it('accepts the text/plain body a plain form post produces', async () => {
    const out = await send(JSON.stringify({ email: 'a@example.com' }));
    expect(out.code).toBe(200);
    expect(list().has('a@example.com')).toBe(true);
  });

  it('answers the same for a repeat and keeps the first sign-up time', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);
    const first = await send({ email: 'a@example.com' });
    nowSpy.mockReturnValue(9_000);
    const again = await send({ email: 'A@example.com' });
    nowSpy.mockRestore();
    expect(again).toEqual(first);
    expect(list().size).toBe(1);
    expect(list().get('a@example.com')).toBe('1000');
  });

  it.each([
    ['missing body', undefined],
    ['no email field', {}],
    ['not a string', { email: 42 }],
    ['broken shape', { email: 'not-an-email' }],
  ])('refuses %s with 400 and touches no storage', async (_label, body) => {
    const out = await send(body);
    expect(out.code).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it('refuses anything but POST', async () => {
    const out = await send({ email: 'a@example.com' }, '1.2.3.4', 'GET');
    expect(out.code).toBe(405);
    expect(fake.calls).toHaveLength(0);
  });

  it('lets the cap through, refuses the next, and writes nothing for it', async () => {
    for (let i = 1; i <= WAITLIST_MAX_PER_WINDOW; i += 1) {
      const out = await send({ email: `u${i}@example.com` });
      expect([i, out.code]).toEqual([i, 200]);
    }
    const over = await send({ email: 'over@example.com' });
    expect(over.code).toBe(429);
    expect(list().has('over@example.com')).toBe(false);
    expect((await send({ email: 'other@example.com' }, '5.6.7.8')).code).toBe(200);
  });

  it('closes the door when the counter is unreachable', async () => {
    fake.failOn('incr');
    const out = await send({ email: 'a@example.com' });
    expect(out.code).toBe(503);
    expect(list().size).toBe(0);
  });

  it('reports a failed write instead of claiming success', async () => {
    fake.failOn('hsetnx');
    const out = await send({ email: 'a@example.com' });
    expect(out.code).toBe(502);
  });

  it('stores nothing about the caller next to the address', async () => {
    await send({ email: 'a@example.com' }, '9.9.9.9');
    const write = fake.calls.find((c) => c[0] === 'hsetnx') ?? [];
    expect(write.join(' ')).not.toContain('9.9.9.9');
  });

  it('answers 500 when storage is not provisioned', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    const out = await send({ email: 'a@example.com' });
    expect(out.code).toBe(500);
  });
});
