/**
 * preview-routes.mjs — 把 `vercel.json` 的 redirects / rewrites 讀進來，
 * 給本地 harness 與截圖伺服器當唯一的一份路由。
 *
 * 🔴 為什麼要有這支：**每一支 harness 都自己手抄一份 vercel rewrite**，
 * 抄漏的那條不會噴錯，會靜默指到另一個真的存在的檔案。
 *
 * 已經付過三次學費（前兩次的紀錄留在 `scripts/preview-strip-color.mjs`
 * 的伺服器註解裡）：
 *   1. 少了 `/preview/*` → decision-alert.html 的模組一路 404，頁面照樣渲染。
 *   2. 只抄了 `/v3/`、少抄 `/v3/(.*)` → takeover 的 CSS 404，整層蓋住 Session。
 *   3. 2026-09-30：`/drift/` 被寫成 `'/apps/preview/' + pathname.slice(7)`，
 *      尾巴是空字串 → 解到目錄 `apps/preview/` → **`index.html` 真的存在**，
 *      於是伺服器回 200、頁面正常、`pageerror` 空的，截到的卻是另一頁。
 *      我差點拿那張圖去判斷 `/drift/` 的版面。
 *
 * 第 3 次的形狀跟前兩次不同 —— 不是少一條，是**目錄式路由推錯檔名** ——
 * 所以修法不能再是「這次記得多抄一條」。這支把來源換成 `vercel.json` 本身：
 * 手抄不掉，也就漏不掉。
 *
 * @module scripts/lib/preview-routes
 */

import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 路徑：repo 根目錄下的 `vercel.json`。 */
export const VERCEL_CONFIG_PATH = join(REPO_ROOT, 'vercel.json');

/**
 * 把 Vercel 的 source pattern 轉成 RegExp。
 *
 * Vercel 的 source 是整條 path 的完全比對，`(.*)` 是唯一用到的捕捉群組。
 * 其餘字元一律當字面值跳脫 —— 尤其 `.`，不跳脫的話 `/v3/a.css` 這種
 * 路徑會被別條規則誤中。
 *
 * @param {string} source - vercel.json 裡的 source 字串。
 * @returns {RegExp} 對整條 pathname 做完全比對的 RegExp。
 */
function toPattern(source) {
  const body = source
    .split('(.*)')
    .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.*)');
  return new RegExp(`^${body}$`);
}

/**
 * 讀出 vercel.json 的路由表。
 *
 * @returns {{redirects: Array<{source: string, destination: string}>, rewrites: Array<{source: string, destination: string}>}}
 */
export function readVercelRoutes() {
  const config = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, 'utf8'));
  return {
    redirects: config.redirects ?? [],
    rewrites: config.rewrites ?? [],
  };
}

/**
 * 套用一組規則：依序比對，第一條中的就用它（Vercel 的語意）。
 *
 * @param {string} pathname - 要解析的路徑。
 * @param {Array<{source: string, destination: string}>} rules - 規則表。
 * @returns {string | null} 目的地，或 null（沒有任何一條中）。
 */
function applyRules(pathname, rules) {
  for (const rule of rules) {
    const match = toPattern(rule.source).exec(pathname);
    if (match === null) continue;
    return rule.destination.replace(/\$(\d)/g, (_, i) => match[Number(i)] ?? '');
  }
  return null;
}

/**
 * 把一條公開路徑解析成 repo 內的檔案路徑，行為跟正式站一致。
 *
 * @param {string} pathname - 瀏覽器請求的 pathname（不含 query）。
 * @returns {{redirect: string} | {path: string}} 需要轉址時回 `redirect`，
 *   否則回 repo 根目錄下的相對路徑（開頭有 `/`）。
 */
export function resolveRoute(pathname) {
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const { redirects, rewrites } = readVercelRoutes();

  const redirect = applyRules(clean, redirects);
  if (redirect !== null) return { redirect };

  const rewritten = applyRules(clean, rewrites);
  return { path: rewritten ?? clean };
}

/**
 * 判斷一條公開路徑是否已經有明確的規則在管（不是掉到 catch-all）。
 *
 * harness 用它來斷言「我要截的這一頁，本地跟正式站走的是同一條規則」。
 *
 * @param {string} pathname - 公開路徑。
 * @returns {boolean} 有專屬規則為 true。
 */
export function hasExplicitRoute(pathname) {
  const { redirects, rewrites } = readVercelRoutes();
  const named = [...redirects, ...rewrites].filter(
    (rule) => rule.source !== '/' && rule.source !== '/(.*)',
  );
  return named.some((rule) => toPattern(rule.source).test(normalize(pathname)));
}
