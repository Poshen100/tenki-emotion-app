/**
 * @module preview/finger-baseline
 * @description 手指 PPG 基線實走頁 —— founder 手機上真的走一遍 90 秒校準。
 *
 * 🔴 這一頁**沒有鏡射任何演算法**。它 import `apps/preview/engine/`，
 * 那是由 `scripts/build-preview-ppg.mjs` 從 `packages/engine/src` 編出來的。
 * 改 TS 沒重建，merge gate 會紅（`scripts/preview-ppg-sync.mjs`）。
 * 本 repo 為「鏡射漂移」付過三次學費（PLAYBOOK §6），這條路是結構性地
 * 把那個問題消滅，而不是靠註解拜託。
 *
 * 這一頁做的事只有三件：取相機、把每一幀化簡成 `PpgFrame`、把結果畫出來。
 *
 * ⚠️ iOS 的兩個限制是真的，不要假裝沒有：
 *   1. **Safari 沒有 torch（閃光燈）API。** 指尖 PPG 在沒有補光時訊號弱很多。
 *      頁面照實說，並且**不因此放寬品質閘門** —— 弱訊號就該被擋下來。
 *   2. getUserMedia 必須由**使用者手勢**觸發，而且 `<video>` 要 `playsinline`。
 */

import { analyzePpgScan } from './engine/biometric/ppg/analyze.js';
import { SCAN_MODE_CONFIGS } from './engine/biometric/scan-modes.js';
import { toEngineInput } from './engine/biometric/ppg/to-reading.js';
import {
  dimensionGoodness,
  toSignalQuality,
} from './engine/biometric/ppg/signal-quality.js';
import { formatValidationReport } from './engine/biometric/validation-log.js';
import {
  buildPulseAnchor,
  resolvePrvComparison,
  resolvePulseBaselineProgress,
  resolveRestingBand,
} from './engine/biometric/pulse-anchor.js';
import {
  INITIAL_PULSE_LOCK,
  LIVE_WINDOW_SEC,
  LOCK_CONSECUTIVE_WINDOWS,
  advancePulseLock,
  assessLiveWindow,
  recentFrames,
} from './engine/biometric/ppg/live.js';
import {
  INITIAL_READINESS,
  READINESS_HOLD_WINDOWS,
  READINESS_PATIENCE_SEC,
  READINESS_WINDOW_SEC,
  assessCaptureReadiness,
} from './engine/biometric/ppg/capture-readiness.js';
import {
  COVERAGE_MAP_GRID,
  buildCoverageMap,
} from './engine/biometric/ppg/coverage-map.js';
import { resolveCaptureStage } from './engine/biometric/ppg/capture-stage.js';
import {
  ANCHOR_AT_SEC,
  INITIAL_TIMELINE,
  PRECISION_ENDS_SEC,
  REFINEMENT_ENDS_SEC,
  advanceCaptureTimeline,
  shouldKeepCapturing,
} from './engine/biometric/ppg/capture-timeline.js';
import {
  DC_DRIFT_SUSPECT,
  assessExposureStability,
} from './engine/biometric/ppg/exposure-stability.js';

const MODE = 'full_scan';
const TARGET_SEC = SCAN_MODE_CONFIGS[MODE].targetDurationSec;
const MIN_SEC = SCAN_MODE_CONFIGS[MODE].minDurationSec;

/**
 * 幀緩衝上限。
 *
 * ⚠️ 上限一到就**結束擷取**，不是丟掉最舊的幀。滑動視窗會讓「90 秒」悄悄
 * 變成別的東西 —— 時長是要報給使用者的量，不能被緩衝策略改掉。
 * 60fps × 目標時長 × 1.5 的餘裕：正常 30fps 永遠碰不到，計時器卡住時會。
 */
const MAX_FRAMES = Math.ceil(TARGET_SEC * 60 * 1.5);

/**
 * 覆蓋地圖平均幾幀。
 *
 * ⚠️ 5 幀（約 0.17 秒）是刻意的下限：夠壓掉逐幀閃爍，又不會讓地圖落後於
 * 手指。這不是閘門的窗口 —— 閘門看 1.5 秒，地圖看「現在」。
 */
const COVERAGE_RING_FRAMES = 5;

/** ROI 邊長佔畫面較短邊的比例。中央一小塊就夠，取樣成本也低。 */
const ROI_FRACTION = 0.35;
/** 取樣畫布邊長。夠算平均值，不浪費每幀的時間。 */
const SAMPLE_SIZE = 64;

/** 使用者能照著改的字。鍵是 engine 回傳的 reason。 */
const REASON_COPY = {
  stable_signal: { tone: 'good', text: '訊號穩定' },
  low_motion: { tone: 'good', text: '手很穩' },
  // 🔴 原本寫「脈搏清楚」。實機第二次把它變成錯的：`strong_pulse` 量的是
  // **帶內 AC/DC**，而階梯式曝光擾動會讓那個值**上升** —— 於是畫面同時說
  // 「脈搏清楚」和「找不到穩定的脈搏節律」，而強的其實是干擾不是脈搏。
  // 講它真正量到的東西：血流訊號強不等於節律讀得到。
  strong_pulse: { tone: 'good', text: '血流訊號強' },
  good_periodicity: { tone: 'good', text: '節律規律' },
  full_coverage: { tone: 'good', text: '覆蓋完整' },
  motion_detected: { tone: 'bad', text: '偵測到晃動 — 手肘撐在桌上會穩很多' },
  weak_pulse: { tone: 'bad', text: '脈搏訊號偏弱 — 手指放鬆貼著就好，不要施力' },
  // ⚠️ 低灌流的建議不要講「蓋住鏡頭」——覆蓋率是另一條獨立的理由，
  // 兩者同時出現時畫面會自相矛盾（截圖抓到：「覆蓋完整」綠勾配「完全蓋住鏡頭」）。
  // 灌流不足的實際原因是手冷或壓太用力把血流壓住。
  low_perfusion: { tone: 'bad', text: '幾乎讀不到脈搏 — 手可能太冰，或壓得太用力把血流壓住了' },
  sensor_clipping: { tone: 'bad', text: '畫面過曝 — 手指壓太用力或太靠近' },
  unstable_coverage: { tone: 'bad', text: '手指滑動了 — 整片蓋住鏡頭不要移動' },
  frame_drops: { tone: 'bad', text: '掉幀 — 關掉其他 App 再試一次' },
  irregular_periodicity: { tone: 'bad', text: '找不到穩定的脈搏節律' },
  insufficient_duration: { tone: 'bad', text: '時間不足' },
  unstable_sampling: { tone: 'bad', text: '取樣不穩' },
};

/**
 * Signal Integrity 的四個維度，**依使用者能動手的順序**：先把手指放對、
 * 再處理光、再把手拿穩，最後才有節律可以找。
 *
 * 🔴 `dimensionGoodness()` 是引擎的函式，不是這裡重算的 —— `motionArtifact`
 * 是唯一反向的維度（1 = 最差），畫面不該自己記得要 1 減。
 */
const DIMENSIONS = [
  { key: 'contactCoverage', label: '接觸', hint: '手指蓋住鏡頭的完整與穩定程度' },
  { key: 'lightStability', label: '光', hint: '曝光有沒有壓到感光上限' },
  { key: 'motionArtifact', label: '穩定', hint: '這段時間手有多穩' },
  { key: 'rhythmicCoherence', label: '節律', hint: '有多清楚的一個重複週期' },
];

/** 低於這個值的維度會被標出來 —— 那是使用者這次該改的地方。 */
const DIM_LOW = 0.6;

/**
 * 光場的色階，由暗到亮。
 *
 * 🔴 亮度嚴格單調（OKLab L 0.182 → 0.797），色相只走 188°–221° 一段 33° 的
 * 弧 —— viridis 家族的 sequential ramp，不是彩虹。算過才用。
 *
 * ⚠️ 寫成資料而不是 CSS 的 `color-mix`：兩個端點混不出中間的 teal，而少了
 * 那一階，整片場會變成一塊平的 cyan（截圖看出來的）。
 */
const LENS_RAMP = [
  [6, 18, 36],     // #061224 深空 navy —— 沒有可用的場
  [11, 23, 40],    // #0B1728
  [36, 54, 94],    // #24365E indigo —— 場正在成形
  [23, 111, 134],  // #176F86 teal —— 透光建立中
  [24, 156, 184],  // #189CB8
  [34, 211, 238],  // --cyan-active —— 可信的光訊號
];

/**
 * 取色階上的一點。
 *
 * @param {number} t - 透光 0..1。
 * @returns {string} `rgb(...)`。
 */
