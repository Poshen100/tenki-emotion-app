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
  createEmptyNoiseFloor,
  recordRepeatability,
  resolveNoiseFloor,
} from './engine/baseline/noise-floor.js';

const MODE = 'full_scan';
const TARGET_SEC = SCAN_MODE_CONFIGS[MODE].targetDurationSec;
const MIN_SEC = SCAN_MODE_CONFIGS[MODE].minDurationSec;

/** ROI 邊長佔畫面較短邊的比例。中央一小塊就夠，取樣成本也低。 */
const ROI_FRACTION = 0.35;
/** 取樣畫布邊長。夠算平均值，不浪費每幀的時間。 */
const SAMPLE_SIZE = 64;

/** 使用者能照著改的字。鍵是 engine 回傳的 reason。 */
const REASON_COPY = {
  stable_signal: { tone: 'good', text: '訊號穩定' },
  low_motion: { tone: 'good', text: '手很穩' },
  strong_pulse: { tone: 'good', text: '脈搏清楚' },
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

/** 指標被扣住的理由，直接用 engine 的 withheld reason。 */
const WITHHELD_COPY = {
  mode_excludes_metric: '這個模式不報這一項',
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

const NOISE_FLOOR_KEY = 'tenki.preview.fingerNoiseFloor';

const state = {
  stream: null,
  frames: [],
  startedAt: 0,
  raf: 0,
  running: false,
  lastSample: null,
  torchAvailable: false,
};

const $ = (id) => document.getElementById(id);

function loadNoiseFloor() {
  try {
    const raw = localStorage.getItem(NOISE_FLOOR_KEY);
    if (!raw) return createEmptyNoiseFloor();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.samples) ? { samples: parsed.samples } : createEmptyNoiseFloor();
  } catch (_) {
    return createEmptyNoiseFloor();
  }
}

function saveNoiseFloor(next) {
  try {
    localStorage.setItem(NOISE_FLOOR_KEY, JSON.stringify(next));
  } catch (_) {
    /* private mode — the floor just does not persist */
  }
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
  if (state.torchAvailable) {
    try {
      await track.applyConstraints({ advanced: [{ torch: true }] });
    } catch (_) {
      state.torchAvailable = false;
    }
  }
  $('torchNote').textContent = state.torchAvailable
    ? '已開啟補光燈。'
    : '這個瀏覽器不支援補光燈（iOS Safari 都不支援）。訊號會比原生 App 弱 —— 品質門檻不會因此放寬，讀不到就是讀不到。';
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

  let red = 0;
  let green = 0;
  let blue = 0;
  let clipped = 0;
  let covered = 0;
  const pixels = SAMPLE_SIZE * SAMPLE_SIZE;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    red += r;
    green += g;
    blue += b;
    if (r >= 254 || r <= 1) clipped++;
    // 手指貼在鏡頭上時紅通道遠高於其他兩個 —— 這就是「有沒有蓋住」的判準，
    // 不是猜的：血液吸收綠光遠多於紅光。
    if (r > g * 1.35 && r > b * 1.35) covered++;
  }

  const motion =
    state.lastSample === null
      ? 0
      : Math.min(1, Math.abs(red / pixels - state.lastSample) / 8);
  state.lastSample = red / pixels;

  return {
    timestampMs,
    red: red / pixels,
    green: green / pixels,
    blue: blue / pixels,
    clippedFraction: clipped / pixels,
    coverage: covered / pixels,
    motion,
  };
}

// ── loop ────────────────────────────────────────────────────────────────────

function tick(video, ctx) {
  if (!state.running) return;

  const now = performance.now();
  const frame = sampleFrame(video, ctx, now);
  if (frame !== null) state.frames.push(frame);

  const elapsed = (now - state.startedAt) / 1000;
  renderProgress(elapsed);

  // 每兩秒用累積到現在的幀跑一次真的 pipeline，給即時品質回饋。
  if (state.frames.length % 60 === 0 && elapsed >= 6) {
    renderLive();
  }

  if (elapsed >= TARGET_SEC) {
    finish();
    return;
  }
  state.raf = requestAnimationFrame(() => tick(video, ctx));
}

function renderProgress(elapsed) {
  const pct = Math.min(100, (elapsed / TARGET_SEC) * 100);
  $('arc').style.setProperty('--p', String(pct));
  $('elapsed').textContent = `${Math.floor(elapsed)}s / ${TARGET_SEC}s`;
}

