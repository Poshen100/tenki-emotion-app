/**
 * TENKI — Desktop Compatibility Layer
 * ====================================
 * SpectrumEngine: TEI → HSL continuous color interpolation (5 anchors)
 * TouchBridge: Desktop click → synthetic touch for fingerprint scan
 *
 * @version 1.0.0
 * @author  TENKI Core Team
 */

(function (global) {
  'use strict';

  // ============================================================
  // SpectrumEngine — HSL-interpolated emotion color system
  // ============================================================

  const ANCHORS = [
    { tei: 1, h: 270, s: 80, l: 25 },   // deep violet
    { tei: 35, h: 205, s: 65, l: 40 },   // steel blue
    { tei: 55, h: 195, s: 100, l: 50 },  // plasma cyan
    { tei: 80, h: 38, s: 90, l: 55 },   // amber gold
    { tei: 99, h: 51, s: 100, l: 60 },  // bright gold
  ];

  function lerpHSL(tei) {
    const t = Math.max(1, Math.min(99, tei));
    // Find the two surrounding anchors
    let lo = ANCHORS[0], hi = ANCHORS[ANCHORS.length - 1];
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      if (t >= ANCHORS[i].tei && t <= ANCHORS[i + 1].tei) {
        lo = ANCHORS[i];
        hi = ANCHORS[i + 1];
        break;
      }
    }
    const ratio = (t - lo.tei) / (hi.tei - lo.tei || 1);
    const h = lo.h + (hi.h - lo.h) * ratio;
    const s = lo.s + (hi.s - lo.s) * ratio;
    const l = lo.l + (hi.l - lo.l) * ratio;
    return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
  }

  function hslToHex(h, s, l) {
    const a = s / 100 * Math.min(l / 100, 1 - l / 100);
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  const SpectrumEngine = {
    _currentTEI: 0,
    _raf: null,

    apply(tei) {
      const t = Math.max(1, Math.min(99, Math.round(tei)));
      if (t === this._currentTEI) return;
      this._currentTEI = t;

      const { h, s, l } = lerpHSL(t);
      const hex = hslToHex(h, s, l);
      const hsl = `hsl(${h}, ${s}%, ${l}%)`;

      const root = document.documentElement;
      root.style.setProperty('--tei-color', hsl);
      root.style.setProperty('--tei-color-dim', `hsla(${h}, ${s}%, ${l}%, 0.125)`);
      root.style.setProperty('--tei-glow', `hsla(${h}, ${s}%, ${l}%, 0.25)`);
      root.style.setProperty('--tei-h', h);
      root.style.setProperty('--tei-s', s + '%');
      root.style.setProperty('--tei-l', l + '%');

      console.log(`[SpectrumEngine] TEI ${t} → ${hsl} (${hex})`);
    },

    /** Get current HSL for JS consumers */
    getColor(tei) {
      const { h, s, l } = lerpHSL(tei || this._currentTEI);
      return { h, s, l, hex: hslToHex(h, s, l), hsl: `hsl(${h}, ${s}%, ${l}%)` };
    }
  };

  // ============================================================
  // TouchBridge — Desktop click → scan trigger
  // ============================================================

  const TouchBridge = {
    _el: null,
    _holdTimer: null,

    init() {
      // Find the fingerprint scan trigger
      const candidates = [
        document.getElementById('scan-trigger-wrapper'),
        document.querySelector('.fingerprint-wrapper'),
        document.querySelector('[data-lucide="fingerprint"]')?.closest('.fingerprint-wrapper'),
      ];
      const el = candidates.find(e => e != null);
      if (!el) {
        console.warn('[DesktopCompat] Scan element not found, retrying in 1s…');
        setTimeout(() => this.init(), 1000);
        return;
      }
      this._el = el;
      console.log('[DesktopCompat] 找到掃描元素:', el.id || el.className);

      // Visual feedback on click
      el.addEventListener('mousedown', () => {
        el.style.transform = 'scale(1.05)';
        el.style.transition = 'transform 0.15s ease';
      });
      el.addEventListener('mouseup', () => {
        el.style.transform = '';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });

      // Click → synthesize touch events (for mobile-first code paths)
      el.addEventListener('click', (e) => {
        // Some mobile-first code only listens to touch events.
        // We dispatch synthetic touches so the same code path activates.
        try {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          const touchInit = {
            bubbles: true,
            cancelable: true,
            view: window,
            touches: [new Touch({
              identifier: Date.now(),
              target: el,
              clientX: cx,
              clientY: cy,
              radiusX: 2.5,
              radiusY: 2.5,
              rotationAngle: 10,
              force: 0.5,
            })],
            changedTouches: [new Touch({
              identifier: Date.now(),
              target: el,
              clientX: cx,
              clientY: cy,
            })],
          };
          el.dispatchEvent(new TouchEvent('touchstart', touchInit));
          setTimeout(() => {
            el.dispatchEvent(new TouchEvent('touchend', {
              ...touchInit,
              touches: [],
            }));
          }, 100);
        } catch (err) {
          // Touch constructor not supported on this browser — fallback is fine
          // The existing pointerdown/mousedown handlers in index.html already work
          console.log('[DesktopCompat] TouchEvent synthesis not supported, using pointer fallback');
        }
      });
    }
  };

  // ============================================================
  // Wire EventBridge subscriptions for SpectrumEngine
  // ============================================================

  function wireSpectrum() {
    // Priority: EventBridgeV2
    function tryWireSpectrumV2() {
      if (global.EventBridgeV2) {
        global.EventBridgeV2.addEventListener('tenki:tei-progressive', (e) => {
          const d = e.detail || e;
          if (d.tei_pr99 != null) SpectrumEngine.apply(d.tei_pr99);
        });
        return true;
      }
      return false;
    }

    if (!tryWireSpectrumV2()) {
      let attempts = 0;
      const retryId = setInterval(() => {
        if (tryWireSpectrumV2() || ++attempts >= 30) clearInterval(retryId);
      }, 500);
    }

    // Fallback: legacy EventBridge
    if (typeof EventBridge !== 'undefined') {
      try {
        EventBridge.on('tei:progressive', (d) => {
          if (d && d.score != null) SpectrumEngine.apply(d.score);
        });
        EventBridge.on('tei:updated', (d) => {
          if (d && d.tei != null) SpectrumEngine.apply(d.tei);
        });
      } catch (e) { /* EventBridge not ready */ }
    }

    // Fallback: plain DOM events
    document.addEventListener('tei:update', (e) => {
      const d = e.detail || {};
      if (d.tei != null) SpectrumEngine.apply(d.tei);
    });
    document.addEventListener('tei:updated', (e) => {
      const d = e.detail || {};
      if (d.tei != null) SpectrumEngine.apply(d.tei);
    });

    // Also watch scan:complete for initial TEI value and trigger Results Page fallback on desktop
    if (typeof EventBridge !== 'undefined') {
      try {
        EventBridge.on('scan:complete', (d) => {
          if (d && d.tei != null) SpectrumEngine.apply(d.tei);
          // Fallback to show results page on desktop
          if (global.TenkiResultsPage && typeof global.TenkiResultsPage.show === 'function') {
            global.TenkiResultsPage.show(d);
          }
        });
      } catch (e) { }
    }

    // Fallback for ProgressiveTEI v2
    function tryWireV2() {
      if (global.EventBridgeV2) {
        global.EventBridgeV2.addEventListener('tenki:tei-scan-stopped', (e) => {
          if (global.TenkiResultsPage && typeof global.TenkiResultsPage.show === 'function') {
            global.TenkiResultsPage.show(e.detail);
          }
        });
        return true;
      }
      return false;
    }

    if (!tryWireV2()) {
      let attempts = 0;
      const retryId = setInterval(() => {
        if (tryWireV2() || ++attempts >= 30) clearInterval(retryId);
      }, 500);
    }

    // MutationObserver: watch #dash-score text changes as ultimate fallback
    const scoreEl = document.getElementById('dash-score');
    if (scoreEl) {
      const obs = new MutationObserver(() => {
        const val = parseInt(scoreEl.textContent, 10);
        if (!isNaN(val) && val >= 1 && val <= 99) {
          SpectrumEngine.apply(val);
        }
      });
      obs.observe(scoreEl, { childList: true, characterData: true, subtree: true });
    }
  }

  // ============================================================
  // Auto-init
  // ============================================================

  function boot() {
    TouchBridge.init();
    wireSpectrum();

    // Apply a neutral starting color
    SpectrumEngine.apply(50);

    console.log('[DesktopCompat] SpectrumEngine + TouchBridge loaded ✓');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 100);
  }

  // ── Export ──
  global.SpectrumEngine = SpectrumEngine;
  global.TouchBridge = TouchBridge;

})(typeof window !== 'undefined' ? window : globalThis);
