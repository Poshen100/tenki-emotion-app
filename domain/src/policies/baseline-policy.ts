/**
 * @module domain/policies/baseline-policy
 * @description Business rules for baseline onboarding flow.
 * Controls step transitions, retry logic, and success criteria.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 8
 */

import {
  BaselineOnboardingStep,
  BaselineOnboardingState,
  BaselineFailureReason,
  ONBOARDING_STEP_ORDER,
} from '../contracts/baseline-contract';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Maximum number of calibration attempts before suggesting alternative. */
export const MAX_CALIBRATION_ATTEMPTS = 3;

/** Target: 80% users complete within this time (seconds). */
export const TARGET_COMPLETION_SEC = 90;

/** Maximum total onboarding time before timeout (seconds). */
export const MAX_ONBOARDING_SEC = 180;

// ─────────────────────────────────────────────
// Step Navigation
// ─────────────────────────────────────────────

/**
 * Determines the next step in the onboarding flow.
 *
 * @param currentStep - The current step.
 * @returns The next step, or null if at the end.
 */
export function getNextStep(currentStep: BaselineOnboardingStep): BaselineOnboardingStep | null {
  const idx = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (idx === -1 || idx >= ONBOARDING_STEP_ORDER.length - 1) return null;
  return ONBOARDING_STEP_ORDER[idx + 1];
}

/**
 * Determines the previous step in the onboarding flow.
 *
 * @param currentStep - The current step.
 * @returns The previous step, or null if at the start.
 */
export function getPreviousStep(currentStep: BaselineOnboardingStep): BaselineOnboardingStep | null {
  const idx = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (idx <= 0) return null;
  return ONBOARDING_STEP_ORDER[idx - 1];
}

/**
 * Checks whether a step transition is allowed.
 *
 * @param state - Current onboarding state.
 * @param targetStep - Desired target step.
 * @returns Whether the transition is valid.
 */
export function canTransitionTo(
  state: BaselineOnboardingState,
  targetStep: BaselineOnboardingStep
): boolean {
  const currentIdx = ONBOARDING_STEP_ORDER.indexOf(state.currentStep);
  const targetIdx = ONBOARDING_STEP_ORDER.indexOf(targetStep);

  // Can always go back
  if (targetIdx < currentIdx) return true;

  // Can only advance by 1 step
  if (targetIdx > currentIdx + 1) return false;

  // Special rules for advancing
  switch (targetStep) {
    case 'readiness_check':
      // Must have selected sensor
      return state.sensorChoice !== null;
    case 'calibration_scan':
      // Readiness check is handled by the gate, not this policy
      return true;
    case 'baseline_result':
      // Must come from calibration_scan only
      return state.currentStep === 'calibration_scan';
    case 'next_action':
      // Must have baseline established
      return state.baselineEstablished;
    default:
      return true;
  }
}

// ─────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────

/**
 * Determines whether the user should retry or be offered an alternative.
 *
 * @param state - Current onboarding state.
 * @returns Action recommendation.
 */
export function evaluateRetryStrategy(state: BaselineOnboardingState): {
  canRetry: boolean;
  suggestAlternativeSensor: boolean;
  guidance: string;
} {
  if (state.attemptCount < MAX_CALIBRATION_ATTEMPTS) {
    // Analyze failure patterns
    const lastFailure = state.failureReasons[state.failureReasons.length - 1];
    const guidance = getRetryGuidance(lastFailure, state.attemptCount);

    return {
      canRetry: true,
      suggestAlternativeSensor: false,
      guidance,
    };
  }

  // Max attempts reached
  return {
    canRetry: false,
    suggestAlternativeSensor: true,
    guidance: state.sensorChoice === 'finger'
      ? '手指掃描多次未成功，建議嘗試臉部掃描模式'
      : '建議調整環境光線後再試一次',
  };
}

/**
 * Generates contextual retry guidance based on the failure reason.
 * Second attempt guidance is adapted from first failure.
 *
 * @param reason - The classified failure reason.
 * @param attemptCount - Which attempt this is.
 * @returns Human-readable guidance message.
 */
function getRetryGuidance(
  reason: BaselineFailureReason | undefined,
  attemptCount: number
): string {
  if (!reason) return '請再試一次';

  const prefix = attemptCount > 1 ? '上次的問題是' : '';

  switch (reason) {
    case 'coverage_insufficient':
      return `${prefix}手指覆蓋不完整。這次試著把手指平貼在鏡頭上，不留空隙`;
    case 'brightness_insufficient':
      return `${prefix}光線不足。請移到較亮的環境，或打開附近的燈`;
    case 'stability_insufficient':
      return `${prefix}偵測到晃動。請把手機放在桌上，手指輕放不要按壓`;
    case 'sqi_insufficient':
      return `${prefix}信號品質不佳。確保手指乾燥，光線充足`;
    case 'scan_timeout':
      return '掃描超時。這次會更快開始，請提前準備好手指位置';
    case 'user_cancelled':
      return '上次你提前結束了。這次只需要 30 秒，保持不動就好';
    case 'no_readings':
    case 'all_rejected':
      return '上次沒有收到有效信號。確保手指貼緊鏡頭，光線充足';
    case 'insufficient_duration':
      return '上次掃描時間太短。請保持手指不動至少 30 秒';
    case 'insufficient_quality':
      return '上次有效數據太少。試著在更穩定的環境中進行';
    default:
      return '請再試一次，這次會更順利';
  }
}

// ─────────────────────────────────────────────
// Success Criteria
// ─────────────────────────────────────────────

/**
 * Checks whether the onboarding completed within the target time.
 *
 * @param state - Completed onboarding state.
 * @returns Whether completion was within the 90s target.
 */
export function isWithinTargetTime(state: BaselineOnboardingState): boolean {
  if (!state.completedAt) return false;
  const durationSec = (state.completedAt - state.startedAt) / 1000;
  return durationSec <= TARGET_COMPLETION_SEC;
}

/**
 * Checks whether the user is a first-time user who needs baseline onboarding.
 *
 * @param hasExistingBaseline - Whether the user already has a baseline.
 * @param baselineMaturity - Current baseline maturity level.
 * @returns Whether onboarding should be shown.
 */
export function shouldShowBaselineOnboarding(
  hasExistingBaseline: boolean,
  baselineMaturity: string
): boolean {
  if (!hasExistingBaseline) return true;
  if (baselineMaturity === 'new') return true;
  return false;
}
