/**
 * smoke-alert-api.mjs — local end-to-end smoke test for the /api/channel,
 * /api/alert, and /api/alerts serverless handlers, no network and no
 * vercel dev required.
 *
 * Compiles api/ into a temp dir (CommonJS), stubs globalThis.fetch with an
 * in-memory Upstash REST fake (lpush/ltrim/expire/lrange/setnx/exists), and
 * drives the handlers with fake req/res objects through the full
 * register → ingest → poll loop.
 *
 * Run:  node scripts/smoke-alert-api.mjs
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = join(new URL('..', import.meta.url).pathname);
const outDir = mkdtempSync(join(tmpdir(), 'tenki-api-smoke-'));

try {
  execSync(`npx tsc -p api --noEmit false --outDir ${outDir}`, { cwd: repoRoot, stdio: 'inherit' });

  // ── env + in-memory Upstash fake ──
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.local';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake';

  const lists = new Map();
  const keys = new Map();
  globalThis.fetch = async (url, init) => {
    const auth = init?.headers?.Authorization ?? '';
    if (auth !== 'Bearer fake') return { ok: false, status: 401, json: async () => ({}) };
    const parts = new URL(url).pathname.slice(1).split('/').map(decodeURIComponent);
    const [cmd, key, ...args] = parts;
    let result = null;
    const list = lists.get(key) ?? [];
    if (cmd === 'lpush') { list.unshift(args[0]); lists.set(key, list); result = list.length; }
    else if (cmd === 'ltrim') { lists.set(key, list.slice(Number(args[0]), Number(args[1]) + 1)); result = 'OK'; }
    else if (cmd === 'expire') { result = 1; }
    else if (cmd === 'lrange') { result = list.slice(Number(args[0]), Number(args[1]) + 1); }
    else if (cmd === 'setnx') { result = keys.has(key) ? 0 : (keys.set(key, args[0]), 1); }
    else if (cmd === 'exists') { result = keys.has(key) ? 1 : 0; }
    else throw new Error('unexpected command: ' + cmd);
    return { ok: true, status: 200, json: async () => ({ result }) };
  };

  const channelHandler = require(join(outDir, 'api/channel.js')).default;
  const alertHandler = require(join(outDir, 'api/alert.js')).default;
  const alertsHandler = require(join(outDir, 'api/alerts.js')).default;

  function fakeRes() {
    const res = { statusCode: 0, payload: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.payload = payload; };
    return res;
  }

  let passed = 0;
  function assert(cond, msg) {
    if (!cond) { console.error('  ✗ ' + msg); process.exit(1); }
    passed += 1;
    console.log('  ✓ ' + msg);
  }

  const VALID_BODY = JSON.stringify({
    symbol: 'NVDA', price: 128.5, condition: 'Breakout', timeframe: '5m', strategy: 'CANSLIM',
  });

  // 1. 註冊頻道
  let res = fakeRes();
  await channelHandler({ method: 'POST', query: {}, headers: { host: 'tenki.test' } }, res);
  assert(res.statusCode === 200 && /^[a-f0-9]{32,64}$/.test(res.payload.channelId), 'POST /api/channel → 200 + 合法 channelId');
  assert(res.payload.webhookUrl === `https://tenki.test/api/alert?ch=${res.payload.channelId}`, 'webhookUrl 由 host 組出');
  const ch = res.payload.channelId;

  // 2. channel 端點只收 POST
  res = fakeRes();
  await channelHandler({ method: 'GET', query: {}, headers: {} }, res);
  assert(res.statusCode === 405, 'GET /api/channel → 405');

  // 3. 未註冊頻道 POST alert → 404
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch: 'a'.repeat(64) }, body: VALID_BODY }, res);
  assert(res.statusCode === 404, '未註冊頻道 → 404');

  // 4. 壞格式 ch → 400
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch: 'not-hex!' }, body: VALID_BODY }, res);
  assert(res.statusCode === 400, '壞格式 ch → 400');

  // 5. 缺 ch → 400
  res = fakeRes();
  await alertHandler({ method: 'POST', query: {}, body: VALID_BODY }, res);
  assert(res.statusCode === 400, '缺 ch → 400');

  // 6. 缺 symbol → 400（domain schema 擋）
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch }, body: '{"price":1}' }, res);
  assert(res.statusCode === 400 && res.payload.errors[0].includes('symbol'), '缺 symbol → 400 schema error');

  // 7. 正常 POST（text/plain 字串 body，如 TradingView）→ 200
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch }, body: VALID_BODY }, res);
  assert(res.statusCode === 200 && res.payload.ok === true, '註冊頻道 + 合法 body → 200');
  const firstId = res.payload.id;

  // 8. 第二筆（object body，不同 ms 供 since 測試）
  await new Promise((ok) => setTimeout(ok, 5));
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch }, body: JSON.parse(VALID_BODY) }, res);
  assert(res.statusCode === 200, 'object body → 200');

  // 9. 輪詢撈回兩筆（新→舊）
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch } }, res);
  assert(res.statusCode === 200 && res.payload.alerts.length === 2, '輪詢回兩筆');
  assert(res.payload.alerts[1].id === firstId, '新→舊排序');
  assert(res.payload.alerts[0].source === 'tradingview', 'AlertContract 欄位正規化');

  // 10. since 過濾
  const older = res.payload.alerts[1].receivedAt;
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch, since: String(older) } }, res);
  assert(res.statusCode === 200 && res.payload.alerts.length === 1, 'since 過濾');

  // 11. 未註冊頻道輪詢 → 404
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch: 'b'.repeat(64) } }, res);
  assert(res.statusCode === 404, '未註冊頻道輪詢 → 404');

  // 12. 頻道隔離：第二頻道看不到第一頻道的快訊
  res = fakeRes();
  await channelHandler({ method: 'POST', query: {}, headers: { host: 'tenki.test' } }, res);
  const ch2 = res.payload.channelId;
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch: ch2 } }, res);
  assert(res.statusCode === 200 && res.payload.alerts.length === 0, '頻道間隔離');

  console.log(`\nSMOKE PASS — ${passed} assertions`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
