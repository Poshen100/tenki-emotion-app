/**
 * TENKI — 掃描嘗試紀錄（守門指標的原料）
 *
 * 北極星（每週填完的決策數）看不到「入口壞了」：第一次掃描就失敗的人
 * 不會出現在任何決策紀錄裡。這份紀錄讓 usage-summary.js 推得出兩個守門指標
 * （founder 2026-11-22，CLAUDE.md 產品定位）：
 *   - 首測成功：裝置上第一次掃描有沒有拿到讀數
 *   - 有效讀數：拿到讀數的次數 / 跑完的掃描次數
 *
 * 🔴 每一筆**只有時間與結果**（拿到讀數／沒拿到／中途取消）。沒有帶位、沒有讀數、沒有任何量測值 ——
 *    讀數本身已經在 readiness-history 裡，這裡再存一份就是第二個來源。
 * 🔴 只存在本機、不送出去。離開裝置的唯一方式是使用者自己複製使用摘要。
 * 🔴 中途取消**單獨記**（founder 2026-11-23）：取消不是量不到，不進「有效讀數」的
 *    分母；但也不能消失 —— 一直被取消的掃描是另一種入口問題（太久、太煩、看不懂），
 *    它要看得見。「首測」只看第一次**跑完**的掃描，取消不算一次量測。
 */
(function (global) {
  'use strict';

  var SCAN_ATTEMPTS_KEY = 'tenki.scan.attempts.v1';
  /** 上限：夠算比例，又不會無限長。超過就丟最舊的 —— 但「第一次」另外記住。 */
  var SCAN_ATTEMPTS_MAX = 200;
  var OUTCOMES = ['reading', 'no_reading', 'cancelled'];
  /** 算「跑完」的結果（首測與有效讀數只看這兩種）。 */
  var COMPLETED = ['reading', 'no_reading'];

  /**
   * 把讀進來的東西整理成合法的紀錄。壞掉的列丟掉，不拋錯。
   * @param {*} raw
   * @returns {{first: ?{ts:number,outcome:string}, attempts: Array<{ts:number,outcome:string}>}}
   */
  function load(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var valid = function (row) {
      return !!row && typeof row.ts === 'number' && OUTCOMES.indexOf(row.outcome) !== -1;
    };
    var attempts = Array.isArray(src.attempts) ? src.attempts.filter(valid) : [];
    var first = valid(src.first) && COMPLETED.indexOf(src.first.outcome) !== -1
      ? { ts: src.first.ts, outcome: src.first.outcome }
      : null;
    return { first: first, attempts: attempts };
  }

  /**
   * 加一筆。純函式。
   * @param {ReturnType<typeof load>} log
   * @param {{ts:number,outcome:string}} attempt
   * @returns {ReturnType<typeof load>}
   */
  function append(log, attempt) {
    var attempts = log.attempts.concat([{ ts: attempt.ts, outcome: attempt.outcome }]);
    if (attempts.length > SCAN_ATTEMPTS_MAX) attempts = attempts.slice(attempts.length - SCAN_ATTEMPTS_MAX);
    // 「第一次」只寫一次 —— 被上限擠掉的最舊一筆不能把它一起帶走。
    // 取消不算一次量測，所以不會成為「第一次」。
    var first = log.first ||
      (COMPLETED.indexOf(attempt.outcome) !== -1 ? { ts: attempt.ts, outcome: attempt.outcome } : null);
    return { first: first, attempts: attempts };
  }

  function read() {
    try {
      return load(JSON.parse(global.localStorage.getItem(SCAN_ATTEMPTS_KEY)));
    } catch (e) {
      return load(null);
    }
  }

  /**
   * 記一次掃描的結果。寫不進去回 false —— 不假裝成功。
   * @param {'reading'|'no_reading'|'cancelled'} outcome
   * @returns {boolean}
   */
  function record(outcome) {
    if (OUTCOMES.indexOf(outcome) === -1) return false;
    try {
      global.localStorage.setItem(SCAN_ATTEMPTS_KEY, JSON.stringify(append(read(), { ts: Date.now(), outcome: outcome })));
      return true;
    } catch (e) {
      if (global.console && global.console.warn) {
        global.console.warn('[tenki] 掃描嘗試寫不進去，這一次沒有被記錄:', e);
      }
      return false;
    }
  }

  global.TENKI_SCAN_ATTEMPTS = {
    SCAN_ATTEMPTS_KEY: SCAN_ATTEMPTS_KEY,
    SCAN_ATTEMPTS_MAX: SCAN_ATTEMPTS_MAX,
    load: load,
    append: append,
    read: read,
    record: record,
  };
})(typeof window !== 'undefined' ? window : globalThis);
