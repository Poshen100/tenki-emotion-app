/**
 * preview-shot.mjs — generic headless screenshot for any apps/preview page,
 * so the founder can verify color/layout changes from a phone without waiting
 * for a deploy.
 *
 * Serves the repo root over local HTTP (relative links work like on Vercel),
 * opens the page at an iPhone-ish viewport, and writes a full-page PNG.
 *
 * Run:  node scripts/preview-shot.mjs <repo-relative-path> [out.png]
 * e.g.  node scripts/preview-shot.mjs apps/preview/scan-result.html /tmp/shot.png
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

const server = http.createServer((req, res) => {
  const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(repoRoot, clean);
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
await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => {
  console.error('goto (CDN 資源被沙箱擋是預期的):', e.message);
});
await page.waitForTimeout(1500); // let entrance animations settle
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
server.close();
console.log(`✓ ${url} → ${outPng}`);
