/**
 * readiness-history.js — 讀數歷史的**唯一** preview 來源。
 *
 * ═══════════════════════════════════════════════
 * 為什麼要有這支檔案
 * ═══════════════════════════════════════════════
 * 🔴 **每次掃描都把上一次覆蓋掉。** `tenki.readiness.reading.v1` 是
 * `setItem` 單筆（readiness-scan.js 的 `saveReading`），所以「當下讀數」
 * 一直有，「你自己的歷史」一筆都沒有。而 Drift Alert / Decision Twin /
 * Clear Window 全部吃歷史 —— 它們永遠不可能在一個只留一列的 store 上跑。
 *
 * 這支負責累積。**舊 key 一個位元組都不動**（別的代碼在讀它，挪用
 * persisted key 就是讓既有紀錄靜默壞掉）；歷史寫進新的
 * `tenki.readiness.history.v1`。
 *
 * ⚠️ 這裡是 vanilla JS：preview 不能 import TS（CLAUDE.md 架構限制），
 * 所以本檔是 `domain/src/policies/readiness-history.ts` 的**鏡射**。
 * `scripts/preview-drift.mjs` 逐一比對兩邊的常數 —— 鏡射漂移這個 repo
 * 付過三次學費，靠自律守不住的交給機器守。
 *
 * ⚠️ **刻意不提供 fallback**（「載不到就在頁面裡自己存一份」）——
 * 那等於又生出第二份 store，正是這支檔案要消滅的東西。
 * 載不到就出聲（console.error）並且**不寫**，不假裝成功。
 *
 * @see docs/DECISION-INTELLIGENCE.md（規格 + keep-in-sync 清單）
 * @see domain/src/policies/readiness-history.ts（語意來源）
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════
  // 常數（逐一鏡射 TS —— harness 會驗）
  // ═══════════════════════════════════════════

  /** mirror of contracts/readiness-history.ts READINESS_HISTORY_KEY */
  var READINESS_HISTORY_KEY = 'tenki.readiness.history.v1';

  /** mirror of contracts/readiness-history.ts READINESS_HISTORY_SCHEMA */
  var READINESS_HISTORY_SCHEMA = 1;

  /** mirror of contracts/readiness-history.ts READINESS_HISTORY_MAX */
  var READINESS_HISTORY_MAX = 500;

  var CAPTURE_TIERS = ['A', 'B'];
  var EDGE_ZONES = ['clear', 'neutral', 'strain'];
  var CONFIDENCE_BANDS = ['high', 'moderate', 'low'];

  // ═══════════════════════════════════════════
  // 寫入
  // ═══════════════════════════════════════════

  /**
   * 把一筆讀數攤平成儲存形狀。**不產生任何推導分數。**
   * @param {{band:string,confidence:string,ts:number,evidence:object}} reading
   * @returns {object}
   */
  function toHistorySample(reading) {
    return {
      schema: READINESS_HISTORY_SCHEMA,
      ts: reading.ts,
      stillness: reading.evidence.stillness,
      lighting: reading.evidence.lighting,
      uniformity: reading.evidence.uniformity,
      blinkCadence: reading.evidence.blinkCadence,
      tier: reading.evidence.tier,
      band: reading.band,
      confidence: reading.confidence,
    };
  }

  /**
   * append 一筆：同 ts 取代而非重複、由舊到新排序、超過上限丟最舊的。
   * 不改動傳進來的陣列。
   * @param {Array<object>} history
   * @param {object} sample
   * @returns {Array<object>}
   */
  function appendHistorySample(history, sample) {
    var kept = history.filter(function (row) {
      return row.ts !== sample.ts;
    });
    kept.push(sample);
    kept.sort(function (a, b) {
      return a.ts - b.ts;
    });
    return kept.length > READINESS_HISTORY_MAX
      ? kept.slice(kept.length - READINESS_HISTORY_MAX)
      : kept;
  }

  // ═══════════════════════════════════════════
  // 讀取
  // ═══════════════════════════════════════════

  /**
   * 是不是 0..1 的有限數。超出範圍的**丟掉不夾住** ——
   * 夾住會把壞掉的產生端藏進一個看起來很合理的分布裡。
   * @param {*} value
   * @returns {boolean}
   */
  function isUnitSignal(value) {
    return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1;
  }

  /**
   * 驗一列。信不過就回 null。
   * @param {*} row
   * @returns {object|null}
   */
  function parseSample(row) {
    if (typeof row !== 'object' || row === null) return null;
    // 別的 schema 寫的列**丟掉不猜** —— 用今天的欄位意義去讀它，
    // 就是讓未來的一次改名變成無聲的壞資料。
    if (row.schema !== READINESS_HISTORY_SCHEMA) return null;
    if (typeof row.ts !== 'number' || !isFinite(row.ts)) return null;
    if (!isUnitSignal(row.stillness) || !isUnitSignal(row.lighting) || !isUnitSignal(row.uniformity)) {
      return null;
    }
    if (row.blinkCadence !== null && !isUnitSignal(row.blinkCadence)) return null;
    if (CAPTURE_TIERS.indexOf(row.tier) === -1) return null;
    if (EDGE_ZONES.indexOf(row.band) === -1) return null;
    if (CONFIDENCE_BANDS.indexOf(row.confidence) === -1) return null;

    return {
      schema: READINESS_HISTORY_SCHEMA,
      ts: row.ts,
      stillness: row.stillness,
      lighting: row.lighting,
      uniformity: row.uniformity,
      blinkCadence: row.blinkCadence,
      tier: row.tier,
      band: row.band,
      confidence: row.confidence,
    };
  }

  /**
   * 從 storage 回來的任何東西裡讀出歷史，**並回報丟掉幾列**。
   * 無聲丟掉讀不動的列就是 `|| fallback`（錯了也不吭聲）。
   * @param {*} raw
   * @returns {{samples:Array<object>,dropped:number}}
   */
  function loadHistory(raw) {
    if (!Array.isArray(raw)) return { samples: [], dropped: 0 };
    var samples = [];
    var dropped = 0;
    for (var i = 0; i < raw.length; i++) {
      var sample = parseSample(raw[i]);
      if (sample === null) dropped++;
      else samples.push(sample);
    }
    samples.sort(function (a, b) {
      return a.ts - b.ts;
    });
    return { samples: samples, dropped: dropped };
  }

  // ═══════════════════════════════════════════
  // 分布
  // ═══════════════════════════════════════════

  function percentile(sorted, q) {
    if (sorted.length === 1) return sorted[0];
    var pos = (sorted.length - 1) * q;
    var lo = Math.floor(pos);
    var hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  /**
   * 一個訊號實際怎麼走。`span`（max − min）是**動門檻之前要先看的那個數字**：
   * span 很小的訊號撐不起任何門檻，不管它正規化得多漂亮
   * （CLAUDE.md 的 browTension 前例：用力皺眉只讓色相動 0.69°）。
   * @param {Array<number>} values
   * @returns {object|null}
   */
  function summarizeSignal(values) {
    var usable = values.filter(function (v) {
      return typeof v === 'number' && isFinite(v);
    });
    if (usable.length === 0) return null;

    var sorted = usable.slice().sort(function (a, b) {
      return a - b;
    });
    var mean =
      usable.reduce(function (sum, v) {
        return sum + v;
      }, 0) / usable.length;
    var variance =
      usable.reduce(function (sum, v) {
        return sum + (v - mean) * (v - mean);
      }, 0) / usable.length;

    return {
      count: usable.length,
      min: sorted[0],
      p25: percentile(sorted, 0.25),
      median: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      max: sorted[sorted.length - 1],
      mean: mean,
      std: Math.sqrt(variance),
      span: sorted[sorted.length - 1] - sorted[0],
    };
  }

  function countDistinctDays(timestamps) {
    var seen = {};
    var count = 0;
    for (var i = 0; i < timestamps.length; i++) {
      var d = new Date(timestamps[i]);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if (!seen[key]) {
        seen[key] = true;
        count++;
      }
    }
    return count;
  }

  /**
   * 歷史目前長什麼樣。**這不是給使用者看的 insight**，它對人不做任何宣稱 ——
   * 它是「drift 的軸能誠實建在什麼上面」這個決定的輸入。
   * @param {Array<object>} samples
   * @returns {object}
   */
  function summarizeHistory(samples) {
    var tierCounts = {};
    for (var i = 0; i < samples.length; i++) {
      var tier = samples[i].tier;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
    var pluck = function (key) {
      return samples.map(function (s) {
        return s[key];
      });
    };
    var blinks = pluck('blinkCadence').filter(function (v) {
      return v !== null;
    });

    return {
      sampleCount: samples.length,
      distinctDays: countDistinctDays(pluck('ts')),
      firstTs: samples.length > 0 ? samples[0].ts : null,
      lastTs: samples.length > 0 ? samples[samples.length - 1].ts : null,
      signals: {
        stillness: summarizeSignal(pluck('stillness')),
        lighting: summarizeSignal(pluck('lighting')),
        uniformity: summarizeSignal(pluck('uniformity')),
        blinkCadence: summarizeSignal(blinks),
      },
      tierCounts: tierCounts,
    };
  }

  /**
   * 分成固定寬度的桶，讓分布的**形狀**看得見，不只是摘要數字。
   * @param {Array<number>} values
   * @param {number} bucketCount
   * @returns {Array<number>}
   */
  function histogram(values, bucketCount) {
    var n = Math.max(1, bucketCount);
    var buckets = [];
    for (var b = 0; b < n; b++) buckets.push(0);
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (typeof value !== 'number' || !isFinite(value)) continue;
      var clamped = Math.min(1, Math.max(0, value));
      // 1.0 屬於最後一個桶，不是屬於一個不存在的第 n+1 桶。
      var index = Math.min(n - 1, Math.floor(clamped * n));
      buckets[index]++;
    }
    return buckets;
  }

  // ═══════════════════════════════════════════
  // Storage（這一層 TS 沒有 —— 它是瀏覽器專屬的邊界）
  // ═══════════════════════════════════════════

  /**
   * 讀出目前的歷史。localStorage 讀不到（無痕、被關掉）時回空 ——
   * 那是**環境事實**不是資料判定，所以這裡不算 fallback。
   * @returns {{samples:Array<object>,dropped:number}}
   */
  function read() {
    var raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(READINESS_HISTORY_KEY));
    } catch (e) {
      raw = null;
    }
    return loadHistory(raw);
  }

  /**
   * 把一筆讀數記進歷史。回傳寫完之後的筆數，寫不進去回 null ——
   * **不假裝成功**。
   * @param {{band:string,confidence:string,ts:number,evidence:object}} reading
   * @returns {number|null}
   */
  function record(reading) {
    if (!reading || !reading.evidence || typeof reading.ts !== 'number') return null;
    var next = appendHistorySample(read().samples, toHistorySample(reading));
    try {
      localStorage.setItem(READINESS_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      // Safari 無痕 / 配額滿 —— 說出來，不要讓資料無聲消失。
      if (global.console && global.console.warn) {
        global.console.warn('[tenki] 讀數歷史寫不進去，這一筆沒有被記錄:', e);
      }
      return null;
    }
    return next.length;
  }

  /**
   * 目前累積的摘要（給 /drift/ 的分布卡用）。
   * @returns {{summary:object,dropped:number}}
   */
  function summary() {
    var loaded = read();
    return { summary: summarizeHistory(loaded.samples), dropped: loaded.dropped };
  }

  global.TENKI_READINESS_HISTORY = {
    // constants（harness 逐一比對 TS）
    READINESS_HISTORY_KEY: READINESS_HISTORY_KEY,
    READINESS_HISTORY_SCHEMA: READINESS_HISTORY_SCHEMA,
    READINESS_HISTORY_MAX: READINESS_HISTORY_MAX,
    // pure
    toHistorySample: toHistorySample,
    appendHistorySample: appendHistorySample,
    loadHistory: loadHistory,
    summarizeSignal: summarizeSignal,
    summarizeHistory: summarizeHistory,
    histogram: histogram,
    // storage
    read: read,
    record: record,
    summary: summary,
  };
})(typeof window !== 'undefined' ? window : globalThis);
