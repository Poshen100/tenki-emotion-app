/**
 * `GET /api/digest` —— 收束提醒的排程端點。
 *
 * 🔴 這支守的是**兩件各自會安靜失效的事**：
 *   · 不該推的時候推了（盤前、過期回報、同一天第二則、沒東西要填）
 *   · 該推的時候沒推（SCAN 只拿第一頁、一個頻道壞掉拖垮其他頻道）
 * 兩邊都不會丟錯誤：第一種會在手機上看得到但沒人會回報，第二種連看都看不到。
 *
 * 🔴 還有第三件：**沒真的送出去就不得記成「今天推過了」**。記了的話，一個
 * 沒有裝置的頻道會把自己每天唯一的額度燒掉，而且長出一條假的沉默連續記錄。
 */
jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}));

import webpush from 'web-push';
import handler, { isAuthorizedCron } from '../digest';
import type { VercelRequestLike, VercelResponseLike } from '../_lib/http';
import {
  DIGEST_KEY_PREFIX,
  OPEN_COUNT_KEY_PREFIX,
  PUSH_KEY_PREFIX,
} from '../_lib/store';
import { DIGEST_PUSH_TAG } from '../../domain/src/policies/digest-push';
import { DIGEST_PUSH_URL } from '../_lib/push';

const SECRET = 'cron-secret-value';
const CH_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SUB_A = { endpoint: 'https://push.test/a', keys: { p256dh: 'p', auth: 'a' } };
const SUB_B = { endpoint: 'https://push.test/b', keys: { p256dh: 'p', auth: 'a' } };

/** ET 2026-07-06 21:00（EDT，收市後、同一個交易日）。cron 真正會落的時刻。 */
const AFTER_CLOSE_MS = Date.parse('2026-07-07T01:00:00Z');
/** 同一個 ET 交易日的盤中。 */
const MIDDAY_MS = Date.parse('2026-07-06T18:00:00Z');
const TODAY_KEY = '2026-07-06';

interface Fake {
  store: Map<string, string>;
  lists: Map<string, string[]>;
  /** 讓某個 key 的讀取爆掉（模擬一個壞掉的頻道）。 */
  failOnKey: string | null;
  /** SCAN 一次只回一個 key，逼出分頁 */
  pageOne: boolean;
  fetchImpl: (input: unknown) => Promise<unknown>;
}

