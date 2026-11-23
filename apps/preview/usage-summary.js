/**
 * TENKI — 使用摘要（本機漏斗）
 *
 * 回答一件事：這個人在「基線 → 掃描 → 接上快訊 → 判定 → 判定與結果都填完」
 * 這條路上走到哪一步，以及最近 7 天填完了幾筆決策（北極星，見 CLAUDE.md 產品定位）。
 * 外加兩個守門指標（founder 2026-11-22）：首測有沒有成功、跑完的掃描有幾次拿到讀數。
 * 北極星看不到入口壞了 —— 第一次就量失敗的人根本不會出現在決策紀錄裡。
 *
 * 🔴 全部是從裝置上的本機紀錄推導的，不送出去。守門指標吃 scan-attempts.js 那份
 *    「只有時間與成敗」的紀錄；其他照舊吃既有的資料。
 *    摘要只有步驟與筆數 —— 沒有標的、沒有結果、沒有讀數。它離開裝置的唯一方式
 *    是使用者自己按下去複製再貼給別人。
 *
 * 純函式：輸入是已經讀好的值，不碰 localStorage（讀在呼叫端）。
 */
(function (global) {
  'use strict';

  /** 「最近」的長度：7 天。 */
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  /** 算成「做了判定」的 outcomeTag（與 decision-outcome.js 的 DISCIPLINED_TAGS 同一組）。 */
  var JUDGED_TAGS = ['judged_entered', 'judged_stood_down'];

  /** 判定過（進場或不動），不含沒判定就離開的。 */
  function isJudged(rec) {
    return !!rec && JUDGED_TAGS.indexOf(rec.outcomeTag) !== -1;
  }

  /**
   * 判定與結果都填完。
   * 「先不動」沒有結果可填，判定完就是完成；「進場」要等結果填了才算。
   */
  function isClosed(rec) {
    if (!isJudged(rec)) return false;
    if (rec.outcomeTag !== 'judged_entered') return true;
    var r = rec.tradeResult;
    return r !== 'pending' && r !== null && r !== undefined;
  }

  /**
   * @param {Object} input
   * @param {boolean} input.onboarded 基線建立過
   * @param {number} input.readingCount 掃描讀數筆數
   * @param {boolean} input.hasChannel 這台裝置有快訊連結
   * @param {Array<Object>} input.outcomes 決策紀錄（tenki.alert.outcomes.v1）
   * @param {number} input.nowMs 現在
   * @param {?{first: ?{outcome:string}, attempts: Array<{outcome:string}>}} [input.scanAttempts]
   *   scan-attempts.js 的 load() 結果；沒有就當作還沒有任何紀錄
   * @returns {{steps: Array<{id: string, label: string, done: boolean}>,
   *   weekJudged: number, weekClosed: number, weekOpen: number,
   *   guard: {firstScan: ?string, completed: number, withReading: number,
   *     noReading: number, cancelled: number}}}
   */
  function summarize(input) {
    var outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
    var since = input.nowMs - WEEK_MS;
    var judged = outcomes.filter(isJudged);
    var recent = judged.filter(function (rec) {
      return typeof rec.ts === 'number' && rec.ts >= since && rec.ts <= input.nowMs;
    });
    var weekClosed = recent.filter(isClosed).length;
    var log = input.scanAttempts && Array.isArray(input.scanAttempts.attempts) ? input.scanAttempts : null;
    var attempts = log ? log.attempts : [];
    var count = function (outcome) {
      return attempts.filter(function (a) { return a.outcome === outcome; }).length;
    };
    return {
      steps: [
        { id: 'baseline', label: '建立基線', done: input.onboarded === true },
        { id: 'scan', label: '掃描', done: input.readingCount > 0 },
        { id: 'channel', label: '接上快訊', done: input.hasChannel === true },
        { id: 'judged', label: '做過判定', done: judged.length > 0 },
        { id: 'closed', label: '填完一筆', done: judged.some(isClosed) },
      ],
      weekJudged: recent.length,
      weekClosed: weekClosed,
      weekOpen: recent.length - weekClosed,
      guard: {
        // 🔴 null ＝「沒有紀錄」，不是失敗。這份紀錄 2026-11-22 才開始寫，
        //    之前就掃過的人第一次掃描根本沒被記下來 —— 不能把它算成「首測失敗」。
        firstScan: log && log.first ? log.first.outcome : null,
        // 「跑完」＝拿到讀數＋沒拿到。中途取消不在分母裡，但單獨給數字（founder 2026-11-23）。
        completed: count('reading') + count('no_reading'),
        withReading: count('reading'),
        noReading: count('no_reading'),
        cancelled: count('cancelled'),
      },
    };
  }

  /**
   * 摘要的文字版（畫面顯示與複製用同一份，不各寫一套）。
   *
   * @param {ReturnType<typeof summarize>} summary
   * @returns {{title: string, detail: string, guard: string}}
   */
  function describe(summary) {
    var title = '最近 7 天填完 ' + summary.weekClosed + ' 筆決策';
    if (summary.weekOpen > 0) title += '，還有 ' + summary.weekOpen + ' 筆沒填結果';
    var detail = summary.steps.map(function (step) {
      return step.label + (step.done ? ' ✓' : ' —');
    }).join(' · ');
    var g = summary.guard;
    var first = g.firstScan === 'reading' ? '首測成功'
      : g.firstScan === 'no_reading' ? '首測沒拿到讀數'
      : '首測沒有紀錄';
    // 🔴 兩個數字都給，不給百分比：n 很小的時候「100%」跟「1/1」是兩件事。
    var guard = first + ' · 跑完的掃描 ' + g.completed + ' 次：拿到讀數 ' + g.withReading +
      '、沒拿到 ' + g.noReading + ' · 中途取消 ' + g.cancelled + ' 次';
    return { title: title, detail: detail, guard: guard };
  }

  global.TENKI_USAGE = {
    WEEK_MS: WEEK_MS,
    isClosed: isClosed,
    summarize: summarize,
    describe: describe,
  };
})(typeof window !== 'undefined' ? window : globalThis);
