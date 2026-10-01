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
   * outcomeTag → 結果軸的預設值。`domain/src/contracts/trade-result.ts` 的鏡射。
   *
   * 🔴 **在紀錄產生的當下就要寫**，不能等使用者按收束頁的收尾鍵 ——
   * 他判定「進場」之後直接關掉收束頁是很正常的事，而那樣寫出來的紀錄會沒有
   * 這一欄 → 讀回來是 `null` → `countsAsTrade` 回 false → **那筆交易從當日
   * 計數裡整個消失**：額度永遠用不完、面板照樣彈，畫面上完全看不出異狀。
   *
   * 🔴 放在這支共用模組而不是兩頁各抄一份：`/v3/` 建立紀錄、`/decision-alert/`
   * 之後細化它，兩邊對同一個映射的理解必須是同一份（本檔存在的理由）。
   *
   * 對照：
   *   `judged_entered`        → `pending`（交易發生了，結果待回填，**算一筆**）
   *   `judged_stood_down`     → `no_entry`（推導，不再問一次）
   *   `abandoned_no_judgment` → `null`（連有沒有交易都不知道，不猜）
   *   舊語意的 tag            → `null`（倒數模式不是節奏規則的流程）
   *
   * @param {string} outcomeTag
   * @returns {string|null}
   * @see docs/TRADINGVIEW-ALERT-SPEC.md §9b
   */
  function defaultTradeResult(outcomeTag) {
    if (outcomeTag === 'judged_entered') return 'pending';
    if (outcomeTag === 'judged_stood_down') return 'no_entry';
    return null;
  }

  // ═══════════════════════════════════════════════
  // 日界節奏（§6.1 贏停 / 雙輸熔斷）—— `domain/src/policies/day-cadence.ts`
  // 與 `domain/src/contracts/trade-result.ts` 的鏡射
  // ═══════════════════════════════════════════════
  // ⚠️ preview 不能 import `domain/`（CLAUDE.md 架構限制），所以這裡是手抄。
  // 🔴 這個 repo 為鏡射漂移付過三次學費（同一筆決策，一頁 100%、另一頁 0%）——
  //    `scripts/preview-drift.mjs` 的做法是逐一比對兩邊的常數值與每一句文案，
  //    這一段照同一個方式被守著：改這裡**必須**同時改 domain，否則守門會紅。
  // 🔴 本段**只報事實，不報該怎麼做**：回傳「今天幾筆、上一筆怎麼結束」，
  //    不回傳任何指示。`contextZh` 可以逐字上畫面（已過合規層）。

  /**
   * 結果三選一的畫面文案 —— `domain/src/contracts/trade-result.ts` 的鏡射。
   *
   * 🔴 **住在這裡而不是各頁各寫一份**：收束頁（`/decision-alert/`）問這一題，
   * Session 詳情（`/v3/`）回填同一題。兩份清單遲早漂移，而漂移的那一份會讓
   * 同一筆紀錄在兩頁顯示不同的結果。
   *
   * 🔴 文案不得用自然的交易詞彙：`PROHIBITED_VOCABULARY_ZH` 擋掉
   * 獲利／虧損／停損／停利，所以「獲利了結」「停損」都不能上畫面。
   * 這三句是實際跑過 `findProhibitedTerms` 確認乾淨的。
   * ⚠️ 內部識別字（`profit_taken` / `stopped_out`）不受此限 —— 那是 persisted contract。
   *
   * 🔴 沒有第四顆「還沒有結果」：那是**未選取**的狀態（值＝ `pending`）。
   * 多一顆可切換的晶片會讓「取消選取」變成兩個意思。
   */
  var TRADE_RESULT_CHIPS = [
    { value: 'profit_taken', label: '達到目標' },
    { value: 'stopped_out', label: '觸及保護價' },
    { value: 'scratch', label: '打平出場' },
  ];

  /** 方法論的時鐘：交易日是 ET 日，不是 UTC 日。 */
  var TRADING_DAY_TZ = 'America/New_York';

  /** §6.1 頻率：每天 1–2 筆。 */
  var DAILY_TRADE_BUDGET = 2;

  var DAY_CADENCE_STATES = [
    'fresh', 'second_chance', 'stop_after_win', 'circuit_break', 'day_complete',
  ];

  /**
   * 這筆結果算不算當日的一筆交易。
   * 🔴 `pending`（結果還沒回填）**算**：交易發生了，只是結果未知。
   * 當成不算的話當日額度永遠用不完 —— 見 trade-result 契約檔頭。
   * ⚠️ 也收 `undefined`（契約之前寫的紀錄根本沒有這一欄）。
   */
  function countsAsTrade(result) {
    return result !== null && result !== undefined && result !== 'no_entry';
  }

  /** 只有停損算輸（平手不算 —— 熔斷是為了止血，平手沒有在流血）。 */
  function isLoss(result) { return result === 'stopped_out'; }

  /** 只有達到目標算贏（`pending` 不算 —— 未知不等於好）。 */
  function isWin(result) { return result === 'profit_taken'; }

  /**
   * 某個時刻屬於哪一個 ET 日。
   * ⚠️ **不得**改用 UTC 日界（`toISOString`）—— 那會在 ET 19:00／20:00 換日，
   * 把傍晚的交易歸到隔天。`en-CA` 直接吐 YYYY-MM-DD，DST 交給 `Intl`。
   */
  function resolveTradingDayKey(nowMs) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TRADING_DAY_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(nowMs));
  }

  function cadenceContext(state, tradesToday) {
    if (state === 'fresh') return '今天還沒有決策紀錄';
    if (state === 'stop_after_win') return '今天第 1 筆 · 上一筆達到目標';
    if (state === 'second_chance') return '今天第 1 筆 · 已收束';
    if (state === 'circuit_break') return '今天 2 筆 · 兩筆都觸及保護價';
    return '今天已完成 ' + String(tradesToday) + ' 筆';
  }

  /**
   * 今天走到哪裡了。
   * @param {Array<{ts:number, tradeResult:string|null}>} records
   * @param {number} nowMs
   * @returns {{tradesToday:number, state:string, contextZh:string}}
   */
  function resolveDayCadence(records, nowMs) {
    var today = resolveTradingDayKey(nowMs);
    var todays = (records || []).filter(function (r) {
      return r && countsAsTrade(r.tradeResult) && resolveTradingDayKey(r.ts) === today;
    }).slice().sort(function (a, b) { return a.ts - b.ts; });

    var tradesToday = todays.length;
    var state;
    if (tradesToday === 0) state = 'fresh';
    else if (tradesToday === 1) {
      state = isWin(todays[0].tradeResult) ? 'stop_after_win' : 'second_chance';
    } else if (isLoss(todays[0].tradeResult) && isLoss(todays[1].tradeResult)) {
      state = 'circuit_break';
    } else {
      state = 'day_complete';
    }
    return { tradesToday: tradesToday, state: state, contextZh: cadenceContext(state, tradesToday) };
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
  // 🔴 `fill` 一律由 `isDisciplined()` 推出來，**不是每個 tag 各挑一個顏色**。
  // 上面那條規則（「畫面上任何跟紀律有關的數字、顏色、文案都要走這一支」）
  // 原本沒有掃到這裡：Timeline 的點與 strip 各自寫死三個色，於是
  //   · `judged_entered` 綠、`judged_stood_down` 青 —— **兩個都算紀律，卻不同色**
  //   · 而 `/decision-alert/` 收束頁的 `segColor()` 早就是照紀律分兩色的
  // 同一件事兩頁兩種畫法，其中一種一定是假的。現在兩邊同一條規則。
  //
  // ⚠️ 順帶修掉一個更硬的錯：Timeline 的圖例寫的是**舊語意**
  // （跟著流程／完整走完／提前收束），而新紀錄走的是判定語意 ——
  // 一個判定「不成立」的紀錄，圖例會告訴使用者那個點的意思是「完整走完」。
  //
  // 🔴 綠退場的理由不是不好看：`--good #34C759` 在三種色盲下同時撞掉
  // gold(10.2) / Clear(12.5) / Strain(12.5) / amber(13.5)，而門檻是 20
  // （`docs/VISUAL-DIRECTION.md` §3.8）。**它可以當表面，不能當宣稱** ——
  // 而這裡正是「一顆沒有字的彩色圓點」。
  var FILL_ALIGNED = 'var(--zone-clear)';
  var FILL_OFF = 'var(--zone-strain)';
  var OUTCOME_VIEW = {
    // 新語意（structure_watch_v1）
    judged_entered: { text: '判定成立 · 已進場', badge: '判定成立', cls: 'win', dot: 'entry', fill: FILL_ALIGNED },
    judged_stood_down: { text: '判定不成立 · 未進場', badge: '判定不成立', cls: 'win', dot: 'exit', fill: FILL_ALIGNED },
    abandoned_no_judgment: { text: '沒有做出判定', badge: '未判定', cls: 'loss', dot: 'cancel', fill: FILL_OFF },
    // 舊語意（既有紀錄，仍要認得）
    stayed_disciplined: { text: '跟著流程完成', badge: '跟著流程', cls: 'win', dot: 'entry', fill: FILL_ALIGNED },
    // ⚠️ `cls` 原本是 'breakeven'，但 `timed_out` 在 LEGACY_DISCIPLINED_TAGS 裡 ——
    //    也就是說同一筆紀錄，`isDisciplined()` 說算紀律、徽章卻印中性的「breakeven」。
    //    跟 fill 同一條規則：跟紀律走。
    timed_out: { text: '完整走完', badge: '完整走完', cls: 'win', dot: 'exit', fill: FILL_ALIGNED },
    broke_discipline: { text: '提前收束', badge: '提前收束', cls: 'loss', dot: 'cancel', fill: FILL_OFF },
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
    // 🔴 只有 `=== true` 才算過期。`readingAtDecision` 與 `staleAtDecision`
    // 是**同一顆 commit 加進去的**，所以有讀數就一定有這個旗標 ——
    // undefined 是一個現實中不存在的形狀。真的遇到就不放進「已過期」那一格
    // （說不出口的事不要說），而不是為它發明第三個桶。
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
    defaultTradeResult: defaultTradeResult,
    TRADE_RESULT_CHIPS: TRADE_RESULT_CHIPS,
    TRADING_DAY_TZ: TRADING_DAY_TZ,
    DAILY_TRADE_BUDGET: DAILY_TRADE_BUDGET,
    DAY_CADENCE_STATES: DAY_CADENCE_STATES,
    countsAsTrade: countsAsTrade,
    isLoss: isLoss,
    isWin: isWin,
    resolveTradingDayKey: resolveTradingDayKey,
    resolveDayCadence: resolveDayCadence,
    load: load,
    MIN_BAND_SAMPLES_FOR_RATE: MIN_BAND_SAMPLES_FOR_RATE,
    BAND_ORDER: BAND_ORDER,
    bandOfRecord: bandOfRecord,
    bandExclusionReason: bandExclusionReason,
    disciplineByBand: disciplineByBand,
  };
}(typeof window !== 'undefined' ? window : this));
