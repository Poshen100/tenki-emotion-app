/**
 * preview-waitlist.mjs — `/story/` 頁尾搶先名單表單的實走檢查。
 *
 * 跑的是真的頁面；假的只有 `/api/waitlist`（用 Playwright 的 route 攔下來，
 * 每一條案例自己決定端點回什麼）。端點本身的行為在
 * `api/__tests__/waitlist.test.ts`，這支只管「畫面對每一種回應各說了什麼」。
 *
 * 用法：node scripts/preview-waitlist.mjs [--shot <png 路徑>]
 * ⚠️ 還沒接進 scripts/verify.sh 與 CI（那是制度變更，要 founder 自己 merge）。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { resolveRoute } from './lib/preview-routes.mjs';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const resolved = resolveRoute(decodeURIComponent(req.url.split('?')[0]));
  if ('redirect' in resolved) { res.writeHead(307, { location: resolved.redirect }).end(); return; }
  const file = join(repoRoot, resolved.path);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     得到 ${JSON.stringify(actual)}\n     預期 ${JSON.stringify(expected)}`}`);
}

const shotAt = process.argv.indexOf('--shot');
const shotPath = shotAt !== -1 ? process.argv[shotAt + 1] : null;

const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

/** 端點這一次要回什麼；null = 連線失敗。每條案例自己設。 */
let reply = { status: 200 };
const posted = [];
await page.route('**/api/waitlist', async (route) => {
  posted.push(route.request().postDataJSON());
  if (reply === null) { await route.abort(); return; }
  await route.fulfill({ status: reply.status, contentType: 'application/json', body: '{}' });
});

// 外部 CDN（字型、GSAP）在沙箱裡連不到，別讓它們拖住 load。
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
await page.goto(`${base}/story/`, { waitUntil: 'domcontentloaded' });

const status = page.locator('#waitlist-status');
const input = page.locator('#waitlist-email');
const submit = page.locator('#waitlist-submit');

async function attempt(email, next) {
  reply = next;
  await input.fill(email);
  await submit.click();
  await page.waitForFunction(() => {
    const s = document.getElementById('waitlist-status');
    const b = document.getElementById('waitlist-submit');
    return s && s.textContent.length > 0 && b && !b.disabled;
  });
  return (await status.textContent()) ?? '';
}

await input.scrollIntoViewIfNeeded();

console.log('── 表單在不在、看不看得到 ──');
check('表單可見（不靠任何進場動畫）', await page.locator('#waitlist').isVisible(), true);
const box = await page.locator('#waitlist').boundingBox();
check('390 寬下沒有超出畫面', box !== null && box.x >= 0 && box.x + box.width <= 390, true);
check('輸入框字級 ≥ 16px（否則 iOS 聚焦會放大整頁）',
  await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16), true);
check('輸入框與按鈕都有 44px 以上的觸控高度',
  [(await input.boundingBox()).height >= 44, (await submit.boundingBox()).height >= 44], [true, true]);
check('Hero 的鎖定文案沒被動到',
  (await page.locator('#hero-title').textContent()).replace(/\s+/g, ' ').trim(),
  'Read your edge before it reads you.');

console.log('── 每一種回應各一句話 ──');
const invalid = await attempt('not-an-email', { status: 200 });
check('格式不對 → 不送出', posted.length, 0);
check('格式不對 → 說格式不對', /email address/.test(invalid), true);

const ok = await attempt('Trader@Example.com', { status: 200 });
check('送出的是使用者打的那個地址', posted.at(-1), { email: 'Trader@Example.com' });
check('成功 → 說在名單上了', /on the list/.test(ok), true);
check('成功 → 清空輸入框', await input.inputValue(), '');
if (shotPath) await page.locator('#site-footer').screenshot({ path: shotPath });

const busy = await attempt('a@example.com', { status: 429 });
check('429 → 說太頻繁', /Too many/.test(busy), true);

const failedMsg = await attempt('a@example.com', { status: 502 });
check('502 → 說沒送成、沒存', /did not go through/.test(failedMsg), true);
check('502 → 留著使用者打的地址，不用重打', await input.inputValue(), 'a@example.com');

const offline = await attempt('a@example.com', null);
check('連不上 → 同樣說沒送成', /did not go through/.test(offline), true);

check('四句話互不相同', new Set([invalid, ok, busy, failedMsg]).size, 4);

await browser.close();
server.close();
console.log(failed === 0 ? '\n✅ preview-waitlist 全綠' : `\n❌ preview-waitlist ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);
