/*
 * TENKI — 外部快訊 → 決策入口 Demo（/decision-alert/）
 * 模擬 TradingView 快訊走完 delivery policy → Decision Entry Panel →
 * 模板建議 → 浮動決策計時條 → 事件鏈。全部合成資料，無真實訊號源。
 *
 * Keep-in-sync（hand mirror，preview 無法 import TS）：
 * - delivery 判定順序 / 冷卻邏輯 → domain/src/policies/alert-policy.ts
 * - TEMPLATES 常數                → packages/engine/src/session/templates.ts
 * - 模板建議映射                  → packages/engine/src/session/template-suggestion.ts
 * Canonical 行為規格：docs/TRADINGVIEW-ALERT-SPEC.md
 */
(function () {
  'use strict';

  // 使用者可調決策節奏設定（mirror of domain AlertDeliverySettings；
  // preview 預設用 demo 縮時值：冷卻 30s / 聚合 60s，正式 domain 預設冷卻 300s）
  var SETTINGS_KEY = 'tenki.alert.settings.v1';
  var DEFAULT_SETTINGS = {
    cooldownSec: 30,
    aggregationSec: 60,
    strainSilent: true,
    sessionQuietUpdate: true,
    quietWindow: false,
  };

  function loadSettings() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_SETTINGS);
    return {
      cooldownSec: (typeof s.cooldownSec === 'number' && s.cooldownSec >= 0) ? s.cooldownSec : DEFAULT_SETTINGS.cooldownSec,
      aggregationSec: (typeof s.aggregationSec === 'number' && s.aggregationSec >= 0) ? s.aggregationSec : DEFAULT_SETTINGS.aggregationSec,
      strainSilent: typeof s.strainSilent === 'boolean' ? s.strainSilent : DEFAULT_SETTINGS.strainSilent,
      sessionQuietUpdate: typeof s.sessionQuietUpdate === 'boolean' ? s.sessionQuietUpdate : DEFAULT_SETTINGS.sessionQuietUpdate,
      quietWindow: typeof s.quietWindow === 'boolean' ? s.quietWindow : DEFAULT_SETTINGS.quietWindow,
    };
  }

  // Mirror of domain isWithinQuietWindowET（美東 11:00–14:00，DST-aware）
  function isWithinQuietWindowET(nowMs) {
    var formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', hour12: false,
    }).format(new Date(nowMs));
    var h = Number(formatted);
    if (h === 24) h = 0;
    return h >= 11 && h < 14;
  }

  // Mirror of packages/engine/src/session/templates.ts TRADER_TEMPLATES
  var TEMPLATES = {
    FBD: {
      id: 'FBD', nameZh: 'Mancini 假跌破流程', icon: '🎯', durationSec: 180,
      segments: [
        { startSec: 0, endSec: 60, color: '#5E3A87', label: 'Ground' },
        { startSec: 60, endSec: 120, color: '#00B4D8', label: 'Execute' },
        { startSec: 120, endSec: 180, color: '#F5A623', label: 'Confirm' },
      ],
      readinessWindow: { startSec: 60, endSec: 120 },
    },
    CANSLIM: {
      id: 'CANSLIM', nameZh: 'Canslim GS 流程', icon: '📋', durationSec: 300,
      segments: [
        { startSec: 0, endSec: 60, color: '#FF6B35', label: 'Observe' },
        { startSec: 60, endSec: 180, color: '#00B4D8', label: 'Readiness' },
        { startSec: 180, endSec: 300, color: '#8E8E93', label: 'Extended' },
      ],
      readinessWindow: { startSec: 60, endSec: 180 },
    },
    MODE_2: {
      id: 'MODE_2', nameZh: '高 RS 突破流程', icon: '⚡', durationSec: 240,
      segments: [
        { startSec: 0, endSec: 45, color: '#FF6B35', label: 'Quick Read' },
        { startSec: 45, endSec: 150, color: '#00B4D8', label: 'Readiness' },
        { startSec: 150, endSec: 240, color: '#8E8E93', label: 'Control' },
      ],
      readinessWindow: { startSec: 45, endSec: 150 },
    },
  };

  // Mirror of suggestTemplateForStrategyHint（先匹配者優先）
  var STRATEGY_KEYWORDS = [
    { keyword: 'canslim', templateId: 'CANSLIM' },
    { keyword: 'fbd', templateId: 'FBD' },
    { keyword: 'mancini', templateId: 'FBD' },
    { keyword: 'high rs', templateId: 'MODE_2' },
    { keyword: 'mode 2', templateId: 'MODE_2' },
    { keyword: 'sensitivity', templateId: 'MODE_2' },
  ];

  function suggestTemplate(hint) {
    if (!hint) return null;
    var normalized = hint.trim().toLowerCase();
    if (!normalized) return null;
    for (var i = 0; i < STRATEGY_KEYWORDS.length; i++) {
      if (normalized.indexOf(STRATEGY_KEYWORDS[i].keyword) !== -1) {
        return STRATEGY_KEYWORDS[i].templateId;
      }
    }
    return null;
  }

  // Mirror of domain extractMarketMode + MARKET_MODE_CONTEXT_ZH（事實脈絡，非建議）
  var MODE_PATTERN = /mode\s*([12])\b/i;
  var MARKET_MODE_CONTEXT_ZH = {
    mode_1: 'Mode 1 · 趨勢延續傾向',
    mode_2: 'Mode 2 · 區間／陷阱傾向',
  };

  function matchMode(text) {
    if (!text) return null;
    var m = MODE_PATTERN.exec(text);
    if (!m) return null;
    return m[1] === '1' ? 'mode_1' : 'mode_2';
  }

  function marketModeContext(alert) {
    var mode = matchMode(alert.condition) || matchMode(alert.note);
    return mode ? MARKET_MODE_CONTEXT_ZH[mode] : null;
  }

  // Mirror of domain decision-outcome（流程語言，非勝負；禁 PnL/勝率）
  var OUTCOME_STORE_KEY = 'tenki.alert.outcomes.v1';
  var REFLECT_TAGS = ['跟計畫', '有點急', '偏離計畫'];

  // 收束頁顯示偏好（可調 + 持久）。記錄一律 on（安全、不可關）→ 不提供關閉記錄的開關。
  var RESULT_SETTINGS_KEY = 'tenki.alert.result.settings.v1';
  var DEFAULT_RESULT_SETTINGS = { showHistory: true, showRecap: true, showReflect: true };
  function loadResultSettings() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(RESULT_SETTINGS_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_RESULT_SETTINGS);
    return {
      showHistory: s.showHistory !== false,
      showRecap: s.showRecap !== false,
      showReflect: s.showReflect !== false,
    };
  }
  function toggleHidden(node, show) {
    if (!node) return;
    if (show) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  }

  function resolveOutcomeTag(endType, reachedReadiness) {
    if (endType === 'timeout') return 'timed_out';
    if (endType === 'cancel') return 'broke_discipline';
    return reachedReadiness ? 'stayed_disciplined' : 'broke_discipline';
  }

  function isDisciplined(tag) {
    return tag === 'stayed_disciplined' || tag === 'timed_out';
  }

  // 收束頁顯示文字：由 endType + 是否進入 readiness 窗決定（比 tag 更細）
  function outcomeDisplay(endType, reachedReadiness) {
    if (endType === 'timeout') return { text: '完整走完', cls: 'disciplined' };
    if (endType === 'cancel') return { text: '中途退出', cls: 'broke' };
    if (reachedReadiness) return { text: '跟著流程完成', cls: 'disciplined' };
    return { text: '提前收束（Readiness 窗前）', cls: 'broke' };
  }

  function loadOutcomes() {
    try { return JSON.parse(localStorage.getItem(OUTCOME_STORE_KEY)) || []; } catch (e) { return []; }
  }

  function saveOutcome(record) {
    var all = loadOutcomes();
    all.push(record);
    if (all.length > 200) all = all.slice(all.length - 200);
    localStorage.setItem(OUTCOME_STORE_KEY, JSON.stringify(all));
  }

  function rateText(records) {
    if (records.length === 0) return '紀律完成率：—（資料累積中）';
    var d = 0;
    records.forEach(function (r) { if (isDisciplined(r.outcomeTag)) d += 1; });
    return '紀律完成率：' + Math.round((d / records.length) * 100) + '%（' + d + '/' + records.length + '）';
  }

  /** 進入決策面板的紀律脈絡由 renderEntryDiscipline 負責（含標的範圍）；
   *  此處僅在沒有 pending alert 時保留一行泛統計，避免蓋掉標的化文案。 */
  function refreshDiscipline() {
    if (el.entryDiscipline && !state.pendingAlert) {
      el.entryDiscipline.textContent = '你過去的' + rateText(loadOutcomes());
    }
  }

  /** 掃描層是否已載入（PR2 的 readiness-scan.js 會註冊）。 */
  function hasReadinessScanner() {
    return !!(window.TENKI_READINESS_SCAN && window.TENKI_READINESS_SCAN.begin);
  }

  // ── 示意狀態（點擊循環；合成值，非真實讀數）──
  var ZONE_STATES = [
    { zone: 'clear', label: 'Clear', score: 78, cssVar: '--zone-clear' },
    { zone: 'neutral', label: 'Neutral', score: 58, cssVar: '--zone-neutral' },
    { zone: 'strain', label: 'Strain', score: 32, cssVar: '--zone-strain' },
  ];

  // ═══════════════════════════════════════════════
  // 狀態讀數（readiness reading）
  // 鏡射 domain/src/policies/readiness-band.ts 的新鮮度與語彙。讀數是「質化帶位」，
  // 只有 band + confidence + evidence，永遠不生成 0-100 分（瀏覽器量不到 HRV）。
  // 掃描層在 PR2 接上；在那之前 store 是空的 → UI 誠實顯示「尚無讀數」。
  // ═══════════════════════════════════════════════
  var READING_STORE_KEY = 'tenki.readiness.reading.v1';
  var READING_FRESHNESS_MS = 15 * 60 * 1000;
  var BAND_LABEL = { clear: 'Clear', neutral: 'Neutral', strain: 'Strain' };
  var CONFIDENCE_LABEL = { high: '信心高', moderate: '信心中', low: '信心低' };

  function loadReading() {
    try {
      var raw = JSON.parse(localStorage.getItem(READING_STORE_KEY));
      if (!raw || typeof raw !== 'object' || !BAND_LABEL[raw.band]) return null;
      return raw;
    } catch (e) { return null; }
  }

  function saveReading(reading) {
    localStorage.setItem(READING_STORE_KEY, JSON.stringify(reading));
  }

  function isReadingFresh(reading, now) {
    if (!reading) return false;
    return now - reading.ts < READING_FRESHNESS_MS;
  }

  /** 'carry_forward' | 'suggest_rescan' | 'no_reading' — 永不擋決策。 */
  function resolveReadingGate(reading, now) {
    if (!reading) return 'no_reading';
    return isReadingFresh(reading, now) ? 'carry_forward' : 'suggest_rescan';
  }

  /** 相對時間（事實語言，無誇飾）。 */
  function agoText(ts, now) {
    var sec = Math.max(0, Math.round((now - ts) / 1000));
    if (sec < 10) return '剛剛';
    if (sec < 60) return sec + ' 秒前';
    var min = Math.round(sec / 60);
    if (min < 60) return min + ' 分鐘前';
    var hr = Math.round(min / 60);
    if (hr < 24) return hr + ' 小時前';
    return Math.round(hr / 24) + ' 天前';
  }

  var state = {
    zoneIdx: 1, // Neutral 起手
    settings: loadSettings(),
    resultSettings: loadResultSettings(),
    lastSurfacedAtBySymbol: {},
    sessionActive: false,
    activeSessionSymbol: null,
    session: null,
    pendingOutcome: null,
    pendingAlert: null,
    entryGate: 'no_reading',
    entryAgeTimer: null,
    pendingGroup: null,
    alertSeq: 0,
    timer: null,
  };

  var el = {};
  [
    'stateCard', 'stateDot', 'stateLine', 'btnSingle', 'btnMulti', 'btnRepeat',
    'silentArea', 'logList', 'backdrop', 'entrySheet',
    'entryPing', 'entrySymbol', 'entryCond', 'entryAge', 'entrySource', 'entryChips',
    'entryNote', 'entryState', 'entryBand', 'entryReadingAge', 'entryRescan', 'entryEvidence',
    'entryDiscLabel', 'entryDiscRate', 'entryStrip', 'entryDiscipline', 'entryCost',
    'btnDismiss', 'btnEngage',
    'tplSheet', 'tplList', 'aggSheet', 'aggHead', 'aggList',
    'resultSheet', 'resultHead', 'resultOutcome', 'resultArc', 'resultArcCenter', 'resultArcGlow', 'resultArcTime',
    'resultHistory', 'resultMeterFill', 'resultRate', 'resultStrip',
    'resultRecap', 'resultRecapList', 'resultReflectWrap', 'resultReflect', 'btnResultSave',
    'timerBar', 'timerLabel', 'timerClock',
    'btnComplete', 'btnCancel', 'segTrack', 'segLabels', 'timerPhase', 'timerUpdate',
    'liveToggle', 'liveDot', 'liveStatus', 'liveChevron', 'liveBody',
    'liveSetup', 'liveReady', 'liveGenerate', 'liveUrl', 'liveUrlWarn', 'liveCopy', 'liveReset',
    'liveSymbol', 'liveTimeframe', 'liveStrategy',
    'livePushRow', 'livePushBtn', 'livePushStatus',
    'liveSelfTest', 'liveSelfTestResult',
    'setToggle', 'setStatus', 'setChevron', 'setBody', 'setCooldown', 'setAggregation',
    'setStrainSilent', 'setSessionQuiet', 'setQuietWindow', 'setReset',
    'resToggle', 'resChevron', 'resBody', 'resShowHistory', 'resShowRecap', 'resShowReflect',
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  // ── 狀態卡 ──
  function currentZone() { return ZONE_STATES[state.zoneIdx]; }

  function renderState() {
    var z = currentZone();
    el.stateDot.style.background = 'var(' + z.cssVar + ')';
    el.stateLine.textContent = z.label + ' · Decision Edge Score ' + z.score;
  }

  el.stateCard.addEventListener('click', function () {
    state.zoneIdx = (state.zoneIdx + 1) % ZONE_STATES.length;
    renderState();
  });

  // ── 事件鏈 log ──
  var TYPE_LABELS = {
    received: { text: '已接收', cls: 'received' },
    surfaced: { text: '已呈現', cls: 'surfaced' },
    engaged: { text: '進入決策', cls: 'engaged' },
    dismissed: { text: '已略過', cls: 'dismissed' },
    suppressed: { text: '冷卻抑制', cls: 'suppressed' },
    silent: { text: '靜默接收', cls: 'received' },
    aggregated: { text: '聚合呈現', cls: 'surfaced' },
    mark: { text: '過程標記', cls: 'engaged' },
    close: { text: '完成', cls: 'outcome' },
    cancel: { text: '取消', cls: 'dismissed' },
    timeout: { text: '時間到', cls: 'outcome' },
  };

  function nowLabel() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function log(type, detail) {
    var empty = el.logList.querySelector('.log-empty');
    if (empty) empty.remove();

    var meta = TYPE_LABELS[type] || { text: type, cls: 'received' };
    var item = document.createElement('div');
    item.className = 'log-item';

    var time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = nowLabel();

    var typeEl = document.createElement('span');
    typeEl.className = 'log-type ' + meta.cls;
    typeEl.textContent = meta.text;

    var detailEl = document.createElement('span');
    detailEl.className = 'log-detail';
    detailEl.textContent = detail;

    item.appendChild(time);
    item.appendChild(typeEl);
    item.appendChild(detailEl);
    el.logList.insertBefore(item, el.logList.firstChild);
  }

  function silentChip(text) {
    var chip = document.createElement('div');
    chip.className = 'silent-chip';
    chip.textContent = text;
    el.silentArea.appendChild(chip);
    while (el.silentArea.children.length > 3) {
      el.silentArea.removeChild(el.silentArea.firstChild);
    }
  }

  // ── Delivery policy（mirror of domain alert-policy 判定順序）──
  function evaluateDelivery(alert, nowMs) {
    if (state.sessionActive) {
      if (state.settings.sessionQuietUpdate && state.activeSessionSymbol !== null && state.activeSessionSymbol === alert.symbol) {
        return { decision: 'session_update', reason: '同標的後續觸發' };
      }
      return { decision: 'silent', reason: '決策進行中' };
    }
    if (state.settings.strainSilent && currentZone().zone === 'strain') {
      return { decision: 'silent', reason: 'Strain 狀態' };
    }
    var last = state.lastSurfacedAtBySymbol[alert.symbol];
    if (last !== undefined && nowMs - last < state.settings.cooldownSec * 1000) {
      return { decision: 'suppressed', reason: '同標的冷卻中' };
    }
    return { decision: 'surfaced', reason: '' };
  }

  function makeAlert(symbol, condition, timeframe, strategy, note) {
    state.alertSeq += 1;
    return {
      id: 'demo-' + state.alertSeq,
      symbol: symbol, condition: condition, timeframe: timeframe,
      strategyHint: strategy, note: note, receivedAt: Date.now(),
    };
  }

  function ingest(alert) {
    log('received', alert.symbol + ' · ' + alert.condition + ' (' + alert.timeframe + ')');
    var result = evaluateDelivery(alert, Date.now());

    if (result.decision === 'session_update') {
      sessionQuietUpdate(alert);
      return;
    }
    if (result.decision === 'silent') {
      log('silent', alert.symbol + ' — ' + result.reason + '，不打擾');
      silentChip(alert.symbol + ' 快訊（已接收）');
      return;
    }
    if (result.decision === 'suppressed') {
      log('suppressed', alert.symbol + ' — ' + result.reason);
      return;
    }
    surfaceAlert(alert);
  }

  function surfaceAlert(alert) {
    state.lastSurfacedAtBySymbol[alert.symbol] = Date.now();
    state.pendingAlert = alert;
    log('surfaced', alert.symbol + ' — 決策入口開啟');

    renderEntryPanel(alert);
    openSheet(el.entrySheet);
    startEntryAgeTicker(alert);
  }

  // ── 進入決策：交易者儀器面板 ──

  /** 訊號讀出 + 出處 + 情境 chips + 狀態槽 + 紀律脈絡 + 成本預期。 */
  function renderEntryPanel(alert) {
    el.entrySymbol.textContent = alert.symbol;
    var condParts = [];
    if (alert.condition) condParts.push(alert.condition);
    if (alert.timeframe) condParts.push(alert.timeframe);
    el.entryCond.textContent = condParts.join(' · ');

    // 出處行（Fable-5 的 "Data & method" 直覺）
    var src = ['TradingView'];
    if (alert.strategyHint) src.push(alert.strategyHint);
    el.entrySource.textContent = src.join(' · ');

    // 情境 chips
    el.entryChips.innerHTML = '';
    var chips = [];
    var modeCtx = marketModeContext(alert);
    if (modeCtx) chips.push({ text: modeCtx, warn: false });
    if (state.settings.quietWindow && isWithinQuietWindowET(Date.now())) {
      chips.push({ text: '盤整迴避時段', warn: true });
    }
    chips.forEach(function (c) {
      var node = document.createElement('div');
      node.className = 'entry-chip' + (c.warn ? ' warn' : '');
      node.textContent = c.text;
      el.entryChips.appendChild(node);
    });

    el.entryNote.textContent = alert.note || '';

    renderEntryState();
    renderEntryDiscipline(alert);
    renderEntryCost(alert);
    updateEntryAge(alert);
  }

  /** 狀態讀數槽 — 誠實三態，永不假裝有讀數。 */
  function renderEntryState() {
    var now = Date.now();
    var reading = loadReading();
    var gate = resolveReadingGate(reading, now);

    // 掃描層由 readiness-scan.js 提供（PR2）。還沒有就不顯示死按鈕 —
    // 寧可少一個入口，也不放一個點了沒反應的鈕。
    el.entryRescan.hidden = !hasReadinessScanner();

    el.entryState.classList.toggle('stale', gate === 'suggest_rescan');
    el.entryBand.className = 'es-band' + (reading ? ' ' + reading.band : '');
    el.entryBand.textContent = reading ? BAND_LABEL[reading.band] : '—';

    if (gate === 'no_reading') {
      el.entryReadingAge.textContent = '尚無狀態讀數';
      el.entryEvidence.textContent = '';
      el.entryRescan.textContent = '掃描';
    } else if (gate === 'suggest_rescan') {
      el.entryReadingAge.textContent = '上次讀數 ' + agoText(reading.ts, now) + ' · 建議重掃';
      el.entryEvidence.textContent = '';
      el.entryRescan.textContent = '重掃';
    } else {
      el.entryReadingAge.textContent = agoText(reading.ts, now);
      el.entryEvidence.textContent = readingEvidenceText(reading);
      el.entryRescan.textContent = '重掃';
    }
    state.entryGate = gate;
  }

  /** 依據行 — 說明這個帶位是憑什麼來的（有出處，不神秘）。 */
  function readingEvidenceText(reading) {
    var parts = [];
    if (CONFIDENCE_LABEL[reading.confidence]) parts.push(CONFIDENCE_LABEL[reading.confidence]);
    var ev = reading.evidence || {};
    if (typeof ev.stillness === 'number') parts.push('穩定度 ' + Math.round(ev.stillness * 100) + '%');
    if (typeof ev.lighting === 'number') parts.push('光線 ' + Math.round(ev.lighting * 100) + '%');
    if (ev.blinkCadence === null || typeof ev.blinkCadence !== 'number') parts.push('眨眼資料不足');
    if (ev.tier === 'B') parts.push('本裝置無臉部偵測 · 信心上限中');
    return parts.join(' · ');
  }

  /** 紀律脈絡 — 這個標的的真實計數（有出處，非泛泛統計）。 */
  function renderEntryDiscipline(alert) {
    var all = loadOutcomes();
    var forSymbol = all.filter(function (r) { return r.symbol === alert.symbol; });
    var scope = forSymbol.length >= 3 ? forSymbol : all;
    var scoped = forSymbol.length >= 3;

    el.entryDiscLabel.textContent = scoped ? alert.symbol + ' 紀律近況' : '紀律近況';

    var d = 0;
    scope.forEach(function (r) { if (isDisciplined(r.outcomeTag)) d += 1; });
    el.entryDiscRate.textContent = scope.length ? Math.round((d / scope.length) * 100) + '%' : '—';

    var recent = scope.slice(Math.max(0, scope.length - 8));
    el.entryStrip.innerHTML = '';
    recent.forEach(function (r, i) {
      var seg = document.createElement('div');
      seg.className = 'result-seg' + (i === recent.length - 1 ? ' now' : '');
      seg.style.background = isDisciplined(r.outcomeTag) ? 'var(--zone-clear)' : 'var(--zone-strain)';
      el.entryStrip.appendChild(seg);
    });

    if (scope.length === 0) {
      el.entryDiscipline.textContent = '還沒有決策紀錄 — 走完一次就會開始累積。';
    } else {
      el.entryDiscipline.textContent =
        (scoped ? '這個標的' : '') + '你過去 ' + scope.length + ' 次：' + d + ' 次跟著流程。';
    }
  }

  /** 成本預期（呼應 Fable-5 的 ⏱ chip）。 */
  function renderEntryCost(alert) {
    var tpl = TEMPLATES[suggestTemplate(alert.strategyHint)];
    if (!tpl) { el.entryCost.textContent = ''; return; }
    var m = Math.floor(tpl.durationSec / 60), s = tpl.durationSec % 60;
    el.entryCost.textContent =
      '建議流程 ' + tpl.nameZh + ' · ' + m + ':' + String(s).padStart(2, '0') + '（可自由更換）';
  }

  /** 訊號「N 秒前」持續跳動 — 讓訊號有生命。 */
  function updateEntryAge(alert) {
    el.entryAge.textContent = agoText(alert.receivedAt, Date.now());
  }

  function startEntryAgeTicker(alert) {
    stopEntryAgeTicker();
    state.entryAgeTimer = setInterval(function () {
      if (!el.entrySheet.classList.contains('show')) { stopEntryAgeTicker(); return; }
      updateEntryAge(alert);
    }, 1000);
  }

  function stopEntryAgeTicker() {
    if (state.entryAgeTimer) { clearInterval(state.entryAgeTimer); state.entryAgeTimer = null; }
  }

  // ── session 中同標的：計時條下浮一行事實更新，不彈新面板 ──
  function sessionQuietUpdate(alert) {
    if (state.session) state.session.sameSymbolUpdates += 1;
    var parts = [alert.symbol];
    if (alert.condition) parts.push(alert.condition);
    if (alert.note) parts.push(alert.note);
    el.timerUpdate.textContent = '↳ ' + parts.join(' · ');
    el.timerUpdate.classList.add('show');
    log('mark', alert.symbol + ' — 同標的後續觸發（決策進行中，安靜更新）');
  }

  // ── 聚合（多快訊同窗）──
  function ingestGroup(alerts) {
    alerts.forEach(function (alert) {
      log('received', alert.symbol + ' · ' + alert.condition + ' (' + alert.timeframe + ')');
    });

    var spreadMs = alerts[alerts.length - 1].receivedAt - alerts[0].receivedAt;
    if (alerts.length < 2 || spreadMs > state.settings.aggregationSec * 1000) {
      alerts.forEach(ingest);
      return;
    }

    var first = evaluateDelivery(alerts[0], Date.now());
    if (first.decision !== 'surfaced') {
      alerts.forEach(function (alert) {
        log('silent', alert.symbol + ' — ' + (first.reason || '靜默接收'));
        silentChip(alert.symbol + ' 快訊（已接收）');
      });
      return;
    }

    state.pendingGroup = alerts;
    var symbolList = alerts.map(function (a) { return a.symbol; });
    var uniqSymbols = symbolList.filter(function (s, i) { return symbolList.indexOf(s) === i; });
    // 同一標的多個價位 → 「ES1! · N 個價位」；多檔 → 逐檔列
    var headText = uniqSymbols.length === 1
      ? uniqSymbols[0] + ' · ' + alerts.length + ' 個價位同時觸發'
      : alerts.length + ' 個決策機會：' + symbolList.join(' / ');
    log('aggregated', alerts.length + ' 個訊號：' + symbolList.join(' / '));
    el.aggHead.textContent = headText;
    el.aggList.textContent = '';
    alerts.forEach(function (alert) {
      var btn = document.createElement('button');
      btn.className = 'btn btn-ghost agg-item';
      btn.type = 'button';
      btn.style.width = '100%';
      btn.textContent = alert.symbol + ' · ' + alert.condition + '（查看）';
      btn.addEventListener('click', function () {
        closeSheets();
        state.pendingGroup = null;
        surfaceAlert(alert);
      });
      el.aggList.appendChild(btn);
    });
    openSheet(el.aggSheet);
  }

  // ── Sheets ──
  var sheets = [];

  function openSheet(sheet) {
    closeSheets();
    el.backdrop.classList.add('show');
    sheet.classList.add('show');
    sheets.push(sheet);
  }

  function closeSheets() {
    el.backdrop.classList.remove('show');
    [el.entrySheet, el.tplSheet, el.aggSheet, el.resultSheet].forEach(function (s) { s.classList.remove('show'); });
    stopEntryAgeTicker();
    sheets = [];
  }

  el.backdrop.addEventListener('click', function () {
    if (state.pendingOutcome) finalizeResult(); // 收束頁點背景 = 仍記錄
    if (state.pendingAlert) {
      log('dismissed', state.pendingAlert.symbol);
      state.pendingAlert = null;
    }
    state.pendingGroup = null;
    closeSheets();
  });

  el.btnDismiss.addEventListener('click', function () {
    if (state.pendingAlert) log('dismissed', state.pendingAlert.symbol);
    state.pendingAlert = null;
    closeSheets();
  });

  el.btnEngage.addEventListener('click', function () {
    if (!state.pendingAlert) return;
    log('engaged', state.pendingAlert.symbol + ' — 選擇流程模板');
    renderTemplatePicker(state.pendingAlert);
    openSheet(el.tplSheet);
  });

  // ── 模板選擇 ──
  function renderTemplatePicker(alert) {
    var suggested = suggestTemplate(alert.strategyHint);
    el.tplList.textContent = '';

    Object.keys(TEMPLATES).forEach(function (id) {
      var tpl = TEMPLATES[id];
      var card = document.createElement('div');
      card.className = 'tpl-card' + (id === suggested ? ' suggested' : '');

      var icon = document.createElement('div');
      icon.className = 'tpl-icon';
      icon.textContent = tpl.icon;

      var main = document.createElement('div');
      main.className = 'tpl-main';
      var name = document.createElement('div');
      name.className = 'tpl-name';
      name.textContent = tpl.nameZh + '（' + tpl.id + '）';
      var sub = document.createElement('div');
      sub.className = 'tpl-sub';
      sub.textContent = Math.round(tpl.durationSec / 60) + ' 分鐘 · ' +
        tpl.segments.map(function (s) { return s.label; }).join(' → ');
      main.appendChild(name);
      main.appendChild(sub);

      card.appendChild(icon);
      card.appendChild(main);

      if (id === suggested) {
        var star = document.createElement('div');
        star.className = 'tpl-star';
        star.textContent = '⭐ 建議';
        card.appendChild(star);
      }

      card.addEventListener('click', function () {
        closeSheets();
        startSession(alert, tpl);
      });
      el.tplList.appendChild(card);
    });
  }

  // ── 浮動決策計時條 ──
  function formatClock(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function startSession(alert, tpl) {
    state.pendingAlert = null;
    state.sessionActive = true;
    state.activeSessionSymbol = alert.symbol;
    state.session = {
      symbol: alert.symbol,
      templateId: tpl.id,
      tplName: tpl.nameZh,
      durationSec: tpl.durationSec,
      readinessStartSec: tpl.readinessWindow.startSec,
      reachedReadiness: false,
      sameSymbolUpdates: 0,
      elapsedSec: 0,
    };
    el.timerUpdate.textContent = '';
    el.timerUpdate.classList.remove('show');

    el.timerLabel.textContent = alert.symbol + ' · ' + tpl.nameZh;
    el.timerClock.textContent = formatClock(0);
    el.timerClock.classList.remove('in-window');

    el.segTrack.textContent = '';
    el.segLabels.textContent = '';
    el.timerPhase.textContent = '';
    el.timerPhase.classList.remove('readiness');
    var fills = [];
    var labelSpans = [];
    tpl.segments.forEach(function (segment) {
      var span = segment.endSec - segment.startSec;
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.flexGrow = String(span);
      var fill = document.createElement('div');
      fill.className = 'seg-fill';
      fill.style.background = segment.color;
      seg.appendChild(fill);
      el.segTrack.appendChild(seg);
      fills.push({ el: fill, startSec: segment.startSec, endSec: segment.endSec });

      var label = document.createElement('div');
      label.className = 'seg-label';
      label.style.flexGrow = String(span);
      label.style.flexBasis = '0';
      label.textContent = segment.label;
      el.segLabels.appendChild(label);
      labelSpans.push({ el: label, name: segment.label, startSec: segment.startSec, endSec: segment.endSec });
    });

    el.timerBar.classList.add('show');
    log('mark', alert.symbol + ' — ' + tpl.nameZh + ' 計時開始');

    var elapsed = 0;
    state.timer = setInterval(function () {
      elapsed += 1;
      el.timerClock.textContent = formatClock(elapsed);
      if (state.session) {
        state.session.elapsedSec = elapsed;
        if (elapsed >= state.session.readinessStartSec) state.session.reachedReadiness = true;
      }

      var w = tpl.readinessWindow;
      var inReadiness = elapsed >= w.startSec && elapsed < w.endSec;
      el.timerClock.classList.toggle('in-window', inReadiness);

      // 當前段落標籤高亮 + 事實脈絡行（Readiness 窗更明確）
      var current = null;
      labelSpans.forEach(function (ls) {
        var active = elapsed >= ls.startSec && elapsed < ls.endSec;
        ls.el.classList.toggle('active', active);
        if (active) current = ls;
      });
      if (inReadiness) {
        el.timerPhase.textContent = 'Readiness 窗開啟';
        el.timerPhase.classList.add('readiness');
      } else {
        el.timerPhase.textContent = current ? '目前：' + current.name : '';
        el.timerPhase.classList.remove('readiness');
      }

      fills.forEach(function (f) {
        var span = f.endSec - f.startSec;
        var ratio = Math.min(Math.max((elapsed - f.startSec) / span, 0), 1);
        f.el.style.transform = 'scaleX(' + ratio + ')';
      });

      if (elapsed >= tpl.durationSec) {
        endSession('timeout', alert.symbol + ' — 完整走完 ' + tpl.nameZh);
      }
    }, 1000);
  }

  function endSession(type, detail) {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    var s = state.session;
    state.sessionActive = false;
    state.activeSessionSymbol = null;
    state.session = null;
    el.timerBar.classList.remove('show');
    el.timerUpdate.classList.remove('show');
    el.timerPhase.textContent = '';
    el.timerPhase.classList.remove('readiness');
    log(type, detail);
    if (s) openResult(type, s);
  }

  // ── 決策收束頁（計時器結束後，事件鏈的 Result 階段）— 視覺化收束 ──
  var MOMENTUM_LIMIT = 12;
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

  // 弧規格：跟著流程/完整走完 → 整圈青；提前收束/中途退出 → 走多完整的部分弧（strain 色）。
  // 「弧長就是你這次走了多完整」— 數值本身即畫面。
  function resultArcSpec(endType, s) {
    var tag = resolveOutcomeTag(endType, s.reachedReadiness);
    if (isDisciplined(tag)) return { ratio: 1, colorVar: '--cyan-active' };
    var ratio = s.durationSec > 0 ? s.elapsedSec / s.durationSec : 0;
    return { ratio: Math.min(Math.max(ratio, 0.06), 1), colorVar: '--zone-strain' };
  }

  // canvas 弧（禁 SVG ring；比照 tissue-instrument 既有 canvas 先例）。固定 176px 尺寸，
  // 不讀 offsetWidth → 避開 PLAYBOOK §6「sheet 滑入中量到 0」陷阱。
  function drawResultArc(ratio, colorVar, animate, onDone) {
    var canvas = el.resultArc;
    if (!canvas || !canvas.getContext) { if (onDone) onDone(); return; }
    canvas.dataset.ratio = String(ratio); // 供 headless 驗證（canvas 像素難斷言）
    canvas.dataset.colorVar = colorVar;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = 176;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = size / 2, cy = size / 2, r = size / 2 - 14, lw = 10, start = -Math.PI / 2;
    var color = cssVar(colorVar), track = cssVar('--border');

    function frame(p) {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = track; ctx.lineWidth = lw; ctx.lineCap = 'butt';
      ctx.stroke();
      var sweep = Math.PI * 2 * ratio * p;
      if (sweep > 0.001) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + sweep);
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    if (!animate) { frame(1); if (onDone) onDone(); return; }
    var t0 = null, dur = 900;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      frame(easeOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    requestAnimationFrame(step);
  }

  // 完成率數字遞增（0 → 最終%）。末值與 rateText 完全一致（供頁面與測試對齊）。
  function countUpRate(records, animate) {
    var node = el.resultRate;
    if (!node) return;
    if (records.length === 0) { node.textContent = rateText(records); return; }
    var d = 0;
    records.forEach(function (r) { if (isDisciplined(r.outcomeTag)) d += 1; });
    var finalPct = Math.round((d / records.length) * 100);
    var suffix = '%（' + d + '/' + records.length + '）';
    if (!animate) { node.textContent = '紀律完成率：' + finalPct + suffix; return; }
    var t0 = null, dur = 600;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      node.textContent = '紀律完成率：' + Math.round(finalPct * easeOutCubic(p)) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = '紀律完成率：' + finalPct + suffix;
    }
    requestAnimationFrame(step);
  }

  function segColor(tag) {
    if (tag === 'stayed_disciplined') return cssVar('--cyan-active');
    if (tag === 'timed_out') return cssVar('--zone-clear');
    return cssVar('--zone-strain'); // broke_discipline / no_action_taken
  }

  // momentum strip：最近 N 次收束（鏡射 domain selectRecentOutcomes），最右＝本次高亮。
  function renderMomentumStrip(records) {
    var strip = el.resultStrip;
    if (!strip) return;
    strip.textContent = '';
    var recent = records.slice(Math.max(0, records.length - MOMENTUM_LIMIT));
    recent.forEach(function (r, i) {
      var seg = document.createElement('div');
      seg.className = 'result-seg' + (i === recent.length - 1 ? ' now' : '');
      seg.style.background = segColor(r.outcomeTag);
      strip.appendChild(seg);
    });
  }

  // 本次事件鏈 recap（流程語言、事實）：快訊 → 同標的更新 → Readiness → 收束。
  function renderRecap(endType, s) {
    var list = el.resultRecapList;
    if (!list) return;
    list.textContent = '';
    var disp = outcomeDisplay(endType, s.reachedReadiness);
    var rows = [
      { cls: 'on', text: '快訊收到 · ' + s.symbol + '（' + s.tplName + '）' },
      { cls: s.sameSymbolUpdates > 0 ? 'on' : '', text: '同標的更新：' + s.sameSymbolUpdates + ' 次' },
      { cls: s.reachedReadiness ? 'on' : 'off', text: 'Readiness 窗：' + (s.reachedReadiness ? '已進入' : '未進入') },
      { cls: disp.cls === 'disciplined' ? 'on' : 'off', text: '收束：' + disp.text + ' · 用時 ' + formatClock(s.elapsedSec) },
    ];
    rows.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'result-recap-row ' + row.cls;
      var dot = document.createElement('span'); dot.className = 'rc-dot';
      var txt = document.createElement('span'); txt.textContent = row.text;
      rowEl.appendChild(dot); rowEl.appendChild(txt);
      list.appendChild(rowEl);
    });
  }

  function disciplineRate(records) {
    if (records.length === 0) return 0;
    var d = 0;
    records.forEach(function (r) { if (isDisciplined(r.outcomeTag)) d += 1; });
    return d / records.length;
  }

  function openResult(endType, s) {
    var disp = outcomeDisplay(endType, s.reachedReadiness);
    state.pendingOutcome = {
      symbol: s.symbol,
      templateId: s.templateId,
      outcomeTag: resolveOutcomeTag(endType, s.reachedReadiness),
      contextTag: null,
      reachedReadiness: s.reachedReadiness,
      durationSec: s.elapsedSec,
      ts: Date.now(),
    };

    var withThis = loadOutcomes().concat([state.pendingOutcome]);

    el.resultHead.textContent = s.symbol + ' · ' + s.tplName;
    el.resultOutcome.textContent = disp.text;
    el.resultOutcome.className = 'result-outcome ' + disp.cls;
    el.resultArcTime.textContent = '用時 ' + formatClock(s.elapsedSec) + ' / ' + formatClock(s.durationSec);
    renderMomentumStrip(withThis);
    renderRecap(endType, s);

    el.resultReflect.textContent = '';
    REFLECT_TAGS.forEach(function (tag) {
      var chip = document.createElement('button');
      chip.className = 'result-chip';
      chip.type = 'button';
      chip.textContent = tag;
      chip.addEventListener('click', function () {
        var picked = state.pendingOutcome && state.pendingOutcome.contextTag === tag;
        Array.prototype.forEach.call(el.resultReflect.children, function (c) { c.classList.remove('sel'); });
        if (!picked) {
          chip.classList.add('sel');
          if (state.pendingOutcome) state.pendingOutcome.contextTag = tag;
        } else if (state.pendingOutcome) {
          state.pendingOutcome.contextTag = null;
        }
      });
      el.resultReflect.appendChild(chip);
    });

    // 依收束頁設定決定各區塊顯示（記錄一律照常，只影響呈現）。
    toggleHidden(el.resultHistory, state.resultSettings.showHistory);
    toggleHidden(el.resultRecap, state.resultSettings.showRecap);
    toggleHidden(el.resultReflectWrap, state.resultSettings.showReflect);

    // ── 揭示編排（choreographed reveal）──
    // 弧掃完才依序放出：微光 breath → outcome 落定 → 完成率遞增 + meter 填 → 下方區塊 cascade。
    // reduced-motion 一律畫終態（不加 .reveal，元素預設可見；onDone 同步觸發、無 glow）。
    var animate = !prefersReducedMotion;
    var spec = resultArcSpec(endType, s);
    var rate = disciplineRate(withThis);
    var revealItems = [el.resultHistory, el.resultRecap, el.resultReflectWrap];

    // 重置上一次的編排殘留
    el.resultArcCenter.classList.remove('landed');
    if (el.resultArcGlow) el.resultArcGlow.classList.remove('pulse');
    revealItems.forEach(function (node) { if (node) node.classList.remove('in'); });
    el.resultSheet.classList.toggle('reveal', animate);
    el.resultRate.textContent = animate ? '紀律完成率：0%' : rateText(withThis);
    el.resultMeterFill.style.width = '0';

    openSheet(el.resultSheet);

    function reveal() {
      el.resultMeterFill.style.width = Math.round(rate * 100) + '%';
      countUpRate(withThis, animate);
      el.resultArcCenter.classList.add('landed');
      if (animate && el.resultArcGlow) {
        el.resultArcGlow.style.setProperty('--glow', cssVar(spec.colorVar));
        el.resultArcGlow.classList.add('pulse');
        el.resultArcGlow.addEventListener('animationend', function handler() {
          el.resultArcGlow.classList.remove('pulse');
          el.resultArcGlow.removeEventListener('animationend', handler);
        });
      }
      revealItems.forEach(function (node, i) {
        if (!node) return;
        if (!animate) { node.classList.add('in'); return; }
        setTimeout(function () { node.classList.add('in'); }, i * 90);
      });
    }

    requestAnimationFrame(function () {
      drawResultArc(spec.ratio, spec.colorVar, animate, reveal);
    });
  }

  // 收束頁離開（存檔或關閉皆持久化，避免漏記）
  function finalizeResult() {
    if (!state.pendingOutcome) return;
    saveOutcome(state.pendingOutcome);
    refreshDiscipline();
    log('mark', state.pendingOutcome.symbol + ' — 決策已收束並記錄');
    state.pendingOutcome = null;
  }

  el.btnResultSave.addEventListener('click', function () {
    finalizeResult();
    closeSheets();
  });

  el.btnComplete.addEventListener('click', function () {
    endSession('close', el.timerLabel.textContent + ' — 流程完成');
  });

  el.btnCancel.addEventListener('click', function () {
    endSession('cancel', el.timerLabel.textContent);
  });

  // ── 連接 TradingView（專屬頻道，零輸入配對；真訊號與模擬走同一條 ingest 管線）──
  var POLL_INTERVAL_MS = 10 * 1000;
  var CHANNEL_KEY = 'tenki.alert.channel';
  // 每頻道記「上次看過的最新一則時間戳」：開頁一律補上你還沒看過的（不論多久前觸發），
  // 看過的不再重複跳。取代舊的固定時間回看窗（60 分鐘太短，隔天開就漏）。
  var LASTSEEN_PREFIX = 'tenki.alert.lastseen.';

  var live = {
    pollTimer: null,
    channelId: '',
    sinceMs: 0,
    seenIds: {},
    catchUp: false,
    // Vercel Deployment Protection 的 bypass query（如 'x-vercel-protection-bypass=xxx'）。
    // 這個部署有 SSO 保護時，匿名的 TradingView POST 會在 edge 就被擋掉、根本進不到
    // /api/alert（2026-08-05：六小時 runtime log 只有本頁自己的輪詢，零筆 POST）。
    // TradingView 不能帶自訂 header，所以官方解法是把同一組密鑰放進 query。
    // 專案沒開 Protection Bypass for Automation 時是 null → 網址跟以前一模一樣。
    bypassQuery: '',
  };

  function getChannel() { return localStorage.getItem(CHANNEL_KEY) || ''; }

  // 向 server 問這個部署的 bypass query。既有頻道不用重新配對就能補上。
  function loadBypassQuery() {
    return fetch('/api/channel', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        live.bypassQuery = (data && typeof data.bypassQuery === 'string') ? data.bypassQuery : '';
      })
      .catch(function () { live.bypassQuery = ''; });
  }

  function loadLastSeen(channelId) {
    return Number(localStorage.getItem(LASTSEEN_PREFIX + channelId)) || 0;
  }

  function advanceSince(receivedAt) {
    if (receivedAt > live.sinceMs) {
      live.sinceMs = receivedAt;
      if (live.channelId) localStorage.setItem(LASTSEEN_PREFIX + live.channelId, String(receivedAt));
    }
  }

  // 快訊網址產生器：把使用者填的欄位（標的必填，週期/策略可選）烤進 webhook URL，
  // 存在此瀏覽器。複製到的就是完整可用連結 — 根治「裸連結漏 symbol → 400」的坑。
  var FIELDS_KEY = 'tenki.alert.fields.v1';

  function loadFields() {
    try {
      var raw = JSON.parse(localStorage.getItem(FIELDS_KEY) || '{}');
      return {
        symbol: typeof raw.symbol === 'string' ? raw.symbol : 'ES1!',
        timeframe: typeof raw.timeframe === 'string' ? raw.timeframe : '',
        strategy: typeof raw.strategy === 'string' ? raw.strategy : '',
      };
    } catch (e) {
      return { symbol: 'ES1!', timeframe: '', strategy: '' };
    }
  }

  function currentFields() {
    return {
      symbol: (el.liveSymbol.value || '').trim(),
      timeframe: (el.liveTimeframe.value || '').trim(),
      strategy: (el.liveStrategy.value || '').trim(),
    };
  }

  function webhookUrlFor(channelId) {
    var url = location.origin + '/api/alert?ch=' + channelId;
    var f = currentFields();
    if (f.symbol) url += '&symbol=' + encodeURIComponent(f.symbol);
    if (f.timeframe) url += '&timeframe=' + encodeURIComponent(f.timeframe);
    if (f.strategy) url += '&strategy=' + encodeURIComponent(f.strategy);
    if (live.bypassQuery) url += '&' + live.bypassQuery;
    return url;
  }

  // 只更新顯示的 URL 與缺 symbol 警示，不重啟輪詢（頻道未變）。
  function renderWebhookUrl() {
    var channelId = getChannel();
    if (!channelId) return;
    el.liveUrl.textContent = webhookUrlFor(channelId);
    if (currentFields().symbol) el.liveUrlWarn.setAttribute('hidden', '');
    else el.liveUrlWarn.removeAttribute('hidden');
  }

  // 把標的綁成「頻道預設 symbol」（server 端）→ 就算 TradingView 貼的是裸 ?ch= 連結，
  // /api/alert 也會回填這個 symbol、不再 400。debounce 避免每次按鍵都打 API。
  var symbolBindTimer = null;
  function syncChannelSymbol() {
    var channelId = getChannel();
    var symbol = currentFields().symbol;
    if (!channelId || !symbol) return;
    if (symbolBindTimer) clearTimeout(symbolBindTimer);
    symbolBindTimer = setTimeout(function () {
      fetch('/api/channel?ch=' + encodeURIComponent(channelId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: symbol }),
      }).catch(function () { /* best-effort：綁定失敗不影響頁面 */ });
    }, 700);
  }

  function setLiveStatus(text, dotState) {
    el.liveStatus.textContent = text;
    el.liveDot.classList.remove('on', 'err');
    if (dotState) el.liveDot.classList.add(dotState);
  }

  function stopPolling() {
    if (live.pollTimer) { clearInterval(live.pollTimer); live.pollTimer = null; }
  }

  function normalizeLiveAlert(raw) {
    return {
      id: raw.id,
      symbol: raw.symbol,
      condition: raw.condition || 'Signal',
      timeframe: raw.timeframe || '—',
      strategyHint: raw.strategyHint,
      note: raw.note || '',
      receivedAt: raw.receivedAt,
    };
  }

  function pollOnce(channelId) {
    fetch('/api/alerts?ch=' + encodeURIComponent(channelId) + '&since=' + live.sinceMs)
      .then(function (response) {
        if (response.status === 404) {
          stopPolling();
          setLiveStatus('連結已失效，請重設', 'err');
          return null;
        }
        if (!response.ok) {
          setLiveStatus('伺服器回應 ' + response.status, 'err');
          return null;
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.alerts)) return;
        setLiveStatus('接收中 · ' + nowLabel(), 'on');

        // API 回新→舊；反轉成舊→新，同毫秒邊界用 id 去重
        var unseen = payload.alerts.slice().reverse().filter(function (raw) {
          return raw && raw.id && !live.seenIds[raw.id];
        });

        if (live.catchUp) {
          // 開頁首輪：把「還沒看過的」全部標記已讀，只讓最新一則浮出決策面板，
          // 較舊者靜默記錄（避免開頁被一串舊快訊轟炸，同時不漏掉任何未讀的）。
          live.catchUp = false;
          if (unseen.length === 0) return;
          unseen.forEach(function (raw) {
            live.seenIds[raw.id] = true;
            advanceSince(raw.receivedAt);
          });
          unseen.slice(0, -1).forEach(function (raw) {
            log('received', raw.symbol + ' · ' + (raw.condition || 'Signal') + '（稍早）');
          });
          ingest(normalizeLiveAlert(unseen[unseen.length - 1]));
          return;
        }

        unseen.forEach(function (raw) {
          live.seenIds[raw.id] = true;
          advanceSince(raw.receivedAt);
          ingest(normalizeLiveAlert(raw));
        });
      })
      .catch(function () {
        setLiveStatus('連線失敗，將重試', 'err');
      });
  }

  function startPolling(channelId) {
    stopPolling();
    // 從「上次看過的最新一則」之後開始收 → 開頁補上所有未讀的（不論多久前觸發），
    // 看過的不再重複跳。首輪只浮出最新一則面板（catch-up）。
    live.channelId = channelId;
    live.sinceMs = loadLastSeen(channelId);
    live.catchUp = true;
    setLiveStatus('接收中…', 'on');
    pollOnce(channelId);
    live.pollTimer = setInterval(function () { pollOnce(channelId); }, POLL_INTERVAL_MS);
  }

  var bypassAsked = false;

  function renderLive() {
    var channelId = getChannel();
    if (channelId) {
      el.liveSetup.setAttribute('hidden', '');
      el.liveReady.removeAttribute('hidden');
      renderWebhookUrl();
      if (!bypassAsked) {
        bypassAsked = true;
        // 問完再重畫一次網址 —— 拿不到就維持原樣，不擋任何流程。
        loadBypassQuery().then(renderWebhookUrl);
      }
      syncChannelSymbol(); // 開頁即把目前標的綁成頻道預設（既有頻道也回填）
      startPolling(channelId); // 有連結就自動接收，零動作
    } else {
      el.liveReady.setAttribute('hidden', '');
      el.liveSetup.removeAttribute('hidden');
      stopPolling();
      setLiveStatus('尚未配對', '');
    }
    refreshPushRow();
  }

  // ── Web Push（關掉網頁也收得到；需 VAPID env + iOS 加入主畫面）──
  var VAPID_PUBLIC_KEY = 'BE5Hjv2X1RFsHr7xNGK1Cs0A3biRzZm5nIaN3CnEXHzyU4Pp271e04liOJSfwD0RwjhSukZQvpyHOse_37Nz9es';
  var PUSH_FLAG_KEY = 'tenki.alert.push.on';

  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlB64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function setPushStatus(text, on) {
    if (el.livePushStatus) el.livePushStatus.textContent = text;
    if (el.livePushBtn) el.livePushBtn.classList.toggle('on', !!on);
  }

  // 把（瀏覽器已有的）推播訂閱重新綁到「當前頻道」的 server 端。頻道可能因重設連結 /
  // 新 PWA session 而更換，而 getSubscription() 只反映本機訂閱 → 若不重綁，webhook 打到
  // 新頻道、訂閱還掛在舊頻道 → server subscriptions=0、關掉網頁就收不到。冪等（endpoint 去重）。
  function rebindPush(sub) {
    var ch = getChannel();
    if (!ch || !sub) return;
    fetch('/api/subscribe?ch=' + ch, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub),
    }).catch(function () { /* best-effort */ });
  }

  function refreshPushRow() {
    if (!el.livePushRow) return;
    if (!pushSupported() || !getChannel()) {
      el.livePushRow.setAttribute('hidden', '');
      return;
    }
    el.livePushRow.removeAttribute('hidden');
    navigator.serviceWorker.getRegistration('/decision-alert/').then(function (reg) {
      if (!reg || !reg.pushManager) return;
      reg.pushManager.getSubscription().then(function (sub) {
        if (sub) {
          el.livePushBtn.textContent = '🔔 手機推播已開啟';
          setPushStatus('關掉網頁也會收到快訊。', true);
          rebindPush(sub); // 開頁即把訂閱重綁到當前頻道（治「換頻道後訂閱沒跟上」）
        }
      });
    }).catch(function () {});
  }

  function enablePush() {
    var ch = getChannel();
    if (!ch) { setPushStatus('請先產生連結（配對頻道）。', false); return; }
    if (!pushSupported()) { setPushStatus('此瀏覽器不支援推播（iOS 請先用分享鈕加入主畫面）。', false); return; }
    setPushStatus('請求通知權限中…', false);
    navigator.serviceWorker.register('/decision-alert/sw.js')
      .then(function (reg) {
        return Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') { setPushStatus('通知權限被拒 — 到系統設定開啟後再試。', false); return null; }
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        });
      })
      .then(function (sub) {
        if (!sub) return null;
        return fetch('/api/subscribe?ch=' + ch, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sub),
        }).then(function (r) {
          if (!r.ok) throw new Error('伺服器 ' + r.status);
          localStorage.setItem(PUSH_FLAG_KEY, '1');
          el.livePushBtn.textContent = '🔔 手機推播已開啟';
          setPushStatus('搞定 — 關掉網頁、ES1! 觸發也會跳通知。', true);
        });
      })
      .catch(function (err) {
        setPushStatus('開啟失敗：' + (err && err.message ? err.message : err), false);
      });
  }

  if (el.livePushBtn) el.livePushBtn.addEventListener('click', enablePush);

  function generateChannel() {
    setLiveStatus('產生連結中…', 'on');
    fetch('/api/channel', { method: 'POST' })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (payload) {
            throw new Error((payload && payload.error) || ('伺服器回應 ' + response.status));
          });
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.channelId) throw new Error('回應缺 channelId');
        localStorage.setItem(CHANNEL_KEY, payload.channelId);
        live.seenIds = {};
        renderLive();
      })
      .catch(function (error) {
        setLiveStatus(String(error.message || error), 'err');
      });
  }

  el.liveGenerate.addEventListener('click', generateChannel);

  el.liveReset.addEventListener('click', function () {
    localStorage.removeItem(CHANNEL_KEY);
    live.seenIds = {};
    generateChannel(); // 直接換一條新頻道（舊頻道 30 天自然過期）
  });

  el.liveCopy.addEventListener('click', function () {
    var url = el.liveUrl.textContent;
    var done = function () {
      el.liveCopy.textContent = '已複製 ✓';
      setTimeout(function () { el.liveCopy.textContent = '複製連結'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  });

  // 「測試這條連結」：用 TradingView 的身分打一次自己的 webhook URL。
  //
  // 為什麼要 credentials:'omit' —— 這頁自己輪詢 /api/alerts 會通，是因為瀏覽器帶著
  // Vercel SSO 的登入 cookie；TradingView 沒有那顆 cookie，會在 edge 就被擋掉。
  // 不拆掉 cookie 的測試只會測到「我登入了」，測不出 TradingView 的處境。
  //
  // 探針用 GET：/api/alert 的第一道檢查就是 method，會回 405 JSON。到得了那個 405
  // 就代表請求穿過了保護層（而且不會寫進任何一筆快訊、不污染紀錄）。收到別的東西
  // ——轉址、HTML 登入頁、401——就是被保護層擋在門外。
  function runWebhookSelfTest() {
    var url = el.liveUrl.textContent;
    if (!url) return;
    el.liveSelfTest.disabled = true;
    el.liveSelfTestResult.textContent = '測試中…';
    fetch(url, { method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store' })
      .then(function (res) {
        if (res.status === 405) return res.json().then(function () { return null; });
        if (res.status === 0 || res.type === 'opaqueredirect') {
          return '被部署保護擋下（轉址到登入頁）—— TradingView 送來的快訊也會這樣消失。修法見 docs/TRADINGVIEW-SETUP.md §1。';
        }
        if (res.status === 401 || res.status === 403) {
          return '被部署保護擋下（' + res.status + '）—— TradingView 送來的快訊也會這樣消失。修法見 docs/TRADINGVIEW-SETUP.md §1。';
        }
        return '回了非預期的 ' + res.status + ' —— 這條連結不能用。';
      })
      .then(function (problem) {
        if (problem) {
          el.liveSelfTestResult.textContent = '❌ ' + problem;
        } else {
          el.liveSelfTestResult.textContent = '✅ 這條連結通到 TENKI —— TradingView 可以送達（沒有寫入任何快訊）。';
        }
      })
      .catch(function () {
        el.liveSelfTestResult.textContent = '❌ 連不上 —— 多半是被部署保護擋在門外。修法見 docs/TRADINGVIEW-SETUP.md §1。';
      })
      .then(function () { el.liveSelfTest.disabled = false; });
  }

  el.liveSelfTest.addEventListener('click', runWebhookSelfTest);

  el.liveToggle.addEventListener('click', function () {
    var hidden = el.liveBody.hasAttribute('hidden');
    if (hidden) { el.liveBody.removeAttribute('hidden'); el.liveChevron.textContent = '▴'; }
    else { el.liveBody.setAttribute('hidden', ''); el.liveChevron.textContent = '▾'; }
  });

  // 初始化欄位輸入（從 localStorage 帶回，預設標的 ES1!）+ 即時更新網址。
  (function initFields() {
    var f = loadFields();
    el.liveSymbol.value = f.symbol;
    el.liveTimeframe.value = f.timeframe;
    el.liveStrategy.value = f.strategy;
    ['liveSymbol', 'liveTimeframe', 'liveStrategy'].forEach(function (id) {
      el[id].addEventListener('input', function () {
        localStorage.setItem(FIELDS_KEY, JSON.stringify(currentFields()));
        renderWebhookUrl();
        if (id === 'liveSymbol') syncChannelSymbol(); // 標的變更 → 更新頻道預設
      });
    });
  })();

  renderLive();

  // ── 模擬按鈕 ──
  // ES1! 單一標的 · Mancini 假跌破（FBD）— 對齊 founder 實際交易型態（示意值）
  el.btnSingle.addEventListener('click', function () {
    ingest(makeAlert('ES1!', '假跌破 FBD', '1m', 'Mancini', '關鍵價位掃低後收回（示意）'));
  });

  // 同一檔快速下殺，一波內連踩兩個關鍵價位 → 60s 窗聚合（不是多檔同時）
  el.btnMulti.addEventListener('click', function () {
    var now = Date.now();
    var a = makeAlert('ES1!', '掃下緣', '1m', 'Mancini', '快速下殺掃到下緣（示意）');
    var b = makeAlert('ES1!', '續破下一級', '1m', 'Mancini', '同一波再破下一個關鍵價位（示意）');
    a.receivedAt = now;
    b.receivedAt = now + 3000; // 同一波 3 秒內連踩兩級
    ingestGroup([a, b]);
  });

  // 同一價位 K 棒內反覆穿越 → 冷卻抑制（不轟炸）
  el.btnRepeat.addEventListener('click', function () {
    ingest(makeAlert('ES1!', '假跌破 FBD', '1m', 'Mancini', '同一價位 K 棒內反覆穿越（示意）'));
  });

  // ── 決策節奏設定面板 ──
  function settingsIsDefault() {
    var d = DEFAULT_SETTINGS, s = state.settings;
    return s.cooldownSec === d.cooldownSec && s.aggregationSec === d.aggregationSec &&
      s.strainSilent === d.strainSilent && s.sessionQuietUpdate === d.sessionQuietUpdate &&
      s.quietWindow === d.quietWindow;
  }
  function updateSettingsStatus() {
    el.setStatus.textContent = settingsIsDefault() ? '預設' : '已自訂';
  }
  function renderSettingsInputs() {
    el.setCooldown.value = state.settings.cooldownSec;
    el.setAggregation.value = state.settings.aggregationSec;
    el.setStrainSilent.checked = state.settings.strainSilent;
    el.setSessionQuiet.checked = state.settings.sessionQuietUpdate;
    el.setQuietWindow.checked = state.settings.quietWindow;
    updateSettingsStatus();
  }
  function persistSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    updateSettingsStatus();
  }
  function readNumberInput(inputEl, fallback) {
    var v = parseInt(inputEl.value, 10);
    return (Number.isFinite(v) && v >= 0) ? v : fallback;
  }

  el.setCooldown.addEventListener('change', function () {
    state.settings.cooldownSec = readNumberInput(el.setCooldown, DEFAULT_SETTINGS.cooldownSec);
    el.setCooldown.value = state.settings.cooldownSec;
    persistSettings();
  });
  el.setAggregation.addEventListener('change', function () {
    state.settings.aggregationSec = readNumberInput(el.setAggregation, DEFAULT_SETTINGS.aggregationSec);
    el.setAggregation.value = state.settings.aggregationSec;
    persistSettings();
  });
  el.setStrainSilent.addEventListener('change', function () { state.settings.strainSilent = el.setStrainSilent.checked; persistSettings(); });
  el.setSessionQuiet.addEventListener('change', function () { state.settings.sessionQuietUpdate = el.setSessionQuiet.checked; persistSettings(); });
  el.setQuietWindow.addEventListener('change', function () { state.settings.quietWindow = el.setQuietWindow.checked; persistSettings(); });
  el.setReset.addEventListener('click', function () {
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    persistSettings();
    renderSettingsInputs();
  });
  el.setToggle.addEventListener('click', function () {
    var hidden = el.setBody.hasAttribute('hidden');
    if (hidden) { el.setBody.removeAttribute('hidden'); el.setChevron.textContent = '▴'; }
    else { el.setBody.setAttribute('hidden', ''); el.setChevron.textContent = '▾'; }
  });

  // ── 收束頁設定（顯示偏好，持久）──
  function renderResultSettingsInputs() {
    el.resShowHistory.checked = state.resultSettings.showHistory;
    el.resShowRecap.checked = state.resultSettings.showRecap;
    el.resShowReflect.checked = state.resultSettings.showReflect;
  }
  function persistResultSettings() {
    localStorage.setItem(RESULT_SETTINGS_KEY, JSON.stringify(state.resultSettings));
  }
  el.resShowHistory.addEventListener('change', function () { state.resultSettings.showHistory = el.resShowHistory.checked; persistResultSettings(); });
  el.resShowRecap.addEventListener('change', function () { state.resultSettings.showRecap = el.resShowRecap.checked; persistResultSettings(); });
  el.resShowReflect.addEventListener('change', function () { state.resultSettings.showReflect = el.resShowReflect.checked; persistResultSettings(); });
  el.resToggle.addEventListener('click', function () {
    var hidden = el.resBody.hasAttribute('hidden');
    if (hidden) { el.resBody.removeAttribute('hidden'); el.resChevron.textContent = '▴'; }
    else { el.resBody.setAttribute('hidden', ''); el.resChevron.textContent = '▾'; }
  });

  renderSettingsInputs();
  renderResultSettingsInputs();
  renderState();
  refreshDiscipline();
})();
