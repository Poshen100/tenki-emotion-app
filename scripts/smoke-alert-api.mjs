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
    else if (cmd === 'lrem') { const before = list.length; const kept = list.filter((v) => v !== args[1]); lists.set(key, kept); result = before - kept.length; }
    else if (cmd === 'setnx') { result = keys.has(key) ? 0 : (keys.set(key, args[0]), 1); }
    else if (cmd === 'exists') { result = keys.has(key) ? 1 : 0; }
    else throw new Error('unexpected command: ' + cmd);
    return { ok: true, status: 200, json: async () => ({ result }) };
  };

  // Compiled handlers live in a temp dir; let their `require('web-push')`
  // resolve against the repo's node_modules.
  process.env.NODE_PATH = join(repoRoot, 'node_modules');
  require('node:module').Module._initPaths();

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

  // 13. Hybrid parser：人話前綴 + 換行 + JSON → 200 且 symbol 正確
  res = fakeRes();
  const hybridBody = '離高點太近，不參與。等誘空+收回\n' + VALID_BODY;
  await alertHandler({ method: 'POST', query: { ch: ch2 }, body: hybridBody }, res);
  assert(res.statusCode === 200 && res.payload.ok === true, 'hybrid（人話前綴+JSON）→ 200');
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch: ch2 } }, res);
  assert(res.payload.alerts[0].symbol === 'NVDA', 'hybrid body 欄位正確解析');

  // 14. Hybrid parser：JSON + 尾隨文字 → 200
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch: ch2 }, body: VALID_BODY + '  -- footer' }, res);
  assert(res.statusCode === 200, 'JSON + 尾隨文字 → 200');

  // 15. 純文字 body 但無 symbol（body 與 query 都沒）→ 400
  res = fakeRes();
  await alertHandler({ method: 'POST', query: { ch: ch2 }, body: 'just plain text' }, res);
  assert(res.statusCode === 400, '純文字 body 缺 symbol → 400');

  // 16. Query-param 模式：純人話 body + query（symbol/condition/strategy）→ 200
  res = fakeRes();
  await alertHandler({
    method: 'POST',
    query: { ch: ch2, symbol: 'ES1!', condition: 'Level Break', strategy: 'Mancini' },
    body: 'ES1! 下穿 7553.00 · 離高點太近，不參與。等誘空+收回',
  }, res);
  assert(res.statusCode === 200 && res.payload.ok === true, 'query-param 模式（純人話 body）→ 200');
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch: ch2 } }, res);
  const qp = res.payload.alerts[0];
  assert(qp.symbol === 'ES1!' && qp.condition === 'Level Break' && qp.strategyHint === 'Mancini',
    'query 結構化欄位正確');
  assert(qp.note === 'ES1! 下穿 7553.00 · 離高點太近，不參與。等誘空+收回', 'note = 純人話 body');

  // 17. Query 覆蓋 body JSON 的同名欄位
  res = fakeRes();
  await alertHandler({
    method: 'POST',
    query: { ch: ch2, symbol: 'TSLA' },
    body: '{"symbol":"NVDA","condition":"Breakout"}',
  }, res);
  assert(res.statusCode === 200, 'query+JSON body → 200');
  res = fakeRes();
  await alertsHandler({ method: 'GET', query: { ch: ch2 } }, res);
  assert(res.payload.alerts[0].symbol === 'TSLA' && res.payload.alerts[0].condition === 'Breakout',
    'query symbol 覆蓋、body condition 保留');

  // ── Web Push 訂閱端點（/api/subscribe）──
  const subscribeHandler = require(join(outDir, 'api/subscribe.js')).default;
  const SUB = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'k1', auth: 'k2' } };

  // 18. 非 POST/DELETE → 405
  res = fakeRes();
  await subscribeHandler({ method: 'GET', query: { ch }, body: JSON.stringify(SUB) }, res);
  assert(res.statusCode === 405, 'subscribe GET → 405');

  // 19. 缺 ch → 400
  res = fakeRes();
  await subscribeHandler({ method: 'POST', query: {}, body: JSON.stringify(SUB) }, res);
  assert(res.statusCode === 400, 'subscribe 缺 ch → 400');

  // 20. 未註冊頻道 → 404
  res = fakeRes();
  await subscribeHandler({ method: 'POST', query: { ch: 'c'.repeat(64) }, body: JSON.stringify(SUB) }, res);
  assert(res.statusCode === 404, 'subscribe 未註冊頻道 → 404');

  // 21. 壞訂閱（缺 keys）→ 400
  res = fakeRes();
  await subscribeHandler({ method: 'POST', query: { ch }, body: '{"endpoint":"https://x/y"}' }, res);
  assert(res.statusCode === 400, 'subscribe 壞訂閱 → 400');

  // 22. 合法訂閱 → 200，且存進頻道
  res = fakeRes();
  await subscribeHandler({ method: 'POST', query: { ch }, body: JSON.stringify(SUB) }, res);
  assert(res.statusCode === 200 && res.payload.ok === true, 'subscribe 合法 → 200');
  assert((lists.get('tenki:push:v1:' + ch) ?? []).length === 1, '訂閱存進頻道（1 筆）');

  // 23. 同 endpoint 再訂閱 → 去重（仍 1 筆）
  res = fakeRes();
  await subscribeHandler({ method: 'POST', query: { ch }, body: JSON.stringify(SUB) }, res);
  assert((lists.get('tenki:push:v1:' + ch) ?? []).length === 1, '同 endpoint 去重');

  // 24. DELETE 移除
  res = fakeRes();
  await subscribeHandler({ method: 'DELETE', query: { ch }, body: JSON.stringify({ endpoint: SUB.endpoint }) }, res);
  assert(res.statusCode === 200 && (lists.get('tenki:push:v1:' + ch) ?? []).length === 0, 'DELETE 移除訂閱');

  console.log(`\nSMOKE PASS — ${passed} assertions`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
