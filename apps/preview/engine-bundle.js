var TENKIEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // apps/preview/engine-entry.ts
  var engine_entry_exports = {};
  __export(engine_entry_exports, {
    assessMaturity: () => assessMaturity,
    calculateEdgeScore: () => calculateEdgeScore,
    classifyEdgeZone: () => classifyEdgeZone,
    createEmptyBaselineProfile: () => createEmptyBaselineProfile,
    createEmptyMetricBaseline: () => createEmptyMetricBaseline,
    getTimeBucket: () => getTimeBucket,
    resolveTimeBucket: () => resolveTimeBucket
  });

  // packages/engine/src/common/types.ts
  var BASELINE_THRESHOLDS = {
    /** Minimum scans to transition from 'new' to 'building'. */
    BUILDING: 1,
    /** Minimum scans to transition from 'building' to 'ready'. */
    READY: 5,
    /** Minimum scans across at least 3 days for 'mature'. */
    MATURE: 15,
    /** Minimum distinct days for 'mature'. */
    MATURE_DAYS: 3
  };
  var CONFIDENCE_BANDS = {
    HIGH: { min: 0.8, max: 1 },
    MODERATE: { min: 0.55, max: 0.79 },
    LOW: { min: 0, max: 0.54 }
  };

  // packages/engine/src/scoring/types.ts
  var EDGE_WEIGHTS = {
    hrvVsBaseline: 25,
    hrStability: 15,
    respirationStability: 10,
    stressProxyVsBaseline: 15,
    sleepRecovery: 15,
    recentTrend: 10,
    baselineFreshness: 5,
    signalQuality: 5
  };
  var _WEIGHT_SUM = EDGE_WEIGHTS.hrvVsBaseline + EDGE_WEIGHTS.hrStability + EDGE_WEIGHTS.respirationStability + EDGE_WEIGHTS.stressProxyVsBaseline + EDGE_WEIGHTS.sleepRecovery + EDGE_WEIGHTS.recentTrend + EDGE_WEIGHTS.baselineFreshness + EDGE_WEIGHTS.signalQuality;

  // packages/engine/src/compliance/safe-copy.ts
  var ZONE_HEADLINES = {
    clear: {
      high: "Clearer state detected",
      moderate: "Signals suggest a steadier state",
      low: "Preliminary signals look more stable"
    },
    neutral: {
      high: "Mixed signals today",
      moderate: "State looks variable",
      low: "Not enough data for a clear picture"
    },
    strain: {
      high: "Elevated strain detected",
      moderate: "Signals suggest higher strain",
      low: "Limited data, but strain indicators present"
    }
  };
  var ZONE_BODIES = {
    clear: {
      high: "Your signals look steadier than usual, with high confidence. You may be in a clearer state for important decisions.",
      moderate: "Your readings look more stable than recent patterns, with moderate confidence.",
      low: "Early signals suggest some stability, but your baseline is still forming."
    },
    neutral: {
      high: "Your signals are mixed today. Some indicators look stable while others are less consistent.",
      moderate: "Your state appears variable. Consider a brief check-in or reset if needed.",
      low: "Not enough reliable data to assess clearly. Try a longer scan or check back later."
    },
    strain: {
      high: "Your signals indicate elevated strain compared to your baseline. A reset or break may help.",
      moderate: "Some strain indicators are present. You might benefit from a pause or breathing exercise.",
      low: "Limited data available, but some strain markers are detected. More data would help."
    }
  };
  function generateSafeCopy(zone, band) {
    return {
      headline: ZONE_HEADLINES[zone][band],
      body: ZONE_BODIES[zone][band]
    };
  }

  // packages/engine/src/scoring/edge-score.ts
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function zScoreToSubScore(zScore, invert = false) {
    const adjusted = invert ? -zScore : zScore;
    return clamp(Math.round(50 + adjusted * 25), 0, 100);
  }
  function computeZScore(value, baseline) {
    if (baseline.sampleCount === 0 || baseline.std === 0) {
      return 0;
    }
    return (value - baseline.mean) / baseline.std;
  }
  function getTimeBucket(timestamp) {
    const hour = new Date(timestamp).getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "midday";
    return "evening";
  }
  function getDirection(subScore) {
    if (subScore >= 60) return "positive";
    if (subScore >= 40) return "neutral";
    return "negative";
  }
  function calcHrvVsBaseline(hrvRmssd, baseline) {
    const z = computeZScore(hrvRmssd, baseline);
    return zScoreToSubScore(z, false);
  }
  function calcHrStability(hrBpm, baseline) {
    const z = computeZScore(hrBpm, baseline);
    const absZ = Math.abs(z);
    return clamp(Math.round(100 - absZ * 30), 0, 100);
  }
  function calcRespirationStability(rrBrpm, baseline) {
    const z = computeZScore(rrBrpm, baseline);
    const absZ = Math.abs(z);
    return clamp(Math.round(100 - absZ * 30), 0, 100);
  }
  function calcStressProxy(reading, baseline, timeBucket) {
    const hrZ = computeZScore(reading.hrBpm, baseline.hr[timeBucket]);
    const hrvZ = computeZScore(reading.hrvRmssdMs, baseline.hrv[timeBucket]);
    const stressIndicator = hrZ - hrvZ;
    return zScoreToSubScore(stressIndicator, true);
  }
  function calcSleepRecovery(sleep) {
    if (sleep.source === "none" || sleep.durationHours === null) {
      return 50;
    }
    let score = 50;
    if (sleep.durationHours >= 7 && sleep.durationHours <= 9) {
      score += 25;
    } else if (sleep.durationHours >= 6) {
      score += 10;
    } else {
      score -= 15;
    }
    if (sleep.qualityScore !== null) {
      score += Math.round((sleep.qualityScore - 50) * 0.3);
    }
    if (sleep.stalenessHours > 24) {
      score -= 10;
    }
    return clamp(score, 0, 100);
  }
  function calcRecentTrend(recentScores) {
    if (recentScores.length < 2) {
      return 50;
    }
    const half = Math.floor(recentScores.length / 2);
    const recentHalf = recentScores.slice(0, half);
    const olderHalf = recentScores.slice(half);
    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const trendDelta = recentAvg - olderAvg;
    return clamp(Math.round(50 + trendDelta), 0, 100);
  }
  function calcBaselineFreshness(baseline, now) {
    if (baseline.totalScanCount === 0) {
      return 20;
    }
    const allUpdates = [
      baseline.hr.morning.lastUpdatedAt,
      baseline.hr.midday.lastUpdatedAt,
      baseline.hr.evening.lastUpdatedAt,
      baseline.hrv.morning.lastUpdatedAt,
      baseline.hrv.midday.lastUpdatedAt,
      baseline.hrv.evening.lastUpdatedAt
    ].filter((t) => t > 0);
    if (allUpdates.length === 0) return 20;
    const mostRecent = Math.max(...allUpdates);
    const hoursAgo = (now - mostRecent) / (1e3 * 60 * 60);
    if (hoursAgo <= 24) return 100;
    if (hoursAgo <= 48) return 80;
    if (hoursAgo <= 72) return 60;
    if (hoursAgo <= 168) return 40;
    return 20;
  }
  function calcSignalQuality(quality) {
    return clamp(quality.score, 0, 100);
  }
  function classifyConfidence(confidence) {
    if (confidence >= CONFIDENCE_BANDS.HIGH.min) return "high";
    if (confidence >= CONFIDENCE_BANDS.MODERATE.min) return "moderate";
    return "low";
  }
  function calcConfidence(baseline, quality, sleep, recentCount, now) {
    const maturityMap = {
      new: 0.2,
      building: 0.5,
      ready: 0.75,
      mature: 1
    };
    const baselineMaturity = maturityMap[baseline.maturity] ?? 0.2;
    let inputs = 0;
    let totalInputs = 3;
    inputs += 3;
    if (sleep.source !== "none") {
      inputs += 1;
      totalInputs += 1;
    }
    const inputCompleteness = inputs / totalInputs;
    const sqiConfidence = quality.score / 100;
    const recency = Math.min(1, recentCount / 5);
    const crossSourceAgreement = quality.coverage * quality.stability;
    const overall = clamp(
      baselineMaturity * 0.3 + inputCompleteness * 0.2 + sqiConfidence * 0.25 + recency * 0.15 + crossSourceAgreement * 0.1,
      0,
      1
    );
    return {
      overall: Math.round(overall * 100) / 100,
      band: classifyConfidence(overall),
      factors: {
        baselineMaturity,
        inputCompleteness,
        signalQuality: sqiConfidence,
        recency,
        crossSourceAgreement
      }
    };
  }
  function classifyEdgeZone(score) {
    if (score >= 70) return "clear";
    if (score >= 40) return "neutral";
    return "strain";
  }
  function calculateEdgeScore(input) {
    const now = input.reading.timestamp;
    const timeBucket = getTimeBucket(now);
    const subScores = {
      hrv_vs_baseline: calcHrvVsBaseline(input.reading.hrvRmssdMs, input.baseline.hrv[timeBucket]),
      hr_stability: calcHrStability(input.reading.hrBpm, input.baseline.hr[timeBucket]),
      respiration_stability: calcRespirationStability(input.reading.rrBrpm, input.baseline.rr[timeBucket]),
      stress_proxy_vs_baseline: calcStressProxy(input.reading, input.baseline, timeBucket),
      sleep_recovery: calcSleepRecovery(input.sleepRecovery),
      recent_trend: calcRecentTrend(input.recentScores),
      baseline_freshness: calcBaselineFreshness(input.baseline, now),
      signal_quality: calcSignalQuality(input.signalQuality)
    };
    const weightMap = {
      hrv_vs_baseline: EDGE_WEIGHTS.hrvVsBaseline,
      hr_stability: EDGE_WEIGHTS.hrStability,
      respiration_stability: EDGE_WEIGHTS.respirationStability,
      stress_proxy_vs_baseline: EDGE_WEIGHTS.stressProxyVsBaseline,
      sleep_recovery: EDGE_WEIGHTS.sleepRecovery,
      recent_trend: EDGE_WEIGHTS.recentTrend,
      baseline_freshness: EDGE_WEIGHTS.baselineFreshness,
      signal_quality: EDGE_WEIGHTS.signalQuality
    };
    const drivers = [];
    let weightedSum = 0;
    for (const key of Object.keys(subScores)) {
      const raw = subScores[key];
      const weight = weightMap[key];
      const direction = getDirection(raw);
      drivers.push({
        key,
        direction,
        impact: Math.round((raw - 50) / 50 * 100) / 100,
        // Normalize to -1 to 1
        rawSubScore: raw
      });
      weightedSum += raw * (weight / 100);
    }
    const finalScore = clamp(Math.round(weightedSum), 0, 100);
    const zone = classifyEdgeZone(finalScore);
    const confidence = calcConfidence(
      input.baseline,
      input.signalQuality,
      input.sleepRecovery,
      input.recentScores.length,
      now
    );
    const copy = generateSafeCopy(zone, confidence.band);
    return {
      score: finalScore,
      zone,
      confidence,
      drivers,
      copy,
      metadata: {
        baselineVersion: input.baseline.version,
        scanQuality: input.signalQuality.score,
        dataCompleteness: confidence.factors.inputCompleteness,
        sourceMix: [],
        // Populated by caller
        computedAt: now
      }
    };
  }

  // packages/engine/src/baseline/baseline.ts
  function createEmptyMetricBaseline() {
    return {
      mean: 0,
      std: 0,
      sampleCount: 0,
      lastUpdatedAt: 0
    };
  }
  function createEmptyBaselineProfile() {
    const empty = () => createEmptyMetricBaseline();
    return {
      hr: { morning: empty(), midday: empty(), evening: empty() },
      hrv: { morning: empty(), midday: empty(), evening: empty() },
      rr: { morning: empty(), midday: empty(), evening: empty() },
      stressProxy: empty(),
      maturity: "new",
      totalScanCount: 0,
      version: "3.0.0"
    };
  }
  function resolveTimeBucket(timestamp) {
    const hour = new Date(timestamp).getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "midday";
    return "evening";
  }
  function assessMaturity(totalScanCount, distinctDays = 0) {
    if (totalScanCount >= BASELINE_THRESHOLDS.MATURE && distinctDays >= BASELINE_THRESHOLDS.MATURE_DAYS) {
      return "mature";
    }
    if (totalScanCount >= BASELINE_THRESHOLDS.READY) {
      return "ready";
    }
    if (totalScanCount >= BASELINE_THRESHOLDS.BUILDING) {
      return "building";
    }
    return "new";
  }
  return __toCommonJS(engine_entry_exports);
})();
