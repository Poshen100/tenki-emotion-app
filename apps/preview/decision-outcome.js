/**
 * decision-outcome.js — 決策收束的**唯一判定來源**。
 *
 * ═══════════════════════════════════════════════
 * 為什麼要有這支檔案
 * ═══════════════════════════════════════════════
 * 「算不算紀律」這個判定在 preview 裡曾經有三份實作，每一份都獨立漂移過：
 *
 * 1. 2026-08-07 `segColor()` 沒跟上 #219 的 tag 更名 → 同一筆決策，
 *    完成率說 100%、正下方的軌跡條卻畫成破戒橘。
 * 2. 2026-08-09 模板代號在標題與資料表各記一份 → 介面漏出內部 id。
 * 3. 2026-08-09 **跨檔漂移，最嚴重的一次**：`decision-alert.js` 改用新語意
 *    （`judged_entered` / `judged_stood_down`）之後，`/v3/` 的
 *    `isDisciplinedV6()` 仍然只認舊的 `stayed_disciplined` / `timed_out` ——
 *    於是**在 decision-alert 看到 100%，進到 /v3/ Session 變 0%**。
 *    兩邊共用同一個 store，資料確實存進去了，只是收端聽不懂寫端的方言。
 *
 * 前兩次是同檔內、grep 得到；第三次跨檔，沒人會想到去對照另一個檔案。
 * 所以判定被搬到這裡：**兩個頁面都載這一支，各自的區域實作全部刪掉。**
 *
 * ⚠️ **刻意不提供 fallback**（「載不到就用本地那份」）—— 那等於又生出第二份判定，
 * 正是這支檔案要消滅的東西。本檔是同源靜態檔，可靠度與該頁自己的 JS 相同。
 *
 * ⚠️ 這裡是 vanilla JS：preview 不能 import `domain/`（CLAUDE.md 架構限制），
 * 所以本檔是 `domain/src/policies/decision-outcome.ts` 的**鏡射**。
 * 兩邊改動要同步，語意見該檔。
 *
 * @see docs/PLAYBOOK.md §6「判定只能有一個來源」
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // 語意斷點（2026-08-04，founder 實走）
  // ═══════════════════════════════════════════════
  // 舊語意問「有沒有走完計時器」，於是 11 秒就判定進場被打成「提前收束」、紀律 0%。
  //
  // 新語意只問一件事：**你有沒有做出判定。**
  //   judged_entered          判定成立並進場        → 紀律
  //   judged_stood_down       判定不成立、放棄      → 紀律（無觸發 → 不交易）
  //   abandoned_no_judgment   離開/逾時而從未判定   → 不算紀律
  // 時間不再進入這個判斷，只作為事實脈絡呈現。
  // ═══════════════════════════════════════════════

  /** 統一決策 store 的 key。快訊決策與 v6 計時器決策合流成同一份節奏歷史。 */
  var STORE_KEY = 'tenki.alert.outcomes.v1';

  /** 新語意標記，寫進每一筆新紀錄，供統計辨識語意斷點。 */
  var JUDGMENT_SCHEMA = 'structure_watch_v1';

  /** 新語意裡算紀律的 tag。 */
  var DISCIPLINED_TAGS = ['judged_entered', 'judged_stood_down'];

  /**
   * 舊語意裡算紀律的 tag。**仍要認得** —— 既有紀錄不重寫、也不丟棄。
   * v6 的計時器決策至今仍寫這一組（它量的就是「有沒有走完計時器」），
   * 那在它自己的語境裡是對的，所以這裡照認。
   */
  var LEGACY_DISCIPLINED_TAGS = ['stayed_disciplined', 'timed_out'];

  /**
   * 這筆收束算不算紀律。**畫面上任何跟紀律有關的數字、顏色、文案都要走這一支。**
   *
   * @param {string} tag - 紀錄裡的 `outcomeTag`。
   * @returns {boolean}
   */
  function isDisciplined(tag) {
    return DISCIPLINED_TAGS.indexOf(tag) !== -1
      || LEGACY_DISCIPLINED_TAGS.indexOf(tag) !== -1;
  }

  /**
   * judgment → outcomeTag。
   *
   * @param {'entered'|'stood_down'|'abandoned'} judgment
   * @returns {string}
   */
  function resolveOutcomeTag(judgment) {
    if (judgment === 'entered') return 'judged_entered';
    if (judgment === 'stood_down') return 'judged_stood_down';
    return 'abandoned_no_judgment';
  }

  /**
   * 讀統一 store。壞資料一律當成空陣列 —— 讀不到歷史不該讓整頁掛掉。
   *
   * @returns {Array<Object>}
   */
  function load() {
    try {
      var all = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(all) ? all : [];
    } catch (e) {
      return [];
    }
  }

  global.TENKI_OUTCOME = {
    STORE_KEY: STORE_KEY,
    JUDGMENT_SCHEMA: JUDGMENT_SCHEMA,
    DISCIPLINED_TAGS: DISCIPLINED_TAGS,
    LEGACY_DISCIPLINED_TAGS: LEGACY_DISCIPLINED_TAGS,
    isDisciplined: isDisciplined,
    resolveOutcomeTag: resolveOutcomeTag,
    load: load,
  };
}(typeof window !== 'undefined' ? window : this));
