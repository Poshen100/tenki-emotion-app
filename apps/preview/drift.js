/**
 * drift.js — Decision Intelligence 判定的**唯一** preview 來源。
 *
 * ═══════════════════════════════════════════════
 * 為什麼要有這支檔案
 * ═══════════════════════════════════════════════
 * PLAYBOOK §6 已經記過一次「兩個頁面共用同一份資料，數字卻對不起來」——
 * decision-alert 說 100%、/v3/ 說 0%，因為判定各寫一份、其中一份沒跟上更名。
 * 修法是把判定搬進一支共用模組（decision-outcome.js），兩頁都載它、不留 fallback。
 *
 * 這支是同一個做法，對象換成偏移判定。**任何頁面要顯示偏移量、校準判定或
 * 決策分身，都必須載這支**，不准在頁面裡自己算一份。
 *
 * ⚠️ 這裡是 vanilla JS：preview 不能 import TS（CLAUDE.md 架構限制），
 * 所以本檔是 `packages/engine/src/intelligence/` 的**鏡射**。
 * ⚠️ 但鏡射會漂移 —— 這個 repo 為此付過三次學費。所以
 * `scripts/preview-drift.mjs` 會**逐一比對本檔與 TS 來源的常數值**，
 * 不一致就當場紅燈。靠自律守不住的東西，交給機器守。
 *
 * ⚠️ 刻意不提供 fallback（「載不到就用頁面自己那份」）—— 那等於又生出第二份判定。
 *
 * @see docs/DECISION-INTELLIGENCE.md（規格 + keep-in-sync 清單）
 * @see packages/engine/src/intelligence/drift.ts（語意來源）
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════
  // 常數（逐一鏡射 TS —— 改這裡就要改那裡，harness 會驗）
  // ═══════════════════════════════════════════

  /** mirror of intelligence/evidence.ts MS_PER_DAY */
  var MS_PER_DAY = 86400000;

  /** mirror of intelligence/drift.ts DRIFT_EVIDENCE_REQUIREMENT */
  var DRIFT_EVIDENCE_REQUIREMENT = {
    minSamples: 8,
    moderateSamples: 12,
    highSamples: 24,
    highWindowDays: 10,
  };

  /** mirror of intelligence/drift.ts REFERENCE_WINDOW_DAYS */
  var REFERENCE_WINDOW_DAYS = 60;

  /** mirror of intelligence/drift.ts MIN_MEANINGFUL_STD */
  var MIN_MEANINGFUL_STD = 2;

  /** mirror of intelligence/drift.ts DRIFT_Z_THRESHOLDS */
  var DRIFT_Z_THRESHOLDS = { DRIFTING: 1, FAR: 2 };

  /** mirror of intelligence/drift.ts DRIFT_ABSOLUTE_THRESHOLDS */
  var DRIFT_ABSOLUTE_THRESHOLDS = { DRIFTING: 8, FAR: 16 };

  /** mirror of intelligence/drift.ts AT_REFERENCE_POINTS */
  var AT_REFERENCE_POINTS = 2;

  /** mirror of intelligence/calibration.ts CALIBRATION_EVIDENCE_REQUIREMENT */
  var CALIBRATION_EVIDENCE_REQUIREMENT = {
    minSamples: 2,
    moderateSamples: 2,
    highSamples: 8,
    highWindowDays: 5,
  };

  /** mirror of intelligence/calibration.ts MIN_MEANINGFUL_SHIFT */
  var MIN_MEANINGFUL_SHIFT = 3;

  /** mirror of intelligence/calibration.ts SHIFT_STD_FRACTION */
  var SHIFT_STD_FRACTION = 0.5;

  /** mirror of intelligence/twin.ts TWIN_EVIDENCE_REQUIREMENT */
  var TWIN_EVIDENCE_REQUIREMENT = {
    minSamples: 5,
    moderateSamples: 8,
    highSamples: 12,
    highWindowDays: 14,
  };

  /** mirror of intelligence/twin.ts TWIN_FEATURE_WEIGHTS */
  var TWIN_FEATURE_WEIGHTS = {
    timeBucket: 30,
    driftMagnitude: 30,
    band: 25,
    template: 15,
  };

  /** mirror of intelligence/twin.ts TWIN_MATCH_THRESHOLD */
  var TWIN_MATCH_THRESHOLD = 70;

  /** 只有這三個 reason 會把 confidence 壓到 moderate（mirror of CAPPING_REASONS）。 */
  var CAPPING_REASONS = [
    'inferred_only',
    'low_variability_reference',
    'mixed_capture_conditions',
  ];

  var BAND_ORDER = ['low', 'moderate', 'high'];
  var PROVENANCE_ORDER = ['measured', 'reported', 'behavioral', 'inferred'];

  // ═══════════════════════════════════════════
  // Evidence
  // ═══════════════════════════════════════════

  /**
   * 取較弱的 band。只會往下、不會往上。
   * @param {string} band
   * @param {string} ceiling
   * @returns {string}
   */
  function capBand(band, ceiling) {
    return BAND_ORDER.indexOf(band) <= BAND_ORDER.indexOf(ceiling) ? band : ceiling;
  }

  /**
   * 去重並排成正規順序。
   * @param {string[]} list
   * @returns {string[]}
   */
  function normalizeProvenance(list) {
    return PROVENANCE_ORDER.filter(function (p) {
      return list.indexOf(p) !== -1;
    });
  }

  /**
   * 算出這些時間戳落在幾個不同的日子上。
   * @param {number[]} timestamps
   * @returns {number}
   */
  function countDistinctDays(timestamps) {
    var seen = {};
    var count = 0;
    for (var i = 0; i < timestamps.length; i++) {
      var ts = timestamps[i];
      if (!isFinite(ts)) continue;
      var d = new Date(ts);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if (!seen[key]) {
        seen[key] = true;
        count++;
      }
    }
    return count;
  }

  /**
   * 建立證據基礎。confidence 是推導的，不是宣告的。
   * @param {{sampleCount:number,windowDays:number,provenance:string[],requirement:object,extraReasons?:string[]}} input
   * @returns {{sampleCount:number,windowDays:number,provenance:string[],confidence:string,reasons:string[]}}
   */
  function buildEvidence(input) {
    var req = input.requirement;
    var sampleCount = Math.max(0, Math.floor(input.sampleCount));
    var windowDays = Math.max(0, Math.floor(input.windowDays));
    var provenance = normalizeProvenance(input.provenance || []);
    var reasons = [];
    var band;

    if (sampleCount >= req.highSamples) band = 'high';
    else if (sampleCount >= req.moderateSamples) band = 'moderate';
    else band = 'low';

    if (sampleCount < req.highSamples) reasons.push('sample_count_below_high');

    if (windowDays < req.highWindowDays) {
      reasons.push('window_too_short');
      band = capBand(band, 'moderate');
    }

    var allInferred = provenance.length > 0;
    for (var i = 0; i < provenance.length; i++) {
      if (provenance[i] !== 'inferred') allInferred = false;
    }
    if (allInferred) {
      reasons.push('inferred_only');
      band = capBand(band, 'moderate');
    }

    var extra = input.extraReasons || [];
    for (var j = 0; j < extra.length; j++) {
      if (reasons.indexOf(extra[j]) === -1) reasons.push(extra[j]);
      if (CAPPING_REASONS.indexOf(extra[j]) !== -1) band = capBand(band, 'moderate');
    }

    if (sampleCount < req.minSamples) {
      if (reasons.indexOf('sample_floor_not_met') === -1) reasons.push('sample_floor_not_met');
      band = 'low';
    }

    return {
      sampleCount: sampleCount,
      windowDays: windowDays,
      provenance: provenance,
      confidence: band,
      reasons: reasons,
    };
  }

  /**
   * 還差幾筆才准開口。
   * @param {number} sampleCount
   * @param {object} requirement
   * @returns {number}
   */
  function samplesShortOfFloor(sampleCount, requirement) {
    return Math.max(0, requirement.minSamples - Math.max(0, Math.floor(sampleCount)));
  }

  /**
   * 證據不足的結果（第一級公民，不是 null）。
   * @param {object} input
   * @returns {{state:string,moreSamplesNeeded:number,evidence:object}}
   */
  function insufficientEvidence(input) {
    return {
      state: 'insufficient',
      moreSamplesNeeded: samplesShortOfFloor(input.sampleCount, input.requirement),
      evidence: buildEvidence(input),
    };
  }

  // ═══════════════════════════════════════════
  // Drift
  // ═══════════════════════════════════════════

  /**
   * 時段分桶（mirror of baseline/baseline.ts resolveTimeBucket）。
   * @param {number} ts
   * @returns {string}
   */
  function resolveTimeBucket(ts) {
    var hour = new Date(ts).getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'midday';
    return 'evening';
  }

  /**
   * 壓進 0..100，非有限數回 null。
   * @param {number} value
   * @returns {number|null}
   */
  function clampReadiness(value) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    return Math.min(100, Math.max(0, value));
  }

  /**
   * 挑出可比較的樣本：同時段、在回溯窗內、值有效。
   * @param {Array<{value:number,ts:number}>} samples
   * @param {{now:number,windowDays?:number}} options
   * @returns {Array<{value:number,ts:number}>}
   */
  function selectComparableSamples(samples, options) {
    var bucket = resolveTimeBucket(options.now);
    var windowDays = typeof options.windowDays === 'number' ? options.windowDays : REFERENCE_WINDOW_DAYS;
    var oldest = options.now - windowDays * MS_PER_DAY;
    return samples.filter(function (s) {
      if (!isFinite(s.ts) || s.ts > options.now || s.ts < oldest) return false;
      if (clampReadiness(s.value) === null) return false;
      return resolveTimeBucket(s.ts) === bucket;
    });
  }

  /**
   * 個人參考值（Welford，mirror of baseline/baseline.ts updateMetricBaseline）。
   *
   * ⚠️ **刻意不鏡射 decay 那一段**：TS 版在 sampleCount ≥ MAX_SAMPLE_COUNT（100）
   * 會把樣本數乘 0.95 衰減，preview 的合成資料遠低於 100，補上去只會多一段
   * 沒有人走得到、卻要跟著維護的分支。哪天 preview 真的要吃 100 筆以上，
   * 這裡必須先補齊，否則兩邊會在第 100 筆之後開始分岔。
   * @param {Array<{value:number,ts:number}>} samples
   * @param {string} bucket
   * @returns {{bucket:string,mean:number,std:number,sampleCount:number,windowDays:number}}
   */
  function buildPersonalReference(samples, bucket) {
    var mean = 0;
    var m2 = 0;
    var count = 0;
    for (var i = 0; i < samples.length; i++) {
      var value = clampReadiness(samples[i].value);
      if (value === null) continue;
      count++;
      var delta = value - mean;
      mean = mean + delta / count;
      m2 = m2 + delta * (value - mean);
    }
    return {
      bucket: bucket,
      mean: mean,
      std: count > 1 ? Math.sqrt(m2 / count) : 0,
      sampleCount: count,
      windowDays: countDistinctDays(
        samples.map(function (s) {
          return s.ts;
        })
      ),
    };
  }

  /**
   * 由 z 或絕對距離決定偏移等級。
   * @param {number|null} z
   * @param {number} distance
   * @returns {string}
   */
  function resolveMagnitude(z, distance) {
    if (z === null) {
      if (distance >= DRIFT_ABSOLUTE_THRESHOLDS.FAR) return 'far';
      if (distance >= DRIFT_ABSOLUTE_THRESHOLDS.DRIFTING) return 'drifting';
      return 'within';
    }
    var abs = Math.abs(z);
    if (abs >= DRIFT_Z_THRESHOLDS.FAR) return 'far';
    if (abs >= DRIFT_Z_THRESHOLDS.DRIFTING) return 'drifting';
    return 'within';
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  /**
   * 偏移判定。樣本不足回 insufficient，不回降級的數字。
   * @param {number} currentValue
   * @param {Array<{value:number,ts:number}>} history
   * @param {{now:number,windowDays?:number}} options
   * @returns {object}
   */
  function assessDrift(currentValue, history, options) {
    var bucket = resolveTimeBucket(options.now);
    var comparable = selectComparableSamples(history, options);
    var reference = buildPersonalReference(comparable, bucket);
    var current = clampReadiness(currentValue);

    var evidenceInput = {
      sampleCount: reference.sampleCount,
      windowDays: reference.windowDays,
      provenance: ['measured', 'inferred'],
      requirement: DRIFT_EVIDENCE_REQUIREMENT,
    };

    if (current === null || reference.sampleCount < DRIFT_EVIDENCE_REQUIREMENT.minSamples) {
      return insufficientEvidence(evidenceInput);
    }

    var deviation = current - reference.mean;
    var distance = Math.abs(deviation);
    var flat = reference.std < MIN_MEANINGFUL_STD;
    var z = flat ? null : deviation / reference.std;

    var direction = 'at';
    if (deviation > AT_REFERENCE_POINTS) direction = 'higher';
    else if (deviation < -AT_REFERENCE_POINTS) direction = 'lower';

    return {
      state: 'assessed',
      deviation: round1(deviation),
      distance: round1(distance),
      z: z === null ? null : round2(z),
      magnitude: resolveMagnitude(z, distance),
      direction: direction,
      reference: {
        bucket: reference.bucket,
        mean: round1(reference.mean),
        std: round1(reference.std),
        sampleCount: reference.sampleCount,
        windowDays: reference.windowDays,
      },
      evidence: buildEvidence({
        sampleCount: evidenceInput.sampleCount,
        windowDays: evidenceInput.windowDays,
        provenance: evidenceInput.provenance,
        requirement: DRIFT_EVIDENCE_REQUIREMENT,
        extraReasons: flat ? ['low_variability_reference'] : [],
      }),
    };
  }

  // ═══════════════════════════════════════════
  // Calibration
  // ═══════════════════════════════════════════

  /**
   * 有意義的變化門檻 —— 由使用者**自己的**變異推導，不是固定值。
   * @param {object|null} reference
   * @returns {number}
   */
  function meaningfulShiftThreshold(reference) {
    if (!reference || reference.std < MIN_MEANINGFUL_STD) return MIN_MEANINGFUL_SHIFT;
    return Math.max(MIN_MEANINGFUL_SHIFT, round1(reference.std * SHIFT_STD_FRACTION));
  }

  /**
   * 判定一次變化。門檻以內一律 no_clear_shift。
   * @param {number} shift
   * @param {number} threshold
   * @returns {string}
   */
  function classifyShift(shift, threshold) {
    if (shift >= threshold) return 'improved';
    if (shift <= -threshold) return 'declined';
    return 'no_clear_shift';
  }

  /**
   * 與過去校準的比較。沒有歷史就回 null，不編。
   * @param {Array<{shift:number,ts:number}>} priors
   * @param {number} threshold
   * @param {string} verdict
   * @returns {{total:number,similar:number}|null}
   */
  function summarizePriors(priors, threshold, verdict) {
    if (!priors || priors.length === 0) return null;
    var usable = priors.filter(function (p) {
      return isFinite(p.shift);
    });
    if (usable.length === 0) return null;
    return {
      total: usable.length,
      similar: usable.filter(function (p) {
        return classifyShift(p.shift, threshold) === verdict;
      }).length,
    };
  }

  /**
   * 校準證明。兩次讀數的 captureId 不同就拒絕判定。
   * @param {{before:object,after:object,reference:object|null,priors?:Array}} input
   * @returns {object}
   */
  function assessCalibration(input) {
    var before = input.before;
    var after = input.after;
    var priors = input.priors || [];
    var timestamps = [before.ts, after.ts].concat(
      priors.map(function (p) {
        return p.ts;
      })
    );

    var evidenceInput = {
      sampleCount: 2 + priors.length,
      windowDays: countDistinctDays(timestamps),
      provenance: ['measured', 'behavioral'],
      requirement: CALIBRATION_EVIDENCE_REQUIREMENT,
    };

    var usable = isFinite(before.value) && isFinite(after.value);
    var sameConditions = before.captureId === after.captureId;

    if (!usable || !sameConditions) {
      return insufficientEvidence({
        sampleCount: 0,
        windowDays: evidenceInput.windowDays,
        provenance: evidenceInput.provenance,
        requirement: CALIBRATION_EVIDENCE_REQUIREMENT,
        extraReasons: sameConditions ? [] : ['mixed_capture_conditions'],
      });
    }

    var threshold = meaningfulShiftThreshold(input.reference);
    var shift = round1(after.value - before.value);
    var verdict = classifyShift(shift, threshold);
    var extraReasons = [];
    if (!input.reference || input.reference.std < MIN_MEANINGFUL_STD) {
      extraReasons.push('low_variability_reference');
    }

    return {
      state: 'assessed',
      verdict: verdict,
      shift: shift,
      threshold: threshold,
      before: round1(before.value),
      after: round1(after.value),
      priorSummary: summarizePriors(priors, threshold, verdict),
      evidence: buildEvidence({
        sampleCount: evidenceInput.sampleCount,
        windowDays: evidenceInput.windowDays,
        provenance: evidenceInput.provenance,
        requirement: CALIBRATION_EVIDENCE_REQUIREMENT,
        extraReasons: extraReasons,
      }),
    };
  }

  // ═══════════════════════════════════════════
  // Decision Twin
  // ═══════════════════════════════════════════

  /**
   * 兩個決策時刻共有哪些可比較特徵。
   * @param {object} a
   * @param {object} b
   * @returns {string[]}
   */
  function sharedFeatures(a, b) {
    var shared = [];
    if (resolveTimeBucket(a.ts) === resolveTimeBucket(b.ts)) shared.push('timeBucket');
    if (a.driftMagnitude === b.driftMagnitude) shared.push('driftMagnitude');
    if (a.band === b.band) shared.push('band');
    if (a.templateId === b.templateId) shared.push('template');
    return shared;
  }

  /**
   * 相似度 0-100。
   * @param {object} a
   * @param {object} b
   * @returns {number}
   */
  function twinSimilarity(a, b) {
    return sharedFeatures(a, b).reduce(function (sum, f) {
      return sum + TWIN_FEATURE_WEIGHTS[f];
    }, 0);
  }

  /**
   * 找出相似的過去決策時刻。只陳述歷史，不預測。
   * @param {object} now
   * @param {Array<object>} history
   * @returns {object}
   */
  function findDecisionTwins(now, history) {
    var matches = history.filter(function (record) {
      return isFinite(record.ts) && record.ts <= now.ts && twinSimilarity(now, record) >= TWIN_MATCH_THRESHOLD;
    });

    var evidenceInput = {
      sampleCount: matches.length,
      windowDays: countDistinctDays(
        matches.map(function (m) {
          return m.ts;
        })
      ),
      provenance: ['behavioral', 'inferred'],
      requirement: TWIN_EVIDENCE_REQUIREMENT,
    };

    if (matches.length < TWIN_EVIDENCE_REQUIREMENT.minSamples) {
      return insufficientEvidence(evidenceInput);
    }

    var followed = matches.filter(function (m) {
      return m.followedProcess;
    }).length;

    var universal = Object.keys(TWIN_FEATURE_WEIGHTS);
    for (var i = 0; i < matches.length; i++) {
      var shared = sharedFeatures(now, matches[i]);
      universal = universal.filter(function (f) {
        return shared.indexOf(f) !== -1;
      });
    }

    return {
      state: 'assessed',
      matchCount: matches.length,
      followedProcessCount: followed,
      divergedCount: matches.length - followed,
      sharedFeatures: universal,
      evidence: buildEvidence(evidenceInput),
    };
  }

  // ═══════════════════════════════════════════
  // Decision Black Box（mirror of intelligence/black-box.ts）
  //
  // 🔴 紀錄器不是分析師：不跨事件下結論，只把事實排好。
  // 🔴 引擎拒絕宣稱的東西（insufficient）不會變成一條紀錄。
  // ═══════════════════════════════════════════

  /**
   * 把 scan / drift / calibration / noticed / decision 組成有時間戳的事實鏈。
   * @param {object} source
   * @returns {{events:Array,windowDays:number,claimCount:number}}
   */
  function buildBlackBox(source) {
    var events = [];

    (source.scans || []).forEach(function (scan) {
      if (!isFinite(scan.ts) || !isFinite(scan.value)) return;
      events.push({ ts: scan.ts, detail: { kind: 'scan', value: scan.value }, evidence: null });
    });

    (source.drifts || []).forEach(function (entry) {
      if (!isFinite(entry.ts) || entry.result.state !== 'assessed') return;
      events.push({
        ts: entry.ts,
        detail: {
          kind: 'drift',
          distance: entry.result.distance,
          magnitude: entry.result.magnitude,
          direction: entry.result.direction,
        },
        evidence: entry.result.evidence,
      });
    });

    (source.calibrations || []).forEach(function (entry) {
      if (!isFinite(entry.ts) || entry.result.state !== 'assessed') return;
      events.push({
        ts: entry.ts,
        detail: { kind: 'calibration', verdict: entry.result.verdict, shift: entry.result.shift },
        evidence: entry.result.evidence,
      });
    });

    (source.noticed || []).forEach(function (entry) {
      if (!isFinite(entry.ts) || entry.result.state !== 'assessed') return;
      events.push({
        ts: entry.ts,
        detail: {
          kind: 'noticed',
          matchCount: entry.result.matchCount,
          divergedCount: entry.result.divergedCount,
        },
        evidence: entry.result.evidence,
      });
    });

    (source.decisions || []).forEach(function (decision) {
      if (!isFinite(decision.ts)) return;
      events.push({
        ts: decision.ts,
        detail: {
          kind: 'decision',
          templateId: decision.templateId,
          followedProcess: decision.followedProcess,
        },
        evidence: null,
      });
    });

    events.sort(function (a, b) {
      return a.ts - b.ts;
    });

    return {
      events: events,
      windowDays: countDistinctDays(
        events.map(function (e) {
          return e.ts;
        })
      ),
      claimCount: events.filter(function (e) {
        return e.evidence !== null;
      }).length,
    };
  }

  // ═══════════════════════════════════════════
  // Copy（mirror of intelligence/copy.ts）
  //
  // 🔴 「prediction」這個字整份不出現，連否認句都改用 forecast —— 理由見 TS 檔頭。
  // 🔴 driftCopy 一個字都不講方向。
  // ═══════════════════════════════════════════

  function formatConfidence(band) {
    return band.charAt(0).toUpperCase() + band.slice(1);
  }

  function formatCount(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  function evidenceLine(evidence) {
    return (
      'Based on ' +
      formatCount(evidence.sampleCount, 'comparable session') +
      ' · Confidence: ' +
      formatConfidence(evidence.confidence)
    );
  }

  var REASON_COPY = {
    sample_floor_not_met: 'There are not yet enough comparable sessions to say anything here.',
    sample_count_below_high:
      'Fewer comparable sessions than TENKI wants before calling this high confidence.',
    window_too_short: 'These sessions do not yet span enough separate days.',
    inferred_only: 'Everything behind this line is inferred; nothing here was measured directly.',
    low_variability_reference:
      'Your readings have barely varied so far, so this distance is graded roughly.',
    mixed_capture_conditions:
      'The two readings were captured differently, so they are not directly comparable.',
  };

  function evidenceReasonCopy(code) {
    return REASON_COPY[code] || code;
  }

  function driftCopy(result) {
    if (result.state === 'insufficient') {
      return {
        headline: 'Building your baseline',
        body: 'TENKI needs a few more comparable sessions before it can tell a passing wobble from a real shift.',
        figure: formatCount(result.moreSamplesNeeded, 'more comparable session') + ' needed',
        evidenceLine: evidenceLine(result.evidence),
      };
    }
    if (result.magnitude === 'within') {
      return {
        headline: 'You are inside your usual range',
        body: 'Your reading sits about where it usually sits at this time of day.',
        figure: result.distance + ' from your baseline',
        evidenceLine: evidenceLine(result.evidence),
      };
    }
    return {
      headline: 'Your state is shifting',
      body: 'Not worse. Just different from the version of you that usually follows the plan.',
      figure: '+' + result.distance + ' away from your baseline',
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  function calibrationCopy(result) {
    if (result.state === 'insufficient') {
      var mixed = result.evidence.reasons.indexOf('mixed_capture_conditions') !== -1;
      return {
        headline: 'Not comparable',
        body: mixed
          ? 'These two readings were captured differently, so the difference would describe the instrument rather than you.'
          : 'There is not enough here to compare the two readings honestly.',
        figure: null,
        evidenceLine: evidenceLine(result.evidence),
      };
    }

    var figure = result.before + ' → ' + result.after;
    var priors = result.priorSummary;
    var priorLine = priors
      ? ' Similar in ' + priors.similar + ' of your last ' + formatCount(priors.total, 'session') + '.'
      : '';

    if (result.verdict === 'improved') {
      return {
        headline: 'Calibration response',
        body: 'Your state moved closer to where it usually sits.' + priorLine,
        figure: figure,
        evidenceLine: evidenceLine(result.evidence),
      };
    }
    if (result.verdict === 'declined') {
      return {
        headline: 'Further from your usual range',
        body: 'This reset did not settle you this time.' + priorLine,
        figure: figure,
        evidenceLine: evidenceLine(result.evidence),
      };
    }
    return {
      headline: 'No clear shift yet',
      body:
        'Nothing moved further than your own day-to-day range. That is not a failure — it is your most honest signal right now.' +
        priorLine,
      figure: figure,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  function twinCopy(result) {
    if (result.state === 'insufficient') {
      return {
        headline: 'Building your decision twins',
        body: 'Once enough of your sessions look alike, TENKI can show you what you usually do from here.',
        figure: formatCount(result.moreSamplesNeeded, 'more matching session') + ' needed',
        evidenceLine: evidenceLine(result.evidence),
      };
    }
    var resemblance =
      'This moment resembles ' + formatCount(result.matchCount, 'of your past decision session') + '.';
    var outcome =
      result.divergedCount === 0
        ? 'In all of them, you followed your own process.'
        : 'In ' + result.divergedCount + ' of them, you did not end up following your own process.';
    return {
      headline: 'TENKI noticed',
      body: resemblance + ' ' + outcome + ' This is not a forecast — it is your own recorded history.',
      figure: null,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  // ═══════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════

  global.TENKI_DRIFT = {
    // constants（harness 逐一比對 TS）
    MS_PER_DAY: MS_PER_DAY,
    DRIFT_EVIDENCE_REQUIREMENT: DRIFT_EVIDENCE_REQUIREMENT,
    REFERENCE_WINDOW_DAYS: REFERENCE_WINDOW_DAYS,
    MIN_MEANINGFUL_STD: MIN_MEANINGFUL_STD,
    DRIFT_Z_THRESHOLDS: DRIFT_Z_THRESHOLDS,
    DRIFT_ABSOLUTE_THRESHOLDS: DRIFT_ABSOLUTE_THRESHOLDS,
    AT_REFERENCE_POINTS: AT_REFERENCE_POINTS,
    CALIBRATION_EVIDENCE_REQUIREMENT: CALIBRATION_EVIDENCE_REQUIREMENT,
    MIN_MEANINGFUL_SHIFT: MIN_MEANINGFUL_SHIFT,
    SHIFT_STD_FRACTION: SHIFT_STD_FRACTION,
    TWIN_EVIDENCE_REQUIREMENT: TWIN_EVIDENCE_REQUIREMENT,
    TWIN_FEATURE_WEIGHTS: TWIN_FEATURE_WEIGHTS,
    TWIN_MATCH_THRESHOLD: TWIN_MATCH_THRESHOLD,
    // engine
    buildEvidence: buildEvidence,
    insufficientEvidence: insufficientEvidence,
    countDistinctDays: countDistinctDays,
    resolveTimeBucket: resolveTimeBucket,
    selectComparableSamples: selectComparableSamples,
    buildPersonalReference: buildPersonalReference,
    assessDrift: assessDrift,
    meaningfulShiftThreshold: meaningfulShiftThreshold,
    classifyShift: classifyShift,
    summarizePriors: summarizePriors,
    assessCalibration: assessCalibration,
    sharedFeatures: sharedFeatures,
    twinSimilarity: twinSimilarity,
    findDecisionTwins: findDecisionTwins,
    buildBlackBox: buildBlackBox,
    // copy
    formatConfidence: formatConfidence,
    formatCount: formatCount,
    evidenceLine: evidenceLine,
    evidenceReasonCopy: evidenceReasonCopy,
    driftCopy: driftCopy,
    calibrationCopy: calibrationCopy,
    twinCopy: twinCopy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
