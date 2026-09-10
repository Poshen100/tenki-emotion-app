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
  /**
   * v6 key → 顯示名。**與 `v6/index.html` 的 `TEMPLATES[*].name` 同字**。
   * 自訂模板（使用者自己建的，id 是亂數）不在這裡 —— 那是刻意的：
   * 收束頁只會為快訊決策開啟，而快訊一律走這三個交易者模板。
   */
  var TEMPLATE_NAME = {
    CANSLIM_GS: 'Canslim GS',
    CANSLIM_HIGH_RS: 'Canslim High RS',
    MANCINI_FBD: 'Mancini FBD',
    WORK_FOCUS: 'Work Focus',
    HEALTH_STRESS: 'Health Stress',
    EXERCISE: 'Exercise',
  };

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

  /**
   * 模板的**顯示名**。
   *
   * 🔴 2026-09-09 founder 實走抓到：`/decision-alert/` 的收束頁把
   * **內部 id 直接印在畫面上** —— 標題與軌跡表的「標的」列都是
   * `ES1! · MANCINI_FBD`。同一筆紀錄在 `/v3/` 的 Session 詳情印的卻是
   * 正確的 `ES1! · Mancini FBD`（那邊查了 `TEMPLATES[...].name`）。
   * 根因是 `acceptReturnTicket()` 寫 `tplName: rec.templateId` ——
   * **拿 id 當名字**。
   *
   * ⚠️ 這正是送審檢查表 #18 與「MODE_2 不得出現在任何 user-facing 文字」
   * 擋的那一類，而那條斷言只守模板選單、沒有守收束頁，所以一路綠著。
   *
   * 名字放這裡的理由跟 `OUTCOME_VIEW` 一樣：**兩頁看同一筆紀錄，
   * 就不能各自有一份講法**。來源是 `apps/preview/v6/index.html` 的
   * `TEMPLATES`（v6 是這些名字的主人），這裡是它的鏡射 —— 加模板要同步。
   *
   * 🔴 查不到就回 `null`，**不回原值** —— 回原值就是把 id 印上畫面，
   * 正是這支函式存在的理由。由呼叫端決定怎麼誠實地留白。
   *
   * @param {string} templateId - 可以是 engine 的 id 或 v6 的 key。
   * @returns {?string} 顯示名，或 null（不認得）。
   */
  function templateName(templateId) {
    return TEMPLATE_NAME[toV6TemplateId(templateId)] || null;
  }

  // ═══════════════════════════════════════════════
  // 「我在什麼狀態下最跟得住自己的流程」
  //
  // ⚠️ 這是 `domain/src/policies/readiness-band.ts` 的
  // `summarizeDisciplineByBand()` 的鏡射（preview 不能 import domain）。
  // 語意以該檔為準，兩邊改動要同步 —— 跟本檔其餘部分同一個規矩。
  //
  // 🔴 那支的 doc comment 自己就把誠實規則寫死了：
  //   "Records without a reading are excluded — they cannot be attributed to a
  //    band, and guessing one would fabricate the very insight this exists to give."
  // 所以沒有 `readingAtDecision` 的紀錄（2026-09-08 之前的全部）一律排除，
  // 而**排除了幾筆要講出來** —— 不講就變成「用一半的資料宣稱一個全貌」。
  //
  // 🔴 **過期的讀數也不算**（2026-09-10 加）。`staleAtDecision` 這個旗標
  // 寫進去了卻沒有人讀 —— founder 實走時 Baseline 是「49 小時前 校準」，
  // 而一筆用它跑完的決策被歸給了 **Clear**（實測 `attributed:1 excluded:0`）。
  // 但這張圖問的是「我**按下判定那一刻**在什麼狀態」，49 小時前量的東西
  // 答不出來 —— 那正是上面那句 doc comment 說的 fabricate。
  // ⚠️ 而且它跟這個 app 自己的標準打架：Hero 超過 15 分鐘就印「讀數已過期 ·
  // 到 Scan 掃一次」。閾值不另訂，直接沿用寫紀錄那一端的
  // `READING_FRESHNESS_MS_V6` —— 旗標在存檔時就算好了，這裡只是**讀它**。
  // ⚠️ 「沒有讀數」與「讀數已過期」是**兩件事**，排除數要分開回，
  // 合成一句就是「把不知道講成沒發生」的同一家族。
  //
  // 🔴 樣本 < MIN_BAND_SAMPLES_FOR_RATE 時 `rate` 回 null ＝「還不夠說」，
  // 不是 0。UI 要印「資料累積中」，不是一個吵雜的百分比。
  // ═══════════════════════════════════════════════

  /** 一個帶位至少要幾筆才值得給比率。與 domain 同值。 */
  var MIN_BAND_SAMPLES_FOR_RATE = 3;

  /** 帶位順序，clear → strain。 */
  var BAND_ORDER = ['clear', 'neutral', 'strain'];

  /**
   * 為什麼一筆紀錄歸不出帶位。`null` ＝ 歸得出來。
   *
   * @param {object} rec
   * @returns {'no_reading'|'stale'|null}
   */
  function bandExclusionReason(rec) {
    var r = rec && rec.readingAtDecision;
    if (!r || BAND_ORDER.indexOf(r.band) < 0) return 'no_reading';
    // 🔴 只有 `=== true` 才算過期。舊紀錄可能沒有這個欄位（undefined），
    // 那是「不知道」不是「過期」—— 缺欄位不准說否定，也不准說肯定。
    if (r.staleAtDecision === true) return 'stale';
    return null;
  }

  /**
   * 從紀錄推出「這一筆是在哪個帶位做的」。
   *
   * @param {object} rec
   * @returns {'clear'|'neutral'|'strain'|null} null = 這筆歸不出帶位（沒讀數或已過期）
   */
  function bandOfRecord(rec) {
    if (bandExclusionReason(rec)) return null;
    return rec.readingAtDecision.band;
  }

  /**
   * Summarizes discipline completion grouped by the band the decision was
   * taken in. Mirrors domain's `summarizeDisciplineByBand`.
   *
   * @param {object[]} records
   * @returns {{stats:object[], attributed:number, excluded:number,
   *            excludedNoReading:number, excludedStale:number, total:number}}
   */
  function disciplineByBand(records) {
    var list = Array.isArray(records) ? records : [];
    var stats = [];
    var attributed = 0;
    for (var i = 0; i < BAND_ORDER.length; i++) {
      var band = BAND_ORDER[i];
      var inBand = list.filter(function (r) { return bandOfRecord(r) === band; });
      attributed += inBand.length;
      // ⚠️ `isDisciplined` 吃的是 **tag 字串**，不是紀錄物件。
      // 直接 `.filter(isDisciplined)` 會全部回 false —— 而畫面上長出來的是
      // 一張「每個帶位都 0%」的**看起來很合理**的圖。第一版就是這樣，
      // 是把圖畫出來看才發現的。
      var disciplined = inBand.filter(function (r) {
        return isDisciplined(r && r.outcomeTag);
      }).length;
      stats.push({
        band: band,
        total: inBand.length,
        disciplined: disciplined,
        rate: inBand.length >= MIN_BAND_SAMPLES_FOR_RATE ? disciplined / inBand.length : null,
      });
    }
    var noReading = 0;
    var stale = 0;
    for (var j = 0; j < list.length; j++) {
      var why = bandExclusionReason(list[j]);
      if (why === 'no_reading') noReading += 1;
      else if (why === 'stale') stale += 1;
    }
    return {
      stats: stats,
      attributed: attributed,
      excluded: list.length - attributed,
      excludedNoReading: noReading,
      excludedStale: stale,
      total: list.length,
    };
  }

  global.TENKI_OUTCOME = {
    TEMPLATE_ID_TO_V6: TEMPLATE_ID_TO_V6,
    OUTCOME_VIEW: OUTCOME_VIEW,
    outcomeView: outcomeView,
    toV6TemplateId: toV6TemplateId,
    TEMPLATE_NAME: TEMPLATE_NAME,
    templateName: templateName,
    STORE_KEY: STORE_KEY,
    JUDGMENT_SCHEMA: JUDGMENT_SCHEMA,
    DISCIPLINED_TAGS: DISCIPLINED_TAGS,
    LEGACY_DISCIPLINED_TAGS: LEGACY_DISCIPLINED_TAGS,
    isDisciplined: isDisciplined,
    resolveOutcomeTag: resolveOutcomeTag,
    load: load,
    MIN_BAND_SAMPLES_FOR_RATE: MIN_BAND_SAMPLES_FOR_RATE,
    BAND_ORDER: BAND_ORDER,
    bandOfRecord: bandOfRecord,
    bandExclusionReason: bandExclusionReason,
    disciplineByBand: disciplineByBand,
  };
}(typeof window !== 'undefined' ? window : this));