function makeFake(): Fake {
  const fake: Fake = {
    store: new Map(),
    lists: new Map(),
    failOnKey: null,
    pageOne: false,
    fetchImpl: async () => null,
  };
  fake.fetchImpl = async (input: unknown): Promise<unknown> => {
    const parts = new URL(String(input)).pathname
      .replace(/^\//, '')
      .split('/')
      .map(decodeURIComponent);
    const [cmd, a, b, c, d] = parts;
    if (fake.failOnKey !== null && a === fake.failOnKey) {
      throw new Error('storage exploded');
    }
    let result: unknown = null;
    if (cmd === 'get') result = fake.store.get(a) ?? null;
    else if (cmd === 'set') {
      fake.store.set(a, b ?? '');
      result = 'OK';
    }
    else if (cmd === 'expire') result = 1;
    else if (cmd === 'lrange') result = (fake.lists.get(a) ?? []).slice();
    else if (cmd === 'lrem') {
      fake.lists.set(a, (fake.lists.get(a) ?? []).filter((v) => v !== c));
      result = 1;
    } else if (cmd === 'scan') {
      // parts: scan <cursor> match <pattern> count <n>
      const cursor = a;
      const pattern = c ?? '*';
      const prefix = pattern.replace(/\*$/, '');
      const keys = [...fake.store.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (!fake.pageOne) {
        result = ['0', keys];
      } else {
        const index = Number(cursor === '0' ? 0 : cursor);
        const page = keys.slice(index, index + 1);
        const next = index + 1 >= keys.length ? '0' : String(index + 1);
        result = [next, page];
      }
    }
    void d;
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return fake;
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

function req(
  auth: string | undefined = `Bearer ${SECRET}`,
  method = 'GET',
): VercelRequestLike {
  return { method, query: {}, headers: auth === undefined ? {} : { authorization: auth } };
}

async function run(auth?: string, method?: string) {
  const { res, out } = makeRes();
  await handler(req(auth, method), res);
  return out as { code: number | null; body: Record<string, unknown> };
}

let fake: Fake;
const realFetch = globalThis.fetch;
const sendMock = webpush.sendNotification as unknown as jest.Mock;

/** 把一個頻道佈成「裝置剛剛回報過 n 筆」。 */
function seedReport(ch: string, n: number, atMs: number = AFTER_CLOSE_MS): void {
  fake.store.set(OPEN_COUNT_KEY_PREFIX + ch, JSON.stringify({ n, at: atMs }));
}

function seedSubscription(ch: string, sub: typeof SUB_A): void {
  const key = PUSH_KEY_PREFIX + ch;
  fake.lists.set(key, [...(fake.lists.get(key) ?? []), JSON.stringify(sub)]);
}

function digestOf(ch: string): Record<string, unknown> | null {
  const raw = fake.store.get(DIGEST_KEY_PREFIX + ch);
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
}

beforeEach(() => {
  fake = makeFake();
  (globalThis as { fetch: unknown }).fetch = fake.fetchImpl;
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  process.env.CRON_SECRET = SECRET;
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  sendMock.mockReset();
  sendMock.mockResolvedValue(undefined);
  jest.spyOn(Date, 'now').mockReturnValue(AFTER_CLOSE_MS);
});

afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
  jest.restoreAllMocks();
});

describe('isAuthorizedCron', () => {
  it('🔴 沒設密鑰 ⇒ 一律不授權（「沒設就跳過檢查」是端點變成公開按鈕的方式）', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, null)).toBe(false);
    expect(isAuthorizedCron(`Bearer ${SECRET}`, '')).toBe(false);
  });

  it('對的密鑰才過', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it('錯的密鑰、長度不同的密鑰、少了 Bearer、沒有 header 都不過', () => {
    expect(isAuthorizedCron('Bearer wrong-secret-val', SECRET)).toBe(false);
    expect(isAuthorizedCron('Bearer short', SECRET)).toBe(false);
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCron(undefined, SECRET)).toBe(false);
  });
});