/** 掃描進行中的即時回饋：只講品質，不報數值。 */
function renderLive() {
  const outcome = analyzePpgScan(state.frames, MODE);
  if (outcome.status !== 'analysed') return;

  const q = outcome.analysis.quality;
  $('liveQuality').textContent = String(q.score);
  renderReasons($('liveReasons'), q.reasons);
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
  renderOutcome(analyzePpgScan(state.frames, MODE));
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

  renderMetric('hr', a.heartRateBpm, 'bpm');
  renderMetric('hrv', a.hrvRmssdMs, 'ms');
  renderMetric('resp', a.respiratoryRateBrpm, 'brpm');
  renderReasons($('resultReasons'), a.quality.reasons);
  renderWithheld(a.withheld);
  renderNoiseFloor(a.repeatabilitySdMs);

  // 🔴 相機產生的東西一律是 estimated —— 契約逼你標記，畫面就照著講。
  $('derivation').textContent =
    input.availability.hrv === true
      ? '心律變異為相機估計值，與手錶／胸帶的數字不可直接比較。'
      : '這次沒有心律變異讀數。';

  $('verdictNote').textContent =
    a.heartRateBpm === null
      ? '訊號不足以立住心率。下方列出可以改的地方。'
      : `以 ${a.beatCount} 拍為依據。`;
}

function renderMetric(id, value, unit) {
  const el = $(id);
  if (value === null) {
    el.textContent = '—';
    el.classList.add('absent');
    return;
  }
  el.classList.remove('absent');
  el.textContent = `${value} ${unit}`;
}

function renderWithheld(withheld) {
  const host = $('withheld');
  const head = $('withheldHead');
  host.innerHTML = '';

  // 「這次沒有報的」底下寫「三項都讀到了」是自相矛盾的 —— 沒有東西可列時，
  // 整塊換成一句陳述，不要留一個空標題配一句反話。（自己截圖看出來的）
  if (withheld.length === 0) {
    head.textContent = '三項都讀到了';
    return;
  }
  head.textContent = '這次沒有報的';
  const names = { heart_rate: '心率', hrv: '心律變異', respiration: '呼吸率' };
  for (const entry of withheld) {
    const li = document.createElement('li');
    li.className = 'reason withheld';
    li.textContent = `${names[entry.metric] ?? entry.metric}：${WITHHELD_COPY[entry.reason] ?? entry.reason}`;
    host.appendChild(li);
  }
}

/**
 * 重複性與雜訊底線。
 *
 * 這是整頁最重要的一塊：系統在講**它量自己有多準**。
 * 底線未確立時照實說「還在累積」，不給一個假裝已經知道的數字。
 */
function renderNoiseFloor(repeatabilitySdMs) {
  const next = recordRepeatability(loadNoiseFloor(), repeatabilitySdMs);
  saveNoiseFloor(next);

  const floor = resolveNoiseFloor(next);
  $('scanCount').textContent = String(next.samples.length);

  if (repeatabilitySdMs === null) {
    $('repeatability').textContent = '—';
    $('repeatabilityNote').textContent = '這次沒有心律變異讀數，不列入重複性。';
  } else {
    $('repeatability').textContent = `±${repeatabilitySdMs} ms`;
    $('repeatabilityNote').textContent =
      '這次掃描內部，前後段讀數的差距。比底線大就是這次量得比平常吃力。';
  }

  if (floor === null) {
    $('noiseFloor').textContent = '累積中';
    $('noiseFloorNote').textContent =
      `再做 ${Math.max(0, 3 - next.samples.length)} 次有效校準就能定出你的雜訊底線。`;
  } else {
    $('noiseFloor').textContent = `±${floor.toFixed(1)} ms`;
    $('noiseFloorNote').textContent =
      '小於這個幅度的變化，不會被當成狀態改變 —— 那是量測誤差，不是你。';
  }
}

// ── wiring ──────────────────────────────────────────────────────────────────

async function begin() {
  const video = $('cam');
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  $('stage').dataset.phase = 'scanning';
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

  state.frames = [];
  state.lastSample = null;
  state.startedAt = performance.now();
  state.running = true;
  tick(video, ctx);
}

function abort() {
  state.running = false;
  cancelAnimationFrame(state.raf);
  stopCamera();
  $('stage').dataset.phase = 'intro';
}

$('startBtn').addEventListener('click', () => {
  begin().catch(() => {});
});
$('abortBtn').addEventListener('click', abort);
$('againBtn').addEventListener('click', () => {
  $('stage').dataset.phase = 'intro';
});

$('minSec').textContent = String(MIN_SEC);
$('targetSec').textContent = String(TARGET_SEC);

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
  renderFrames(frames) {
    state.frames = frames;
    renderOutcome(analyzePpgScan(frames, MODE));
  },
  resetNoiseFloor() {
    try {
      localStorage.removeItem(NOISE_FLOOR_KEY);
    } catch (_) { /* ignore */ }
  },
};
