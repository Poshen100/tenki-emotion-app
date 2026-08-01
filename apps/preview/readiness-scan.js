/**
 * TENKI — Soul Scan（正典掃描模組）
 *
 * 「一個掃描，多道門」：v6 Scan tab、/decision-alert/ 進入決策、待命狀態卡，
 * 全部開這一支。以前 v6 的星塵 takeover 是唯一實作但耦合 v6 DOM 且寫死讀數，
 * 這支把它升格成兩個 host 都能載入的共用模組。
 *
 * 對外唯一輸出是一個 ReadinessReading（契約見
 * domain/src/contracts/readiness-reading.ts）—— 質化帶位，永遠不生成 0-100 分。
 *
 * 合規：全程校準/流程語言；無醫療、無情緒辨識、無進出場建議；影像只在本機運算。
 *
 * 本檔為 S1（骨架）：markup 注入 + 生命週期 + mission 框架。
 * S2 接真實量測匯總，S3 疊 cyan/gold 儀式層 —— 兩處都標了 TODO(S2)/TODO(S3)。
 */
(function (global) {
  'use strict';

  var OVERLAY_ID = 'tenki-readiness-scan';
  /** 必須蓋過 v6 既有 takeover 的 z9000（含底部常駐指紋 wrapper）。 */
  var OVERLAY_Z = 9700;

  /** 來意 — 同一台儀器，不同任務。決定文案與時間預算。 */
  var MISSIONS = {
    daily:    { label: '建立今天的讀數', budgetSec: 10 },
    decision: { label: '決策前讀數',     budgetSec: 8  },
    refresh:  { label: '重新讀一次',     budgetSec: 8  },
  };

  var session = null; // { resolve, mission, symbol, stream, raf, cancelled }

  // ── markup（冪等注入；模組自帶 DOM，不依賴 host 頁面預先具備任何 id）──

  function ensureOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    var style = document.createElement('style');
    style.setAttribute('data-tenki-readiness-scan', '1');
    style.textContent = [
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:' + OVERLAY_Z + ';display:none;',
      'background:#05060A;color:#F4F6FF;font-family:inherit;',
      'flex-direction:column;align-items:center;justify-content:center;gap:18px;}',
      '#' + OVERLAY_ID + '.open{display:flex;}',
      '#' + OVERLAY_ID + ' .rs-video{position:absolute;inset:0;width:100%;height:100%;',
      'object-fit:cover;opacity:0.25;filter:blur(2px);transform:scaleX(-1);}',
      '#' + OVERLAY_ID + ' .rs-stage{position:relative;z-index:1;display:flex;',
      'flex-direction:column;align-items:center;gap:18px;padding:0 24px;text-align:center;}',
      '#' + OVERLAY_ID + ' .rs-mission{font-size:11px;letter-spacing:0.24em;',
      'text-transform:uppercase;color:#A6ADC8;}',
      '#' + OVERLAY_ID + ' .rs-symbol{font-size:13px;color:#3DE0FF;letter-spacing:0.08em;}',
      '#' + OVERLAY_ID + ' .rs-symbol:empty{display:none;}',
      // 掃描框：圓角超橢圓 + cyan 角括號＝ACTIVE（對齊中）。S3 會在此疊 gold 收束層。
      '#' + OVERLAY_ID + ' .rs-frame{position:relative;width:236px;height:236px;',
      'border-radius:64px;border:1px solid rgba(61,224,255,0.28);}',
      '#' + OVERLAY_ID + ' .rs-instruction{font-size:17px;font-weight:600;min-height:24px;}',
      '#' + OVERLAY_ID + ' .rs-dots{display:flex;gap:14px;font-size:10px;color:#5A6178;',
      'letter-spacing:0.1em;text-transform:uppercase;}',
      '#' + OVERLAY_ID + ' .rs-dot{display:flex;align-items:center;gap:5px;}',
      '#' + OVERLAY_ID + ' .rs-dot i{width:6px;height:6px;border-radius:50%;',
      'background:#5A6178;display:inline-block;}',
      '#' + OVERLAY_ID + ' .rs-dot.pass i{background:#46E0B0;}',
      '#' + OVERLAY_ID + ' .rs-dot.fail i{background:#FF6B6B;}',
      '#' + OVERLAY_ID + ' .rs-privacy{font-size:11px;color:#5A6178;}',
      '#' + OVERLAY_ID + ' .rs-cancel{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);',
      'right:16px;z-index:2;background:none;border:0;color:#A6ADC8;font-size:15px;',
      'font-family:inherit;padding:10px 14px;cursor:pointer;}',
    ].join('');
    document.head.appendChild(style);

    var node = document.createElement('div');
    node.id = OVERLAY_ID;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', '狀態讀數掃描');
    node.innerHTML = [
      '<video class="rs-video" playsinline muted autoplay></video>',
      '<button type="button" class="rs-cancel" data-rs="cancel">取消</button>',
      '<div class="rs-stage">',
      '  <div class="rs-mission" data-rs="mission"></div>',
      '  <div class="rs-symbol" data-rs="symbol"></div>',
      '  <div class="rs-frame" data-rs="frame"></div>',
      '  <div class="rs-instruction" data-rs="instruction"></div>',
      '  <div class="rs-dots">',
      '    <span class="rs-dot" data-rs="dot-light"><i></i>Lighting</span>',
      '    <span class="rs-dot" data-rs="dot-center"><i></i>Centering</span>',
      '    <span class="rs-dot" data-rs="dot-still"><i></i>Stillness</span>',
      '  </div>',
      '  <div class="rs-privacy">本機運算 · 不留影像</div>',
      '</div>',
    ].join('');
    document.body.appendChild(node);

    node.querySelector('[data-rs="cancel"]').addEventListener('click', function () {
      finish(null);
    });
    return node;
  }

  function q(sel) {
    var overlay = document.getElementById(OVERLAY_ID);
    return overlay ? overlay.querySelector('[data-rs="' + sel + '"]') : null;
  }

  /** 一次只顯示一個主指令（North Star §4）。 */
  function setInstruction(text) {
    var node = q('instruction');
    if (node) node.textContent = text;
  }

  // ── 相機（拿不到就走 tier B，絕不偽造讀數）──

  function startCamera(videoEl) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve(null);
    }
    return navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(function (stream) {
        videoEl.srcObject = stream;
        var played = videoEl.play();
        return played && played.catch ? played.catch(function () {}).then(function () { return stream; })
                                      : stream;
      })
      .catch(function () { return null; });
  }

  function stopCamera() {
    if (!session || !session.stream) return;
    session.stream.getTracks().forEach(function (track) { track.stop(); });
    session.stream = null;
    var video = document.querySelector('#' + OVERLAY_ID + ' .rs-video');
    if (video) video.srcObject = null;
  }

  // ── 生命週期 ──

  function finish(reading) {
    if (!session) return;
    var resolve = session.resolve;
    if (session.raf) cancelAnimationFrame(session.raf);
    stopCamera();
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('open');
    session = null;
    resolve(reading);
  }

  /**
   * 開始一次讀數掃描。
   *
   * @param {{mission?: 'daily'|'decision'|'refresh', symbol?: string}} [options]
   *   mission 決定文案與時間預算；symbol 只在 decision 來意時顯示（你正要決策的標的）。
   * @returns {Promise<Object|null>} ReadinessReading，使用者取消則為 null。
   */
  function begin(options) {
    var opts = options || {};
    var mission = MISSIONS[opts.mission] ? opts.mission : 'daily';
    if (session) return Promise.resolve(null); // 同時只允許一次掃描

    var overlay = ensureOverlay();
    q('mission').textContent = MISSIONS[mission].label;
    q('symbol').textContent = mission === 'decision' && opts.symbol ? opts.symbol : '';
    setInstruction('正在啟動相機⋯');
    overlay.classList.add('open');

    return new Promise(function (resolve) {
      session = {
        resolve: resolve, mission: mission, symbol: opts.symbol || null,
        stream: null, raf: null, startedAt: Date.now(),
      };
      var video = overlay.querySelector('.rs-video');
      startCamera(video).then(function (stream) {
        if (!session) return; // 啟動中被取消
        session.stream = stream;
        session.tier = stream ? 'A' : 'B';
        setInstruction(stream ? '保持穩定' : '沒有相機 · 無法取得讀數');
        if (!stream) {
          // 無相機時不假造讀數 —— 讓使用者看到事實後自行離開。
          return;
        }
        // TODO(S2): 逐幀累積 stillness / lighting / uniformity / blinkCadence，
        //   時間到 → 正規化 → deriveBand + resolveConfidence → finish(reading)。
        // TODO(S3): cyan 角括號對齊 → gold progress halo → 星塵收束（不改星塵感覺）。
      });
    });
  }

  /** 這個環境是否可能取得讀數（無相機 API 時 UI 不該給掃描入口）。 */
  function isAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  global.TENKI_READINESS_SCAN = { begin: begin, isAvailable: isAvailable, MISSIONS: MISSIONS };
})(window);