describe('守門', () => {
  it('POST → 405（cron 是 GET）', async () => {
    const out = await run(undefined, 'POST');
    expect(out.code).toBe(405);
  });

  it('沒設 CRON_SECRET → 503，而且什麼都不掃', async () => {
    delete process.env.CRON_SECRET;
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.code).toBe(503);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('密鑰不對 → 401', async () => {
    const out = await run('Bearer nope');
    expect(out.code).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('沒有 VAPID → 503（不能推就要大聲，不要回 200 裝沒事）', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const out = await run();
    expect(out.code).toBe(503);
  });

  it('🔴 盤中打這個端點 → 不推（答案在收市後才存在）', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(MIDDAY_MS);
    seedReport(CH_A, 2, MIDDAY_MS);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.code).toBe(200);
    expect(out.body.reason).toBe('before_close');
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('推一則', () => {
  it('🔴 有新鮮回報 + 有訂閱 → 推，而且用自己的 tag 與深連結', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.code).toBe(200);
    expect(out.body.outcomes).toEqual({ sent: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendMock.mock.calls[0][1] as string);
    // 🔴 tag 必須跟快訊不同命名空間 —— 共用會讓提醒蓋掉一則真的快訊。
    expect(payload.tag).toBe(DIGEST_PUSH_TAG);
    // 🔴 **寫死那個路徑**。第一版寫的是 `toBe(DIGEST_PUSH_URL)` —— 拿常數跟
    //    自己比，於是把深連結改回 `/decision-alert/` 這個破壞**48 條全綠**。
    //    這一條守的是「提醒要落在填得到結果的那一頁」，那是一個具體的路徑。
    expect(payload.url).toBe('/v3/#session');
    expect(DIGEST_PUSH_URL).toBe('/v3/#session');
    expect(payload.body).toContain('2');
  });

  it('推完要記下來：哪一天、幾筆、沉默連續幾天', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    await run();
    expect(digestOf(CH_A)).toEqual({
      lastSentDayKey: TODAY_KEY,
      lastSentCount: 2,
      silentStreak: 0,
    });
  });

  it('🔴 回應裡不得出現頻道 id（那是憑證）', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(JSON.stringify(out.body)).not.toContain(CH_A);
    expect(JSON.stringify(out.body)).not.toContain(CH_A.slice(0, 16));
  });

  it('同一天第二次跑 → 不再推', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    await run();
    sendMock.mockClear();
    const second = await run();
    expect(second.body.outcomes).toEqual({ already_sent_today: 1 });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('不推的那些情況', () => {
  it('沒回報過的頻道連掃都掃不到（回報 key 就是索引）', async () => {
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.body.channels).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('回報是昨天的 → stale_report，不猜今天幾筆', async () => {
    seedReport(CH_A, 2, AFTER_CLOSE_MS - 24 * 3600 * 1000);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.body.outcomes).toEqual({ stale_report: 1 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('回報是 0 筆 → nothing_open', async () => {
    seedReport(CH_A, 0);
    seedSubscription(CH_A, SUB_A);
    const out = await run();
    expect(out.body.outcomes).toEqual({ nothing_open: 1 });
  });

  it('連續 3 天沒反應 → 停', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    fake.store.set(
      DIGEST_KEY_PREFIX + CH_A,
      JSON.stringify({ lastSentDayKey: '2026-07-01', lastSentCount: 2, silentStreak: 3 }),
    );
    const out = await run();
    expect(out.body.outcomes).toEqual({ silent_streak: 1 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔴 沒有任何訂閱 → 不算推過（不得燒掉今天唯一的額度）', async () => {
    seedReport(CH_A, 2);
    const out = await run();
    expect(out.body.outcomes).toEqual({ no_subscription: 1 });
    expect(digestOf(CH_A)).toBeNull();
  });

  it('🔴 全部送失敗 → 不算推過', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    sendMock.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const out = await run();
    expect(out.body.outcomes).toEqual({ push_failed: 1 });
    expect(digestOf(CH_A)).toBeNull();
  });

  it('endpoint 已經不存在（410）→ 清掉它，而且不算推過', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    sendMock.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const out = await run();
    expect(out.body.outcomes).toEqual({ push_failed: 1 });
    expect(fake.lists.get(PUSH_KEY_PREFIX + CH_A)).toEqual([]);
  });
});

describe('沉默連續記錄', () => {
  it('筆數沒下降 → 連續數 +1', async () => {
    seedReport(CH_A, 2);
    seedSubscription(CH_A, SUB_A);
    fake.store.set(
      DIGEST_KEY_PREFIX + CH_A,
      JSON.stringify({ lastSentDayKey: '2026-07-01', lastSentCount: 2, silentStreak: 1 }),
    );
    await run();
    expect(digestOf(CH_A)?.silentStreak).toBe(2);
  });

  it('筆數下降了 → 歸零（他真的去填了）', async () => {
    seedReport(CH_A, 1);
    seedSubscription(CH_A, SUB_A);
    fake.store.set(
      DIGEST_KEY_PREFIX + CH_A,
      JSON.stringify({ lastSentDayKey: '2026-07-01', lastSentCount: 2, silentStreak: 2 }),
    );
    await run();
    expect(digestOf(CH_A)?.silentStreak).toBe(0);
  });
});

describe('多個頻道', () => {
  it('🔴 SCAN 一頁只回一個也要全部處理（cursor 不是 0 就還沒掃完）', async () => {
    fake.pageOne = true;
    seedReport(CH_A, 2);
    seedReport(CH_B, 1);
    seedSubscription(CH_A, SUB_A);
    seedSubscription(CH_B, SUB_B);
    const out = await run();
    expect(out.body.channels).toBe(2);
    expect(out.body.outcomes).toEqual({ sent: 2 });
    expect(out.body.truncated).toBe(false);
  });

  it('🔴 一個頻道壞掉不得拖垮其他頻道', async () => {
    seedReport(CH_A, 2);
    seedReport(CH_B, 1);
    seedSubscription(CH_A, SUB_A);
    seedSubscription(CH_B, SUB_B);
    fake.failOnKey = OPEN_COUNT_KEY_PREFIX + CH_A;
    const out = await run();
    expect(out.code).toBe(200);
    expect(out.body.outcomes).toEqual({ channel_error: 1, sent: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('前綴相符但不是頻道 id 的 key 不算頻道', async () => {
    fake.store.set(`${OPEN_COUNT_KEY_PREFIX}not-a-channel`, JSON.stringify({ n: 2, at: AFTER_CLOSE_MS }));
    const out = await run();
    expect(out.body.channels).toBe(0);
  });
});
