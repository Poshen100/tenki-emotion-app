/**
 * preview-shot.mjs — generic headless screenshot for any apps/preview page,
 * so the founder can verify color/layout changes from a phone without waiting
 * for a deploy.
 *
 * Serves the repo root over local HTTP (relative links work like on Vercel),
 * opens the page at an iPhone-ish viewport, and writes a full-page PNG.
 *
 * Run:  node scripts/preview-shot.mjs <repo-relative-path | 正式路由> [out.png]
 * e.g.  node scripts/preview-shot.mjs apps/preview/scan-result.html /tmp/shot.png
 *       node scripts/preview-shot.mjs drift/ /tmp/drift.png
 *
 * 🔴 想看 founder 手機上看到的那一頁，就給**正式路由**（`drift/`、`v3/`），
 *    不要給檔案路徑：正式站的 `/drift/` 與 repo 裡的 `drift-alert.html` 是
 *    兩回事，而路由由 `vercel.json` 決定（見 `lib/preview-routes.mjs`）。
 *
 * Limits (see docs/PLAYBOOK.md §6):
 *  - Sandbox blocks CDN (Google Fonts / GSAP / Three / MediaPipe) → system-font
 *    fallback, progressive-enhancement paths render without those libs.
 *  - Desktop Chromium, not iOS Safari — 100vh/dvh, mix-blend OOM, camera and
 *    haptics behavior still need a real device.
 *  - Static states only; camera/gesture-gated flows can't be walked headlessly.
 */
// Playwright 從共用 resolver 拿：CI 走 node_modules、容器退回全域安裝。
// 這一行原本是寫死的 /opt/node22/... 絕對路徑 —— 那就是 harness 進不了 CI 的原因。
import { getChromium } from './lib/playwright.mjs';
import { resolveRoute } from './lib/preview-routes.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// top-level await：ESM 可以，且必須在任何 chromium.* 之前解析完。
const chromium = await getChromium();

const [, , pagePath, outArg] = process.argv;
if (!pagePath) {
  console.error('usage: node scripts/preview-shot.mjs <repo-relative-path> [out.png]');
  process.exit(1);
}
const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const outPng = resolve(outArg ?? '/tmp/preview-shot.png');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

/**
 * 正式路由 → repo 路徑，**整組從 `vercel.json` 推導**。
 *
 * 🔴 頁面裡的 `<script src="/preview/...">` 用的是**正式路由**，不是 repo 路徑。
 *    不做改寫，那些 script 全部 404 —— 而頁面**照樣渲染**（HTML 是靜態的），
 *    截出來的圖看起來很正常，只是 JS 一行都沒跑。2026-09-16 實例：我截了
 *    decision-alert.html 去看新加的入口列，副標是空的，差點當成 bug 去查 ——
 *    真相是 decision-outcome.js 404 → 檔案頂層 `TENKI_OUTCOME.STORE_KEY` 直接拋錯。
 *    ⚠️ 這比「截不到」危險：截不到會發現，截到一個死頁面不會。
 *
 * 🔴 2026-09-30：這裡原本是三行手抄的 `startsWith`，其中 `/drift/` 寫成
 *    `'/apps/preview/' + pathname.slice(7)` —— 尾巴是空字串，解到目錄
 *    `apps/preview/`，而**那個目錄底下真的有 index.html**。於是 200、無
 *    console.error、截了一張完整漂亮的圖，只是那是另一頁。
 *    手抄的版本沒救，所以現在讀 `vercel.json` 本身：見 `lib/preview-routes.mjs`。
 */
const server = http.createServer((req, res) => {
  const route = resolveRoute(
    normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''),
  );
  if ('redirect' in route) {
    res.writeHead(307, { location: route.redirect }).end();
    return;
  }
  let file = join(repoRoot, route.path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/${pagePath}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
page.on('console', (m) => { if (m.type() === 'error') console.error('[console.error]', m.text()); });

// 同源的 4xx ＝ 本地伺服器沒把某條正式路由解出來。頁面會照樣渲染，所以
// 這件事必須用**吼的**：一張安靜的死頁面比一張截不到的圖危險得多。
const missed = [];
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1:')) {
    missed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  }
});
page.on('pageerror', (e) => console.error('[pageerror]', String(e)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => {
  console.error('goto (CDN 資源被沙箱擋是預期的):', e.message);
});
await page.waitForTimeout(1500); // let entrance animations settle
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
server.close();
if (missed.length > 0) {
  console.error(`\n🔴 同源 404（這張圖上的 JS 沒跑完，不要拿它下判斷）:`);
  for (const m of missed) console.error(`   ${m}`);
}
console.log(`✓ ${url} → ${outPng}`);
if (missed.length > 0) process.exit(1);
