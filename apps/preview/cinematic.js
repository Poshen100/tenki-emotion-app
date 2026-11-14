/**
 * cinematic.js — 電影級視覺的 dark-launch 骨架。
 *
 * 規格：docs/prompts/antigravity-cinematic-kickoff.md（Guardrail 1）。
 *
 * 🔴 **只在 `?cine=1|2|3` 時有作用。** 其他任何情況（沒帶、`cine=0`、`cine=4`、
 *    `cine=abc`）都在第一行就 return：不碰 DOM、不寫 CSS 變數、不定義任何 global。
 *    鎖定資產靠「預設值 = 恆等變換」這個結構性質守住，不是靠小心 ——
 *    `scripts/preview-cinematic.mjs` 直接驗這件事。
 *
 * 啟用時只做兩層**靜態**質感，掛在掃描覆蓋層（`#tenki-readiness-scan`，
 * 由 readiness-scan.js 自己注入）的兩個 pseudo-element 上：
 *
 *   ::before  暗角 —— 邊緣壓向純黑，z 在 stage 之下
 *   ::after   底片顆粒 —— 預生成的 128px 雜訊貼圖，z 在 stage 之上、不吃點擊
 *
 * 兩層都沒有任何每幀成本，也沒有動態，所以 reduced-motion 下長得一樣。
 * 鏡頭、轉焦、光條、聲音是 Antigravity 的 take，請掛在 `window.TENKI_CINE.take` 上分流。
 * ⚠️ 不得在這裡加 gold —— 金色只能經 `securedEarned()` 出口（Guardrail 4）。
 */
(function () {
  'use strict';

  /** 允許的 take 編號上限（Take 1 望遠鏡 / 2 對焦 / 3 快門）。 */
  var CINE_MAX_TAKE = 3;
  /** 顆粒貼圖邊長（px）。小張重複鋪即可，不要每幀重畫。 */
  var CINE_GRAIN_SIZE = 128;

  var take = parseTake(window.location.search);
  if (!take) return;

  /**
   * 從 query 讀 take 編號；不合法一律回 0（＝inert）。
   * @param {string} search location.search
   * @returns {number}
   */
  function parseTake(search) {
    var m = /[?&]cine=([^&#]*)/.exec(search || '');
    if (!m) return 0;
    var n = m[1];
    if (!/^[1-9]$/.test(n)) return 0;
    var v = Number(n);
    return v <= CINE_MAX_TAKE ? v : 0;
  }

  /**
   * 產生一張灰階雜訊貼圖的 data URL。固定種子 —— 同一台機器每次長得一樣，
   * harness 也才比得出東西。
   * @returns {string} data:image/png URL；canvas 不可用時回空字串
   */
  function grainDataUrl() {
    try {
      var c = document.createElement('canvas');
      c.width = CINE_GRAIN_SIZE;
      c.height = CINE_GRAIN_SIZE;
      var ctx = c.getContext('2d');
      if (!ctx) return '';
      var img = ctx.createImageData(CINE_GRAIN_SIZE, CINE_GRAIN_SIZE);
      var seed = 0x7e4c1;
      for (var i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
        var g = seed >>> 24;
        img.data[i] = g;
        img.data[i + 1] = g;
        img.data[i + 2] = g;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }

  var root = document.documentElement;
  root.setAttribute('data-cine', String(take));

  var grain = grainDataUrl();
  if (grain) root.style.setProperty('--cine-grain', 'url("' + grain + '")');

  var SEL = 'html[data-cine] #tenki-readiness-scan';
  var style = document.createElement('style');
  style.setAttribute('data-tenki-cinematic', '1');
  style.textContent = [
    // 調參入口：Antigravity 只改這三個值，不要散落裸值。
    'html[data-cine]{--cine-vignette-strength:82%;--cine-vignette-inner:52%;',
    '--cine-grain-opacity:0.035;}',
    SEL + '::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;',
    'background:radial-gradient(ellipse 120% 90% at 50% 38%,transparent var(--cine-vignette-inner),',
    // ⚠️ 壓向純黑，不是 `--bg-space`：掃描底色是 #05060A，而 `--bg-space` #020617
    //    比它**更藍也更亮** —— 第一版壓向它，截圖上四角反而浮出一層藍。
    'color-mix(in srgb,black var(--cine-vignette-strength),transparent) 100%);}',
    SEL + '::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;',
    'background-image:var(--cine-grain,none);background-size:' + CINE_GRAIN_SIZE + 'px '
      + CINE_GRAIN_SIZE + 'px;opacity:var(--cine-grain-opacity);}',
  ].join('');
  (document.head || root).appendChild(style);

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }

  /** take 分流用的唯讀旗標；Antigravity 的效果一律先問 `window.TENKI_CINE`。 */
  window.TENKI_CINE = Object.freeze({ take: take, reducedMotion: reduce });
})();
