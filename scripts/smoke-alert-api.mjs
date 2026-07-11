/**
 * smoke-alert-api.mjs — local end-to-end smoke test for the /api/alert and
 * /api/alerts serverless handlers, no network and no vercel dev required.
 *
 * Compiles api/ into a temp dir (CommonJS), stubs globalThis.fetch with an
 * in-memory Upstash REST fake (lpush/ltrim/expire/lrange), and drives the
 * handlers with fake req/res objects through the full ingest → poll loop.
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
  process.env.ALERT_INGEST_TOKEN = 'smoke-token';
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.local';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake';

  const lists = new Map();
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
    else throw new Error('unexpected command: ' + cmd);
    return { ok: true, status: 200, json: async () => ({ result }) };
  };

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

  // 1. 無 token → 401
  let res = fakeRes();
  await alertHandler({ method: 'POST', query: {}, body: VALID_BODY }, res);
  assert(res.statusCode === 401, 'POST without token → 401');

  // 2. 錯誤 method → 405
  res = fakeRes();
  await alertHandler({ method: 'GET', query: { token: 'smoke-token' }, body: VALID_BODY }, res);
  assert(res.statusCode === 405, 'GET on /api/alert → 405');

  // 3. 壞 JSON → 400
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { token: 'smoke-token' }, body: '{oops' }, res);
  assert(res.statusCode === 400, 'malformed JSON body → 400');

  // 4. 缺 symbol → 400（domain schema 擋）
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { token: 'smoke-token' }, body: '{"price":1}' }, res);
  assert(res.statusCode === 400 && res.payload.errors[0].includes('symbol'), 'missing symbol → 400 with schema error');

  // 5. 正常 POST（text/plain 字串 body，如 TradingView）→ 200
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { token: 'smoke-token' }, body: VALID_BODY }, res);
  assert(res.statusCode === 200 && res.payload.ok === true, 'valid string body → 200 { ok: true }');
  const firstId = res.payload.id;

  // 6. 正常 POST（已解析 object body，如 JSON content-type）→ 200
  await new Promise((ok) => setTimeout(ok, 5)); // 讓 receivedAt 分屬不同 ms，since 過濾才可測
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { token: 'smoke-token' }, body: JSON.parse(VALID_BODY) }, res);
  assert(res.statusCode === 200, 'valid object body → 200');

  // 7. GET /api/alerts 撈回兩筆（新→舊）且欄位正規化
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { token: 'smoke-token' } }, res);
  assert(res.statusCode === 200 && res.payload.alerts.length === 2, 'poll returns both alerts');
  assert(res.payload.alerts[1].id === firstId, 'newest-first ordering');
  assert(res.payload.alerts[0].symbol === 'NVDA' && res.payload.alerts[0].source === 'tradingview', 'canonical AlertContract fields');

  // 8. since 過濾（用第一筆的 receivedAt）
  const older = res.payload.alerts[1].receivedAt;
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { token: 'smoke-token', since: String(older) } }, res);
  assert(res.statusCode === 200 && res.payload.alerts.length === 1, 'since filter drops older alerts');

  // 9. alerts 端點也要 token
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { since: '0' } }, res);
  assert(res.statusCode === 401, 'poll without token → 401');

  console.log(`\nSMOKE PASS — ${passed} assertions`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
