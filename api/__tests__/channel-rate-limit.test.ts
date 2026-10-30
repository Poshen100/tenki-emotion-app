/**
 * 端對端驗 `POST /api/channel` 的建立上限。
 *
 * 🔴 為什麼要有這支：`domain/policies/channel-rate-limit` 的 9 條測試驗的是
 * **判準**（視窗怎麼滾、cap 的邊界、讀不回來要拒絕）。真正會壞的那一段是
 * **I/O 膠水** —— 誰先誰後、INCR 的回傳有沒有被當一回事、counter 掛掉時
 * 往哪邊倒。2026-10-29 那一刀把這段留在型別與人工閱讀上，因為 `api/` 當時
 * 不在 jest workspace；而這個部署的對外位址從開發容器打不到（網路政策擋），
 * 所以也沒辦法用一次真的 curl 代替。這支把它補起來，而且每次 CI 都跑。
 *
 * 假的是 Upstash 的 REST 介面（`command()` 唯一碰到的東西），
 * 跑的是**真的 handler**。
 */
import handler from '../channel';
import {
  CHANNEL_CREATE_MAX_PER_WINDOW,
  CHANNEL_CREATE_WINDOW_SEC,
} from '../../domain/src/policies/channel-rate-limit';
import type { VercelRequestLike, VercelResponseLike } from '../_lib/http';

/** Upstash REST 的最小忠實仿製：路徑就是命令，回 `{result}`。 */
function makeFakeUpstash() {
  const store = new Map<string, string>();
  const calls: string[][] = [];
  let failCommand: string | null = null;
  let setnxAlwaysTaken = false;

  const fetchImpl = async (input: unknown): Promise<unknown> => {
    const parts = new URL(String(input)).pathname
      .replace(/^\//, '')
      .split('/')
      .map(decodeURIComponent);
    calls.push(parts);
    const [cmd, key, arg] = parts;
    if (failCommand !== null && cmd === failCommand) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    let result: unknown = null;
    if (cmd === 'incr') {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      result = next;
    } else if (cmd === 'expire') {
      result = store.has(key) ? 1 : 0;
    } else if (cmd === 'set' && parts.includes('nx')) {
      // `SET k v EX n NX` → "OK" 代表佔到了，null 代表已經有人。
      if (setnxAlwaysTaken || store.has(key)) {
        result = null;
      } else {
        store.set(key, arg ?? '');
        result = 'OK';
      }
    } else if (cmd === 'get') {
      result = store.get(key) ?? null;
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };

  return {
    store,
    calls,
    fetchImpl,
    failOn(cmd: string | null) {
      failCommand = cmd;
    },
    makeEveryIdCollide() {
      setnxAlwaysTaken = true;
    },
  };
}

function makeReq(ip?: string): VercelRequestLike {
  const headers: Record<string, string> = { 'x-forwarded-host': 'tenki.test' };
  if (ip !== undefined) headers['x-vercel-forwarded-for'] = ip;
  return { method: 'POST', query: {}, headers };
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

async function post(ip?: string): Promise<{ code: number | null; body: unknown }> {
  const { res, out } = makeRes();
  await handler(makeReq(ip), res);
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
  jest.restoreAllMocks();
});

describe('POST /api/channel 的建立上限', () => {
  it('前提：一次正常註冊真的會成功（0 的話下面全是死斷言）', async () => {
    const first = await post('1.2.3.4');
    expect(first.code).toBe(200);
    expect((first.body as { channelId?: string }).channelId).toEqual(expect.any(String));
  });

  it('🔴 第 N 次還過，第 N+1 次回 429', async () => {
    for (let i = 1; i <= CHANNEL_CREATE_MAX_PER_WINDOW; i += 1) {
      const out = await post('1.2.3.4');
      expect([i, out.code]).toEqual([i, 200]);
    }
    const over = await post('1.2.3.4');
    expect(over.code).toBe(429);
  });

  it('🔴 擋下來之後**沒有**再註冊頻道（不是只把回應換掉）', async () => {
    for (let i = 0; i <= CHANNEL_CREATE_MAX_PER_WINDOW; i += 1) await post('1.2.3.4');
    const registered = fake.calls.filter((c) => c[0] === 'set').length;
    expect(registered).toBe(CHANNEL_CREATE_MAX_PER_WINDOW);
  });

  it('不同位址各有自己的預算', async () => {
    for (let i = 0; i < CHANNEL_CREATE_MAX_PER_WINDOW; i += 1) await post('1.2.3.4');
    expect((await post('1.2.3.4')).code).toBe(429);
    expect((await post('5.6.7.8')).code).toBe(200);
  });

  // 🔴 讀不到位址不得變成「無限制」。所有認不出來的共用一個桶。
  it('🔴 讀不到來源位址的請求共用一個桶，不是各自無限', async () => {
    for (let i = 0; i < CHANNEL_CREATE_MAX_PER_WINDOW; i += 1) await post(undefined);
    expect((await post(undefined)).code).toBe(429);
  });

  // 🔴 counter 是開放端點前面唯一的東西 —— 連不上就是關門，不是開門。
  it('🔴 counter 連不上 → 503，而且一條頻道都沒註冊', async () => {
    fake.failOn('incr');
    const out = await post('1.2.3.4');
    expect(out.code).toBe(503);
    expect(fake.calls.filter((c) => c[0] === 'set')).toHaveLength(0);
  });

  // 🔴 計數在註冊之前：穩定踩到失敗路徑的 caller 不得免費製造負載。
  it('🔴 註冊失敗仍然花掉預算（計數在註冊之前）', async () => {
    fake.makeEveryIdCollide();
    const out = await post('1.2.3.4');
    expect(out.code).toBe(502);
    const rateKeys = [...fake.store.keys()].filter((k) => k.startsWith('tenki:chrate:'));
    expect(rateKeys).toHaveLength(1);
    expect(fake.store.get(rateKeys[0] as string)).toBe('1');
  });

  it('視窗滾過去，預算回來', async () => {
    const t0 = 1_700_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    for (let i = 0; i < CHANNEL_CREATE_MAX_PER_WINDOW; i += 1) await post('1.2.3.4');
    expect((await post('1.2.3.4')).code).toBe(429);
    now.mockReturnValue(t0 + CHANNEL_CREATE_WINDOW_SEC * 1000);
    expect((await post('1.2.3.4')).code).toBe(200);
  });

  // 🔴 EXPIRE 失敗只能留下一把沒人讀的 key，**不得**把這個 client 鎖死。
  it('🔴 EXPIRE 失敗不影響這次註冊，也不會鎖死下一次', async () => {
    fake.failOn('expire');
    expect((await post('1.2.3.4')).code).toBe(200);
    expect((await post('1.2.3.4')).code).toBe(200);
  });
});
