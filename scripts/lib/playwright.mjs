/**
 * playwright.mjs — 讓 harness 在**兩種環境**都拿得到 Playwright。
 *
 * 為什麼需要這一層：六支 harness 原本都寫死
 * `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
 * —— 那是這個開發容器的全域安裝路徑，GitHub runner 上不存在。
 * **這就是 preview harness 一直進不了 CI 的唯一硬阻礙**（不是什麼架構問題），
 * 而那個盲區已經咬人兩次：
 *   1. #231 改了 Hero 無讀數文案沒改斷言 → preview-strip-color 在 main 上
 *      紅著 44/45 好幾天沒人發現。
 *   2. #229/#231/#232 讓 Hero 讀數爆版三次都沒紅，最後是 founder 用手機發現的。
 *
 * 解法刻意是「先試套件、再退回絕對路徑」而不是二選一：
 * CI 走 devDependency（版本釘在 package.json），容器沒有 node_modules 時
 * 仍然照舊跑得動。**兩條路都要能走**，否則等於為了 CI 把現在的用法弄壞。
 */

/** 容器全域安裝的位置（GitHub runner 上不存在，所以只能當 fallback）。 */
const CONTAINER_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';

/**
 * 取得 chromium。優先用 node_modules 裡的（CI／`npm ci` 之後的本機），
 * 找不到才退回容器的全域安裝。
 *
 * @returns {Promise<import('playwright').BrowserType>}
 */
export async function getChromium() {
  try {
    const pw = await import('playwright');
    return (pw.default ?? pw).chromium;
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    const pw = await import(CONTAINER_PLAYWRIGHT);
    return (pw.default ?? pw).chromium;
  }
}

// ═══════════════════════════════════════════════════
// 字型金絲雀
//
// 🔴 這幾支 harness 量的是文字寬度與行數，而**文字寬度是字型的函式**。
// 實測同一組字串在不同字型下（390px 視窗、頁面實際字級）：
//
//   字型              尚未量測@30px   Neutral@36px
//   容器預設 sans        120            124
//   WenQuanYi Zen Hei    120            114
//   DejaVu Sans          120            152   ← 環心只有 ~128px
//
// 中文是穩的（漢字天生 1em/字，任何字型都一樣），**英文差到 33%**。
// 所以 CI 不釘字型就把 harness 丟進去，第一次跑就會紅 —— 而且是假紅。
//
// CI 裝 fonts-wqy-zenhei 讓兩邊一致（founder 2026-08-19 拍板）。但「釘住」只
// 保證**現在**一致，擋不住哪天 runner image 換字型。所以先量一組已知字串：
// 對不上就**以字型不符失敗**，而不是讓它去翻掉「讀數不在圓內」那條 ——
// 否則下一個人看到的是一個看起來像版面 bug、其實是環境問題的紅燈。
//
// 斷言守的是「結構上有沒有溢出」，不是像素級的真實裝置外觀
// （真實裝置是 SF Pro，Linux 永遠拿不到）。
// ═══════════════════════════════════════════════════

/** 頁面實際用的字型堆疊（apps/preview/v6/index.html:75）。 */
const PAGE_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',sans-serif";

/** 基準值（容器 sans-serif 實測）。中文容差極小、英文放寬到 ±8px。 */
const FONT_BASELINE = [
  { text: '尚未量測', px: 30, expect: 120, tol: 2 },
  { text: 'Neutral', px: 36, expect: 124, tol: 8 },
];

/**
 * 在給定的 page 上量基準字串，回傳不符的項目（空陣列 = 環境對得上）。
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>} 人看得懂的偏差描述
 */
export async function checkFontCanary(page) {
  const measured = await page.evaluate(([stack, samples]) => {
    const el = document.createElement('div');
    el.style.cssText =
      `position:absolute;left:-9999px;top:0;white-space:nowrap;font-family:${stack};font-weight:600`;
    document.body.appendChild(el);
    const out = samples.map((s) => {
      el.style.fontSize = `${s.px}px`;
      el.textContent = s.text;
      return Math.round(el.getBoundingClientRect().width);
    });
    el.remove();
    return out;
  }, [PAGE_FONT_STACK, FONT_BASELINE]);

  return FONT_BASELINE.flatMap((s, i) => {
    const got = measured[i];
    if (Math.abs(got - s.expect) <= s.tol) return [];
    return [`「${s.text}」@${s.px}px 量到 ${got}px，基準是 ${s.expect}±${s.tol}px`];
  });
}
