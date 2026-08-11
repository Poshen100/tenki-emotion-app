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

  // ═══════════════════════════════════════════════
  // 呈現對照 —— 紀錄要**認得出自己是誰**
  // ═══════════════════════════════════════════════
  // 2026-08-09：判定修好之後，Session 頁的百分比對了，我就宣告「接通了」。
  // 但那筆決策到了 /v3/ 長成這樣：
  //     ❤️ ES1!  ·  15:23 · 未達 Readiness · 0:04  ·  [已記錄]
  // 四處都錯，而且**沒有一處會報錯**（全是 `|| fallback`）。
  // ⚠️ 教訓：**一個數字對了不等於這筆紀錄被認得。**
  // 所以呈現對照也收進這裡，跟判定同一個來源。

  /**
   * 模板 id 對照：快訊決策寫的是 engine 的 `TraderTemplateId`
   * （`FBD` / `CANSLIM` / `MODE_2`，persisted contract），
   * 而 v6 的 `TEMPLATES` 用自己的一套 key。**兩套從來沒對上** ——
   * `TEMPLATES['FBD']` 是 undefined，於是決策失去方法論身分、
   * fallback 成一顆灰色心跳圖示加上 symbol。
   *
   * ⚠️ **兩邊的 id 都不改** —— engine 那組是持久化契約，v6 那組是它自己的表；
   * 動任何一邊都會弄壞既有紀錄。這裡只做翻譯。
   */
  var TEMPLATE_ID_TO_V6 = {
    FBD: 'MANCINI_FBD',
    CANSLIM: 'CANSLIM_GS',
    MODE_2: 'CANSLIM_HIGH_RS',
  };

  /**
   * 收束結果的呈現。**新舊語意都要有** —— 少了哪一個，那一筆就會掉進
   * fallback 變成灰色的「已記錄」，看起來像沒被認得。
   *
   * `cls` 對應 v6 既有的 badge 樣式（win / breakeven / loss），
   * `dot` 對應 Timeline 的點類別，`fill` 是點的顏色。
   */
  var OUTCOME_VIEW = {
    // 新語意（structure_watch_v1）
    judged_entered: { text: '判定成立 · 已進場', badge: '判定成立', cls: 'win', dot: 'entry', fill: 'var(--good)' },
    judged_stood_down: { text: '判定不成立 · 未進場', badge: '判定不成立', cls: 'win', dot: 'exit', fill: 'var(--primary)' },
    abandoned_no_judgment: { text: '沒有做出判定', badge: '未判定', cls: 'loss', dot: 'cancel', fill: '#ff7e76' },
    // 舊語意（既有紀錄，仍要認得）
    stayed_disciplined: { text: '跟著流程完成', badge: '跟著流程', cls: 'win', dot: 'entry', fill: 'var(--good)' },
    timed_out: { text: '完整走完', badge: '完整走完', cls: 'breakeven', dot: 'exit', fill: 'var(--primary)' },
    broke_discipline: { text: '提前收束', badge: '提前收束', cls: 'loss', dot: 'cancel', fill: '#ff7e76' },
  };

  /**
   * 取這筆紀錄的呈現。查不到就回 null —— **由呼叫端決定怎麼誠實地留白**，
   * 這裡不編一個看起來像結果的預設值。
   *
   * @param {string} tag
   * @returns {?{text:string, badge:string, cls:string, dot:string, fill:string}}
   */
  function outcomeView(tag) {
    return OUTCOME_VIEW[tag] || null;
  }

  /**
   * 把快訊決策的 templateId 翻成 v6 的 key。翻不了就回原值
   * （v6 自己寫的紀錄本來就是 v6 的 key，不需要翻譯）。
   *
   * @param {string} templateId
   * @returns {string}
   */
  function toV6TemplateId(templateId) {
    return TEMPLATE_ID_TO_V6[templateId] || templateId;
  }

  global.TENKI_OUTCOME = {
    TEMPLATE_ID_TO_V6: TEMPLATE_ID_TO_V6,
    OUTCOME_VIEW: OUTCOME_VIEW,
    outcomeView: outcomeView,
    toV6TemplateId: toV6TemplateId,
    STORE_KEY: STORE_KEY,
    JUDGMENT_SCHEMA: JUDGMENT_SCHEMA,
    DISCIPLINED_TAGS: DISCIPLINED_TAGS,
    LEGACY_DISCIPLINED_TAGS: LEGACY_DISCIPLINED_TAGS,
    isDisciplined: isDisciplined,
    resolveOutcomeTag: resolveOutcomeTag,
    load: load,
  };
}(typeof window !== 'undefined' ? window : this));
