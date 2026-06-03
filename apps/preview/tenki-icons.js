/**
 * tenki-icons.js — Vanilla JS icon helper mirroring TenkiIcons.tsx
 * No dependencies, no ES modules. Safe for classic <script> include.
 *
 * Globals exposed:
 *   window.TENKI_ICONS          — registry mapping name → function({size})
 *   window.tenkiIcon(name, {size}) — returns SVG string
 *   window.hydrateTenkiIcons(root) — hydrates [data-tenki-icon] elements
 */

(function (root) {
  'use strict';

  // ── Colour constants (mirror TenkiIcons.tsx) ──────────────────────────────
  var ACCENT = 'var(--tenki-accent, #5FE9D0)';
  var OK     = '#5FE9D0';
  var FAIL   = '#5E7596';
  var WARN   = '#FFC68A';

  // ── Base SVG wrapper (base icons: currentColor, stroke-width 1.6) ─────────
  function baseSvg(size, inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' +
      ' aria-hidden="true" width="' + size + '" height="' + size + '">' +
      inner + '</svg>';
  }

  // ── Status SVG wrapper (status icons: fixed semantic colours, stroke-width 1.8) ─
  function statusSvg(size, color, inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '"' +
      ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' +
      ' aria-hidden="true" width="' + size + '" height="' + size + '">' +
      inner + '</svg>';
  }

  // ── Icon definitions (inner SVG markup mirrors TenkiIcons.tsx exactly) ────

  function sense(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="9"/>' +
      '<polyline points="4,12 7.5,12 9.5,7.5 12,15.5 14,11 15.5,12 20,12" stroke="' + ACCENT + '"/>'
    );
  }

  function baseline(size) {
    return baseSvg(size,
      '<polyline points="3,8.5 6,15 8.2,6.5 10.2,13 12,11.8 21,11.8"/>' +
      '<circle cx="16" cy="11.8" r="1.5" fill="' + ACCENT + '" stroke="none"/>'
    );
  }

  // 指紋建立 — iOS 線條風 3 圈指紋 + 四角對位框（與臉部卡同一套框），固定 teal #5FE1D6（取代 👆）。
  function fingerprint(size) {
    return '<svg viewBox="0 0 120 120" fill="none" stroke="#5FE1D6"' +
      ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"' +
      ' aria-hidden="true" width="' + size + '" height="' + size + '">' +
      '<path d="M60 38 C48 38 42 48 42 58 C42 70 50 80 60 80 C70 80 78 70 78 58 C78 48 72 38 60 38"/>' +
      '<path d="M60 46 C52 46 48 52 48 58 C48 66 54 72 60 72 C66 72 72 66 72 58 C72 52 68 46 60 46"/>' +
      '<path d="M60 54 C56 54 54 56 54 58 C54 62 57 64 60 64 C63 64 66 62 66 58 C66 56 64 54 60 54"/>' +
      '<path d="M28 40 Q28 28 40 28"/>' +
      '<path d="M80 28 Q92 28 92 40"/>' +
      '<path d="M92 80 Q92 92 80 92"/>' +
      '<path d="M40 92 Q28 92 28 80"/>' +
      '</svg>';
  }

  // 臉部建立 — 線條人臉 + iOS 圓角四角對位框，固定 teal 色 #5FE1D6（取代 🙂）。
  function soulFace(size) {
    return '<svg viewBox="0 0 120 120" fill="none" stroke="#5FE1D6"' +
      ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"' +
      ' aria-hidden="true" width="' + size + '" height="' + size + '">' +
      '<path d="M60 30 C48 30 42 42 42 55 C42 70 50 82 60 82 C70 82 78 70 78 55 C78 42 72 30 60 30Z"/>' +
      '<path d="M42 55 C38 55 38 62 42 62"/>' +
      '<path d="M78 55 C82 55 82 62 78 62"/>' +
      '<path d="M38 92 C45 78 75 78 82 92"/>' +
      '<path d="M28 40 Q28 28 40 28"/>' +
      '<path d="M80 28 Q92 28 92 40"/>' +
      '<path d="M92 80 Q92 92 80 92"/>' +
      '<path d="M40 92 Q28 92 28 80"/>' +
      '</svg>';
  }

  function camera(size) {
    return baseSvg(size,
      '<rect x="3" y="6.5" width="18" height="13" rx="3.2"/>' +
      '<path d="M8.6 6.5 l1.4 -2 h4 l1.4 2"/>' +
      '<circle cx="12" cy="13" r="3.4" stroke="' + ACCENT + '"/>' +
      '<circle cx="12" cy="13" r="0.7" fill="currentColor" stroke="none"/>'
    );
  }

  function align(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="1.5" fill="' + ACCENT + '" stroke="none"/>' +
      '<polyline points="9,4.4 12,6.8 15,4.4"/>' +
      '<polyline points="9,19.6 12,17.2 15,19.6"/>' +
      '<polyline points="4.4,9 6.8,12 4.4,15"/>' +
      '<polyline points="19.6,9 17.2,12 19.6,15"/>'
    );
  }

  function scan(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="8.4"/>' +
      '<circle cx="12" cy="12" r="3" stroke="' + ACCENT + '"/>' +
      '<circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none"/>' +
      '<line x1="12" y1="2.6" x2="12" y2="5.4"/>' +
      '<line x1="12" y1="18.6" x2="12" y2="21.4"/>' +
      '<line x1="2.6" y1="12" x2="5.4" y2="12"/>' +
      '<line x1="18.6" y1="12" x2="21.4" y2="12"/>'
    );
  }

  function explore(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="8.4"/>' +
      '<path d="M12 5.4 L14 12 L12 12.6 Z" fill="' + ACCENT + '" stroke="none"/>' +
      '<path d="M12 18.6 L10 12 L12 11.4 Z"/>' +
      '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'
    );
  }

  function ready(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="9"/>' +
      '<polyline points="7.5,12.5 10.5,15.5 16.5,8.5" stroke="' + ACCENT + '"/>'
    );
  }

  function statusOk(size) {
    return statusSvg(size, OK,
      '<circle cx="12" cy="12" r="9"/>' +
      '<polyline points="7.5,12.5 10.5,15.5 16.5,8.5"/>'
    );
  }

  function statusFail(size) {
    return statusSvg(size, FAIL,
      '<circle cx="12" cy="12" r="9"/>' +
      '<line x1="9" y1="9" x2="15" y2="15"/>' +
      '<line x1="15" y1="9" x2="9" y2="15"/>'
    );
  }

  function statusWarn(size) {
    return statusSvg(size, WARN,
      '<circle cx="12" cy="12" r="9"/>' +
      '<line x1="12" y1="7.5" x2="12" y2="13"/>' +
      '<circle cx="12" cy="16.2" r="0.5" fill="' + WARN + '" stroke="none"/>'
    );
  }

  // ── Registry ──────────────────────────────────────────────────────────────
  var REGISTRY = {
    sense:       sense,
    baseline:    baseline,
    fingerprint: fingerprint,
    soulFace:    soulFace,
    camera:      camera,
    align:       align,
    scan:        scan,
    explore:     explore,
    ready:       ready,
    statusOk:    statusOk,
    statusFail:  statusFail,
    statusWarn:  statusWarn,
  };

  /**
   * Returns the SVG string for the given icon name.
   * @param {string} name  — one of the icon keys in TENKI_ICONS
   * @param {{size?: number}} [opts]
   * @returns {string} SVG markup string
   */
  function tenkiIcon(name, opts) {
    var size = (opts && opts.size) ? opts.size : 24;
    var fn = REGISTRY[name];
    if (!fn) {
      console.warn('[tenki-icons] unknown icon: ' + name);
      return '';
    }
    return fn(size);
  }

  /**
   * Finds every element with [data-tenki-icon] under `rootEl` and sets its
   * innerHTML to the corresponding SVG. Reads optional [data-size] attribute.
   * @param {Document|Element} [rootEl]
   */
  function hydrateTenkiIcons(rootEl) {
    var r = rootEl || document;
    var els = r.querySelectorAll('[data-tenki-icon]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var name = el.getAttribute('data-tenki-icon');
      var size = parseInt(el.getAttribute('data-size') || '24', 10);
      el.innerHTML = tenkiIcon(name, { size: size });
    }
  }

  // ── Expose globals ────────────────────────────────────────────────────────
  root.TENKI_ICONS = REGISTRY;
  root.tenkiIcon   = tenkiIcon;
  root.hydrateTenkiIcons = hydrateTenkiIcons;

  // Auto-hydrate on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      hydrateTenkiIcons(document);
    });
  } else {
    hydrateTenkiIcons(document);
  }

}(window));
