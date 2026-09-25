/**
 * blink-cadence.js — shared blink-cadence measurement for the Soul Scan surfaces.
 *
 * Consumed by BOTH apps/preview/soul-enroll.js (enrollment: earn the personal
 * blink-cadence baseline) and apps/preview/v6/stardust-scan-takeover.js (daily
 * scan: compare today's cadence against that baseline). One file so the
 * hysteresis / banding / storage rules can never fork between the two pages.
 *
 * Privacy contract (matches the on-device promise): only derived scalars are
 * ever persisted — cadence per minute, blink count, window seconds. No frames,
 * no per-frame eye-openness timelines.
 *
 * Honesty contract (PLAYBOOK §6): a measurement below MIN_WINDOW_MS is
 * discarded, callers hide their UI instead of faking a value, and the band
 * comparison keeps a deliberately wide "near" zone — a 10–15s window is a
 * small Poisson sample, so only strong deviations earn a directional label.
 * Thresholds get re-tuned when the native pipeline lands (Phase 3).
 *
 * QA: append ?blink=clear to either page's URL to drop the stored baseline.
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'tenki.baseline.blink';

  /** A blink-cadence sample shorter than this is statistically worthless — discard. */
  var MIN_WINDOW_MS = 8000;

  /** Wide neutral zone: only strong deviations from baseline earn a direction. */
  var BAND_BELOW = 0.55; // daily < 55% of baseline cadence → 'below'
  var BAND_ABOVE = 1.7;  // daily > 170% of baseline cadence → 'above'

  /**
   * Hysteresis blink counter. `eyeOpen` is 0..1 (1 = fully open); the two
   * thresholds differ per page because the sources differ (blendshape score
   * on soul-enroll vs normalized EAR on v6) — callers pick their own pair.
   * A blink is counted on the open→closed edge; re-arming requires the eye
   * to reopen past `openAbove`, so one long closure counts once.
   */
  function createCounter(opts) {
    var closeBelow = opts.closeBelow;
    var openAbove = opts.openAbove;
    var counter = {
      blinks: 0,
      windowMs: 0,
      closed: false,
      /** Feed one frame. Caller caps dtMs (gaps in tracking must not count). */
      feed: function (eyeOpen, dtMs) {
        if (!(dtMs > 0)) return;
        counter.windowMs += dtMs;
        if (!counter.closed && eyeOpen < closeBelow) {
          counter.closed = true;
          counter.blinks += 1;
        } else if (counter.closed && eyeOpen > openAbove) {
          counter.closed = false;
        }
      },
    };
    return counter;
  }

  /** Blinks per minute for a measured window; null when the window is too short. */
  function cadencePerMin(blinks, windowMs) {
    if (!(windowMs >= MIN_WINDOW_MS)) return null;
    return (blinks * 60000) / windowMs;
  }

  /** Qualitative daily-vs-baseline comparison: 'below' | 'near' | 'above'. */
  function band(dailyCpm, baseCpm) {
    if (dailyCpm == null || baseCpm == null || !(baseCpm > 0)) return 'near';
    var ratio = dailyCpm / baseCpm;
    if (ratio < BAND_BELOW) return 'below';
    if (ratio > BAND_ABOVE) return 'above';
    return 'near';
  }

  /**
   * Cadence regularity as a 0..1 scalar, for consumers that need to feed a
   * weighted model rather than show a word (readiness `evidence.blinkCadence`).
   * 1 = sitting on your baseline; 0 = at or beyond the same strong-deviation
   * edges `band()` uses, in either direction. Lives here so the thresholds keep
   * exactly one home — a copy in the caller would fork the moment either moves.
   *
   * Returns null when it cannot be judged (window too short, or no enrollment
   * baseline yet): an absent signal must stay absent, never default to a value.
   *
   * @param {?number} dailyCpm - This scan's cadence, or null.
   * @param {?number} baseCpm - The enrollment baseline cadence, or null.
   * @returns {?number} Regularity in 0..1, or null when unjudgeable.
   */
  function regularity(dailyCpm, baseCpm) {
    if (dailyCpm == null || baseCpm == null || !(baseCpm > 0)) return null;
    var ratio = dailyCpm / baseCpm;
    var deviation = ratio < 1
      ? (1 - ratio) / (1 - BAND_BELOW)
      : (ratio - 1) / (BAND_ABOVE - 1);
    return Math.min(1, Math.max(0, 1 - deviation));
  }

  /** Persist the enrollment baseline (derived scalars only). */
  function save(snapshot) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        cpm: Math.round(snapshot.cpm * 10) / 10,
        blinks: snapshot.blinks,
        windowSec: Math.round(snapshot.windowSec),
        at: Date.now(),
      }));
      return true;
    } catch (e) {
      return false; // Safari private mode etc. — measurement is simply not kept
    }
  }

  /** Load the stored baseline, or null when absent/corrupt. */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.cpm !== 'number' || !(data.cpm >= 0)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  // QA reset (mirrors the ?precision=clear precedent)
  try {
    if (global.location && global.location.search.indexOf('blink=clear') !== -1) {
      localStorage.removeItem(STORE_KEY);
    }
  } catch (e) { /* storage unavailable — nothing to clear */ }

  global.TENKI_BLINK = {
    STORE_KEY: STORE_KEY,
    MIN_WINDOW_MS: MIN_WINDOW_MS,
    createCounter: createCounter,
    cadencePerMin: cadencePerMin,
    band: band,
    regularity: regularity,
    save: save,
    load: load,
  };
})(window);
