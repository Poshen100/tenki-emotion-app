/**
 * preview-cinematic.mjs — 驗電影級視覺骨架（apps/preview/cinematic.js）的 dark launch。
 *
 * 規格：docs/prompts/antigravity-cinematic-kickoff.md Guardrail 1 ——
 * 不帶 `?cine` 時，所有頁面行為與現在一致。這支鎖住的就是那件事，
 * 外加「帶了合法 take 時，兩層質感真的有出現、而且不吃點擊」。
 *
 * 鎖的事情：
 *   1. 🔴 沒帶 / 不合法的 `cine` → 沒有 data-cine、沒有注入 <style>、沒有 global、
 *      掃描覆蓋層的 ::before / ::after 都是 `none`。
 *   2. `cine=1..3` → 旗標、take 編號、暗角與顆粒兩層都在、pointer-events:none、
 *      顆粒透明度維持在「質感」等級（≤ 0.1），不是一層灰幕。
 *   3. 🔴 cinematic.js 原始碼裡沒有 gold —— 金色只能經 `securedEarned()` 出口。
 *
 * Run: node scripts/preview-cinematic.mjs
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith('/preview/')) clean = '/apps/preview/' + clean.slice('/preview/'.length);
  const file = join(repoRoot, clean);
  if (!existsSync(file) || statSync(file).isDirectory() || !file.startsWith(repoRoot)) {
    res.writeHead(404).end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}` + (ok || detail === undefined ? '' : `  ← ${detail}`));
}

const chromium = await getChromium();
const browser = await chromium.launch();

/** 開 v6、打開掃描覆蓋層，回傳 cinematic 相關狀態。 */
async function probe(query) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'],
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/apps/preview/v6/index.html${query}`, { waitUntil: 'domcontentloaded' })
    .catch(() => {});
  await page.waitForFunction(() => !!window.TENKI_READINESS_SCAN, null, { timeout: 15_000 });
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'daily' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  const s = await page.evaluate(() => {
    const ov = document.getElementById('tenki-readiness-scan');
    const b = getComputedStyle(ov, '::before');
    const a = getComputedStyle(ov, '::after');
    return {
      attr: document.documentElement.getAttribute('data-cine'),
      grainVar: document.documentElement.style.getPropertyValue('--cine-grain'),
      styleTag: !!document.querySelector('style[data-tenki-cinematic]'),
      global: typeof window.TENKI_CINE === 'undefined' ? null : { ...window.TENKI_CINE },
      frozen: typeof window.TENKI_CINE === 'undefined' ? null : Object.isFrozen(window.TENKI_CINE),
      before: { content: b.content, pe: b.pointerEvents, bg: b.backgroundImage },
      after: { content: a.content, pe: a.pointerEvents, bg: a.backgroundImage, op: Number(a.opacity) },
    };
  });
  await ctx.close();
  return s;
}

// ── 1. 🔴 inert：沒帶與各種不合法值 ──
for (const q of ['', '?cine=0', '?cine=4', '?cine=abc', '?cine=', '?cine=12', '?cinema=1']) {
  const s = await probe(q);
  const label = q || '（沒帶參數）';
  check(`🔴 ${label}：沒有 data-cine`, s.attr === null, s.attr);
  check(`🔴 ${label}：沒有注入 <style>`, !s.styleTag);
  check(`🔴 ${label}：沒有 --cine-grain`, s.grainVar === '', s.grainVar);
  check(`🔴 ${label}：沒有 window.TENKI_CINE`, s.global === null, JSON.stringify(s.global));
  check(`🔴 ${label}：覆蓋層 ::before / ::after 都是 none`,
    s.before.content === 'none' && s.after.content === 'none',
    `${s.before.content} / ${s.after.content}`);
}

// ── 2. 啟用：每個 take 都要長出兩層 ──
for (const t of [1, 2, 3]) {
  const s = await probe(`?cine=${t}`);
  check(`cine=${t}：data-cine="${t}"`, s.attr === String(t), s.attr);
  check(`cine=${t}：TENKI_CINE.take === ${t}`, s.global && s.global.take === t, JSON.stringify(s.global));
  check(`cine=${t}：TENKI_CINE 是唯讀的`, s.frozen === true);
  check(`cine=${t}：暗角層存在且是漸層`,
    s.before.content !== 'none' && /gradient/.test(s.before.bg), s.before.bg.slice(0, 60));
  check(`cine=${t}：顆粒層存在且吃的是預生成貼圖`,
    s.after.content !== 'none' && /data:image\/png/.test(s.after.bg), s.after.bg.slice(0, 60));
  check(`cine=${t}：🔴 兩層都不吃點擊（取消鈕要按得到）`,
    s.before.pe === 'none' && s.after.pe === 'none', `${s.before.pe} / ${s.after.pe}`);
  check(`cine=${t}：顆粒是質感不是灰幕（0 < opacity ≤ 0.1）`,
    s.after.op > 0 && s.after.op <= 0.1, s.after.op);
}

// ── 3. 🔴 原始碼裡沒有 gold ──
const src = readFileSync(join(repoRoot, 'apps/preview/cinematic.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // 只看程式碼，註解裡提到 gold 是在講規則
check('🔴 cinematic.js 程式碼沒有 gold / secured / #FFD46E',
  !/gold|secured|#?ffd46e/i.test(src));

await browser.close();
server.close();
console.log(`\n${fail ? '🔴' : '🟢'} pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
