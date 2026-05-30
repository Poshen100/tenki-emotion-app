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

  function fingerprint(size) {
    return baseSvg(size,
      '<circle cx="12" cy="12" r="8.4"/>' +
      '<path d="M7.6 14 a4.6 4.6 0 0 1 8.8 0" stroke="' + ACCENT + '"/>' +
      '<path d="M9.2 14 a3 3 0 0 1 5.6 0"/>' +
      '<path d="M10.7 14 a1.6 1.6 0 0 1 2.6 0"/>' +
      '<line x1="12" y1="14" x2="12" y2="12.6"/>'
    );
  }

  function soulFace(size) {
    return baseSvg(size,
      '<ellipse cx="12" cy="12" rx="6.4" ry="7.4" stroke-dasharray="2 2.6" opacity="0.55"/>' +
      '<circle cx="9.2" cy="10" r="0.95" fill="' + ACCENT + '" stroke="none"/>' +
      '<circle cx="14.6" cy="9.4" r="0.85" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="12.6" r="1.15" fill="' + ACCENT + '" stroke="none"/>' +
      '<circle cx="10" cy="15" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="14.4" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="12.4" cy="7.8" r="0.7" fill="currentColor" stroke="none"/>'
    );
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
