/**
 * preview-strip-color.mjs — 迴歸驗證：momentum strip 的顏色必須與紀律完成率一致。
 *
 * 為什麼需要這支：`apps/preview/**` 是 CI 盲區（PLAYBOOK §3），而「條紋顏色」這種
 * 錯誤語法檢查抓不到、只有人眼在手機上看得出來。
 *
 * 2026-08-07 founder 實走查出的實例：結構守望（#219）把 outcomeTag 改名成
 * judged_entered / judged_stood_down / abandoned_no_judgment 之後，`segColor()`
 * 仍在逐一比對舊名，於是 `judged_entered` 掉進 else 分支被畫成 strain 橘
 * (#C2703D) —— 同一筆決策，條紋說「破戒」而正上方的完成率說 100%。
 *
 * 反向驗證過：把 segColor() 改回舊版，本 harness 會失敗並回報 rgb(194,112,61)。
 *
 * 2026-08-09 起也守模板選單的終端機排版與兩條內容紅線（MODE_2 不上畫面、不推薦）。
 * ⚠️ 那次改版把 `.tpl-card` 改名成 `.tpl-row`，本 harness 的選擇器當場失效 ——
 * preview harness **沒有進 verify.sh**（Playwright 路徑是容器限定），所以它不會
 * 自己喊痛。改 preview 的 class 名時要一併 grep scripts/*.mjs。
 *
 * 走法：模擬快訊 → 進入決策 → 選 FBD → 立刻「成立 · 我進場了」→ 讀收束頁條紋。
 * Run:  node scripts/preview-strip-color.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
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
const base = `http://127.0.0.1:${server.address().port}`;

/** tokens.css：--zone-strain #C2703D / --zone-clear #00B4D8 */
const STRAIN = 'rgb(194, 112, 61)';
const CLEAR = 'rgb(0, 180, 216)';

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${got}\n    want: ${want}`}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
page.on('pageerror', (e) => {
  console.error('[pageerror]', e.message);
  fail += 1;
});

await page.goto(`${base}/apps/preview/decision-alert.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);

await page.click('#btnSingle');
await page.waitForTimeout(600);
await page.click('#btnEngage');
await page.waitForTimeout(400);

// ── 模板選單：終端機讀數 ──
// founder 2026-08-09 點名這一頁「太遜」，要的是彭博終端機。下面守的是它的
// **結構性特徵**（等寬骨架 / 硬邊 / 欄位表頭 / 列編號），以及兩條內容紅線。
const sheetText = await page.$eval('#tplSheet', (n) => n.innerText);

// 🔴 內部 template id 不得上畫面。在 Adam Mancini 的語彙裡「Mode 2」指的是
// **盤整日盤勢**，跟這個模板（Canslim High RS Breakout）完全兩回事 ——
// 先前標題印成「高 RS 突破流程（MODE_2）」，剛好撞上 founder 每天在用的術語。
check('MODE_2 不得出現在任何 user-facing 文字裡', sheetText.includes('MODE_2'), false);
check('顯示的是交易者看得懂的代號（HIGH RS）', sheetText.includes('HIGH RS'), true);

// 交易者本來就有自己的偏好 —— 不推薦，只陳述「這筆快訊標的是這個結構」。
check('不得出現「建議」字樣', sheetText.includes('建議'), false);
check('快訊匹配以中性欄位值呈現（ALERT）', sheetText.includes('ALERT'), true);

// emoji 會有 AI 感（founder 原話）。
// ⚠️ 範圍要涵蓋 U+2B00-2BFF —— ⭐ 是 U+2B50，不在 2600-27BF 裡。
// 反向驗證時把 ⭐建議 加回去，第一版的 regex 沒抓到（自己漏的，當場補上）。
check('模板列不得有 emoji',
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u.test(sheetText), false);

// 終端機的骨架：等寬（拉丁與數字欄位）、硬邊、欄位表頭、彭博式列編號。
const term = await page.evaluate(() => {
  const cs = (s) => getComputedStyle(document.querySelector(s));
  return {
    codeMono: /mono/i.test(cs('.tpl-code').fontFamily),
    rowRadius: cs('.tpl-row').borderRadius,
    hasHead: !!document.querySelector('.tpl-head'),
    numbered: [...document.querySelectorAll('.tpl-code')].every((n, i) => n.textContent.startsWith(`${i + 1}) `)),
  };
});
check('代號欄是等寬字', term.codeMono, true);
check('列是硬邊（不是圓角卡片）', term.rowRadius, '0px');
check('有欄位表頭列', term.hasHead, true);
check('每一列都有彭博式編號 N)', term.numbered, true);

await page.click('.tpl-row'); // 第 1 列 = 快訊標記的 FBD
await page.waitForTimeout(1200); // 讓守望條累積幾秒（快速判定正是要保護的案例）
await page.click('#btnStructureConfirmed');
await page.waitForTimeout(1600); // 收束頁的揭示編排

const rate = (await page.textContent('#resultRate'))?.trim() ?? '';
console.log(`\n紀律完成率文字：「${rate}」`);
check('快速判定進場算紀律（完成率 100%）', /100%/.test(rate), true);

const segBg = await page.$eval('#resultStrip .result-seg', (n) => getComputedStyle(n).backgroundColor);
check('momentum strip 本次段落 = 紀律色', segBg, CLEAR);
check('momentum strip 不得畫成 strain 橘', segBg !== STRAIN, true);

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
