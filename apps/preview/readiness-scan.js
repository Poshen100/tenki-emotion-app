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
 * S1（骨架）：markup 注入 + 生命週期 + mission 框架。
 * S2（本次）：逐幀量測 → evidence 匯總 → band/confidence → 寫入
 *   `tenki.readiness.reading.v1`。S3 再疊 cyan/gold 儀式層。
 */
(function (global) {
  'use strict';

  var OVERLAY_ID = 'tenki-readiness-scan';
  /** 必須蓋過 v6 既有 takeover 的 z9000（含底部常駐指紋 wrapper）。 */
  var OVERLAY_Z = 9700;

  /** 讀數 store —— 與 apps/preview/decision-alert.js 同一把鑰匙。 */
  var READING_STORE_KEY = 'tenki.readiness.reading.v1';

  // ── 量測常數（鏡射 apps/preview/soul-enroll.js 的閘門，不另立一套）──

  /** 取樣邊長：夠算亮度/均勻度/逐幀位移，成本低到能持續跑。 */
  var SAMP = 64;
  /** ~15fps 取樣；比 rAF 慢，省電且對量測精度無損。 */
  var SAMPLE_INTERVAL_MS = 66;
  /** 每像素平均 luma 變化達此值 → 視為完全不穩。 */
  var MOTION_DIVISOR = 40;
  /** 四象限亮度標準差達此值 → 均勻度歸零。 */
  var UNIFORMITY_SD_DIVISOR = 60;
  /** 中央區水平梯度除數（Tier B 取景啟發式）。 */
  var DETAIL_DIVISOR = 18;

  /**
   * 曝光。0.34 原本同時是「滿分下限」和「閘門」—— 實機在夜間室內光下直接卡死
   * （2026-08-01 founder 23:17 實走：LIGHTING 紅、進度條停在 0，掃描永遠走不完）。
   * 拆成兩個角色：0.34 以上算滿分，0.16 以下才真的太暗；中間是**斜坡**，
   * 光線差就讓 captureQuality 掉、confidence 跟著降 —— 而不是不給讀數。
   * 0.16（≈41/255）以下臉基本上只剩剪影，landmark 也追不動，那時停下來是有依據的。
   */
  var BRIGHTNESS_FULL_MIN = 0.34;
  var BRIGHTNESS_FLOOR = 0.16;
  var BRIGHTNESS_MAX = 0.97;
  var UNIFORMITY_MIN = 0.50;
  var MOTION_STILL_MAX = 0.40;
  var DETAIL_MIN = 0.20;

  // ── 臉部追蹤（Tier A）常數 ──
  // 全部沿用 v6/stardust-scan-takeover.js 已經調過的值，不另立一套。

  /** MediaPipe 推論節流：~5.5fps。比這快在手機上只是燒電。 */
  var FACE_INTERVAL_MS = 180;
  /** 位移速度達此值＝takeover 判定「HOLD STILL」的門檻 → stillness 讀 0。 */
  var LANDMARK_MOTION_CEILING = 0.35;
  /**
   * Tier A 的 stillness 閘門。**不能借用 `MOTION_STILL_MAX`** —— 那是 soul-enroll
   * 給「整幀 luma 差分」調的尺度，跟 landmark 位移不是同一種量。取 takeover 那個
   * 已調過的 HOLD STILL 門檻的一半當閘門（speed ≤ 0.175 ⟺ stillness ≥ 0.5），
   * 留餘裕給低光下的 landmark 抖動。
   */
  var LANDMARK_STILL_GATE = 0.5;
  /** 眼睛開合正規化除數（landmark y 距離 → 0..1）。 */
  var EYE_OPEN_DIVISOR = 0.035;
  /** 眨眼遲滯門檻（EAR-normalized，與 takeover 同一組）。 */
  var BLINK_CLOSE = 0.25;
  var BLINK_OPEN = 0.55;
  /** 取景範圍：臉框邊長與置中容差。 */
  var FACE_SIZE_MIN = 0.30;
  var FACE_SIZE_MAX = 0.65;
  var FACE_CENTER_X_TOL = 0.08;
  var FACE_CENTER_Y_TOL = 0.09;
  /** 臉部資料超過這麼久沒更新就當作臉不在（推論比取樣慢，要留寬容）。 */
  var FACE_STALE_MS = 700;
  /** Tier A 要成立，landmark 樣本至少要這麼多 —— 只瞄到一兩幀不算量到。 */
  var MIN_LANDMARK_SAMPLES = 10;

  /** 低於此的有效取景時間不足以生讀數 —— 寧可沒有讀數，也不生一個。 */
  var MIN_HELD_MS = 5000;
  /** 品質一直不過關時的牆鐘上限（budget × 此值），避免無限等待。 */
  var CEILING_FACTOR = 3;
  /** 讀數揭示停留時間。 */
  var REVEAL_MS = 1200;

  // ── band / confidence 政策（鏡射 domain/src/policies/readiness-band.ts）──
  // preview 是 vanilla JS 不能 import domain，沿用 decision-alert.js 既有的鏡射慣例；
  // 閾值與權重改動時兩邊要一起改。

  var CLEAR_AT = 0.7;
  var NEUTRAL_AT = 0.45;
  var HIGH_CONFIDENCE_AT = 0.75;
  var MODERATE_CONFIDENCE_AT = 0.5;
  var WEIGHT_STILLNESS = 0.5;
  var WEIGHT_BLINK = 0.3;
  var WEIGHT_CAPTURE = 0.2;

  var BAND_LABEL = { clear: 'Clear', neutral: 'Neutral', strain: 'Strain' };
  var CONFIDENCE_LABEL = { high: '信心高', moderate: '信心中', low: '信心低' };

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
      // 進度只在品質閘門通過時前進（pause-not-reset）。S3 會用 gold halo 取代這條。
      '#' + OVERLAY_ID + ' .rs-progress{width:236px;height:2px;border-radius:2px;',
      'background:rgba(255,255,255,0.10);overflow:hidden;}',
      '#' + OVERLAY_ID + ' .rs-progress i{display:block;height:100%;width:0%;',
      'background:#3DE0FF;transition:width 0.18s linear;}',
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
      '  <div class="rs-progress"><i data-rs="progress"></i></div>',
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

  /** 三個微型狀態點 —— 說明進度為什麼停住，而不是讓人乾等。 */
  function setDot(name, pass) {
    var node = q('dot-' + name);
    if (!node) return;
    node.classList.toggle('pass', pass === true);
    node.classList.toggle('fail', pass === false);
  }

  function setProgress(ratio) {
    var node = q('progress');
    if (node) node.style.width = Math.round(clamp01(ratio) * 100) + '%';
  }

  // ── 量測（逐幀取樣 → evidence）──

  function clamp01(value) {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  function samplerContext() {
    if (!session.ctx) {
      var canvas = document.createElement('canvas');
      canvas.width = SAMP;
      canvas.height = SAMP;
      session.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    return session.ctx;
  }

  /**
   * Samples one video frame into per-frame quality signals. All of it is
   * computed on-device from a 64×64 downscale — no frame ever leaves the page,
   * and nothing is retained beyond the previous frame's luma for the delta.
   *
   * @param {HTMLVideoElement} video - The live preview element.
   * @returns {?{brightness:number, uniformity:number, motion:number,
   *   hasMotion:boolean, detail:number}} Signals, or null when unreadable.
   */
  function sampleFrame(video) {
    if (!video || video.readyState < 2) return null;
    var ctx = samplerContext();
    var data;
    try {
      ctx.drawImage(video, 0, 0, SAMP, SAMP);
      data = ctx.getImageData(0, 0, SAMP, SAMP).data;
    } catch (e) {
      return null; // 相機尚未供幀 / canvas 被污染 —— 這幀不算數
    }

    var luma = new Float32Array(SAMP * SAMP);
    var half = SAMP / 2;
    var quadN = half * half;
    var quad = [0, 0, 0, 0];
    for (var y = 0; y < SAMP; y++) {
      for (var x = 0; x < SAMP; x++) {
        var i = (y * SAMP + x) * 4;
        var l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        luma[y * SAMP + x] = l;
        quad[(y < half ? 0 : 2) + (x < half ? 0 : 1)] += l;
      }
    }

    // 四象限等大 → 象限平均的平均＝整幀平均亮度（順帶拿到均勻度用的離散度）。
    var qm = [quad[0] / quadN, quad[1] / quadN, quad[2] / quadN, quad[3] / quadN];
    var qMean = (qm[0] + qm[1] + qm[2] + qm[3]) / 4;
    var qVar = 0;
    for (var k = 0; k < 4; k++) qVar += (qm[k] - qMean) * (qm[k] - qMean);
    var qSd = Math.sqrt(qVar / 4);

    // 位移：與前一幀的平均 luma 差。第一幀沒有可比對象 → hasMotion=false，不計入。
    var hasMotion = !!session.prevLuma;
    var motion = 0;
    if (hasMotion) {
      var diff = 0;
      for (var m = 0; m < luma.length; m++) diff += Math.abs(luma[m] - session.prevLuma[m]);
      motion = clamp01((diff / luma.length) / MOTION_DIVISOR);
    }
    session.prevLuma = luma;

    // 中央區水平梯度＝Tier B 取景啟發式（中間有五官結構，不是 ML 偵測）。
    var lo = Math.round(SAMP * 0.3);
    var hi = Math.round(SAMP * 0.7);
    var grad = 0;
    var gN = 0;
    for (var gy = lo; gy < hi; gy++) {
      for (var gx = lo; gx < hi - 1; gx++) {
        grad += Math.abs(luma[gy * SAMP + gx + 1] - luma[gy * SAMP + gx]);
        gN++;
      }
    }

    return {
      brightness: clamp01(qMean / 255),
      uniformity: clamp01(1 - qSd / UNIFORMITY_SD_DIVISOR),
      motion: motion,
      hasMotion: hasMotion,
      detail: gN ? clamp01((grad / gN) / DETAIL_DIVISOR) : 0,
    };
  }

  // ── 臉部追蹤（Tier A）──
  // host 頁面已經載了 MediaPipe FaceMesh 就用它：landmark 位移是比整幀 luma 差分
  // 誠實得多的 stillness —— 後者背景有人走過就會算成「你在動」。眨眼節奏也只有
  // 這條路量得到。拿不到 FaceMesh（例如 /decision-alert/ 沒載）就退回畫面啟發式，
  // tier 誠實留 B。

  function faceMeshAvailable() {
    return typeof global.FaceMesh !== 'undefined';
  }

  function computeFaceBox(lm) {
    var minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (var i = 0; i < lm.length; i++) {
      var p = lm[i];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  /** 每次推論結果 → 位移、取景、眨眼。只在這裡累積 landmark 樣本。 */
  function onFaceResults(results) {
    if (!session || session.done) return;
    var faces = results && results.multiFaceLandmarks;
    if (!faces || !faces.length) {
      // 臉不見了：位移與眨眼的時間基準都要斷開，空窗不得計入任何視窗。
      session.lastFaceCenter = null;
      session.lastFaceAt = 0;
      session.lastBlinkFeedAt = 0;
      return;
    }
    var lm = faces[0];
    var now = performance.now();

    var box = computeFaceBox(lm);
    var centerX = (box.minX + box.maxX) / 2;
    var centerY = (box.minY + box.maxY) / 2;
    var size = Math.max(box.maxX - box.minX, box.maxY - box.minY);

    if (session.lastFaceCenter && session.lastFaceAt) {
      var dt = Math.max(1, now - session.lastFaceAt);
      var dx = centerX - session.lastFaceCenter.x;
      var dy = centerY - session.lastFaceCenter.y;
      var speed = Math.sqrt(dx * dx + dy * dy) / (dt / 1000);
      session.lastStillness = 1 - clamp01(speed / LANDMARK_MOTION_CEILING);
      session.lmAcc.n += 1;
      session.lmAcc.stillness += session.lastStillness;
    }
    session.everSawFace = true;
    session.lastFaceCenter = { x: centerX, y: centerY };
    session.lastFaceAt = now;
    session.faceFramed = size >= FACE_SIZE_MIN && size <= FACE_SIZE_MAX
      && Math.abs(centerX - 0.5) <= FACE_CENTER_X_TOL
      && Math.abs(centerY - 0.5) <= FACE_CENTER_Y_TOL;

    // 眨眼節奏：只餵臉在的幀，dt 上限避免推論卡頓灌大視窗（同 takeover）。
    if (session.blinkCounter) {
      var eyeL = Math.abs(lm[159].y - lm[145].y);
      var eyeR = Math.abs(lm[386].y - lm[374].y);
      var eyeOpen = Math.min(1, ((eyeL + eyeR) / 2) / EYE_OPEN_DIVISOR);
      if (session.lastBlinkFeedAt) {
        session.blinkCounter.feed(eyeOpen, Math.min(now - session.lastBlinkFeedAt, 200));
      }
      session.lastBlinkFeedAt = now;
    }
  }

  function startFaceMesh(video) {
    if (!faceMeshAvailable()) return;
    var instance;
    try {
      instance = new global.FaceMesh({
        locateFile: function (file) {
          return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
        },
      });
      instance.setOptions({
        maxNumFaces: 1, refineLandmarks: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      instance.onResults(onFaceResults);
    } catch (e) {
      return; // 初始化失敗 → 安靜退回 tier B，不擋掃描
    }
    session.faceMesh = instance;
    if (global.TENKI_BLINK) {
      session.blinkCounter = global.TENKI_BLINK.createCounter({
        closeBelow: BLINK_CLOSE, openAbove: BLINK_OPEN,
      });
    }
    // 重疊防護：前一次推論還沒回來就不送新的 —— MediaPipe 的影像張量堆積起來
    // 會把 iOS 記憶體吃爆（takeover 踩過，照抄）。
    session.faceTimer = setInterval(function () {
      if (!session || session.done || session.faceBusy) return;
      if (!video || video.readyState < 2 || !session.faceMesh) return;
      session.faceBusy = true;
      session.faceMesh.send({ image: video })
        .then(function () { if (session) session.faceBusy = false; })
        .catch(function () { if (session) session.faceBusy = false; });
    }, FACE_INTERVAL_MS);
  }

  function stopFaceMesh() {
    if (!session) return;
    if (session.faceTimer) { clearInterval(session.faceTimer); session.faceTimer = null; }
    session.faceMesh = null;
    session.faceBusy = false;
  }

  /** 這次掃描是否真的量到臉（決定 tier，不是「有沒有載到 MediaPipe」）。 */
  function landmarksEarned() {
    return session.lmAcc.n >= MIN_LANDMARK_SAMPLES;
  }

  /**
   * Exposure adequacy in 0..1. Both under- and over-exposure fall off; the
   * band between the two gate thresholds is fully adequate.
   *
   * @param {number} brightness - Mean luma normalized to 0..1.
   * @returns {number} Adequacy in 0..1.
   */
  function lightingAdequacy(brightness) {
    if (brightness < BRIGHTNESS_FLOOR) return 0;
    if (brightness < BRIGHTNESS_FULL_MIN) {
      // 斜坡：暗但還量得到 → 給部分分數，讓 confidence 誠實下降。
      return clamp01((brightness - BRIGHTNESS_FLOOR) / (BRIGHTNESS_FULL_MIN - BRIGHTNESS_FLOOR));
    }
    if (brightness > BRIGHTNESS_MAX) {
      return clamp01(1 - (brightness - BRIGHTNESS_MAX) / (1 - BRIGHTNESS_MAX));
    }
    return 1;
  }

  /**
   * Quality gates for one frame. These drive the status dots and whether
   * progress advances — they do NOT filter the evidence average.
   *
   * Centering and stillness come from landmarks once this scan has actually
   * seen a face; until then (or if MediaPipe never delivers) they fall back to
   * the frame heuristics, so a blocked wasm load degrades instead of hanging.
   *
   * @param {{brightness:number, uniformity:number, motion:number,
   *   hasMotion:boolean, detail:number}} frame - Per-frame signals.
   * @returns {{lighting:boolean, centering:?boolean, stillness:?boolean}} Gates.
   */
  function evalGates(frame) {
    var lighting = frame.brightness >= BRIGHTNESS_FULL_MIN
      && frame.brightness <= BRIGHTNESS_MAX
      && frame.uniformity >= UNIFORMITY_MIN;
    if (session.everSawFace) {
      var fresh = session.lastFaceAt
        && (performance.now() - session.lastFaceAt) < FACE_STALE_MS;
      return {
        lighting: lighting,
        centering: fresh ? session.faceFramed === true : false,
        stillness: fresh && session.lastStillness !== null
          ? session.lastStillness >= LANDMARK_STILL_GATE
          : false,
      };
    }
    return {
      lighting: lighting,
      centering: frame.detail >= DETAIL_MIN && lighting,
      stillness: frame.hasMotion ? frame.motion <= MOTION_STILL_MAX : null,
    };
  }

  /**
   * 進度前不前進的判準（pause-not-reset）。
   *
   * Tier A 刻意**不把 lighting 算進來**：landmark tracker 追得動，就代表光線足夠
   * 量測 —— 讓追蹤器自己當「夠不夠亮」的裁判，比一個外加的亮度門檻誠實。光線差的
   * 代價走 `lightingAdequacy` → captureQuality → confidence 下降，而不是不給讀數。
   * Tier B 沒有追蹤器可當裁判，取景啟發式本身就吃光線，所以照舊要求 lighting。
   *
   * @param {{lighting:boolean, centering:?boolean, stillness:?boolean}} gates
   * @returns {boolean} 這一幀是否讓有效取景時間前進。
   */
  function gatesAdvance(gates) {
    return session.everSawFace
      ? gates.centering === true && gates.stillness === true
      : gates.lighting === true && gates.centering === true;
  }

  // ── band / confidence（鏡射 domain/src/policies/readiness-band.ts）──

  function captureQuality(evidence) {
    return clamp01(clamp01(evidence.lighting) * 0.6 + clamp01(evidence.uniformity) * 0.4);
  }

  /** Tier B 永遠不宣稱 high —— 取景是推論來的，不是量到的。 */
  function resolveConfidence(evidence) {
    var quality = captureQuality(evidence);
    if (quality >= HIGH_CONFIDENCE_AT && evidence.blinkCadence !== null && evidence.tier === 'A') {
      return 'high';
    }
    return quality >= MODERATE_CONFIDENCE_AT ? 'moderate' : 'low';
  }

  /** 眨眼缺席時把權重併回穩定度 —— 缺的訊號不得自己把帶位推上或推下。 */
  function deriveBand(evidence) {
    var stillness = clamp01(evidence.stillness);
    var quality = captureQuality(evidence);
    var composite = evidence.blinkCadence === null
      ? stillness * (WEIGHT_STILLNESS + WEIGHT_BLINK) + quality * WEIGHT_CAPTURE
      : stillness * WEIGHT_STILLNESS
        + clamp01(evidence.blinkCadence) * WEIGHT_BLINK
        + quality * WEIGHT_CAPTURE;
    if (composite >= CLEAR_AT) return 'clear';
    return composite >= NEUTRAL_AT ? 'neutral' : 'strain';
  }

  // ── 讀數落地 ──

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  /**
   * Blink-cadence regularity for this scan, or null when it cannot be judged.
   * Needs BOTH a long-enough face-tracked window AND a stored enrollment
   * baseline (soul-enroll) — without a baseline there is nothing to be regular
   * against, and guessing one would fabricate the signal. The 0..1 mapping and
   * its thresholds live in blink-cadence.js so they keep a single home.
   *
   * @returns {?number} Regularity in 0..1, or null.
   */
  function blinkRegularity() {
    var B = global.TENKI_BLINK;
    if (!B || !session.blinkCounter || !B.regularity) return null;
    var baseline = B.load();
    if (!baseline) return null;
    var daily = B.cadencePerMin(session.blinkCounter.blinks, session.blinkCounter.windowMs);
    return B.regularity(daily, baseline.cpm);
  }

  /**
   * Averages the accumulated samples into a ReadinessEvidence, or null when
   * nothing measurable was captured. Averaged over EVERY measured frame, not
   * only the ones that passed the gates — filtering would bias the reading up.
   *
   * Stillness has one source per tier and they are never mixed: Tier A reads
   * landmark displacement (the face moved), Tier B reads whole-frame luma delta
   * (something moved). The two are not the same measurement and averaging them
   * together would mean neither.
   *
   * @returns {?Object} ReadinessEvidence, or null.
   */
  function buildEvidence() {
    var acc = session.acc;
    if (!acc.n) return null;
    var tierA = landmarksEarned();
    return {
      stillness: tierA
        ? round3(session.lmAcc.stillness / session.lmAcc.n)
        : round3(acc.stillness / acc.n),
      lighting: round3(acc.lighting / acc.n),
      uniformity: round3(acc.uniformity / acc.n),
      blinkCadence: blinkRegularity(),
      tier: tierA ? 'A' : 'B',
    };
  }

  function saveReading(reading) {
    try {
      localStorage.setItem(READING_STORE_KEY, JSON.stringify(reading));
    } catch (e) { /* Safari 無痕等 —— 讀數單純不留存，不影響本次回傳 */ }
  }

  /** 進入揭示 —— 量測已結束，取消鈕收起（否則會出現「store 有讀數但回傳 null」）。 */
  function enterReveal() {
    session.done = true;
    stopFaceMesh(); // 推論先停，免得收尾期間還在燒 CPU
    stopCamera();   // 量測已完成，相機立刻關掉
    var cancel = q('cancel');
    if (cancel) cancel.hidden = true;
  }

  /** 收束：算出讀數 → 存檔 → 揭示 → 回傳。 */
  function finalize() {
    var evidence = buildEvidence();
    enterReveal();
    if (!evidence) {
      giveUp();
      return;
    }
    var reading = {
      band: deriveBand(evidence),
      confidence: resolveConfidence(evidence),
      ts: Date.now(),
      evidence: evidence,
    };
    saveReading(reading);
    setProgress(1);
    setInstruction(BAND_LABEL[reading.band] + ' · ' + CONFIDENCE_LABEL[reading.confidence]);
    setTimeout(function () { finish(reading); }, REVEAL_MS);
  }

  /** 訊號不足就說沒有讀數 —— 不用低品質資料湊一個出來。 */
  function giveUp() {
    enterReveal();
    setInstruction('訊號不足 · 這次沒有讀數');
    setTimeout(function () { finish(null); }, REVEAL_MS);
  }

  /** 取樣迴圈。進度只在光線與取景過關時前進（pause-not-reset）。 */
  function tick() {
    if (!session || session.done) return;
    session.raf = requestAnimationFrame(tick);

    var now = performance.now();
    if (now - session.lastSampleAt < SAMPLE_INTERVAL_MS) return;
    // dt 上限：分頁切走或掉幀的空窗不得灌進有效取景時間。
    var dt = session.lastSampleAt ? Math.min(now - session.lastSampleAt, 250) : 0;
    session.lastSampleAt = now;

    var frame = sampleFrame(session.video);
    if (frame) {
      var gates = evalGates(frame);
      setDot('light', gates.lighting);
      setDot('center', gates.centering);
      setDot('still', gates.stillness);

      if (frame.hasMotion) {
        var acc = session.acc;
        acc.n += 1;
        // Tier B 的 stillness 備援；tier A 落地時 buildEvidence 會改用 landmark。
        acc.stillness += 1 - frame.motion;
        acc.lighting += lightingAdequacy(frame.brightness);
        acc.uniformity += frame.uniformity;
        if (gatesAdvance(gates)) session.heldMs += dt;
      }

      // 單一指令：先講「擋住進度的那一件事」，光線只在它真的是阻塞點時才提。
      setInstruction(
        gatesAdvance(gates) ? '保持穩定'
        : gates.centering !== true ? '把臉放進框裡'
        : gates.stillness !== true ? '再穩一下'
        : '需要多一點光線');
      setProgress(session.heldMs / session.budgetMs);
    }

    if (session.heldMs >= session.budgetMs) {
      finalize();
      return;
    }
    if (now - session.captureStartedAt >= session.budgetMs * CEILING_FACTOR) {
      if (session.heldMs >= MIN_HELD_MS) finalize();
      else giveUp();
    }
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
    stopFaceMesh();
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
    ['light', 'center', 'still'].forEach(function (name) { setDot(name, null); });
    q('cancel').hidden = false; // 上一輪揭示時收起過
    overlay.classList.add('open');

    return new Promise(function (resolve) {
      session = {
        resolve: resolve, mission: mission, symbol: opts.symbol || null,
        stream: null, raf: null, startedAt: Date.now(),
        video: null, ctx: null, prevLuma: null, done: false,
        acc: { n: 0, stillness: 0, lighting: 0, uniformity: 0 },
        heldMs: 0, budgetMs: MISSIONS[mission].budgetSec * 1000,
        captureStartedAt: 0, lastSampleAt: 0,
        // 臉部追蹤（tier 由實際量到的 landmark 樣本數決定，不是由「有沒有載到
        // MediaPipe」決定 —— 載到但整場沒看到臉，那就不是 Tier A）。
        faceMesh: null, faceTimer: null, faceBusy: false,
        everSawFace: false, faceFramed: false,
        lastFaceCenter: null, lastFaceAt: 0, lastStillness: null,
        blinkCounter: null, lastBlinkFeedAt: 0,
        lmAcc: { n: 0, stillness: 0 },
      };
      setProgress(0);
      var video = overlay.querySelector('.rs-video');
      startCamera(video).then(function (stream) {
        if (!session) return; // 啟動中被取消
        session.stream = stream;
        if (!stream) {
          // 無相機時不假造讀數 —— 讓使用者看到事實後自行離開。
          setInstruction('沒有相機 · 無法取得讀數');
          return;
        }
        session.video = video;
        session.captureStartedAt = performance.now();
        setInstruction('保持穩定');
        startFaceMesh(video); // host 有 MediaPipe 就升到 Tier A；沒有就純畫面啟發式
        tick();
        // TODO(S3): 把星塵本體搬進本模組（takeover 退為薄 adapter）+ cyan 角括號對齊
        //   → gold progress halo → 收束（不改星塵感覺）。校準後才做。
      });
    });
  }

  /** 這個環境是否可能取得讀數（無相機 API 時 UI 不該給掃描入口）。 */
  function isAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  global.TENKI_READINESS_SCAN = {
    begin: begin,
    isAvailable: isAvailable,
    MISSIONS: MISSIONS,
    STORE_KEY: READING_STORE_KEY,
  };
})(window);
