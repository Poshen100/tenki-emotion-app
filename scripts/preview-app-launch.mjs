/**
 * preview-app-launch.mjs — `/app/` PWA 啟動路由的迴歸驗證。
 *
 * founder 2026-10-27 實機：「現在沒事點進來都是快訊設定頁，我想要沒事點進去
 * 是 TODAY 的頁面；如果是首次登入就走 /preview/」。
 *
 * 這支守的是**一個使用者永遠看不到、但每次開 App 都會跑一遍的判斷**。
 * 它錯掉的兩種方式都很安靜：
 *   · 回訪者被丟回 onboarding —— 畫面完全正常，只是進錯地方；
 *   · 新用戶被丟進空的 Today —— 畫面也完全正常。
 * 所以每一條都直接驗**落點**，不驗「函式有沒有被呼叫」。
 *
 * ⚠️ 不跑字型金絲雀：這支一條版面都不量（它量的是導航與 storage），
 *    金絲雀在這裡只會引進一個跟被測物無關的失敗源。
 *
 * Run:  node scripts/preview-app-launch.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const chromium = await getChromium();
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  // 種 localStorage 用的空殼：必須跟被測頁**同源**，否則 storage 不通。
  if (clean === '/__blank') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>BLANK</title>');
    return;
  }
  // ⚠️ rewrite 照抄 vercel.json，含 `(.*)` 那一條（少一條就是靜默 404，
  //    而靜默 404 的測試環境比沒有測試更糟 —— 見 preview-strip-color.mjs 的血淚）。
  if (clean === '/app' || clean === '/app/') clean = '/apps/preview/app.html';
  else if (clean.startsWith('/app/')) clean = '/apps/preview/' + clean.slice('/app/'.length);
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  if (clean === '/v3' || clean === '/v3/') clean = '/apps/preview/v6/index.html';
  else if (clean.startsWith('/v3/')) clean = '/apps/preview/v6/' + clean.slice('/v3/'.length);
  let file = join(repoRoot, clean);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) console.log(`   期待 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`);
}

const APP = readFileSync(join(repoRoot, 'apps/preview/app.html'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(join(repoRoot, 'apps/preview/manifest.webmanifest'), 'utf8'));
const VERCEL = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8'));
const TOKENS = readFileSync(join(repoRoot, 'apps/preview/tokens.css'), 'utf8');

// ══════════════════════════════════════════════════════════
// A. manifest 與路由（不需要瀏覽器）
// ══════════════════════════════════════════════════════════
check('manifest 的 start_url 是 /app/（被安裝的就是啟動路由）', MANIFEST.start_url, '/app/');
// 🔴 離開 scope 的導覽會讓 iOS standalone 把使用者踢回 Safari ——
//    而 /app/ 的工作正是把人導到**別的路徑**。這條鬆掉，整個 PWA 當場散掉。
check('manifest 的 scope 是 "/"（跨 /v3/ /preview/ /decision-alert/ 都還在 App 裡）', MANIFEST.scope, '/');
check('manifest 的 name 不再是 demo 名', MANIFEST.name, 'TENKI CORE');
check('manifest 的 display 是 standalone', MANIFEST.display, 'standalone');
check('/app/ 有 rewrite 到 app.html',
  VERCEL.rewrites.some((r) => r.source === '/app/' && r.destination === '/apps/preview/app.html'), true);
// 少了 `(.*)` 那一條 → /app/manifest.webmanifest 404 → 安裝時沒有 manifest
// → iOS 退回「拿當前網址當 start_url」，於是又生出一顆繞過啟動路由的 icon。
check('/app/(.*) 也有 rewrite（manifest 要從這個路徑拿得到）',
  VERCEL.rewrites.some((r) => r.source === '/app/(.*)'), true);
check('/app（沒有尾斜線）有 redirect',
  VERCEL.redirects.some((r) => r.source === '/app' && r.destination === '/app/'), true);

// ══════════════════════════════════════════════════════════
// B. 啟動頁本身：零外部相依 + 底色對得上 token
// ══════════════════════════════════════════════════════════
// 這一頁唯一的視覺工作是蓋掉 iOS 冷啟動白閃，而那個空窗只有幾十毫秒 ——
// 任何 render-blocking 的外部資源都比它長。
check('啟動頁沒有外部 <script src>', /<script\s[^>]*src=/i.test(APP), false);
check('啟動頁沒有外部 stylesheet', /<link[^>]+rel=["']?stylesheet/i.test(APP), false);
check('啟動頁沒有 @import', /@import/.test(APP), false);
const bgSpace = (TOKENS.match(/--n-950:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
check('tokens.css 讀得到 --n-950（= --bg-space）', typeof bgSpace === 'string', true);
// 🔴 寫死的色票與 token 必須**數值相同**，而「記得改兩邊」不是機制 —— 這條才是。
check('啟動頁底色 = tokens 的 --bg-space',
  (APP.match(/background:\s*(#[0-9A-Fa-f]{6})/) || [])[1].toLowerCase(), (bgSpace || '').toLowerCase());
// 🔴 這條守的是**前提**，不是當下會壞的行為：script 跑在 body 尾端、文件還沒
//    load 完，這時 href 與 replace 的使用者可見行為**完全相同**（2026-10-27 實測
//    落點 / history.length / 返回後網址三項逐項相同）。它要擋的是「哪天這段被搬
//    到 load 之後」—— 那時 href 才會真的多留一筆歷史。
check('啟動頁用 location.replace（守住「導覽發生在 load 之前」這個前提）',
  /location\.replace\(/.test(APP) && !/location\.href\s*=/.test(APP), true);
check('JS 關掉時有 <noscript> 出口（否則這一頁是死路）',
  /<noscript>[\s\S]*\/v3\/[\s\S]*\/preview\/[\s\S]*<\/noscript>/.test(APP), true);

// ══════════════════════════════════════════════════════════
// C. manifest 與 standalone meta 掛在**每一頁**
//    iOS 的「加到主畫面」用的是當下那一頁看得到的 manifest。
// ══════════════════════════════════════════════════════════
for (const [label, rel] of [
  ['/app/', 'apps/preview/app.html'],
  ['/v3/', 'apps/preview/v6/index.html'],
  ['/preview/', 'apps/preview/soul-enroll.html'],
  ['/decision-alert/', 'apps/preview/decision-alert.html'],
]) {
  const html = readFileSync(join(repoRoot, rel), 'utf8');
  check(`${label} 掛了 manifest（從哪一頁安裝都要落到 /app/）`,
    /<link[^>]+rel=["']?manifest["']?[^>]*href=["']\/app\/manifest\.webmanifest/.test(html), true);
  check(`${label} 有 apple-mobile-web-app-capable（少了會開成 Safari 分頁）`,
    /name=["']apple-mobile-web-app-capable["'][^>]*content=["']yes["']/.test(html), true);
  check(`${label} 有 status-bar-style: black-translucent（少了會多一條白狀態列）`,
    /name=["']apple-mobile-web-app-status-bar-style["'][^>]*content=["']black-translucent["']/.test(html), true);
}

// ══════════════════════════════════════════════════════════
// D. 落點：直接驗導到哪裡，不驗「函式有沒有被呼叫」
// ══════════════════════════════════════════════════════════
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });

const stub = (tag) => (route) => route.fulfill({
  status: 200, contentType: 'text/html', body: `<!doctype html><title>STUB-${tag}</title>`,
});

/** 種好 storage → 開 /app/ → 回報最後落在哪、戳記變成什麼。 */
async function launch(seed) {
  const page = await ctx.newPage();
  // 把兩個目的地換成 stub：這支要驗的是**導到哪裡**，
  // 不是 /v3/ 八千行有沒有載得起來（那是別支 harness 的工作）。
  await page.route(/\/v3\/$/, stub('V3'));
  await page.route(/\/preview\/$/, stub('PREVIEW'));
  await page.goto(`${base}/__blank`, { waitUntil: 'load' });
  await page.evaluate((pairs) => {
    localStorage.clear();
    for (const [k, v] of pairs) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${base}/app/`, { waitUntil: 'load' });
  await page.waitForURL(/\/(v3|preview)\/$/, { timeout: 5000 }).catch(() => {});
  const url = page.url();
  const dest = /\/v3\/$/.test(url) ? 'v3' : /\/preview\/$/.test(url) ? 'preview' : url;
  const stamp = await page.evaluate(() => localStorage.getItem('tenki.app.onboarded.v1'));
  return { page, dest, stamp };
}

{
  const r = await launch([]);
  check('🔴 空的 storage ＝ 第一次 → /preview/（Soul Scan）', r.dest, 'preview');
  check('   而且沒有偷偷補一張戳記給沒走過的人', r.stamp, null);
  await r.page.close();
}
{
  const r = await launch([['tenki.app.onboarded.v1', JSON.stringify({ at: 1, via: 'soul_scan' })]]);
  check('🔴 有戳記 → /v3/（= Today，沒有 hash 就是 Today）', r.dest, 'v3');
  await r.page.close();
}
// 🔴 migration：戳記是今天才開始寫的。沒有這段，升級後第一次啟動會把**既有
//    使用者**丟回 onboarding —— 而他們正是最不該被丟回去的那群人。
for (const key of ['tenki.baseline.blink', 'tenki.readiness.reading.v1', 'tenki.alert.outcomes.v1']) {
  const r = await launch([[key, JSON.stringify([{ ts: 1 }])]]);
  check(`🔴 舊用戶（只有 ${key}）→ /v3/，不被丟回 onboarding`, r.dest, 'v3');
  check('   而且當場補一張戳記，下次不用再掃一輪', JSON.parse(r.stamp || 'null')?.via, 'legacy');
  await r.page.close();
}
// 空殼不算用過 —— 讀端把 `[]` 寫回 storage 是很常見的事。
for (const empty of ['[]', '{}', 'null', '']) {
  const r = await launch([['tenki.alert.outcomes.v1', empty]]);
  check(`🔴 空殼 ${JSON.stringify(empty)} 不算用過 → 仍然是 /preview/`, r.dest, 'preview');
  await r.page.close();
}
{
  // 🔴 **storage 整個讀不到**（Safari 無痕／站台資料被擋）。
  //    這條分支原本只有註解寫理由、沒有斷言守著 —— 而「有寫理由」不是機制。
  //    兩邊猜錯的代價不對稱：猜成新用戶會讓付費回訪者**每次**開 App 都失去
  //    他的 App；猜成老用戶只是讓新用戶多按一下去 Scan。
  const page = await ctx.newPage();
  await page.route(/\/v3\/$/, stub('V3'));
  await page.route(/\/preview\/$/, stub('PREVIEW'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('blocked', 'SecurityError'); },
    });
  });
  await page.goto(`${base}/app/`, { waitUntil: 'load' });
  await page.waitForURL(/\/(v3|preview)\/$/, { timeout: 5000 }).catch(() => {});
  check('🔴 storage 讀不到時走 /v3/（不把回訪者關在 onboarding 外面）',
    /\/v3\/$/.test(page.url()), true);
  await page.close();
}
{
  // 🔴 **這條分不出 replace 與 href** —— 反向驗證把它改成 href 時它沒有紅
  //    （上面那條來源形狀的才是釘住 replace 的）。留著它是因為它守的是另一件事：
  //    不管用哪種寫法，使用者按返回都必須回到進來之前，而不是卡在啟動頁被
  //    反覆導走。那是**使用者按得到的性質**，而且未來任何 push 型導覽都會讓它紅。
  //    ⚠️ 不要把它當成「replace 有生效」的證據 —— 一條在正確與破壞兩種實作下
  //    都綠的斷言，就不是那個選擇的守門員。
  const r = await launch([['tenki.app.onboarded.v1', '{"at":1}']]);
  await r.page.goBack({ waitUntil: 'load' }).catch(() => {});
  check('🔴 返回鍵回到進來之前，不是卡在啟動頁',
    /\/__blank$/.test(r.page.url()), true);
  await r.page.close();
}

await browser.close();
server.close();
console.log(failed === 0 ? '\n🟢 全綠' : `\n🔴 ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);
