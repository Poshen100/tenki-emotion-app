/**
 * @module domain/contracts/baseline-contract
 * @description Canonical contracts for the Baseline Onboarding flow.
 * Defines the 6-step state machine, sensor choice, and handoff types.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 8 — Scan & Readiness
 */

// ─────────────────────────────────────────────
// Onboarding Step Enum
// ─────────────────────────────────────────────

/** The 6 steps of baseline onboarding. */
export type BaselineOnboardingStep =
  | 'intro'
  | 'sensor_choice'
  | 'readiness_check'
  | 'calibration_scan'
  | 'baseline_result'
  | 'next_action';

/** Ordered step sequence for navigation. */
export const ONBOARDING_STEP_ORDER: readonly BaselineOnboardingStep[] = [
  'intro',
  'sensor_choice',
  'readiness_check',
  'calibration_scan',
  'baseline_result',
  'next_action',
] as const;

// ─────────────────────────────────────────────
// Sensor Choice
// ─────────────────────────────────────────────

/** Available sensor types for baseline calibration. */
export type SensorChoice = 'finger' | 'face_beta';

/**
 * Shortest camera capture that can establish a pulse anchor, in seconds.
 *
 * 🔴 This is not a UX preference, it is what the signal chain can do. Mirrors
 * `SCAN_MODE_CONFIGS.full_scan.minDurationSec` in
 * `packages/engine/src/biometric/scan-modes.ts`, which is canonical — `domain`
 * is the lower layer and does not depend on the engine. Keep the two in step.
 *
 * Two promises have been walked back here, both because they were measured:
 *
 *   1. The copy once promised 30 seconds. A 30-second window produced an HRV
 *      estimate **0 times out of 12** — `quick_check` does not report HRV at
 *      all, by construction. A test was holding that promise in place without
 *      ever checking it was true.
 *   2. The name once said HRV. Camera HRV is withheld
 *      (`camera_hrv_estimates`, default off), so what this capture establishes
 *      is a resting **pulse** reference. See docs/PHONE-PPG.md §10.
 */
export const MIN_SECONDS_FOR_PULSE_ANCHOR = 45;

/** Sensor choice display config. */
export interface SensorChoiceConfig {
  /** Sensor identifier. */
  id: SensorChoice;
  /** Display label. */
  label: string;
  /** Description text. */
  description: string;
  /** Whether this option is in beta. */
  isBeta: boolean;
  /** Estimated calibration time in seconds. */
  estimatedTimeSec: number;
  /** Icon hint for UI. */
  iconHint: string;
}

/** Available sensor choices. */
export const SENSOR_CHOICES: readonly SensorChoiceConfig[] = [
  {
    id: 'finger',
    label: '手指精密建立',
    // 🔴 不得寫「建立心律變異基線」—— 相機 HRV 是關掉的。而且也不得寫
    // 「建立基線」：一次擷取得到的是一個參考值，基線要多次跨幾天才成形
    // （`packages/engine/src/biometric/pulse-anchor.ts`）。
    // ⚠️ 90 秒是**沿用**下來的：它是 HRV 離散度量出來的甜蜜點（45s ±2.15 →
    // 90s ±1.12 → 180s ±0.95）。只報脈搏的話 30 秒就到 ±0.06 bpm 了，所以
    // 這個時長現在是保守而非必要 —— 要縮短是產品決定，不是 AI 自己改。
    description: '將手指輕放在後鏡頭上，90 秒立一個靜息脈搏參考值',
    isBeta: false,
    estimatedTimeSec: 90,
    iconHint: '👆',
  },
  {
    id: 'face_beta',
    label: '臉部自然建立',
    // 刻意不再宣稱「較穩定」：那是一個沒有量測依據的比較宣稱。
    // repo 自己的來源優先序已把 camera(45) 排在 finger_scan(60) 之下
    // （domain/policies/wearable-source-policy.ts）。
    description: '看著前鏡頭，60 秒建立心率基線',
    isBeta: true,
    estimatedTimeSec: 60,
    iconHint: '🙂',
  },
] as const;

// ─────────────────────────────────────────────
// Onboarding State
// ─────────────────────────────────────────────

/** Classifiable failure reason for analytics. */
export type BaselineFailureReason =
  | 'coverage_insufficient'
  | 'brightness_insufficient'
  | 'stability_insufficient'
  | 'sqi_insufficient'
  | 'scan_timeout'
  | 'user_cancelled'
  | 'no_readings'
  | 'all_rejected'
  | 'insufficient_duration'
  | 'insufficient_quality';

/** Complete onboarding state for the baseline flow. */
export interface BaselineOnboardingState {
  /** Current step in the flow. */
  currentStep: BaselineOnboardingStep;
  /** Selected sensor type (set at step 2). */
  sensorChoice: SensorChoice | null;
  /** Whether this is the user's first time. */
  isFirstTime: boolean;
  /** Started timestamp. */
  startedAt: number;
  /** Completed timestamp (null if not done). */
  completedAt: number | null;
  /** Current attempt number (1-indexed). */
  attemptCount: number;
  /** Classified failure reasons from past attempts. */
  failureReasons: BaselineFailureReason[];
  /** Whether the baseline was successfully established. */
  baselineEstablished: boolean;
}

// ─────────────────────────────────────────────
// Next Action Config
// ─────────────────────────────────────────────

/** Post-baseline next action options. */
export type NextActionType = 'first_scan' | 'trader_check' | 'explore_app';

/** Next action display config. */
export interface NextActionConfig {
  /** Action identifier. */
  id: NextActionType;
  /** Display label. */
  label: string;
  /** Description. */
  description: string;
  /** Icon hint. */
  iconHint: string;
}

/** Available next actions after baseline completion. */
export const NEXT_ACTIONS: readonly NextActionConfig[] = [
  {
    id: 'first_scan',
    label: '開始第一次掃描',
    description: '用你剛建立的基線，看看現在的狀態',
    iconHint: '🔍',
  },
  {
    id: 'trader_check',
    label: '進入 Trader Mode 前檢查',
    description: '確認你的決策準備度',
    iconHint: '🎯',
  },
  {
    id: 'explore_app',
    label: '先逛逛',
    description: '探索 TENKI 的各項功能',
    iconHint: '🧭',
  },
] as const;

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Creates the initial onboarding state for a new user.
 *
 * @returns Fresh BaselineOnboardingState at the intro step.
 */
export function createInitialOnboardingState(): BaselineOnboardingState {
  return {
    currentStep: 'intro',
    sensorChoice: null,
    isFirstTime: true,
    startedAt: Date.now(),
    completedAt: null,
    attemptCount: 1,
    failureReasons: [],
    baselineEstablished: false,
  };
}
