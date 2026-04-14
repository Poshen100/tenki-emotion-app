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
    label: '手指快速建立',
    description: '將手指輕放在後鏡頭上，30 秒即可完成',
    isBeta: false,
    estimatedTimeSec: 30,
    iconHint: '👆',
  },
  {
    id: 'face_beta',
    label: '臉部自然建立',
    description: '看著前鏡頭，60 秒自然建立（較穩定）',
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
