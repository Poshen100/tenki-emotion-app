/**
 * preview-scan-blink.mjs — 驗 Soul Lock Beat 3 的眨眼偵測。
 *
 * 為什麼需要這支：founder 2026-08-29 兩次實走都拿到「未偵測到眨眼」，第二次
 * 他明確說**他有眨**。原因是 FaceMesh 每 180ms 才推論一次，而一次眨眼閉合只有
 * 100–150ms —— 落到取樣點上的多半是「半閉」那一幀，絕對門檻兩邊都不滿足。
 *
 * 偵測改成看谷底之後，風險就換了一邊：**放寬靈敏度不能放寬誠實度**。
 * 「眨眼確認」那行字在宣稱一個事實，所以這支同時驗兩件事：
 *   - 真的眨眼要抓得到（含只抓到半閉那一幀的情況）
 *   - 瞇眼、低頭、緩慢閉合**不得**被算成眨眼
 *
 * 直接餵開合度序列給模組開出來的純狀態機（`TENKI_READINESS_SCAN.__blink`），
 * 不開相機、不走完整場掃描。
 *
 * 第二段（2026-09-25）：**gold 的判準**（`__policy.securedEarned`）。
 * 放在這裡而不是 preview-scan-stardust.mjs，理由很實際 —— 那支**不在 verify.sh
 * 也不在 CI**（它倚賴「容器連不到 cdnjs」這個前提），guard 放進去等於永遠不會跑。
 * 這支同樣只需要把 readiness-scan.js 載進一個頁面，而且兩邊都跑得到。
 *
 * Run: node scripts/preview-scan-blink.mjs
 */
// Playwright 的取得集中在 scripts/lib/playwright.mjs：先走 devDependency，
// 找不到才退回開發容器的絕對路徑。寫死容器路徑正是這批 harness 一直進不了
// CI 的唯一硬阻礙（#226 第四輪），這支是 #240 之後才寫的，當時漏掉。
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

/**
 * 每個案例是一串**取樣到的**開合度（每 180ms 一個），不是連續訊號 ——
 * 這正是儀器真正看得到的東西。
 */
const CASES = [
  // ── 應該要抓到 ──
  { name: '完整閉眼落在取樣點上（絕對門檻）',
    seq: [1, 1, 0.98, 0.10, 0.95, 1], want: 1 },
  { name: '只抓到半閉那一幀（180ms 取樣的常態）',
    seq: [1, 1, 0.97, 0.38, 0.99, 1], want: 1 },
  { name: '眼睛本來就比較細的人（基線 0.5）也要抓得到',
    seq: [0.5, 0.5, 0.5, 0.5, 0.5, 0.22, 0.5, 0.5], want: 1 },
  { name: '兩次眨眼算兩次',
    seq: [1, 1, 0.35, 1, 1, 1, 0.33, 1, 1], want: 2 },

  // ── 不得誤判（這排才是誠實度的守門）──
  { name: '瞇眼兩秒後睜開，不是眨眼',
    seq: [1, 1, 0.45, 0.44, 0.43, 0.45, 0.44, 0.43, 0.45, 1, 1], want: 0 },
  { name: '緩慢閉合再緩慢睜開（低頭），不是眨眼',
    seq: [1, 0.9, 0.75, 0.6, 0.45, 0.35, 0.45, 0.6, 0.75, 0.9, 1], want: 0 },
  { name: '完全沒眨（穩定睜著）',
    seq: [1, 1, 0.99, 1, 0.98, 1, 1], want: 0 },
  { name: '眨眼整個落在兩次取樣之間 → 誠實地報 0，不補一個',
    seq: [1, 1, 0.99, 0.97, 1, 0.98], want: 0 },
  { name: '輕微抖動不算眨眼',
    seq: [1, 0.95, 0.9, 0.93, 0.97, 1, 0.94], want: 0 },
];

const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/apps/preview/v6/index.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForFunction(() => !!(window.TENKI_READINESS_SCAN
  && window.TENKI_READINESS_SCAN.__blink), null, { timeout: 15_000 });

const consts = await page.evaluate(() => window.TENKI_READINESS_SCAN.__blink.constants);
console.log(`取樣間隔 ${consts.FACE_INTERVAL_MS}ms · 谷 <${consts.BLINK_DIP_RATIO}×基線 · `
  + `回升 ≥${consts.BLINK_RECOVER_RATIO}×基線 · 谷最長 ${consts.BLINK_DIP_MAX_SAMPLES} 幀\n`);

const results = await page.evaluate((cases) => {
  const B = window.TENKI_READINESS_SCAN.__blink;
  return cases.map((c) => {
    const st = B.newState();
    let n = 0;
    for (const v of c.seq) { if (B.detect(st, v)) n += 1; }
    return { name: c.name, want: c.want, got: n };
  });
}, CASES);

let pass = 0;
let fail = 0;
for (const r of results) {
  const ok = r.got === r.want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${r.name}` + (ok ? '' : `  ← 期望 ${r.want} 次，得到 ${r.got} 次`));
}

// ── gold 的判準（founder 2026-09-25：信心低就不給 SECURED）──
//
// 為什麼要有這一段：一次「穩定度 58% · 未偵測到眨眼 · 信心低」的掃描，教練文案
// 正說「讀數僅供參考」，外框與完成鈕卻是 SECURED 的金色。**顏色宣稱的比文字強**，
// 兩個一起出現時使用者信的是顏色。而「有讀數但信心低」那一格只有走完整場掃描
// 才碰得到 —— CI 裡跑不出來，所以規則開成純函式，直接驗真值表。
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) console.log(`   期待 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`);
}

console.log('\n── gold 的判準 ──');
check('🔴 gold 的真值表（沒讀數 / 信心低都不給，中以上才給）', await page.evaluate(() => {
  const earned = window.TENKI_READINESS_SCAN.__policy.securedEarned;
  return {
    none: earned(null),
    low: earned({ confidence: 'low' }),
    moderate: earned({ confidence: 'moderate' }),
    high: earned({ confidence: 'high' }),
  };
}), { none: false, low: false, moderate: true, high: true });

// 🔴 **接線守衛**：真值表對了不代表產品有在問它。
// 這個 repo 反覆踩到的就是那一類 —— 規則存在，但它的掃描範圍比它宣稱的小。
// 所以直接掃原始碼：檔案裡每一處 `classList.add('secured')` 與每一個
// `revealTone(` 的**呼叫**都必須在同一行問到 `securedEarned`。
// 把條件改回 `if (frame)` 或 `revealTone(reading.band)` 都會讓這條紅。
// ⚠️ 若之後把那些呼叫拆成多行，這條會誤報 —— 請一起更新，不要直接刪。
{
  const src = readFileSync(join(repoRoot, 'apps/preview/readiness-scan.js'), 'utf8');
  const unguarded = src.split('\n').filter((line) => {
    if (/^\s*(\*|\/\/)/.test(line)) return false;         // 註解行不算
    if (/function revealTone\(/.test(line)) return false;  // 宣告不是呼叫
    const touchesGold = /classList\.add\('secured'\)/.test(line) || /revealTone\(/.test(line);
    return touchesGold && !/securedEarned/.test(line);
  });
  check('🔴 每一個上 gold 的出口都問過 securedEarned（接線守衛）', unguarded, []);
}

await browser.close();
server.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