function sampleLensRamp(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (LENS_RAMP.length - 1);
  const i = Math.min(LENS_RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const mix = (a, b) => Math.round(a + (b - a) * f);
  return `rgb(${mix(LENS_RAMP[i][0], LENS_RAMP[i + 1][0])}, ${mix(
    LENS_RAMP[i][1],
    LENS_RAMP[i + 1][1],
  )}, ${mix(LENS_RAMP[i][2], LENS_RAMP[i + 1][2])})`;
}

/**
 * 八個顯示狀態的文案，逐字照 founder 2026-09-15 的 COVERAGE LOCK brief。
 *
 * 🔴 文案不做任何量測宣稱：不講 100% 實體覆蓋、不講壓力數值、不講溫度或
 * 紅外線。`pressure_adjustment` 那句是**動作建議**而不是量到的壓力 ——
 * 觸發它的是逐格飽和，而飽和只說明光被打到頂。
 */
const LENS_STATE_COPY = {
  searching_contact: '把手指輕放在鏡頭與補光燈上。',
  coverage_gap: '再蓋住一點。光場邊緣還有小缺口。',
  light_locking: '光已經穿過來了。保持這個位置。',
  pressure_adjustment: '放鬆一點手指，讓光均勻穿過。',
  field_shifted: '位置很好。保持不動 5 秒。',
  coverage_locked: '覆蓋已確認。現在開始找你的節奏。',
  rhythm_search: '接觸很好。Tenki 正在確認脈搏節律。',
  pulse_locked: '脈搏已鎖定。',
};

/**
 * 只有**狀態句沒講到**的指令才印第二行。
 *
 * 八個狀態裡有五個本身就是那句指令，再印一次只是重複 —— 而 brief 的規則是
 * 一次只有一個修正。`warm_fingertip` 是唯一沒有對應狀態的指令，所以只有它
 * 需要自己的一行。
 */
const INSTRUCTION_EXTRA_COPY = {
  warm_fingertip: '手指偏冷時透光會很弱 —— 搓一下手再試。',
};

/**
 * `light_locking` 是**兩件事**共用的狀態，而原本的那句話只符合其中一件。
 *
 * 🔴 founder 2026-09-24 實走：「光場穩定燈號沒有亮，是不是應該要提示怎麼調整
 * 動作」。查下去發現畫面當時說的是「光已經穿過來了。保持這個位置。」——
 * 而同一個畫面的證據列正顯示「光場均勻 ✗」。**畫面在跟自己的證據打架。**
 *
 * 原因是狀態被兩條路徑共用：
 *   1. `resolveLensState` 的 fallback（還沒開始找節律、覆蓋還沒全確認）——
 *      那是良性的「光正在穩定下來」，原句剛好適合。
 *   2. `camera_adapting` 指令（`slowDriftDominates === true`）—— 相機正在自己
 *      重新決定亮度。原句在這裡是**反過來的**。
 *
 * 🔴 **不新增第九個狀態**（brief 指定就是這八個）。指令本來就分得出這兩件事，
 * 所以由指令挑文案。
 *
 * ⚠️ 而且這句話**刻意不是一個姿勢指令**。相機在自己調增益，換姿勢改不了它 ——
 * 叫使用者「調整一下手指」會是**假的指引**，而且會把責任推給他。能做的那件事
 * （關掉補光燈）在就位畫面的切換鈕旁邊講，那裡才按得到。
 */
const INSTRUCTION_STATE_COPY = {
  camera_adapting: '相機正在自己重新調整亮度（不是你的手）。維持不動等它穩定。',
};


/**
 * 各階段的名字。英文是對外溝通的 canonical 詞，中文是畫面上的說法。
 * 🔴 只有最後一階可以叫「基線」。
 */
const STAGE_COPY = {
  none: { term: 'NO REFERENCE YET', name: '還沒有參考點' },
  first_reference: { term: 'FIRST PULSE REFERENCE', name: '第一個脈搏參考' },
  emerging_rhythm: { term: 'EMERGING RHYTHM', name: '節律開始成形' },
  personal_resting_band: { term: 'PERSONAL RESTING BAND', name: '你的靜息區間' },
  contextual_baseline: { term: 'CONTEXTUAL PULSE BASELINE', name: '情境脈搏基線' },
};

/** 值得說、但不影響結論的事。 */
const ADVISORY_COPY = {
  torch_unavailable:
    '這次沒有補光燈（iOS Safari 不支援）。讀數照算 —— 沒有補光只是讓訊號更容易太弱，而太弱本來就會被擋下來。',
};

/**
 * 三個中性的落點說法。
 *
 * 🔴 不得出現壓力／恢復／準備度／交感／副交感 —— 引擎回的是 token，句子在這裡
 * 生成，就是為了讓「能講什麼」只有一個地方要看。
 */
const PLACEMENT_COPY = {
  below_usual: '比你平常低',
  usual: '在你平常的範圍內',
  above_usual: '比你平常高',
};

const ANCHOR_KEY = 'tenki.preview.pulseAnchors';
const VALIDATION_KEY = 'tenki.preview.validationLog';

/** 指標被扣住的理由，直接用 engine 的 withheld reason。 */
const WITHHELD_COPY = {
  mode_excludes_metric: '這個版本不報這一項',
  unstable_beat_shape: '每一拍的波形不夠像，拍點時間不可信（常見原因是感光雜訊）',
  too_few_beats: '拍數不足',
  too_many_artifacts: '拍點被剔除太多，算出來的數字會低報',
  frame_drops: '拍點時序跨過了補插的空隙',
  low_perfusion: '訊號太弱',
  motion_detected: '手在動',
  sensor_clipping: '畫面過曝',
  unstable_coverage: '手指沒有穩定覆蓋',
  insufficient_duration: '時間不足',
  irregular_periodicity: '節律不穩',
  weak_pulse: '脈搏訊號偏弱',
};

const state = {
  stream: null,
  frames: [],
  startedAt: 0,
  raf: 0,
  running: false,
  lastSample: null,
  torchAvailable: false,
  /**
   * 補光燈現在是不是亮的。
   *
   * 🔴 可以關，而且關掉是一個**實驗**不是一個偏好：瀏覽器不給鎖曝光，
   * 所以唯一還剩的辦法是不要給 auto-exposure 東西去追。補光燈貼著指尖會讓
   * 紅到 201、綠到 37，那是 AE 很難平衡的場景。它是不是 29% 擺動的原因，
   * 兩次擷取就答得出來 —— 前提是紀錄記得下哪一次開哪一次關。
   */
  torchOn: false,
  lock: INITIAL_PULSE_LOCK,
  /** 這次擷取期間是否曾經 lock 過。實機驗收第 6 條問的就是這個。 */
  lockEverAchieved: false,
  /** 使用者說的情境。預設靜坐，但要由他選。 */
  scenario: 'resting',
  /** 就位閘的狀態。`gateFrames` 是**還沒評過**的那一批，評完就清掉。 */
  gate: INITIAL_READINESS,
  gateFrames: [],
  gateStartedAt: 0,
  gateRunning: false,
  /** 最近幾幀的 per-cell 覆蓋比例。只給畫面用，跟著幀丟掉，不落地。 */
  cellRing: [],
  /** 最近一次畫出來的光場。狀態機要用它判斷覆蓋有沒有確認。 */
  coverMap: null,
  /** 最近一次的 Pulse Lens 狀態。`previousStage` 要它才講得出「本來有、掉了」。 */
  lensView: null,
  /** 擷取時間軸：30 秒 anchor → 60 秒收尾 → 90 秒只有明確選擇才走。 */
  timeline: INITIAL_TIMELINE,
  /** 使用者有沒有明確選擇繼續到 90 秒。 */
  precisionOptIn: false,
  /** 上一次評估 anchor 候選的秒數。`analyzePpgScan` 不便宜，不能每幀跑。 */
  lastCandidateAtSec: 0,
  /** 這次擷取有沒有鎖住曝光，以及鎖了什麼。null = 沒試或無可鎖。 */
  exposureLock: null,
  /** 最近一次算出來的曝光穩定度。掃描中顯示，結束後記進驗收紀錄。 */
  exposure: null,
};

const $ = (id) => document.getElementById(id);

/**
 * 這次擷取的能力旗標。
 *
 * 🔴 `torchAvailable` 是**記錄**用的，不是拒收條件（founder 2026-09-11）：
 * iOS Safari 完全沒有 torch API，拿它拒收等於拒收一整個平台；而夠亮的環境光
 * 真的量得到。沒有補光燈**通常**造成的結果（訊號太弱）品質閘門本來就會擋，
 * 這個 reason 的用途是在那件事發生時說得出原因。
 */
function captureOptions() {
  return { torchAvailable: state.torchAvailable };
}

/**
 * 存下來的只有**推導出來的數值與品質後設資料**。沒有影像、沒有波形、沒有
 * 逐幀取樣 —— anchor 的型別裡根本沒有地方放那些東西（engine 有一條測試
 * 把序列化後的 anchor 攤開來驗這件事）。
 */
function loadAnchors() {
  try {
    const raw = localStorage.getItem(ANCHOR_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveAnchors(anchors) {
  try {
    localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchors));
  } catch (_) {
    /* private mode — 這一次就不留下來 */
  }
}

function loadValidationLog() {
  try {
    const raw = localStorage.getItem(VALIDATION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * 記下一次擷取嘗試 —— **接受與拒答都記**。
 *
 * 🔴 只記推導值。沒有幀、沒有波形、沒有任何本來沒算過的東西；報告本身也只有
 * 統計，因為它會被從手機複製、貼進對話裡。
 *
 * ⚠️ 拒答的那些**特別重要**：實機驗收第 6 條問的是「lock 出現但最終沒有讀數」，
 * 而那種擷取根本不會產生 anchor。只看 anchor 的話那條檢查永遠是空的。
 */
function recordValidationCapture(entry) {
  const log = loadValidationLog();
  log.push(entry);
  try {
    localStorage.setItem(VALIDATION_KEY, JSON.stringify(log));
  } catch (_) {
    /* private mode — 這一次就不留下來 */
  }
  return log;
}

function renderValidationReport(log) {
  $('validationReport').textContent = formatValidationReport(log);
}

/** 本機日曆日。時區只有這台裝置知道，所以日界線由這裡決定，不由引擎猜。 */
function localDateKey(at) {
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 這次擷取在驗收紀錄裡長什麼樣。
 *
 * @param a 分析結果，或 null（連分析都跑不動的擷取）。
 */
function validationEntry(a) {
  const at = Date.now();
  return {
    atMs: at,
    localDateKey: localDateKey(at),
    durationSec: a === null ? 0 : a.durationSec,
    qualityScore: a === null ? 0 : a.quality.score,
    accepted: a !== null && a.heartRateBpm !== null,
    heartRateBpm: a === null ? null : a.heartRateBpm,
    prvRmssdMs: a === null ? null : a.prvRmssdMs,
    beatTemplateCorrelation: a === null ? null : a.beatTemplateCorrelation,
    lockEverAchieved: state.lockEverAchieved,
    // 🔴 通道診斷。實機第一次跑出「接觸 100%、節律 8%、沒有讀數」，而最可能的
    // 原因是補光燈把紅通道打飽和 —— 記下贏的通道與**兩個**通道的節律和亮度，
    // 才能把那個懷疑變成答案。
    channel: a === null ? null : a.channel,
    channelPeriodicity: a === null ? null : channelMap(a, 'periodicity'),
    channelDcMean: a === null ? null : channelMap(a, 'dcMean'),
    // 🔴 曝光診斷。實機第二次通道修正沒有解釋：光 100%（什麼都沒削波）而節律
    // 仍然是 0，理由同時出現 strong_pulse 與 irregular_periodicity —— 心搏
    // 頻帶裡有很多不重複的能量。記下來才知道是不是相機在自己調亮度。
    // ⚠️ 用**被選中的那個通道**算，不是寫死紅的：漂移要量在讀數真的來自的地方。
    exposure: assessExposureStability(state.frames, a === null ? 'red' : a.channel),
    exposureLock: state.exposureLock,
    // 🔴 記的是「這次到底亮不亮」，不是「這台機器有沒有補光燈」。
    // 沒有補光燈可開的瀏覽器（iOS Safari 都是）回 null —— 那不是「關」。
    torchOn: state.torchAvailable ? state.torchOn : null,
    // 🔴 連拒絕一起記。救不起來不是一件事而是三件（切不出段／段裡沒脈搏／
    // 段之間不一致），而它們要的修法不同 —— 只記「又是 0%」等於下一輪實機
    // 還是瞎的。
    quietSegments:
      a === null || a.quietSegments === null
        ? null
        : {
            bpm: a.quietSegments.bpm,
            foundCount: a.quietSegments.foundCount,
            periodicCount: a.quietSegments.periodicCount,
            longestSec: a.quietSegments.longestSec,
            spreadBpm: a.quietSegments.spreadBpm,
          },
    scenario: state.scenario,
  };
}

/** 把 `channelDiagnostics` 攤成 `{ red, green }`。 */
function channelMap(a, field) {
  const find = (channel) => a.channelDiagnostics.find((d) => d.channel === channel);
  return { red: find('red')?.[field] ?? 0, green: find('green')?.[field] ?? 0 };
}

/** 這次擷取的條件。問不到的就標成不知道，不要猜一個。 */
function captureContext(at) {
  const hour = new Date(at).getHours();
  const timeOfDay =
    hour < 11 ? 'morning' : hour < 16 ? 'midday' : hour < 22 ? 'evening' : 'night';
  return {
    timeOfDay,
    // 實走頁沒有問姿勢，也沒有問剛剛有沒有動過 —— 所以就是不知道。
    posture: 'unknown',
    afterExertion: null,
  };
}

// ── camera ──────────────────────────────────────────────────────────────────

async function startCamera() {
  const video = $('cam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
  state.stream = stream;
  video.srcObject = stream;
  await video.play().catch(() => {});

  // Torch is Chrome-on-Android only. Asking for it on iOS throws, so probe
  // rather than assume — and say which one the user is on.
  const track = stream.getVideoTracks()[0];
  const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  state.torchAvailable = Boolean(caps && caps.torch);
  if (state.torchAvailable) await setTorch(true);
  renderTorchControl();
}

/**
 * 開關補光燈。
 *
 * ⚠️ 失敗就把 `torchAvailable` 降下來，因為 `getCapabilities()` 說有不等於
 * `applyConstraints()` 會收 —— 而 `torchOn` 必須反映**實際**狀態，否則驗收
 * 報告的那組對照會拿錯的標籤去比。
 *
 * @param {boolean} on - 要不要亮。
 * @returns {Promise<void>}
 */
async function setTorch(on) {
  if (state.stream === null) return;
  const track = state.stream.getVideoTracks()[0];
  if (!track) return;
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] });
    state.torchOn = on;
  } catch (_) {
    state.torchAvailable = false;
    state.torchOn = false;
  }
}

/** 補光燈那一行：狀態＋（有的話）切換鈕。 */
function renderTorchControl() {
  const note = $('torchNote');
  const btn = $('torchToggle');
  if (!state.torchAvailable) {
    btn.hidden = true;
    note.textContent =
      '這個瀏覽器不支援補光燈（iOS Safari 都不支援）。訊號會比原生 App 弱 —— 品質門檻不會因此放寬，讀不到就是讀不到。';
    return;
  }
  btn.hidden = false;
  btn.textContent = state.torchOn ? '關掉補光燈' : '開啟補光燈';
  note.textContent = state.torchOn
    ? '補光燈開著。⚠️ 如果節律一直讀不到，關掉再做一次 —— 驗收報告會把兩種情況的亮度擺動並排。'
    : '補光燈關著。訊號會弱一些，但相機比較不會一直重調亮度。';
}

function stopCamera() {
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
}

// ── frame → PpgFrame ────────────────────────────────────────────────────────

/**
 * 把一幀化簡成純量。
 *
 * 🔴 像素不離開這個函式 —— 這正是 `PpgFrame` 的形狀在強制的事
 * （`packages/engine/src/biometric/ppg/types.ts`）：引擎拿不到影像，
 * 所以「不留存影像」是型別的性質，不是要記得做的事。
 */
function sampleFrame(video, ctx, timestampMs) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const side = Math.floor(Math.min(vw, vh) * ROI_FRACTION);
  const sx = Math.floor((vw - side) / 2);
  const sy = Math.floor((vh - side) / 2);

  ctx.drawImage(video, sx, sy, side, side, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return reduceRoi(data, timestampMs);
}

/**
 * 把 ROI 的像素化簡成純量 ＋ 每格覆蓋比例。
 *
 * 🔴 從 `sampleFrame` 拆出來是為了**能被測到**：像素 → 格子的索引換算
 * （`px` / `py` / row-major 位置）正是 off-by-one 會住的地方，而合成的
 * `PpgFrame` 永遠碰不到它 —— 合成器產出的是已經化簡完的幀。harness 現在
 * 直接餵一塊已知圖樣的像素進來。
 *
 * @param {Uint8ClampedArray} data - RGBA，SAMPLE_SIZE × SAMPLE_SIZE。
 * @param {number} timestampMs
 */
function reduceRoi(data, timestampMs) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let clipped = 0;
  const pixels = SAMPLE_SIZE * SAMPLE_SIZE;

  /**
   * 每一格被蓋住的像素數。
   *
   * 🔴 整塊的 `coverage` 是**從這些格子加總出來的**，不是另外算一次 ——
   * 所以地圖與閘門在算術上不可能講不同的話（`coverage-map.ts`）。
   */
  const cellCovered = new Array(COVERAGE_MAP_GRID * COVERAGE_MAP_GRID).fill(0);
  /**
   * 每一格被打到感光上下限的像素數。
   *
   * 🔴 逐格，不是逐幀。調整色（amber）存在的意義就是說出「哪裡」要調 ——
   * 逐幀的旗標會讓整張圖一起變色，等於只講「有東西不對」。
   */
  const cellClipped = new Array(COVERAGE_MAP_GRID * COVERAGE_MAP_GRID).fill(0);
  const cellSide = SAMPLE_SIZE / COVERAGE_MAP_GRID;
  const cellPixels = cellSide * cellSide;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    red += r;
    green += g;
    blue += b;
    const px = (i / 4) % SAMPLE_SIZE;
    const py = Math.floor(i / 4 / SAMPLE_SIZE);
    const cell = Math.floor(py / cellSide) * COVERAGE_MAP_GRID + Math.floor(px / cellSide);
    if (r >= 254 || r <= 1) {
      clipped++;
      cellClipped[cell]++;
    }
    // 手指貼在鏡頭上時紅通道遠高於其他兩個 —— 這就是「有沒有蓋住」的判準，
    // 不是猜的：血液吸收綠光遠多於紅光。
    if (r > g * 1.35 && r > b * 1.35) cellCovered[cell]++;
  }

  let covered = 0;
  for (const count of cellCovered) covered += count;

  const motion =
    state.lastSample === null
      ? 0
      : Math.min(1, Math.abs(red / pixels - state.lastSample) / 8);
  state.lastSample = red / pixels;

  return {
    // `PpgFrame` 就是引擎拿到的全部。⚠️ 格子**不在裡面**：它是給畫面看的
    // 推導值，不進分析鏈、不落地（`coverage-map.ts` 的隱私註記）。
    frame: {
      timestampMs,
      red: red / pixels,
      green: green / pixels,
      blue: blue / pixels,
      clippedFraction: clipped / pixels,
      coverage: covered / pixels,
      motion,
    },
    cells: cellCovered.map((count) => count / cellPixels),
    clipping: cellClipped.map((count) => count / cellPixels),
  };
}

// ── 就位閘（clock 還沒開始）─────────────────────────────────────────────────

/**
 * 擺手指的那段時間。
 *
 * 🔴 這裡**不累積擷取用的幀**。`state.gateFrames` 每評完一個窗口就清掉 ——
 * 使用者找位置的那 10 秒不是量測的一部分，混進去等於在 90 秒的擷取裡塞一段
 * 手指還在移動的資料。
 *
 * ⚠️ 窗口是**不重疊**的：重疊窗口會讓同一批幀被算進好幾次 hold，於是「連續
 * 三個窗口」變成「一個窗口看三次」。引擎那邊的測試也是照不重疊replay 的。
 */
function gateTick(video, ctx) {
  if (!state.gateRunning) return;

  // 🔴 光場畫的是**現在**，不是這個窗口的平均 —— 使用者的手指正在移動，
  // 落後 1.5 秒的場沒辦法拿來對位。`sampleAndPublish` 保證每一幀都發布。
  const now = performance.now();
  const sample = sampleAndPublish(video, ctx, now);
  if (sample !== null) state.gateFrames.push(sample.frame);

  const batch = state.gateFrames;
  const spanSec =
    batch.length < 2 ? 0 : (batch[batch.length - 1].timestampMs - batch[0].timestampMs) / 1000;

  if (spanSec >= READINESS_WINDOW_SEC) {
    state.gate = assessCaptureReadiness(batch, state.gate.held);
    // ⚠️ 先畫再清。`stageInput()` 讀的就是這一批幀 —— 清掉再畫，狀態機會拿到
    // 一個空窗口，然後每個窗口都報「還在找接觸」。
    renderGate();
    state.gateFrames = [];

    if (state.gate.ready) {
      startCapture(video, ctx);
      return;
    }
  }

  // 🔴 逃生口，不是逾時自動開始：按鈕出現，但要**使用者自己按**。沒有出口的
  // 閘會把「coverage 判準在這支手機上不準」的人整個擋在產品外面。
  if ((now - state.gateStartedAt) / 1000 >= READINESS_PATIENCE_SEC) {
    $('skipGate').hidden = false;
  }

  state.raf = requestAnimationFrame(() => gateTick(video, ctx));
}

/**
 * Pulse Lens —— 一個場、一個狀態、一句指令。
 *
 * 🔴 狀態與指令都來自引擎的 `resolveCaptureStage`，這一層只負責把 token 換成
 * 中文。畫面不得自己判斷現在是什麼狀態 —— 那會變成對訊號的第二種意見。
 *
 * 🔴 主畫面**不解釋量測方法**（founder 2026-09-15）。「這不是溫度」那類說明
 * 全部在「量測細節」裡。主畫面只回答：現在怎麼樣、要做什麼。
 */
function renderGate() {
  const input = stageInput();
  const view = resolveCaptureStage(input);
  state.lensView = view;

  // 指令優先：同一個狀態可能由兩條不同的路徑到達，而只有指令分得出來。
  $('lensState').textContent =
    (view.instruction === null ? null : INSTRUCTION_STATE_COPY[view.instruction]) ??
    LENS_STATE_COPY[view.lensState] ??
    '';

  // 🔴 只有當指令**多講了狀態沒講的事**時才出現第二行。八個狀態裡有五個
  // 本身就是那句指令，再印一次只是重複。
  const extra = view.instruction === null ? null : INSTRUCTION_EXTRA_COPY[view.instruction];
  const line = $('lensInstruction');
  line.hidden = extra == null;
  line.textContent = extra ?? '';

  for (const item of document.querySelectorAll('.evidenceItem')) {
    item.dataset.on = view.evidence[item.dataset.key] ? 'yes' : 'no';
  }

  const dots = $('holdDots');
  if (dots.childElementCount === 0) {
    for (let i = 0; i < READINESS_HOLD_WINDOWS; i++) {
      const dot = document.createElement('span');
      dot.className = 'holdDot';
      dots.appendChild(dot);
    }
  }
  for (let i = 0; i < dots.children.length; i++) {
    dots.children[i].dataset.on = i < state.gate.held ? 'yes' : 'no';
  }

  renderDetailDims(input.reading);
}

/**
 * 把畫面手上的量測湊成引擎要的輸入。
 *
 * ⚠️ 就位期間也要有 `LiveReading` —— 用閘門那一批幀跑 `assessLiveWindow`，
 * 節律會是 null（窗口太短），那正是它該回的東西。
 */
function stageInput() {
  // 就位期間看閘門那一批，擷取期間看擷取的幀。用「哪一個有東西」而不是
  // `gateRunning` —— harness 餵幀時沒有跑那個迴圈。
  const frames = state.gateFrames.length > 0 ? state.gateFrames : state.frames;
  const reading = assessLiveWindow(recentFrames(frames, LIVE_WINDOW_SEC), MODE);
  return {
    reading,
    lock: state.lock,
    exposure: assessExposureStability(frames, 'red'),
    readiness: state.gate.ready ? undefined : state.gate,
    previousStage: state.lensView === null ? undefined : state.lensView.stage,
    // 🔴 null 不是 0：還沒算出場的時候，「已確認」不准打勾。
    uncoveredCells: state.coverMap === null ? null : state.coverMap.uncoveredCount,
  };
}

/**
 * 取一幀，並且**同時**把它發布到光場。
 *
 * 🔴 兩個迴圈都只能用這一支拿幀，而那是刻意的結構安排，不是整理：
 * Coverage Lock 必須在整個 60 秒都有用（founder 2026-09-15），而
 * 「擷取迴圈有沒有記得更新光場」**沒有辦法用 harness 驗**（harness 餵的是
 * 合成的 `PpgFrame`，沒有像素，走不到取樣器；也沒有相機可以驅動 `tick()`）。
 * 第一版我寫了一條斷言假裝驗到了 —— 它讀到的其實是稍早 `cover()` 留下來的
 * 舊顏色，把擷取迴圈裡那一行整段刪掉照樣綠。
 *
 * 驗不到的東西就不要用測試假裝驗到：**把漏掉的可能性拿掉**。現在少寫那一行
 * 的唯一方法是連幀也不取。
 *
 * @param {HTMLVideoElement} video
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} now
 * @returns {{frame: object, cells: number[], clipping: number[]} | null}
 */
function sampleAndPublish(video, ctx, now) {
  const sample = sampleFrame(video, ctx, now);
  if (sample !== null) updateLensFromSample(sample);
  return sample;
}

/**
 * 把一幀的逐格資料餵進光場。
 *
 * @param {{cells: number[], clipping: number[]}} sample
 */
function updateLensFromSample(sample) {
  state.cellRing.push({ cells: sample.cells, clipping: sample.clipping });
  if (state.cellRing.length > COVERAGE_RING_FRAMES) state.cellRing.shift();
  renderCoverageMap();
}

/**
 * 光場本身。
 *
 * 🔴 亮 = 透光良好，暗 navy/indigo = 沒有可用的場。缺口**不用 amber** ——
 * 靠暗格與封環的破口表示，因為同一個亮度不得同時代表「訊號好」與「沒蓋到」
 * （founder 2026-09-15 定案）。amber 只標**逐格量到**真的被打到感光上限的
 * 那幾格。gold 不在這裡出現，它只屬於已立住的 Pulse Anchor。
 *
 * ⚠️ 不內插：8×8 就畫成 8×8。格線是誠實的解析度，不是瑕疵。
 */
function renderCoverageMap() {
  const host = $('lensGrid');
  if (state.cellRing.length === 0) return;

  const size = COVERAGE_MAP_GRID * COVERAGE_MAP_GRID;
  const mean = new Array(size).fill(0);
  const meanClip = new Array(size).fill(0);
  for (const frame of state.cellRing) {
    for (let i = 0; i < size; i++) {
      mean[i] += frame.cells[i] / state.cellRing.length;
      meanClip[i] += frame.clipping[i] / state.cellRing.length;
    }
  }
  const map = buildCoverageMap(mean, meanClip);

  if (host.childElementCount !== size) {
    host.innerHTML = '';
    host.style.gridTemplateColumns = `repeat(${map.grid}, 1fr)`;
    for (let i = 0; i < size; i++) {
      const cell = document.createElement('span');
      cell.className = 'lensCell';
      host.appendChild(cell);
    }
  }

  for (let i = 0; i < size; i++) {
    const cell = host.children[i];
    cell.style.setProperty('--t', String(map.cells[i].fraction));
    // 🔴 amber 只給需要調整的格子；其餘走光場色階。兩者不會同時出現在一格上。
    cell.style.backgroundColor = map.cells[i].saturated
      ? ''
      : sampleLensRamp(map.cells[i].fraction);
    cell.dataset.adjust = map.cells[i].saturated ? 'yes' : 'no';
  }

  renderSealRing(map);
  state.coverMap = map;
}

/**
 * 封環：四段弧，各對應場的一個象限。
 *
 * 🔴 破口是缺口的**第二個線索**，跟暗格講同一件事 —— 因為 amber 被保留給
 * 「需要調整」，缺口只剩亮度可用，而單靠亮度在小尺寸上不夠明顯。
 *
 * ⚠️ 環的方位指的是**畫面上那張圖**的方位，不是手機的方位 —— 使用者同時看到
 * 兩者，所以這不是一個關於實體方向的宣稱（驗收清單第 20 條還沒跑）。
 */
function renderSealRing(map) {
  const half = map.grid / 2;
  for (const arc of document.querySelectorAll('.sealArc')) {
    const q = Number(arc.dataset.quadrant);
    // 0 = 右上、1 = 右下、2 = 左下、3 = 左上（環從 12 點鐘順時針起算）。
    const top = q === 0 || q === 3;
    const left = q >= 2;
    const sealed = map.cells.every(
      (cell) =>
        cell.covered ||
        (cell.row < half) !== top ||
        (cell.col < half) !== left,
    );
    arc.dataset.sealed = sealed ? 'yes' : 'no';
  }
}

/**
 * 量測細節裡的四條 bar。
 *
 * 🔴 從主畫面移下來的（founder 2026-09-15 §6）：主擷取畫面只放一個場、一個
 * 狀態、一句指令。這些數字沒有被刪掉 —— 它們是診斷實機問題的唯一依據，
 * 只是收在一個 tap 之後。
 */
function renderDetailDims(reading) {
  const host = $('detailDims');
  if (host !== null) renderDims(host, reading);
}

// ── loop ────────────────────────────────────────────────────────────────────

function tick(video, ctx) {
  if (!state.running) return;

  const now = performance.now();
  const sample = sampleAndPublish(video, ctx, now);
  if (sample !== null) state.frames.push(sample.frame);

  const elapsed = (now - state.startedAt) / 1000;
  renderProgress(elapsed);

  if (state.frames.length >= MAX_FRAMES) {
    finish();
    return;
  }

  // 每 30 幀（約一秒）更新一次即時回饋。⚠️ 不再等到第 6 秒才開始 ——
  // 接觸與光從第一幀就量得到，而那正是使用者最需要被糾正的時候。
  if (state.frames.length % 30 === 0) {
    renderLive();
  }

  // 🔴 「還要不要繼續」只有一個地方決定 —— `advanceTimeline` 的回傳值。
  // ⚠️ 這一行本身**沒有測試蓋得到**（harness 沒有相機可以驅動 `tick()`），
  // 所以決策被推進一個 harness 驅動得到的函式裡，而這裡只剩「照做」。
  if (!advanceTimeline(elapsed)) {
    finish();
    return;
  }
  state.raf = requestAnimationFrame(() => tick(video, ctx));
}

/**
 * 推進擷取的時間軸。
 *
 * 🔴 30 秒一到就用 `quick_check` 評一次 —— 那是**同一條**心率品質門檻
 * （`minQualityForHeartRate` 兩個模式都是 45），不是放寬過的。過了就立刻
 * 收下 anchor 並告訴使用者，他可以馬上走。
 *
 * ⚠️ `analyzePpgScan` 不便宜，所以不是每幀評 —— 30 秒評第一次，之後每
 * `CANDIDATE_EVERY_SEC` 秒一次，60 秒收尾再評一次。
 *
 * @param {number} elapsed - 擷取開始到現在的秒數。
 * @returns {boolean} 還要不要繼續擷取。擷取迴圈只照這個值做事。
 */
function advanceTimeline(elapsed) {
  const due =
    elapsed >= ANCHOR_AT_SEC &&
    elapsed - state.lastCandidateAtSec >= CANDIDATE_EVERY_SEC;
  if (!due) return shouldKeepCapturing(state.timeline, elapsed, state.precisionOptIn);
  state.lastCandidateAtSec = elapsed;

  // 30–60 秒用 quick_check 的門檻評 anchor；超過 full_scan 的最短時長之後
  // 改用 full_scan —— 那才是精修真正買到的東西（PRV、呼吸率、不規則節律）。
  const mode = elapsed >= SCAN_MODE_CONFIGS.full_scan.minDurationSec ? MODE : 'quick_check';
  const outcome = analyzePpgScan(state.frames, mode, captureOptions());
  const analysed = outcome.status === 'analysed' ? outcome.analysis : null;

  state.timeline = advanceCaptureTimeline(state.timeline, {
    elapsedSec: elapsed,
    candidate:
      analysed === null
        ? { heartRateBpm: null, qualityScore: 0, durationSec: elapsed, meetsGate: false }
        : {
            heartRateBpm: analysed.heartRateBpm,
            qualityScore: analysed.quality.score,
            durationSec: analysed.durationSec,
            meetsGate: analysed.heartRateBpm !== null,
          },
    precisionOptIn: state.precisionOptIn,
  });
  renderTimeline();

  // 🔴 60 秒就停，除非使用者自己選了 Precision Session（founder rule 7）。
  // 沒有 anchor 也一樣停 —— 在沒有選擇的情況下被留過一分鐘，正是要擋的事。
  return shouldKeepCapturing(state.timeline, elapsed, state.precisionOptIn);
}

/** `analyzePpgScan` 的評估間隔。太密會吃掉擷取迴圈的時間。 */
const CANDIDATE_EVERY_SEC = 5;

/**
 * 時間軸在畫面上的樣子。
 *
 * 🔴 三件事要分得出來（founder rule 10）：已經拿到 anchor、還在精修、
 * 精密證據是選配。而且**拿到 anchor 之後隨時可以走，不會有懲罰**。
 */
function renderTimeline() {
  const { phase, anchor, refinementIncomplete } = state.timeline;
  const banner = $('anchorBanner');
  if (banner === null) return;

  banner.hidden = anchor === null;
  if (anchor === null) return;

  $('anchorBpm').textContent = String(anchor.heartRateBpm);
  $('anchorPhase').textContent =
    phase === 'refining'
      ? '錨點已收下，正在精修 —— 你隨時可以離開。'
      : refinementIncomplete
        ? '錨點已收下。這次的精修沒有完成，錨點不受影響。'
        : '錨點已收下。';
  $('precisionBtn').hidden = !(phase === 'refined' && !state.precisionOptIn);
}

function renderProgress(elapsed) {
  // 🔴 分母是**這次實際會跑到哪裡**，不是寫死的 90 —— 預設 60 秒收尾，
  // 只有明確選了 Precision Session 才是 90。畫一個永遠到不了的進度環，
  // 就是在告訴使用者他被困在 90 秒裡。
  const target = state.precisionOptIn ? PRECISION_ENDS_SEC : REFINEMENT_ENDS_SEC;
  const pct = Math.min(100, (elapsed / target) * 100);
  const arc = $('arc');
  arc.style.setProperty('--p', String(pct));
  // ⚠️ `stroke-linecap: round` 在長度 0 時還是會畫一顆圓頭 —— 也就是 0%
  // 進度會在環的頂端點一個亮點，看起來像已經開始了。長度 0 就整條隱藏。
  arc.style.opacity = pct > 0 ? '1' : '0';
  $('elapsed').textContent = `${Math.floor(elapsed)}s / ${target}s`;
}

/**
 * 掃描進行中的即時回饋。
 *
 * 🔴 這裡不呼叫 `analyzePpgScan` —— 那是最終分析，會用整段掃描的門檻去評一個
 * 20 秒的窗口（於是每次即時回饋都會說「時間不足」），而且會算出一個**不該**
 * 在掃描中顯示的心率。即時層是引擎自己的 `assessLiveWindow()`：接觸／光／穩定
 * 從第一幀就有，節律要等窗口夠長才有（不夠長時是 `null`，不是 0）。
 */
function renderLive() {
  const reading = assessLiveWindow(recentFrames(state.frames, LIVE_WINDOW_SEC), MODE);

  // 🔴 `—` 在實機上被讀成「壞了」（founder 2026-09-12）。前 15 秒還評不出
  // 品質分數是真的，但一條橫槓沒有說出那件事 —— 而旁邊的「節律」那一列早就
  // 用「累積中」講同一件事了。同一個狀態要用同一個字。
  const quality = $('liveQuality');
  quality.dataset.pending = reading.score === null ? 'yes' : 'no';
  quality.textContent = reading.score === null ? '累積中' : String(reading.score);
  renderReasons($('liveReasons'), reading.reasons);
  renderDims($('liveDims'), reading);

  renderExposure();

  state.lock = advancePulseLock(state.lock, reading);
  // 狀態與證據列在擷取進行中照樣跟著走 —— 同一個 `resolveCaptureStage`。
  renderGate();
  state.lockEverAchieved = state.lockEverAchieved || state.lock.locked;
  renderLock();
}

/**
 * 掃描中的曝光讀數。
 *
 * 🔴 為什麼要在**掃描進行中**就顯示：實機第二次跑到 46 秒時畫面上能看到的
 * 只有「節律 0%」和「找不到穩定的脈搏節律」—— 沒有任何一個數字說得出為什麼。
 * 曝光擺動就是那個數字，而它在第 15 秒就算得出來。
 *
 * ⚠️ 活層用紅通道算（此刻還不知道讀數會來自哪個通道）。結束後記進驗收紀錄
 * 的那一筆用**被選中的**通道。
 */
function renderExposure() {
  const exposure = assessExposureStability(state.frames, 'red');
  state.exposure = exposure;
  const note = $('exposureNote');

  if (exposure === null) {
    // 🔴 量不到就說量不到 —— null 不是「穩定」。
    note.dataset.tone = 'neutral';
    note.textContent = '亮度穩定度：累積中。';
    return;
  }

  const drift = `${(exposure.dcDriftFraction * 100).toFixed(1)}%`;
  const fps = exposure.framesPerSecond.toFixed(0);
  // 🔴 週期決定這件事有沒有救：比一次心搏慢的擺動原理上可以除掉，
  // 跟心搏同頻的沒有東西分得出來。量不到就不講（null 不是「沒有擺動」）。
  const period =
    exposure.driftPeriodSec === null ? '' : `，週期約 ${exposure.driftPeriodSec.toFixed(1)} 秒`;
  if (exposure.slowDriftDominates) {
    note.dataset.tone = 'bad';
    note.textContent =
      `⚠️ 相機在自己重新調亮度（慢速擺動 ${drift}，門檻 ${(DC_DRIFT_SUSPECT * 100).toFixed(0)}%${period}）。` +
      '心搏起伏只有百分之一上下，這個幅度會把它整個蓋掉 —— 節律讀不到多半是這個原因。';
    return;
  }
  note.dataset.tone = 'neutral';
  note.textContent = `亮度穩定（慢速擺動 ${drift}）· ${fps} fps。`;
}

/**
 * Pulse Lock。
 *
 * 🔴 它只宣稱一件事：「如果現在結束，這次擷取會產出讀數。」不是結果 ——
 * 所以**不上 gold**（gold = SECURED），也沒有任何動效。而且不黏著：手指一滑
 * 就掉，否則就是把過去的事講成現在。
 */
function renderLock() {
  const el = $('lock');
  const stage = $('stage');
  stage.dataset.locked = state.lock.locked ? 'yes' : 'no';

  if (state.lock.locked) {
    el.textContent = '訊號穩住了 —— 現在結束也會有讀數。';
    return;
  }
  el.textContent =
    state.lock.consecutive > 0
      ? `訊號開始穩定（${state.lock.consecutive}/${LOCK_CONSECUTIVE_WINDOWS}）。`
      : '還在等訊號穩定。下面列出可以調整的地方。';
}

/**
 * 四維儀表。值全部來自引擎算出來的 component。
 *
 * 🔴 這裡沒有任何「看起來在動」的東西 —— 沒有脈動、沒有 keyframes。訊號被
 * 拒答時畫面若還在律動，那是在演一個沒有發生的量測（brief §7）。
 */
function renderDims(host, signal) {
  if (host.childElementCount === 0) {
    for (const dim of DIMENSIONS) {
      const row = document.createElement('div');
      row.className = 'dim';
      row.dataset.key = dim.key;
      row.innerHTML =
        `<span class="dimLabel"></span><span class="dimValue"></span>` +
        `<span class="dimTrack"><span class="dimFill"></span></span>`;
      row.querySelector('.dimLabel').textContent = dim.label;
      row.title = dim.hint;
      host.appendChild(row);
    }
  }

  for (const dim of DIMENSIONS) {
    const row = host.querySelector(`.dim[data-key="${dim.key}"]`);

    // 🔴 `null` 是「還沒量到」，不是 0。0 會讀成「你的節律很差」，而真相是
    // 窗口還不夠長到能找一個週期。空軌道 ＋「累積中」，不給數字。
    if (signal[dim.key] === null) {
      row.dataset.low = 'no';
      row.dataset.pending = 'yes';
      row.querySelector('.dimValue').textContent = '累積中';
      row.querySelector('.dimFill').style.width = '0%';
      continue;
    }

    const goodness = dimensionGoodness(signal, dim.key);
    row.dataset.pending = 'no';
    row.dataset.low = goodness < DIM_LOW ? 'yes' : 'no';
    row.querySelector('.dimValue').textContent = `${Math.round(goodness * 100)}%`;
    row.querySelector('.dimFill').style.width = `${Math.round(goodness * 100)}%`;
  }
}

function renderReasons(host, reasons) {
  host.innerHTML = '';
  for (const reason of reasons) {
    const copy = REASON_COPY[reason];
    if (!copy) continue;
    const li = document.createElement('li');
    li.className = `reason ${copy.tone}`;
    li.textContent = copy.text;
    host.appendChild(li);
  }
}

// ── result ──────────────────────────────────────────────────────────────────

function finish() {
  state.running = false;
  cancelAnimationFrame(state.raf);
  stopCamera();
  renderOutcome(analyzePpgScan(state.frames, MODE, captureOptions()));
}

function renderOutcome(outcome) {
  $('stage').dataset.phase = 'result';

  if (outcome.status !== 'analysed') {
    $('stage').dataset.secured = 'no';
    $('verdict').textContent = '這次無法分析';
    $('verdictNote').textContent =
      outcome.reason === 'too_few_frames'
        ? '取到的幀數太少。'
        : '相機時戳不可用。';
    // ⚠️ 連完全跑不動的擷取也要記。第 6 條問的是「lock 出現但最終沒有讀數」，
    // 而那正是這條路徑。
    renderValidationReport(recordValidationCapture(validationEntry(null)));
    return;
  }

  const a = outcome.analysis;
  const input = toEngineInput(a, Date.now());

  // 🔴 gold = SECURED（docs/VISUAL-DIRECTION.md §3）。**沒有讀數不准上 gold。**
  // 這一行原本漏掉，CSS 裡的 `[data-secured="yes"]` 因此永遠不生效 ——
  // 也就是那條紅線的守門從寫下去的那一刻就是壞的，是 harness 抓到的。
  $('stage').dataset.secured = a.heartRateBpm === null ? 'no' : 'yes';

  $('verdict').textContent = a.heartRateBpm === null ? '沒有立住讀數' : '校準完成';
  $('qualityScore').textContent = String(a.quality.score);
  $('confidence').textContent = a.quality.confidence.toFixed(2);
  $('duration').textContent = `${a.durationSec}s`;

  const signal = toSignalQuality(a);

  renderAnchor(a.heartRateBpm);
  renderSegmentNote(a);
  renderDims($('resultDims'), signal);
  renderReasons($('resultReasons'), a.quality.reasons);
  renderWithheld(a.withheld);

  renderAdvisories(signal.advisories);
  const anchors = renderStage(a);
  renderPrv(a, anchors);
  renderValidationReport(recordValidationCapture(validationEntry(a)));

  const channelNote = a.channelDiagnostics
    .map((d) => `${d.channel === 'red' ? '紅' : '綠'} 節律 ${d.periodicity}／亮度 ${d.dcMean}`)
    .join('，');
  $('channelNote').textContent =
    `這次讀的是${a.channel === 'red' ? '紅' : '綠'}通道（${channelNote}）。` +
    '通道是量出來的 —— 補光燈會把紅通道打飽和，那時脈搏在綠通道裡。';

  $('frameNote').textContent =
    `${signal.usableFrameCount} / ${signal.totalFrameCount} 幀通過接觸、曝光與晃動的逐幀門檻，` +
    `分析了 ${(signal.captureDurationMs / 1000).toFixed(1)} 秒。`;

  // 🔴 每一個被接受的讀數都要標明它是怎麼來的（PULSE ANCHOR brief §8），
  // 而且要把相機**做不到**的事講在同一句裡 —— 否則使用者會自己補上
  // 「那應該也量了呼吸吧」。
  $('derivation').textContent =
    a.heartRateBpm === null
      ? '這次沒有立住脈搏參考值。'
      : `相機指尖 PPG · 品質 ${a.quality.score}/100。相機不報呼吸率 —— 那需要另一套擷取流程（Breath Lock）。`;

  // 🔴 availability 是契約講給引擎聽的那一面。相機**永遠**不得回報 hrv：
  // 它量到的是脈搏節律（相機推導的靜息脈搏變化，PRV），那跟胸帶的
  // RR-derived HRV 是兩個量。
  // 這一行是自我檢查 —— 真的擋在 `to-reading.ts`，那裡寫死 false。
  if (input.availability.hrv === true) {
    throw new Error('相機掃描不得回報 hrv availability');
  }

  $('verdictNote').textContent =
    a.heartRateBpm === null
      ? '訊號不足以立住心率。下方列出可以改的地方。'
      : `以 ${a.beatCount} 拍為依據。`;
}

/**
 * 把這次校準記成一個 anchor（如果它真的立住了），然後說現在算到哪一階。
 *
 * 🔴 階段的判斷整個在引擎裡（`resolvePulseBaselineProgress`）—— 頁面不重算
 * 門檻。同一天做五次描述的是同一個早上，這件事必須只有一個地方說得出來。
 */
function renderStage(analysis) {
  const at = Date.now();
  const anchor = buildPulseAnchor(analysis, {
    capturedAtMs: at,
    localDateKey: localDateKey(at),
    context: captureContext(at),
  });

  const anchors = loadAnchors();
  if (anchor !== null) {
    anchors.push(anchor);
    saveAnchors(anchors);
  }

  const progress = resolvePulseBaselineProgress(anchors);
  const copy = STAGE_COPY[progress.stage];
  $('stageTerm').textContent = copy.term;
  $('stageName').textContent = copy.name;

  const parts = [`已有 ${progress.anchorCount} 次有效校準，分布在 ${progress.dateCount} 天。`];
  if (progress.nextStage !== null) {
    const need = [];
    if (progress.anchorsNeeded > 0) need.push(`再 ${progress.anchorsNeeded} 次`);
    if (progress.datesNeeded > 0) need.push(`再跨 ${progress.datesNeeded} 天`);
    parts.push(
      need.length > 0
        ? `${need.join('、')}就會進到「${STAGE_COPY[progress.nextStage].name}」。`
        : `已經達到「${STAGE_COPY[progress.nextStage].name}」的條件。`,
    );
  } else {
    parts.push('這是目前最完整的一階。');
  }
  if (anchor === null) {
    parts.push('這一次沒有立住，不計入。');
  }
  $('stageNote').textContent = parts.join('');

  // 🔴 區間要到夠多次、跨夠多天才給。兩三點畫出來的範圍不是保守估計，
  // 是另一個更窄的宣稱 —— 而且會錯在自信的那一邊。
  const band = resolveRestingBand(anchors);
  const show = band !== null;
  $('bandRow').hidden = !show;
  $('bandNote').hidden = !show;
  if (show) {
    $('band').textContent = `${band.lowBpm}–${band.highBpm} bpm`;
    $('bandNote').textContent =
      `中位數 ${band.medianBpm} bpm，以 ${band.anchorCount} 次校準的四分位為界（不是最小值到最大值 —— 一次手冰的早上不該把你的區間永久撐開）。`;
  }

  return anchors;
}

/**
 * 不是錯、但值得說的事。⚠️ 這一區永遠不會讓一個被接受的讀數變得比較不算數
 * —— 沒有補光燈是裝置的事實，不是這次擷取的過錯。
 */
function renderAdvisories(advisories) {
  const host = $('advisories');
  host.innerHTML = '';
  host.hidden = advisories.length === 0;
  for (const reason of advisories) {
    const li = document.createElement('li');
    li.className = 'reason advisory';
    li.textContent = ADVISORY_COPY[reason] ?? reason;
    host.appendChild(li);
  }
}

/**
 * 脈搏節律 —— 相機推導的靜息脈搏變化（PRV）。
 *
 * 🔴 **不是心律變異**，而且**不進 Edge Score**（founder 2026-09-11）。
 * 相機是從光的波形推回拍點時間，胸帶是直接量拍與拍之間；兩者誤差行為不一樣：
 * 乾淨擷取 PRV 就已經低報 7–9%，而在品質分數 99 的擷取上它可以錯 156%
 * （感光雜訊不扣品質分，卻會把每個峰值推開）。所以它只在拍形穩定度過關時
 * 才出現 —— 過不了就**整項消失**，不是降級成一個誤導人的數字。
 *
 * 🔴 它只出現在證據層（展開的「量測細節與證據」），不是頭條讀數。
 * 🔴 個人比較要等到有足夠多**可比較的高品質**靜息錨點才給。
 */
function renderPrv(a, anchors) {
  const row = $('prvRow');
  const note = $('prvNote');
  const compare = $('prvCompare');
  const rule = $('prvRule');
  const shown = a.prvRmssdMs !== null;

  row.hidden = !shown;
  note.hidden = !shown;
  rule.hidden = !shown;
  if (!shown) {
    // 清掉上一次的值。隱藏的節點留著舊數字，下一次一顯示就是別人的讀數。
    $('prv').textContent = '—';
    note.textContent = '';
    compare.textContent = '';
    compare.hidden = true;
    return;
  }

  $('prv').textContent = `${a.prvRmssdMs} ms`;
  note.textContent =
    `相機推導的靜息脈搏變化，拍形穩定度 ${a.beatTemplateCorrelation}。` +
    '這不是心律變異 —— 手錶或胸帶的數字跟它不能直接比。它不進你的分數。';

  const comparison = resolvePrvComparison(anchors, a.prvRmssdMs);
  compare.hidden = false;
  compare.textContent =
    comparison.status === 'established'
      ? `跟你過去 ${comparison.sampleCount} 次可比較的高品質校準相比：${PLACEMENT_COPY[comparison.placement]}。`
      : `還在累積可比較的紀錄（${comparison.sampleCount}/${comparison.required} 次），還不能跟你自己比。`;
}

/**
 * 這個讀數是不是從相機沒有打擾的那幾段裡拼出來的。
 *
 * 🔴 出現的時候畫面必須說出**用了幾秒**。旁邊的「實際時長」寫的是 60 秒，
 * 那是擷取的長度、是真的；但讀數只用了其中一部分，兩個數字並排而不解釋，
 * 等於讓畫面宣稱一個它沒有的東西。
 *
 * ⚠️ 不上警示色：這不是錯誤，是一個成功但證據比較薄的讀數。
 *
 * @param {object} a - 這次擷取的分析結果。
 */
function renderSegmentNote(a) {
  const note = $('segmentNote');
  const seg = a.rateFromQuietSegments;
  if (!seg) {
    note.hidden = true;
    note.textContent = '';
    return;
  }
  note.hidden = false;
  note.dataset.tone = 'neutral';
  note.textContent =
    `相機在這 ${a.durationSec} 秒裡一直重調亮度，所以這個脈搏是從中間 ${seg.periodicCount} 段` +
    `沒有被打擾的時間讀出來的（合計 ${seg.analysedSec} 秒，彼此相差 ${seg.spreadBpm} bpm）。` +
    '這次不報脈搏節律 —— 被切掉的地方兩邊的拍不是相鄰的。';
}

function renderAnchor(bpm) {
  const el = $('hr');
  if (bpm === null) {
    el.textContent = '—';
    el.classList.add('absent');
    return;
  }
  el.classList.remove('absent');
  el.textContent = `${bpm} bpm`;
}

function renderWithheld(withheld) {
  const host = $('withheld');
  const head = $('withheldHead');
  host.innerHTML = '';

  // 相機從來就不報呼吸率 —— 那是常態，不是這次的失誤。把它列進
  // 「這次沒有報的」會讓每一次成功的校準都看起來少了兩項；那句限制在上面的
  // derivation 講過一次就夠。這裡只留**這次**沒立住的東西。
  let thisScan = withheld.filter((entry) => entry.reason !== 'mode_excludes_metric');

  // ⚠️ 沒有脈搏時，從拍點推出來的東西當然也沒有。列三項失敗會讓使用者以為
  // 壞了三件事 —— 壞的是同一件。只留根本原因。
  if (thisScan.some((entry) => entry.metric === 'heart_rate')) {
    thisScan = thisScan.filter((entry) => entry.metric === 'heart_rate');
  }

  // 「這次沒有報的」底下寫「都讀到了」是自相矛盾的 —— 沒有東西可列時，
  // 整塊換成一句陳述，不要留一個空標題配一句反話。（自己截圖看出來的）
  if (thisScan.length === 0) {
    // 沒有東西可列時整塊收起來 —— 上面的判語已經說了校準完成，在品質清單
    // 底下再補一句「脈搏立住了」只是重複，而且看起來像個沒填完的欄位。
    head.hidden = true;
    return;
  }
  head.hidden = false;
  head.textContent = '這次沒有報的';
  const names = { heart_rate: '脈搏', prv: '脈搏節律', respiration: '呼吸率' };
  for (const entry of thisScan) {
    const li = document.createElement('li');
    li.className = 'reason withheld';
    li.textContent = `${names[entry.metric] ?? entry.metric}：${WITHHELD_COPY[entry.reason] ?? entry.reason}`;
    host.appendChild(li);
  }
}

// ── wiring ──────────────────────────────────────────────────────────────────

/**
 * 按下「開始校準」之後做的事 —— 注意**不是**開始擷取。
 *
 * 🔴 相機開起來，進就位閘，90 秒的鐘還沒動。實機第一次是按下去就起跑，
 * 於是兩次擷取都在手指還沒擺好的情況下跑滿 90 秒（`docs/PHONE-PPG.md` §12
 * 第 19 條）。
 */
async function begin() {
  const video = $('cam');
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  $('stage').dataset.phase = 'ready';
  $('startError').textContent = '';

  try {
    await startCamera();
  } catch (err) {
    $('stage').dataset.phase = 'intro';
    $('startError').textContent =
      err && err.name === 'NotAllowedError'
        ? '沒有相機權限就無法校準。可以到瀏覽器設定開啟後再試。'
        : `相機無法啟動：${err && err.name ? err.name : '未知錯誤'}`;
    return;
  }

  state.gate = INITIAL_READINESS;
  state.gateFrames = [];
  state.lastSample = null;
  state.gateStartedAt = performance.now();
  state.gateRunning = true;
  $('skipGate').hidden = true;
  renderGate();
  gateTick(video, ctx);
}

/**
 * 鎖住相機的曝光 / 白平衡 / 對焦。
 *
 * 🔴 為什麼是在**擷取開始的那一刻**鎖，而不是開相機的時候：鎖 `manual` 是把
 * 當下那個曝光值凍住。開相機時鏡頭上還沒有東西，凍住的會是一個對著空氣算出
 * 來的曝光。就位閘保證了手指此刻已經在鏡頭上、而且 AE 已經對著它收斂 ——
 * 這是那道閘意外的第二個用處。
 *
 * ⚠️ Best-effort，而且**失敗不擋擷取**：Safari 幾乎不支援這些約束。
 * 成敗記進驗收紀錄，因為「瀏覽器收了約束」跟「亮度真的不動了」是兩個問題
 * （`exposure-stability.ts`）。
 */
async function lockExposure() {
  state.exposureLock = null;
  if (state.stream === null) return;
  const track = state.stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function') return;

  let caps = {};
  try {
    caps = track.getCapabilities() ?? {};
  } catch (_) {
    return;
  }

  const wanted = {};
  for (const mode of ['exposureMode', 'whiteBalanceMode', 'focusMode']) {
    if (Array.isArray(caps[mode]) && caps[mode].includes('manual')) wanted[mode] = 'manual';
  }
  const requested = Object.keys(wanted);
  if (requested.length === 0) return;

  let applied = false;
  try {
    await track.applyConstraints({ advanced: [wanted] });
    applied = true;
  } catch (_) {
    applied = false;
  }
  state.exposureLock = { requested, applied };
}

/**
 * 擷取真正開始的地方。時鐘從這裡才走。
 *
 * ⚠️ `state.frames` 從空的開始 —— 就位期間的幀**不算**擷取的一部分。
 */
function startCapture(video, ctx) {
  state.gateRunning = false;
  cancelAnimationFrame(state.raf);

  // ⚠️ 不 await：鎖曝光是 best-effort，不該讓時鐘等它。前幾百毫秒的幀
  // 可能還是 auto 的，而 90 秒的擷取不在乎那幾幀。
  lockExposure().catch(() => {});

  $('stage').dataset.phase = 'scanning';
  state.frames = [];
  state.lastSample = null;
  state.lock = INITIAL_PULSE_LOCK;
  state.lockEverAchieved = false;
  state.timeline = INITIAL_TIMELINE;
  state.precisionOptIn = false;
  state.lastCandidateAtSec = 0;
  renderLock();
  renderTimeline();
  renderProgress(0);
  state.startedAt = performance.now();
  state.running = true;
  tick(video, ctx);
}

function abort() {
  state.running = false;
  state.gateRunning = false;
  cancelAnimationFrame(state.raf);
  stopCamera();
  $('stage').dataset.phase = 'intro';
}

$('startBtn').addEventListener('click', () => {
  begin().catch(() => {});
});
$('abortBtn').addEventListener('click', abort);
// 🔴 離開不罰：已經收下的 anchor 就是結果，直接結束擷取並呈現它。
$('viewStateBtn').addEventListener('click', () => finish());
// 🔴 60–90 秒**永遠不自動**（rule 7）。要使用者自己按。
$('precisionBtn').addEventListener('click', () => {
  state.precisionOptIn = true;
  $('precisionBtn').hidden = true;
  if (!state.running) {
    state.running = true;
    const video = $('cam');
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    tick(video, canvas.getContext('2d', { willReadFrequently: true }));
  }
});
$('cancelGate').addEventListener('click', abort);

// 補光燈切換。⚠️ 只在就位階段可按 —— 擷取途中改光源等於把兩種條件混進
// 同一筆資料，那筆就兩邊都不算。
$('torchToggle').addEventListener('click', async () => {
  await setTorch(!state.torchOn);
  renderTorchControl();
});
// 🔴 逃生口。按了照樣走完整的 90 秒與同一套閘門 —— 它放寬的是「什麼時候可以
// 開始」，不是「什麼算得上一次讀數」。
$('skipGate').addEventListener('click', () => {
  const video = $('cam');
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  startCapture(video, canvas.getContext('2d', { willReadFrequently: true }));
});
$('againBtn').addEventListener('click', () => {
  $('stage').dataset.phase = 'intro';
});

$('minSec').textContent = String(MIN_SEC);
$('targetSec').textContent = String(TARGET_SEC);

for (const button of document.querySelectorAll('.scenario')) {
  button.addEventListener('click', () => {
    state.scenario = button.dataset.scenario;
    for (const other of document.querySelectorAll('.scenario')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
  });
}

$('copyReport').addEventListener('click', async () => {
  const text = $('validationReport').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('copyState').textContent = '已複製。貼回對話就能看結果。';
  } catch (_) {
    // 🔴 iOS 的剪貼簿在非使用者手勢或非安全情境下會擋。失敗就照實說，
    // 不要假裝複製成功 —— 使用者會貼出一片空白然後以為是我們的報告壞了。
    $('copyState').textContent = '這個瀏覽器擋住了複製。長按上面的報告手動選取。';
  }
});

renderValidationReport(loadValidationLog());

window.addEventListener('pagehide', stopCamera);

/**
 * Harness seam — `scripts/preview-finger.mjs` only.
 *
 * Feeds frames straight into the real pipeline and renders the real result, so
 * the harness asserts against what the engine actually produced rather than
 * values a test typed into the DOM. ⚠️ Nothing in the product calls this, and
 * no synthetic frames ship with the page: the generator lives in
 * `packages/engine/src/biometric/ppg/replay.ts` and is deliberately excluded
 * from the browser bundle (see scripts/build-preview-ppg.mjs).
 */
window.__tenkiFingerHarness = {
  /**
   * 假裝相機回報了（或沒回報）補光燈能力，然後跑真的那個 render。
   *
   * ⚠️ 這個接縫是必要的：`renderTorchControl` 只在 `setupCamera()` 之後跑，
   * 而 harness 沒有相機，所以那一整條分支本來 harness 走不到 —— 而它正是
   * 「這台不支援」跟「忘記開」要分得出來的地方。
   *
   * @param {boolean} available - 相機有沒有 torch 能力。
   * @param {boolean} on - 現在亮不亮。
   */
  setTorchCapability(available, on) {
    state.torchAvailable = available;
    state.torchOn = available && on;
    renderTorchControl();
  },
  renderFrames(frames) {
    state.frames = frames;
    renderOutcome(analyzePpgScan(frames, MODE, captureOptions()));
  },
  /**
   * 掃描**進行中**的那一幀。這個接縫是必要的，不是方便：
   * 掃描階段以前完全沒有 harness 走過，而那個盲區剛好藏住了一個真的 bug
   * （即時層拿整段掃描的時長門檻去評一個 20 秒窗口，於是每次即時回饋都會
   * 說「時間不足」）。
   */
  renderLiveFrames(frames) {
    $('stage').dataset.phase = 'scanning';
    state.frames = frames;
    // 照真的 loop 做的事：進度也更新。少了這一步，harness 看到的掃描畫面
    // 永遠停在 0s，而那正好會漏掉進度環自己的問題。
    renderProgress(
      frames.length === 0
        ? 0
        : (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000,
    );
    renderLive();
  },
  resetLock() {
    state.lock = INITIAL_PULSE_LOCK;
    renderLock();
  },
  resetValidationLog() {
    try {
      localStorage.removeItem(VALIDATION_KEY);
    } catch (_) { /* ignore */ }
    renderValidationReport([]);
  },
  setScenario(scenario) {
    state.scenario = scenario;
  },
  setLockAchieved(value) {
    state.lockEverAchieved = value;
  },
  resetAnchors() {
    try {
      localStorage.removeItem(ANCHOR_KEY);
    } catch (_) { /* ignore */ }
  },
  anchorCount() {
    return loadAnchors().length;
  },
  /**
   * 就位閘。
   *
   * 🔴 這個接縫跟 `renderLiveFrames` 是同一個理由：掃描以前沒有 harness 走過
   * 的那一段藏過一個真的 bug。就位閘整段都在掃描以前。
   */
  resetGate() {
    state.gate = INITIAL_READINESS;
    state.gateFrames = [];
    state.lensView = null;
    state.coverMap = null;
    state.cellRing = [];
    $('stage').dataset.phase = 'ready';
    $('skipGate').hidden = true;
    renderGate();
  },
  /** 餵一個窗口。走的是真的 `assessCaptureReadiness` 與真的 `renderGate`。 */
  renderGateWindow(frames) {
    state.gateFrames = frames;
    state.gate = assessCaptureReadiness(frames, state.gate.held);
    renderGate();
    return {
      stage: state.gate.stage,
      ready: state.gate.ready,
      blocker: state.gate.blocker,
      advisories: state.gate.advisories,
      held: state.gate.held,
      lensState: state.lensView === null ? null : state.lensView.lensState,
      instruction: state.lensView === null ? null : state.lensView.instruction,
      evidence: state.lensView === null ? null : state.lensView.evidence,
    };
  },
  readinessWindowSec() {
    return READINESS_WINDOW_SEC;
  },
  /**
   * 覆蓋地圖：餵**真的像素**進真的取樣器。
   *
   * 🔴 這是唯一能驗到像素 → 格子索引換算的路徑。合成器給的是已經化簡完的
   * `PpgFrame`，永遠走不到那段 code。
   *
   * @param bare - 要留白（沒被指腹蓋住）的矩形，單位是取樣畫布的像素。
   */
  renderSampledCells(bare) {
    const size = window.__tenkiFingerHarness.sampleSize();
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const isBare =
          bare !== null &&
          x >= bare.x && x < bare.x + bare.w && y >= bare.y && y < bare.y + bare.h;
        // 蓋住 = 紅遠高於綠藍（取樣器的判準）。留白 = 灰，三通道一樣。
        data[i] = isBare ? 90 : 200;
        data[i + 1] = 90;
        data[i + 2] = 90;
        data[i + 3] = 255;
      }
    }
    const sample = reduceRoi(data, 0);
    state.cellRing = [{ cells: sample.cells, clipping: sample.clipping }];
    renderCoverageMap();
    return { frameCoverage: sample.frame.coverage, map: state.coverMap };
  },
  /** 同上，但整個 ROI 都被打到感光上限 —— 驗 amber 只出現在該出現的地方。 */
  renderSaturatedCells(bareRect) {
    const size = window.__tenkiFingerHarness.sampleSize();
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const isBare =
          bareRect !== null &&
          x >= bareRect.x && x < bareRect.x + bareRect.w &&
          y >= bareRect.y && y < bareRect.y + bareRect.h;
        // 蓋住且過曝 = 紅打到 255；留白 = 灰。
        data[i] = isBare ? 90 : 255;
        data[i + 1] = 90;
        data[i + 2] = 90;
        data[i + 3] = 255;
      }
    }
    const sample = reduceRoi(data, 0);
    state.cellRing = [{ cells: sample.cells, clipping: sample.clipping }];
    renderCoverageMap();
    return { map: state.coverMap };
  },
  sampleSize() {
    return SAMPLE_SIZE;
  },
  coverageGrid() {
    return COVERAGE_MAP_GRID;
  },
  /** 色階本身。harness 要能密集掃過整個 0..1，不能只靠畫面上剛好出現的值。 */
  lensRampAt(t) {
    return sampleLensRamp(t);
  },
  /**
   * 走真的時間軸路徑：設定幀、推進到指定秒數、重畫橫幅。
   * 回傳畫面上看得到的東西，不是內部 state。
   */
  advanceTimelineAt(frames, elapsedSec) {
    state.frames = frames;
    state.lastCandidateAtSec = 0;
    const keepsCapturing = advanceTimeline(elapsedSec);
    const banner = document.getElementById('anchorBanner');
    return {
      phase: state.timeline.phase,
      anchorBpm: state.timeline.anchor === null ? null : state.timeline.anchor.heartRateBpm,
      refinementIncomplete: state.timeline.refinementIncomplete,
      bannerShown: !banner.hidden,
      bannerText: banner.textContent.replace(/\s+/g, ' ').trim(),
      viewStateShown: !document.getElementById('viewStateBtn').hidden,
      precisionShown: !document.getElementById('precisionBtn').hidden,
      // 回傳的是 `advanceTimeline` **自己算出來的**那一個，不是再算一次 ——
      // 再算一次就變成測試另一個副本，而不是測擷取迴圈真正遵守的那個。
      keepsCapturing,
    };
  },
  resetTimeline() {
    state.timeline = INITIAL_TIMELINE;
    state.precisionOptIn = false;
    state.lastCandidateAtSec = 0;
    renderTimeline();
  },
  /** 把光場清空，讓「有沒有重畫」問得出來。 */
  clearLens() {
    state.cellRing = [];
    state.coverMap = null;
    for (const cell of document.querySelectorAll('#lensGrid .lensCell')) {
      cell.style.backgroundColor = '';
      cell.style.setProperty('--t', '0');
      cell.dataset.adjust = 'no';
    }
  },
  /**
   * 走**真的**逐幀路徑（取樣器 → ring → 重畫），在指定 phase 下。
   * 合成的 `PpgFrame` 沒有像素，所以這是唯一驗得到擷取中光場的接縫。
   */
  feedLensFrame(bare) {
    const size = window.__tenkiFingerHarness.sampleSize();
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const isBare =
          bare !== null &&
          x >= bare.x && x < bare.x + bare.w && y >= bare.y && y < bare.y + bare.h;
        data[i] = isBare ? 90 : 200;
        data[i + 1] = 90;
        data[i + 2] = 90;
        data[i + 3] = 255;
      }
    }
    updateLensFromSample(reduceRoi(data, 0));
  },
  exposureNote() {
    const note = document.getElementById('exposureNote');
    return { text: note.textContent.trim(), tone: note.dataset.tone };
  },
  qualityCentre() {
    const el = document.getElementById('liveQuality');
    return { text: el.textContent.trim(), pending: el.dataset.pending };
  },
  /** 把閘的 blocker 設成指定值再重畫，用來驗教練句吃地圖。 */
  renderGateWithBlocker(blocker) {
    state.gate = { ...state.gate, blocker, ready: false, stage: 'cover', held: 0 };
    renderGate();
    return document.getElementById('coach').textContent.trim();
  },
  readinessHoldWindows() {
    return READINESS_HOLD_WINDOWS;
  },
};
