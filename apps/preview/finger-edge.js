/**
 * @module finger-edge
 * @description Bridges the real fingertip-PPG baseline (finger-ppg.js) into the
 * real Decision Edge Score engine (engine-bundle.js → window.TENKIEngine) for
 * the TENKI browser preview (Model B, round 2).
 *
 * Honesty contract (founder decision: "誠實低信心"):
 *   The browser PPG only directly measures resting HR. HRV / respiration /
 *   sleep / recent-trend are NOT measured, so the engine runs them on its
 *   neutral defaults (and its own confidence over-counts them as "present").
 *   We therefore (a) feed only the real HR baseline, and (b) present an HONEST,
 *   downgraded confidence + a transparent per-driver measured/unmeasured label.
 *   The engine math is never re-implemented or mutated — it stays source of truth.
 *
 * Privacy: only derived numbers (HR baseline, past Edge Scores) touch
 * localStorage. Nothing is uploaded.
 *
 * UMD pattern mirrors apps/preview/finger-ppg.js so __tests__ can require it.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TENKIFingerEdge = api;
})(function () {
  'use strict';

  const EDGE_HISTORY_KEY = 'tenki.edgeHistory.v1';
  const TODAY_SNAPSHOT_KEY = 'tenki.todaySnapshot.v1';

  /**
   * Per-driver honesty label for the preview breakdown. The browser preview
   * only measures HR, so most engine drivers run on neutral defaults.
   * @type {Record<string, 'measured'|'partial'|'unmeasured'>}
   */
  const DRIVER_STATUS = {
    hr_stability: 'measured',
    signal_quality: 'measured',
    baseline_freshness: 'measured',
    stress_proxy_vs_baseline: 'partial', // real HR, placeholder HRV
    hrv_vs_baseline: 'unmeasured',
    respiration_stability: 'unmeasured',
    sleep_recovery: 'unmeasured',
    recent_trend: 'unmeasured',
  };

  /**
   * Builds an engine SignalQuality from the capture's last confidence + coverage.
   * @param {number} confidence - normalized autocorrelation peak [0..1].
   * @param {boolean} covered - finger-over-lens flag from onQuality.
   * @returns {{score:number,grade:string,coverage:number,stability:number,acceptable:boolean}}
   */
  function buildSignalQuality(confidence, covered) {
    const c = Math.max(0, Math.min(1, confidence || 0));
    const score = Math.round(c * 100);
    const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
    return {
      score,
      grade,
      coverage: covered ? 0.9 : 0.4,
      stability: c,
      acceptable: score >= 40,
    };
  }

  /**
   * Builds the engine EdgeScoreInput from a real finger-PPG baseline.
   * Only the HR baseline is populated; HRV/RR are left empty (engine treats an
   * empty MetricBaseline as neutral), sleep is 'none', trend uses real history.
   *
   * @param {object} fb - finger baseline { count, mean, std, maturity, lastUpdatedAt }.
   * @param {number} currentBpm - the just-measured resting HR.
   * @param {object} signalQuality - from buildSignalQuality.
   * @param {number[]} recentScores - past Edge Scores, newest first.
   * @param {number} [now] - timestamp (ms).
   * @param {object} [engine] - TENKIEngine (defaults to window.TENKIEngine); injectable for tests.
   * @returns {object} EdgeScoreInput.
   */
  function buildEdgeInput(fb, currentBpm, signalQuality, recentScores, now, engine) {
    engine = engine || (typeof window !== 'undefined' ? window.TENKIEngine : null);
    if (!engine || typeof engine.createEmptyBaselineProfile !== 'function') {
      throw new Error('TENKIEngine not loaded (engine-bundle.js)');
    }
    const ts = now || (typeof Date !== 'undefined' ? Date.now() : 0);
    const baseline = engine.createEmptyBaselineProfile();
    const bucket = engine.resolveTimeBucket(ts);

    // Populate ONLY the HR baseline for the current time bucket from real data.
    baseline.hr[bucket] = {
      mean: fb.mean || 0,
      std: fb.std || 0, // 0 when count<2 → engine's computeZScore guards (z=0)
      sampleCount: fb.count || 0,
      lastUpdatedAt: fb.lastUpdatedAt || ts,
    };
    baseline.maturity = fb.maturity || 'new';
    baseline.totalScanCount = fb.count || 0;

    return {
      // hrv/rr readings are inert: their baselines are empty → z-score = 0.
      reading: { hrBpm: currentBpm, hrvRmssdMs: 0, rrBrpm: 0, timestamp: ts },
      baseline,
      signalQuality,
      sleepRecovery: { source: 'none', durationHours: null, qualityScore: null, stalenessHours: 0 },
      recentScores: recentScores || [],
    };
  }

  /**
   * Produces an HONEST confidence summary for the preview. Because the
   * highest-weight driver (HRV vs baseline, weight 25) and RR/sleep/trend are
   * never measured in the browser, confidence is capped LOW regardless of the
   * engine's own (over-optimistic) band.
   *
   * @param {object} result - EdgeScoreResult from calculateEdgeScore.
   * @returns {{band:'low',measuredWeight:number,measuredKeys:string[],unmeasuredKeys:string[],note:string,engineBand:string,engineOverall:number}}
   */
  function computeHonestConfidence(result) {
    // Measured weight: HR stability (15) + signal (5) + freshness (5) + half of
    // stress proxy (7.5, since it uses real HR but placeholder HRV) = 32.5/100.
    const measuredWeight = 32.5;
    return {
      band: 'low',
      measuredWeight,
      measuredKeys: ['hr_stability', 'signal_quality', 'baseline_freshness', 'stress_proxy_vs_baseline (partial)'],
      unmeasuredKeys: ['hrv_vs_baseline', 'respiration_stability', 'sleep_recovery', 'recent_trend'],
      note: 'Only resting HR is directly measured in the browser preview. HRV, respiration, sleep and recent trend are not yet measured, so confidence is low.',
      engineBand: result && result.confidence ? result.confidence.band : 'unknown',
      engineOverall: result && result.confidence ? result.confidence.overall : 0,
    };
  }

  /** @returns {number[]} past Edge Scores, newest first (capped 10). */
  function loadEdgeHistory() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(EDGE_HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Persists a new Edge Score to the rolling history (newest first, cap 10),
   * so the engine's recent-trend driver grows over repeated scans.
   * @param {number} score
   * @returns {number[]} the updated history.
   */
  function recordEdgeScore(score) {
    const hist = loadEdgeHistory();
    hist.unshift(score);
    const capped = hist.slice(0, 10);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(EDGE_HISTORY_KEY, JSON.stringify(capped));
    } catch (_) {
      /* private mode / quota — degrade silently */
    }
    return capped;
  }

  /** @param {{mean:number,std:number}} v @param {number} count @param {number} ts */
  function metricBaselineFrom(v, count, ts) {
    const mean = (v && v.mean) || 0;
    return {
      mean,
      std: (v && v.std) || 0,
      sampleCount: mean > 0 ? Math.max(1, count || 1) : 0,
      lastUpdatedAt: ts,
    };
  }

  /**
   * Builds the engine EdgeScoreInput from a FULL vitals baseline (HR + HRV + RR
   * all really measured — e.g. the onboarding ceremony via camera-scan.js).
   * Unlike buildEdgeInput (HR-only), every baseline is populated, so the
   * engine's NATIVE confidence is honest and is NOT downgraded.
   *
   * @param {object} vitals - { hr:{mean,std}, hrv:{mean,std}, rr:{mean,std}, count, maturity }.
   * @param {object} signalQuality - from buildSignalQuality.
   * @param {number[]} recentScores - past Edge Scores, newest first.
   * @param {number} [now] - timestamp (ms).
   * @param {object} [engine] - TENKIEngine (defaults to window.TENKIEngine); injectable for tests.
   * @returns {object} EdgeScoreInput.
   */
  function buildEdgeInputFromVitals(vitals, signalQuality, recentScores, now, engine) {
    engine = engine || (typeof window !== 'undefined' ? window.TENKIEngine : null);
    if (!engine || typeof engine.createEmptyBaselineProfile !== 'function') {
      throw new Error('TENKIEngine not loaded (engine-bundle.js)');
    }
    const ts = now || (typeof Date !== 'undefined' ? Date.now() : 0);
    const count = vitals.count || 1;
    const baseline = engine.createEmptyBaselineProfile();
    const bucket = engine.resolveTimeBucket(ts);
    baseline.hr[bucket] = metricBaselineFrom(vitals.hr, count, ts);
    baseline.hrv[bucket] = metricBaselineFrom(vitals.hrv, count, ts);
    baseline.rr[bucket] = metricBaselineFrom(vitals.rr, count, ts);
    baseline.maturity = vitals.maturity || 'building';
    baseline.totalScanCount = count;

    return {
      reading: {
        hrBpm: (vitals.hr && vitals.hr.mean) || 0,
        hrvRmssdMs: (vitals.hrv && vitals.hrv.mean) || 0,
        rrBrpm: (vitals.rr && vitals.rr.mean) || 0,
        timestamp: ts,
      },
      baseline,
      signalQuality,
      sleepRecovery: { source: 'none', durationHours: null, qualityScore: null, stalenessHours: 0 },
      recentScores: recentScores || [],
    };
  }

  /** @returns {object|null} the persisted Today snapshot, or null. */
  function loadTodaySnapshot() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(TODAY_SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Persists the latest Today snapshot so other views (v6 Today) can show the
   * real engine score across navigation. Only derived numbers — privacy-safe.
   * @param {object} snap - { score, zone, hr, hrv, rr, confidenceBand, count, ts }.
   * @returns {object} the snapshot written.
   */
  function persistTodaySnapshot(snap) {
    const out = Object.assign({ ts: (typeof Date !== 'undefined' ? Date.now() : 0) }, snap);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(TODAY_SNAPSHOT_KEY, JSON.stringify(out));
    } catch (_) {
      /* private mode / quota — degrade silently */
    }
    return out;
  }

  return {
    DRIVER_STATUS,
    EDGE_HISTORY_KEY,
    TODAY_SNAPSHOT_KEY,
    buildSignalQuality,
    buildEdgeInput,
    buildEdgeInputFromVitals,
    computeHonestConfidence,
    loadEdgeHistory,
    recordEdgeScore,
    loadTodaySnapshot,
    persistTodaySnapshot,
  };
});
