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
