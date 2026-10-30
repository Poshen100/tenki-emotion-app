/**
 * `POST /api/open-count` —— 裝置回報那一個整數。
 *
 * 🔴 這支守的重點是**拒絕，而不是強制轉型**。`Number(null)` 是 0，而 0 在
 * 這條路上是一個**有意義的事實**（「今天沒有待填的」）—— 把一個壞掉的 body
 * 轉成 0，伺服器就會安靜地記下一件它沒被告知的事。
 */
import handler, { OPEN_COUNT_MAX } from '../open-count';
import { OPEN_COUNT_KEY_PREFIX, CHANNEL_KEY_PREFIX } from '../_lib/store';
import type { VercelRequestLike, VercelResponseLike } from '../_lib/http';

function makeFakeUpstash(registered: string[] = []) {
  const store = new Map<string, string>();
  registered.forEach((ch) => store.set(CHANNEL_KEY_PREFIX + ch, '1'));
  const fetchImpl = async (input: unknown): Promise<unknown> => {
    const parts = new URL(String(input)).pathname
      .replace(/^\//, '')
      .split('/')
      .map(decodeURIComponent);
    const [cmd, key, arg] = parts;
    let result: unknown = null;
    if (cmd === 'get') result = store.get(key) ?? null;
    else if (cmd === 'exists') result = store.has(key) ? 1 : 0;
    else if (cmd === 'set') {
      store.set(key, arg ?? '');
      result = 'OK';
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return { store, fetchImpl };
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

// 🔴 頻道 id 的形狀是 `/^[a-f0-9]{32,64}$/`（`api/_lib/http.ts`）。
//    第一版 fixture 用 'abc123'，於是**每一條合法 body 的測試都 400**，
//    而我一度以為是 handler 壞了。fixture 的形狀要跟真實契約一樣。
const CH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const UNREGISTERED = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
let fake: ReturnType<typeof makeFakeUpstash>;
const realFetch = globalThis.fetch;

function req(body: unknown, ch: string | null = CH, method = 'POST'): VercelRequestLike {
  return {
    method,
    query: ch === null ? {} : { ch },
    body,
    headers: { 'content-type': 'application/json' },
  };
}

async function post(body: unknown, ch: string | null = CH, method = 'POST') {
  const { res, out } = makeRes();
  await handler(req(body, ch, method), res);
  return out;
}

beforeEach(() => {
  fake = makeFakeUpstash([CH]);
  (globalThis as { fetch: unknown }).fetch = fake.fetchImpl;
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
});

describe('POST /api/open-count', () => {
  it('前提：正常回報寫得進去（0 的話下面全是死斷言）', async () => {
    expect((await post({ openCount: 2 })).code).toBe(200);
    const raw = fake.store.get(OPEN_COUNT_KEY_PREFIX + CH);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string).n).toBe(2);
  });

  it('🔴 存的只有一個整數和一個時間戳 —— 沒有別的欄位', async () => {
    await post({ openCount: 1, symbol: 'ES1!', tradeResult: 'profit_taken' });
    const saved = JSON.parse(fake.store.get(OPEN_COUNT_KEY_PREFIX + CH) as string);
    expect(Object.keys(saved).sort()).toEqual(['at', 'n']);
  });

  it('0 是合法的回報（「今天沒有待填的」是一個事實）', async () => {
    expect((await post({ openCount: 0 })).code).toBe(200);
    expect(JSON.parse(fake.store.get(OPEN_COUNT_KEY_PREFIX + CH) as string).n).toBe(0);
  });

  // 🔴 `Number(null)` 是 0，而 0 在這條路上有意義。轉型 ＝ 安靜地記下一件
  //    伺服器沒被告知的事。
  it.each([
    ['缺欄位', {}],
    ['null', { openCount: null }],
    ['字串', { openCount: '3' }],
    ['小數', { openCount: 1.5 }],
    ['負數', { openCount: -1 }],
    ['超過上限', { openCount: OPEN_COUNT_MAX + 1 }],
    ['body 不是物件', 'nope'],
  ])('🔴 %s → 400，而且什麼都沒寫進去', async (_label, body) => {
    expect((await post(body)).code).toBe(400);
    expect(fake.store.has(OPEN_COUNT_KEY_PREFIX + CH)).toBe(false);
  });

  it('上限本身是合法的（邊界是包含的）', async () => {
    expect((await post({ openCount: OPEN_COUNT_MAX })).code).toBe(200);
  });

  it('沒有 ch → 400', async () => {
    expect((await post({ openCount: 1 }, null)).code).toBe(400);
  });

  // 🔴 形狀不對的 id 也要擋。這條跟上面那條**不是同一件事** ——
  //    上面那條就算 getChannelId 整個拿掉也會過（query 裡根本沒有 ch）。
  it('🔴 形狀不對的 ch → 400（不是只擋「沒有」）', async () => {
    expect((await post({ openCount: 1 }, 'abc123')).code).toBe(400);
    expect((await post({ openCount: 1 }, 'A'.repeat(64))).code).toBe(400);
  });

  it('GET → 405', async () => {
    expect((await post({ openCount: 1 }, CH, 'GET')).code).toBe(405);
  });

  // 🔴 沒有這道閘，任何人發明一個 id 就能在你的 Redis 裡鑄 key。
  it('🔴 沒註冊過的頻道 → 404，而且什麼都沒寫進去', async () => {
    const out = await post({ openCount: 1 }, UNREGISTERED);
    expect(out.code).toBe(404);
    expect(fake.store.has(OPEN_COUNT_KEY_PREFIX + UNREGISTERED)).toBe(false);
  });
});
