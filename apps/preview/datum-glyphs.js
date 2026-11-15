/**
 * datum-glyphs.js — TENKI Datum Glyphs (icon system v4). Classic script, no deps.
 *
 * One glyph = neutral structure + at most ONE datum (the measured point).
 * The datum is the only part allowed to carry a world-rule colour:
 *   rest = neutral, cyan = ACTIVE, gold = SECURED. Not measured = no datum.
 *
 * Geometry: 24 grid, 20 live area, stroke 1.5, round caps/joins, datum r 1.5.
 * Styling lives in tokens.css (`.dg`, `.d`, `.a`, `.f`); the colour of the
 * datum is the CSS custom property `--datum` on any ancestor.
 *
 * 🔴 這是圖示的**單一來源**。頁面不要自己再抄一份 path —— 用
 *    `data-datum="name"` 佔位讓 hydrate() 填，或在 JS 裡呼叫 svg(name)。
 *    （`tenki-icons.js` 是 apps/mobile `TenkiIcons.tsx` 的鏡像，刻意不動。）
 *
 * Globals:
 *   window.TENKI_DATUM.GLYPHS          name → inner SVG markup
 *   window.TENKI_DATUM.svg(name)       → '<svg class="dg" …>' ('' if unknown)
 *   window.TENKI_DATUM.hydrate(root)   fills every [data-datum] under root
 */
(function (root) {
  'use strict';

  var DATUM = '<circle class="d" cx="%x" cy="%y" r="1.5"/>';
  function d(x, y) { return DATUM.replace('%x', x).replace('%y', y); }

  /** Class legend: `.d` datum dot · `.a` datum-coloured stroke · `.f` faint structure. */
  var GLYPHS = {
    // ── navigation ──
    today: '<path d="M5.6 17.5a8.5 8.5 0 1 1 12.8 0"/><path d="M12 12l3.4-4.6"/>' + d(12, 12),
    scan: '<path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/>' + d(12, 12),
    session: '<path d="M5 5v14M19 5v14M5 12h7"/><path class="f" d="M16.5 12H19"/>' + d(14, 12),
    timeline: '<path d="M3 8h18M7 8v4M17 8v3M12 8v5.5"/>' + d(12, 16),
    lab: '<path d="M4 8h3M11 8h9M4 16h8.5M17.5 16H20"/><circle cx="9" cy="8" r="2"/>' + d(15, 16),
    // ── measurement ──
    baseline: '<path d="M3 12h6M15 12h6"/><path class="f" d="M6 7h12M6 17h12"/>' + d(12, 12),
    calibrate: '<path d="M5 7l3.5 5L5 17M19 7l-3.5 5 3.5 5"/>' + d(12, 12),
    pulse: '<path d="M3 14h4.5l1.9-5.2M11.4 9.3L14 17l2-3h5"/>' + d(10.4, 6.8),
    decision: '<path d="M4 12h4M12 11.2c1.6-2 2.6-4.2 5-4.2h3M12 12.8c1.6 2 2.6 4.2 5 4.2h3"/>' + d(10.5, 12),
    records: '<path d="M4 20h17M7 20v-4M11 20v-7M15 20V10"/><path class="a" d="M19 20V7" stroke-dasharray="1.5 3"/>',
    history: '<circle cx="12" cy="12" r="8.5"/><path class="a" d="M12 7.5V12l3 2"/>',
    edge: '<path d="M4 17l5-4 3 2.5 5.6-6.8"/>' + d(19, 7),
    // 平的 → 那一點 → 往上：轉折發生在 datum 上。（第一版是對稱的谷，22px 下讀成一個「V」。）
    turning: '<path d="M3.5 16h5M14.4 14l5.6-7.5"/>' + d(12, 16),
    // ── objects ──
    saved: '<path d="M7.5 4h9A1.5 1.5 0 0 1 18 5.5V20l-6-4-6 4V5.5A1.5 1.5 0 0 1 7.5 4z"/>' + d(12, 9.5),
    alert: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5M4.5 16.5h15"/>' + d(12, 19.8),
    privacy: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>' + d(12, 15.2),
    premium: '<path d="M7 4.5h10l3.5 4.8L12 20 3.5 9.3z"/><path d="M3.5 9.3h6M14.5 9.3h6"/>' + d(12, 9.3),
    wearable: '<rect x="7" y="6.5" width="10" height="11" rx="3"/><path d="M9.5 6.5v-3h5v3M9.5 17.5v3h5v-3"/>' + d(12, 12),
    // ── states ──
    secured: '<circle cx="12" cy="12" r="8.5"/><path class="a" d="M8.3 12.3l2.5 2.5 4.9-5.3"/>',
    // 沒量到就沒有 datum —— 這顆刻意不帶任何 `.d` / `.a`。
    unmeasured: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="1.5 3.2"/><path d="M9.5 12h5"/>',
  };

  /**
   * Returns the full SVG string for a glyph, or '' when the name is unknown.
   * @param {string} name
   * @returns {string}
   */
  function svg(name) {
    if (!Object.prototype.hasOwnProperty.call(GLYPHS, name)) return '';
    return '<svg class="dg" viewBox="0 0 24 24" aria-hidden="true">' + GLYPHS[name] + '</svg>';
  }

  /**
   * Fills every `[data-datum="name"]` element under `scope` with its glyph.
   * Unknown names are left untouched (and reported once) rather than blanked.
   * @param {ParentNode} [scope]
   * @returns {number} how many elements were filled
   */
  function hydrate(scope) {
    var nodes = (scope || document).querySelectorAll('[data-datum]');
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var markup = svg(nodes[i].getAttribute('data-datum'));
      if (!markup) {
        if (root.console) root.console.warn('[datum] unknown glyph:', nodes[i].getAttribute('data-datum'));
        continue;
      }
      nodes[i].innerHTML = markup;
      n++;
    }
    return n;
  }

  root.TENKI_DATUM = { GLYPHS: GLYPHS, svg: svg, hydrate: hydrate };
})(typeof window !== 'undefined' ? window : globalThis);
