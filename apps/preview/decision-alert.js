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

  // Demo 縮時冷卻：正式值 ALERT_COOLDOWN_SEC = 300（5 分鐘）
  var COOLDOWN_MS = 30 * 1000;
  var AGGREGATION_WINDOW_MS = 60 * 1000;

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

  function refreshDiscipline() {
    if (el.entryDiscipline) el.entryDiscipline.textContent = '你過去的' + rateText(loadOutcomes());
  }

  // ── 示意狀態（點擊循環；合成值，非真實讀數）──
  var ZONE_STATES = [
    { zone: 'clear', label: 'Clear', score: 78, cssVar: '--zone-clear' },
    { zone: 'neutral', label: 'Neutral', score: 58, cssVar: '--zone-neutral' },
    { zone: 'strain', label: 'Strain', score: 32, cssVar: '--zone-strain' },
  ];

  var state = {
    zoneIdx: 1, // Neutral 起手
    lastSurfacedAtBySymbol: {},
    sessionActive: false,
    activeSessionSymbol: null,
    session: null,
    pendingOutcome: null,
    pendingAlert: null,
    pendingGroup: null,
    alertSeq: 0,
    timer: null,
  };

  var el = {};
  [
    'stateCard', 'stateDot', 'stateLine', 'btnSingle', 'btnMulti', 'btnRepeat',
    'silentArea', 'logList', 'backdrop', 'entrySheet', 'entryHead', 'entryMode',
    'entryNote', 'entryStateLine', 'entryDiscipline', 'btnDismiss', 'btnEngage',
    'tplSheet', 'tplList', 'aggSheet', 'aggHead', 'aggList',
    'resultSheet', 'resultHead', 'resultOutcome', 'resultSummary', 'resultRate',
    'resultReflect', 'btnResultSave',
    'timerBar', 'timerLabel', 'timerClock',
    'btnComplete', 'btnCancel', 'segTrack', 'segLabels', 'timerPhase', 'timerUpdate',
    'liveToggle', 'liveDot', 'liveStatus', 'liveChevron', 'liveBody',
    'liveSetup', 'liveReady', 'liveGenerate', 'liveUrl', 'liveCopy', 'liveReset',
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
      if (state.activeSessionSymbol !== null && state.activeSessionSymbol === alert.symbol) {
        return { decision: 'session_update', reason: '同標的後續觸發' };
      }
      return { decision: 'silent', reason: '決策進行中' };
    }
    if (currentZone().zone === 'strain') return { decision: 'silent', reason: 'Strain 狀態' };
    var last = state.lastSurfacedAtBySymbol[alert.symbol];
    if (last !== undefined && nowMs - last < COOLDOWN_MS) {
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

    el.entryHead.textContent = alert.symbol + ' · ' + alert.condition + ' · ' + alert.timeframe;
    var modeCtx = marketModeContext(alert);
    el.entryMode.textContent = modeCtx || '';
    el.entryMode.classList.toggle('show', modeCtx !== null);
    el.entryNote.textContent = alert.note || '';
    var z = currentZone();
    el.entryStateLine.textContent = '你目前的狀態：' + z.label + '（Decision Edge Score ' + z.score + '）';
    refreshDiscipline();
    openSheet(el.entrySheet);
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
    if (alerts.length < 2 || spreadMs > AGGREGATION_WINDOW_MS) {
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
    var symbols = alerts.map(function (a) { return a.symbol; }).join(' / ');
    log('aggregated', alerts.length + ' 個訊號：' + symbols);
    el.aggHead.textContent = alerts.length + ' 個決策機會：' + symbols;
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

  // ── 決策收束頁（計時器結束後，事件鏈的 Result 階段）──
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

    el.resultHead.textContent = s.symbol + ' · ' + s.tplName + ' · 用時 ' +
      formatClock(s.elapsedSec) + ' / ' + formatClock(s.durationSec);
    el.resultOutcome.textContent = disp.text;
    el.resultOutcome.className = 'result-outcome ' + disp.cls;
    el.resultSummary.textContent = 'Readiness 窗：' + (s.reachedReadiness ? '已進入' : '未進入') +
      '　·　同標的更新：' + s.sameSymbolUpdates + ' 次';
    // 顯示「含本次」的累計完成率
    el.resultRate.textContent = rateText(loadOutcomes().concat([state.pendingOutcome]));

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

    openSheet(el.resultSheet);
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
  };

  function getChannel() { return localStorage.getItem(CHANNEL_KEY) || ''; }

  function loadLastSeen(channelId) {
    return Number(localStorage.getItem(LASTSEEN_PREFIX + channelId)) || 0;
  }

  function advanceSince(receivedAt) {
    if (receivedAt > live.sinceMs) {
      live.sinceMs = receivedAt;
      if (live.channelId) localStorage.setItem(LASTSEEN_PREFIX + live.channelId, String(receivedAt));
    }
  }

  function webhookUrlFor(channelId) {
    return location.origin + '/api/alert?ch=' + channelId;
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

  function renderLive() {
    var channelId = getChannel();
    if (channelId) {
      el.liveSetup.setAttribute('hidden', '');
      el.liveReady.removeAttribute('hidden');
      el.liveUrl.textContent = webhookUrlFor(channelId);
      startPolling(channelId); // 有連結就自動接收，零動作
    } else {
      el.liveReady.setAttribute('hidden', '');
      el.liveSetup.removeAttribute('hidden');
      stopPolling();
      setLiveStatus('尚未配對', '');
    }
  }

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

  el.liveToggle.addEventListener('click', function () {
    var hidden = el.liveBody.hasAttribute('hidden');
    if (hidden) { el.liveBody.removeAttribute('hidden'); el.liveChevron.textContent = '▴'; }
    else { el.liveBody.setAttribute('hidden', ''); el.liveChevron.textContent = '▾'; }
  });

  renderLive();

  // ── 模擬按鈕 ──
  el.btnSingle.addEventListener('click', function () {
    ingest(makeAlert('NVDA', 'Breakout', '5m', 'CANSLIM', 'RS High + Volume Spike'));
  });

  el.btnMulti.addEventListener('click', function () {
    var now = Date.now();
    var a = makeAlert('NVDA', 'Breakout', '5m', 'CANSLIM', 'RS High + Volume Spike');
    var b = makeAlert('TSLA', 'Reclaim', '15m', 'Mancini FBD', 'Level reclaim');
    a.receivedAt = now;
    b.receivedAt = now + 5000; // 模擬 5 秒內先後到達
    ingestGroup([a, b]);
  });

  el.btnRepeat.addEventListener('click', function () {
    ingest(makeAlert('NVDA', 'Breakout', '5m', 'CANSLIM', '同標的重複觸發'));
  });

  renderState();
  refreshDiscipline();
})();
