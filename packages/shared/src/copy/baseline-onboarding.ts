/**
 * @module shared/copy/baseline-onboarding
 * @description All user-facing copy for the 6-step Baseline Onboarding flow.
 * Copy designed to meet 5 UX standards:
 *   1. User knows success conditions before scanning  
 *   2. Single main status during scan  
 *   3. Failures are explainable  
 *   4. Results speak human language  
 *   5. Success makes user feel future scans will be more accurate
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 8
 */

// ─────────────────────────────────────────────
// Step 1: Intro
// ─────────────────────────────────────────────

/** Step 1 intro copy. */
export const BASELINE_INTRO = {
  headline: 'TENKI 先學你，再評估你',
  body: '接下來約 60 秒，TENKI 會學習你目前的心率、心率變異和呼吸節奏。' +
    '這不是測驗，只是建立屬於你的「正常狀態」參考。',
  subtext: '完成之後，每次掃描都會用你自己的基線來理解你',
  ctaLabel: '開始建立基線',
  learnMoreLabel: '為什麼需要基線？',
  learnMoreBody: '每個人的心率、呼吸節奏都不同。' +
    'TENKI 需要先知道「你的正常」在哪裡，才能在後續掃描中告訴你「今天跟平常比起來如何」。' +
    '這就像量身高體重一樣 — 是基本參考，不是分數。',
} as const;

// ─────────────────────────────────────────────
// Step 2: Sensor Choice
// ─────────────────────────────────────────────

/** Step 2 sensor choice copy. */
export const SENSOR_CHOICE_COPY = {
  headline: '選擇你的建立方式',
  body: '兩種方式都會建立同樣的基線',
  fingerOption: {
    label: '手指快速建立',
    description: '將手指輕放在後鏡頭上',
    time: '約 30 秒',
    tip: '適合大多數人，速度最快',
  },
  faceOption: {
    label: '臉部自然建立',
    description: '面對前鏡頭，自然呼吸',
    time: '約 60 秒',
    tip: 'Beta — 不需接觸鏡頭',
    betaBadge: 'Beta',
  },
} as const;

// ─────────────────────────────────────────────
// Step 3: Readiness Check
// ─────────────────────────────────────────────

/** Step 3 readiness check copy. */
export const READINESS_CHECK_COPY = {
  headline: '準備檢查',
  body: '在開始之前，確認環境和位置都準備好了',
  fingerInstructions: [
    '將食指或中指的指腹完整覆蓋後鏡頭',
    '手指要輕放，不要用力按壓',
    '保持手機穩定，盡量不要晃動',
  ],
  faceInstructions: [
    '面對前鏡頭，保持自然表情',
    '確保臉部光線均勻，避免逆光',
    '保持頭部穩定',
  ],
  dimensionLabels: {
    coverage: '覆蓋率',
    brightness: '光線',
    stability: '穩定度',
    sqi: '信號品質',
  },
  /** Success conditions shown BEFORE scanning (UX Standard 1) */
  successConditions: '手指到位 + 光線充足 + 保持穩定 = 可以開始',
} as const;

// ─────────────────────────────────────────────
// Step 4: Calibration Scan
// ─────────────────────────────────────────────

/** Step 4 calibration scan copy — single status messages (UX Standard 2). */
export const CALIBRATION_SCAN_COPY = {
  headline: '正在學習你的節奏',
  /** Phase messages — only 1 shown at a time */
  phases: {
    warmup: '準備中...',
    collecting: '讀取中，保持不動',
    stabilizing: '穩定中...',
    finalizing: '即將完成',
  },
  /** Single-line status messages for during-scan (UX Standard 2). */
  scanStatus: {
    good: '很好，保持不動',
    adjusting: '再靠近一點',
    recovering: '穩定中...',
    almostDone: '快好了，再堅持一下',
  },
  /** Progress labels. */
  progressLabel: '基線建立進度',
  /** Timer format instruction. */
  timerNote: '請保持不動',
} as const;

// ─────────────────────────────────────────────
// Step 5: Baseline Result
// ─────────────────────────────────────────────

/** Step 5 baseline result copy — human language, not scores (UX Standard 4). */
export const BASELINE_RESULT_COPY = {
  /** Success state */
  success: {
    headline: '基線已建立 ✓',
    /** Core message: NOT a score (UX Standard 4) */
    body: '這是你的目前基線，不是好壞分數。' +
      'TENKI 已經學到你的心率、呼吸和壓力的「正常範圍」。',
    subtext: '從現在開始，每次掃描都是跟你自己比較',
    confidenceHigh: '數據品質優秀，基線非常可靠',
    confidenceModerate: '基線已建立，持續掃描會讓它更準確',
    confidenceLow: '基線已初步建立，多掃幾次會更精準',
  },
  /** Failure state — explainable (UX Standard 3) */
  failure: {
    headline: '基線尚未完成',
    retryLabel: '再試一次',
    changeMethodLabel: '換一種方式',
  },
  /** Metric display labels */
  metrics: {
    heartRate: '你的心率範圍',
    hrv: '你的心率變異',
    breathing: '你的呼吸節奏',
    unit: {
      hr: 'BPM',
      hrv: 'ms',
      rr: '次/分',
    },
  },
} as const;

// ─────────────────────────────────────────────
// Step 6: Next Action
// ─────────────────────────────────────────────

/** Step 6 next action copy — future value message (UX Standard 5). */
export const NEXT_ACTION_COPY = {
  headline: '準備好了',
  /** UX Standard 5: user feels future scans will be more accurate */
  body: '每次掃描都會讓 TENKI 更懂你。' +
    '基線會隨著你的數據累積而越來越精準。',
  encouragement: '你的第一個基線已經建立 — 現在可以開始你的第一次掃描了',
  ctaFirstScan: '開始第一次掃描',
  ctaTraderCheck: '決策紀律模式前檢查',
  ctaExplore: '先看看',
} as const;

// ─────────────────────────────────────────────
// Disclaimer (required on every scan-related screen)
// ─────────────────────────────────────────────

/** Inline disclaimer for baseline screens. */
export const BASELINE_DISCLAIMER =
  'TENKI 提供的所有指標僅供個人健康參考，不構成醫療診斷或金融建議。' +
  '你的生理數據只儲存在你的裝置上。';
