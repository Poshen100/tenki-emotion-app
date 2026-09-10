/*
 * drift-alert.js — /drift/ 頁面控制器（Drift Alert 實走 demo）。
 *
 * 🔴 這支**不做任何判定**。偏移量、校準判定、決策分身、事件鏈全部來自
 *    `drift.js`（TENKI_DRIFT，engine intelligence/ 的鏡射）。頁面只負責
 *    產生合成歷史、把結果畫出來。PLAYBOOK §6：判定的單一來源要跨檔成立。
 *
 * 🔴 **不留 fallback**。TENKI_DRIFT 載不到就明講「判定模組沒載到」，不是
 *    退回頁面自己算一份 —— 那正是這個架構要消滅的東西。
 *
 * 合成資料的設計意圖：每個情境的數字都挑成**跑得出目標分支**，但仍然是
 * 真的算出來的。例如「大幅偏移」的歷史 mean 65 / std 8.5、當下 82，
 * 於是 z 剛好 2.0 → far、距離 17 —— 那個 +17 是算出來的，不是寫死的字串。
 */
(function () {
  'use strict';

  var DI = window.TENKI_DRIFT;

  var $ = function (id) {
    return document.getElementById(id);
  };

  if (!DI) {
    $('drift-headline').textContent = '判定模組沒載到';
    $('drift-body').textContent =
      'drift.js 沒有載入，這一頁不會用自己算的數字頂替 —— 那會生出第二份判定。';
    return;
  }

  var MS_PER_DAY = DI.MS_PER_DAY;
  var NOW = Date.now();

  // ═══════════════════════════════════════════
  // 情境（合成資料）
  // ═══════════════════════════════════════════

  /**
   * 每個情境定義一組歷史讀數與當下讀數。
   * values 循環使用 → mean/std 可控：[56.5, 73.5] 的 mean 65、std 8.5。
   */
  var SCENARIOS = [
    {
      id: 'far',
      label: '大幅偏移',
      hint: 'z ≈ 2.0',
      current: 82,
      values: [56.5, 73.5],
      count: 28,
      twinTotal: 11,
      twinFollowed: 3,
    },
    {
      id: 'drifting',
      label: '偏移中',
      hint: 'z ≈ 1.6',
      current: 79,
      values: [56.5, 73.5],
      count: 28,
      twinTotal: 9,
      twinFollowed: 4,
    },
    {
      id: 'within',
      label: '在常態內',
      hint: '距離 1',
      current: 66,
      values: [56.5, 73.5],
      count: 28,
      twinTotal: 7,
      twinFollowed: 6,
    },
    {
      id: 'flat',
      label: '零變異',
      hint: 'std = 0',
      current: 79,
      values: [65],
      count: 28,
      twinTotal: 6,
      twinFollowed: 2,
    },
    {
      id: 'insufficient',
      label: '證據不足',
      hint: '只有 3 次',
      current: 79,
      values: [56.5, 73.5],
      count: 3,
      twinTotal: 2,
      twinFollowed: 1,
    },
  ];

  /** 校準後量到什麼 —— demo 用，讓 founder 走得到三種判定。 */
  var CALIB_OUTCOMES = [
    { id: 'improved', label: '往常態靠回去', offset: 18 },
    { id: 'none', label: '沒有明顯改變', offset: 1 },
    { id: 'declined', label: '離得更遠', offset: -12 },
  ];

  /** 過去七次校準的變化量 —— 讓「7 次裡有 5 次相似」是算出來的。 */
  var PRIOR_SHIFTS = [12, 15, 11, 1, -2, 9, 13];

  var state = {
    scenario: SCENARIOS[0],
    calibOutcome: CALIB_OUTCOMES[1],
    drift: null,
    twin: null,
    calibration: null,
    calibratedAt: null,
    scanTs: NOW,
  };

  // ═══════════════════════════════════════════
  // 合成資料產生器
  // ═══════════════════════════════════════════

  /**
   * 產生同一個時段、每天一筆的歷史讀數。
   * @param {{values:number[],count:number}} scenario
   * @returns {Array<{value:number,ts:number}>}
   */
  function buildHistory(scenario) {
    var out = [];
    for (var i = 0; i < scenario.count; i++) {
      out.push({
        value: scenario.values[i % scenario.values.length],
        ts: NOW - (i + 1) * MS_PER_DAY,
      });
    }
    return out;
  }

  /**
   * 由讀數推帶位（mirror of packages/shared zone-config 閾值）。
   * @param {number} value
   * @returns {string}
   */
  function bandFor(value) {
    if (value >= 70) return 'clear';
    if (value >= 40) return 'neutral';
    return 'strain';
  }

  /**
   * 產生過去的決策時刻。刻意讓其中兩筆換模板 —— 這樣 sharedFeatures
   * 就會少掉 template，示範「只回報每一個 match 都共有的特徵」。
   * @param {object} moment
   * @param {object} scenario
   * @returns {Array<object>}
   */
  function buildTwinHistory(moment, scenario) {
    var out = [];
    for (var i = 0; i < scenario.twinTotal; i++) {
      out.push({
        ts: NOW - (i + 1) * MS_PER_DAY,
        band: moment.band,
        driftMagnitude: moment.driftMagnitude,
        templateId: i < 2 ? 'CANSLIM' : moment.templateId,
        followedProcess: i < scenario.twinFollowed,
      });
    }
    return out;
  }

  // ═══════════════════════════════════════════
  // 重新計算
  // ═══════════════════════════════════════════

  function recompute() {
    var scenario = state.scenario;
    var history = buildHistory(scenario);

    state.scanTs = NOW;
    state.drift = DI.assessDrift(scenario.current, history, { now: NOW });

    var moment = {
      ts: NOW,
      band: bandFor(scenario.current),
      driftMagnitude: state.drift.state === 'assessed' ? state.drift.magnitude : 'within',
      templateId: 'FBD',
    };
    state.twin = DI.findDecisionTwins(moment, buildTwinHistory(moment, scenario));

    state.calibration = null;
    state.calibratedAt = null;
  }

  function runCalibration() {
    var scenario = state.scenario;
    var reference = state.drift.state === 'assessed' ? state.drift.reference : null;
    var ts = NOW + 3 * 60000;
    var priors = PRIOR_SHIFTS.map(function (shift, i) {
      return { shift: shift, ts: NOW - (i + 1) * MS_PER_DAY };
    });

    state.calibratedAt = ts;
    state.calibration = DI.assessCalibration({
      before: { value: scenario.current, ts: NOW, captureId: 'soul-scan:A' },
      after: { value: scenario.current + state.calibOutcome.offset, ts: ts, captureId: 'soul-scan:A' },
      reference: reference,
      priors: priors,
    });
  }

  // ═══════════════════════════════════════════
  // 畫面
  // ═══════════════════════════════════════════

  function renderChips(container, items, selectedId, onPick) {
    Array.prototype.slice.call(container.querySelectorAll('button')).forEach(function (b) {
      b.remove();
    });
    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.id = item.id;
      btn.setAttribute('aria-pressed', String(item.id === selectedId));
      btn.innerHTML =
        item.label + (item.hint ? '<br><small style="color:var(--n-550)">' + item.hint + '</small>' : '');
      btn.addEventListener('click', function () {
        onPick(item);
      });
      container.appendChild(btn);
    });
  }

  /**
   * 把 copy 產生的 figure 字串拆成「數字 + 標籤」兩級來排版。
   * 🔴 這是**排版**不是判定 —— 字串仍然整句來自 copy 層，這裡只切第一個空白。
   * @param {HTMLElement} el
   * @param {string|null} text
   */
  function renderFigure(el, text) {
    el.innerHTML = '';
    if (!text) return;
    var gap = text.indexOf(' ');
    var rest = gap === -1 ? '' : text.slice(gap + 1);
    // 只有在後半是**文字標籤**時才降級。「82 → 83」的後半是另一個讀數，
    // 拆開會變成「大大的 82、小小的 → 83」—— 那組數字是一對，不是值加單位。
    var splitIt = gap !== -1 && /^[A-Za-z]/.test(rest);
    var value = splitIt ? text.slice(0, gap) : text;
    var unit = splitIt ? rest : '';
    var valueEl = document.createElement('span');
    valueEl.className = 'figure-value';
    valueEl.textContent = value;
    el.appendChild(valueEl);
    if (unit) {
      var unitEl = document.createElement('span');
      unitEl.className = 'figure-unit';
      unitEl.textContent = unit;
      el.appendChild(unitEl);
    }
  }

  function renderDrift() {
    var copy = DI.driftCopy(state.drift);
    $('drift-headline').textContent = copy.headline;
    $('drift-body').textContent = copy.body;
    renderFigure($('drift-figure'), copy.figure);
    $('drift-evidence').textContent = copy.evidenceLine;

    var evidence = state.drift.evidence;
    var ref = state.drift.state === 'assessed' ? state.drift.reference : null;

    $('xray-samples').textContent = String(evidence.sampleCount);
    $('xray-days').textContent = DI.formatCount(evidence.windowDays, 'day');
    $('xray-reference').textContent = ref ? ref.mean + ' ± ' + ref.std + ' (' + ref.bucket + ')' : '—';
    $('xray-z').textContent =
      state.drift.state === 'assessed' && state.drift.z !== null ? String(state.drift.z) : 'not usable';
    $('xray-confidence').textContent = DI.formatConfidence(evidence.confidence);

    $('xray-provenance').innerHTML = evidence.provenance
      .map(function (p) {
        return '<span class="prov">' + p + '</span>';
      })
      .join('');

    var list = $('xray-reasons');
    list.innerHTML = '';
    if (evidence.reasons.length === 0) {
      var none = document.createElement('li');
      none.textContent = 'Nothing is holding this back — it is as well evidenced as this layer gets.';
      list.appendChild(none);
    } else {
      evidence.reasons.forEach(function (code) {
        var li = document.createElement('li');
        li.textContent = DI.evidenceReasonCopy(code);
        list.appendChild(li);
      });
    }
  }

  function renderCalibration() {
    var card = $('calib-card');
    if (!state.calibration) {
      card.hidden = true;
      return;
    }
    var copy = DI.calibrationCopy(state.calibration);
    card.hidden = false;
    $('calib-headline').textContent = copy.headline;
    renderFigure($('calib-figure'), copy.figure);
    $('calib-body').textContent = copy.body;
    $('calib-evidence').textContent = copy.evidenceLine;
  }

  function renderTwin() {
    var copy = DI.twinCopy(state.twin);
    $('twin-headline').textContent = copy.headline;
    $('twin-body').textContent = copy.body;
    $('twin-evidence').textContent = copy.evidenceLine;
  }

  function clockOf(ts) {
    var d = new Date(ts);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /**
   * 一條事件的人話。刻意逐 kind 寫死映射，而不是 detail 直接印 ——
   * 內部代號（magnitude / verdict）不該漏到畫面上。
   * @param {object} detail
   * @returns {string}
   */
  function chainText(detail) {
    if (detail.kind === 'scan') return 'Reading taken · <b>' + detail.value + '</b>';
    if (detail.kind === 'drift') {
      return detail.magnitude === 'within'
        ? 'Inside your usual range · <b>' + detail.distance + '</b> from baseline'
        : 'Distance from baseline · <b>+' + detail.distance + '</b>';
    }
    if (detail.kind === 'calibration') {
      if (detail.verdict === 'improved') return 'Calibration · <b>moved back toward your range</b>';
      if (detail.verdict === 'declined') return 'Calibration · <b>moved further out</b>';
      return 'Calibration · <b>no clear shift</b>';
    }
    if (detail.kind === 'noticed') {
      return (
        'Pattern in your own history · <b>' +
        detail.matchCount +
        '</b> similar sessions, ' +
        detail.divergedCount +
        ' without process'
      );
    }
    return 'Decision judged · <b>' + (detail.followedProcess ? 'process followed' : 'process not followed') + '</b>';
  }

  function renderChain() {
    var timeline = DI.buildBlackBox({
      scans: [{ ts: state.scanTs, value: state.scenario.current }].concat(
        state.calibratedAt
          ? [{ ts: state.calibratedAt, value: state.scenario.current + state.calibOutcome.offset }]
          : []
      ),
      drifts: [{ ts: state.scanTs + 1000, result: state.drift }],
      noticed: [{ ts: state.scanTs + 2000, result: state.twin }],
      calibrations: state.calibration ? [{ ts: state.calibratedAt + 1000, result: state.calibration }] : [],
    });

    var list = $('chain');
    list.innerHTML = '';
    timeline.events.forEach(function (event) {
      var li = document.createElement('li');
      var time = document.createElement('time');
      time.textContent = clockOf(event.ts);
      var what = document.createElement('div');
      what.className = 'what';
      what.innerHTML = chainText(event.detail);
      if (event.evidence) {
        var backing = document.createElement('div');
        backing.className = 'backing';
        backing.textContent = DI.evidenceLine(event.evidence);
        what.appendChild(backing);
      }
      li.appendChild(time);
      li.appendChild(what);
      list.appendChild(li);
    });
    $('chain-empty').hidden = timeline.events.length > 0;
  }

  function renderAll() {
    renderDrift();
    renderCalibration();
    renderTwin();
    renderChain();
  }

  // ═══════════════════════════════════════════
  // 互動
  // ═══════════════════════════════════════════

  var CALIBRATION_DEMO_MS = 2400;

  function startCalibration() {
    var btn = $('calibrate-btn');
    var progress = $('calib-progress');
    var bar = $('calib-bar');
    btn.disabled = true;
    btn.textContent = 'Calibrating…';
    progress.hidden = false;
    bar.style.width = '0%';

    // 兩幀之後再設寬度，否則 transition 不會跑（同一幀內的值變化沒有起點）。
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.style.transition = 'width ' + CALIBRATION_DEMO_MS + 'ms linear';
        bar.style.width = '100%';
      });
    });

    window.setTimeout(function () {
      runCalibration();
      renderAll();
      progress.hidden = true;
      bar.style.transition = '';
      bar.style.width = '0%';
      btn.disabled = false;
      btn.textContent = 'Calibrate again';
      $('calib-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, CALIBRATION_DEMO_MS);
  }

  function pickScenario(scenario) {
    state.scenario = scenario;
    renderChips($('scenario-row'), SCENARIOS, scenario.id, pickScenario);
    $('calibrate-btn').textContent = 'Begin calibration';
    recompute();
    renderAll();
  }

  function pickCalibOutcome(outcome) {
    state.calibOutcome = outcome;
    renderChips($('calib-outcome-row'), CALIB_OUTCOMES, outcome.id, pickCalibOutcome);
    if (state.calibration) {
      runCalibration();
      renderAll();
    }
  }

  $('xray-toggle').addEventListener('click', function () {
    var xray = $('xray');
    var open = xray.hidden;
    xray.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    this.textContent = open ? 'Hide evidence' : 'See why';
  });

  $('calibrate-btn').addEventListener('click', startCalibration);

  renderChips($('scenario-row'), SCENARIOS, state.scenario.id, pickScenario);
  renderChips($('calib-outcome-row'), CALIB_OUTCOMES, state.calibOutcome.id, pickCalibOutcome);
  recompute();
  renderAll();
})();
