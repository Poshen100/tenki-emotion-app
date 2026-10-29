/**
 * preview-sw-push.mjs — `/decision-alert/sw.js` 兩個 handler 的迴歸驗證。
 *
 * 為什麼需要這支：service worker 是 CI 盲區裡的盲區 —— `apps/preview/**` 本來
 * 就沒有單元測試，而 sw.js 連頁面都不是，`node --check` 只看得到語法。
 * 而它掌管的兩件事都會**靜默**出錯：
 *   · 所有通知共用一個 tag → 第二則直接取代第一則，使用者永遠看不到第一則
 *   · `notificationclick` 算出了 target 卻沒用它 → 點通知到錯的畫面
 * 兩個都不會丟錯誤、不會留痕跡。
 *
 * 做法：把 sw.js 的原始碼載進一個普通頁面（`self === window`），用 stub 接管
 * `addEventListener` / `registration` / `clients`，再餵合成事件進去。
 * ⚠️ 驗的是**真的那份檔案**，不是在這裡重打一份邏輯 —— 後者會自己腐爛。
 *
 * Run:  node scripts/preview-sw-push.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const SW_SRC = readFileSync(join(repoRoot, 'apps/preview/sw.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`✓ ${name}`); } else {
    fail += 1;
    console.log(`✗ ${name}\n    得到 ${JSON.stringify(actual)}，預期 ${JSON.stringify(expected)}`);
  }
}

const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

// sw.js 裝進頁面：addEventListener 被接管，handler 存進 __sw。
await page.evaluate((src) => {
  window.__sw = {};
  const realAdd = window.addEventListener.bind(window);
  window.addEventListener = (kind, fn) => { window.__sw[kind] = fn; };
  // eslint-disable-next-line no-eval
  window.eval(src);
  window.addEventListener = realAdd;
}, SW_SRC);

const installed = await page.evaluate(() => Object.keys(window.__sw).sort());
check('🔴 兩個 handler 都真的註冊了（前提不成立就別信下面任何一條）',
  installed, ['notificationclick', 'push']);

/** 餵一則 push，回傳 showNotification 收到的 options。 */
async function firePush(payload) {
  return page.evaluate(async (p) => {
    const shown = [];
    window.registration = { showNotification: (t, o) => { shown.push({ title: t, options: o }); return Promise.resolve(); } };
    const waits = [];
    window.__sw.push({
      data: p === null ? null : { json: () => p },
      waitUntil: (x) => waits.push(x),
    });
    await Promise.all(waits);
    return shown;
  }, payload);
}

console.log('\n── push：tag 決定哪兩則會互相取代 ──');
{
  const a = await firePush({ title: 'T', body: 'ES', url: '/decision-alert/', tag: 'tenki-alert:ES1!' });
  const b = await firePush({ title: 'T', body: 'NQ', url: '/decision-alert/', tag: 'tenki-alert:NQ1!' });
  check('🔴 不同標的 → 不同 tag（第二則不會蓋掉第一則）',
    a[0].options.tag !== b[0].options.tag, true);
  check('   而且 tag 照用 server 給的，不自己發明', a[0].options.tag, 'tenki-alert:ES1!');
}
{
  const a = await firePush({ tag: 'tenki-alert:ES1!' });
  const b = await firePush({ tag: 'tenki-alert:ES1!' });
  // 成對的另一半：只驗「不同標的不同 tag」的話，每則都給隨機值也會綠 ——
  // 而那會讓同一標的的重複快訊在鎖屏上疊成一排。
  check('🔴 同一標的 → 同一個 tag（重複快訊收斂，不疊成一排）',
    a[0].options.tag, b[0].options.tag);
}
{
  // 🔴 payload 沒帶 tag ＝ 我們**不知道**這則跟上一則是不是同一件事。
  //    退回常數就是宣稱「是」，而那正是原本的 bug。
  const a = await firePush({ title: 'T' });
  const b = await firePush({ title: 'T' });
  check('🔴 沒有 tag 時每則都不同（不知道就不要宣稱「這兩則是同一件事」）',
    a[0].options.tag !== b[0].options.tag, true);
  check('   而且不是那個會互相蓋掉的舊常數',
    a[0].options.tag === 'tenki-alert', false);
}
{
  const bad = await firePush(null);
  check('payload 壞掉也要顯示得出來（有預設文案）',
    typeof bad[0].options.body === 'string' && bad[0].options.body.length > 0, true);
}

console.log('\n── notificationclick：target 要真的被用到 ──');
/** 餵一次點擊，回傳 stub 記到的動作。 */
async function fireClick(targetUrl, clientUrls) {
  return page.evaluate(async ([target, urls]) => {
    const acts = [];
    const clients = urls.map((u) => ({
      url: u,
      focus() { acts.push(['focus', this.url]); return Promise.resolve(this); },
      navigate(to) { acts.push(['navigate', to]); return Promise.resolve(this); },
    }));
    window.clients = {
      matchAll: () => Promise.resolve(clients),
      openWindow: (u) => { acts.push(['open', u]); return Promise.resolve(null); },
    };
    const waits = [];
    window.__sw.notificationclick({
      notification: { close: () => acts.push(['close']), data: { url: target } },
      waitUntil: (x) => waits.push(x),
    });
    await Promise.all(waits);
    return acts;
  }, [targetUrl, clientUrls]);
}

{
  const acts = await fireClick('/decision-alert/', []);
  check('沒有視窗 → 開一個，而且開在 target', acts.filter((a) => a[0] === 'open'), [['open', '/decision-alert/']]);
}
{
  const acts = await fireClick('/decision-alert/', ['https://x.test/decision-alert/']);
  check('已經停在目的地 → 只 focus，不多導一次',
    acts.filter((a) => a[0] !== 'close'), [['focus', 'https://x.test/decision-alert/']]);
}
{
  // 🔴 這一條就是那個洞：先前只要是本站視窗就 focus，target 完全沒用到。
  const acts = await fireClick('/decision-alert/#result', ['https://x.test/decision-alert/']);
  const navigated = acts.filter((a) => a[0] === 'navigate');
  check('🔴 視窗停在別的網址 → focus **並且導到 target**（不是只 focus）',
    navigated, [['navigate', '/decision-alert/#result']]);
}
{
  // 不是本站的視窗不能被當成「找到了」。
  const acts = await fireClick('/decision-alert/', ['https://x.test/v3/']);
  check('別頁的視窗不算數 → 照樣開新的', acts.filter((a) => a[0] === 'open'), [['open', '/decision-alert/']]);
}
{
  const acts = await fireClick('/decision-alert/', ['https://x.test/decision-alert/']);
  check('通知一定會被關掉', acts.some((a) => a[0] === 'close'), true);
}

await browser.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
