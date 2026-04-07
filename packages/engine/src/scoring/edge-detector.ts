/**
 * @module scoring/edge-detector
 * @description Edge Detector — real-time readiness window detection.
 * Detects sustained periods of clear/focused state for optional alerts.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 7
 */

import {
  EdgeDetectorState,
  DetectedState,
  EDGE_DETECTOR_THRESHOLDS,
} from './types';

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Creates a fresh Edge Detector state.
 *
 * @returns Initialized EdgeDetectorState with no detection.
 */
export function createEdgeDetectorState(): EdgeDetectorState {
  return {
    isDetected: false,
    strength: 'none',
    detectedState: null,
    heldDurationSec: 0,
    consecutiveWindows: 0,
    alertsFiredToday: 0,
    suppressed: false,
    suppressionReason: null,
  };
}

// ─────────────────────────────────────────────
// Detection Logic
// ─────────────────────────────────────────────

/** Input for a single detection tick. */
export interface DetectorTickInput {
  /** Current Edge Score (0-100). */
  score: number;
  /** Current confidence (0-1). */
  confidence: number;
  /** Elapsed seconds since last tick. */
  deltaSec: number;
  /** Whether the user has quiet hours enabled. */
  quietHoursActive: boolean;
}

/**
 * Determines the detected state label from a score.
 *
 * @param score - Edge Score 0-100.
 * @returns DetectedState label.
 */
function classifyDetectedState(score: number): DetectedState {
  if (score >= 85) return 'clear';
  if (score >= 80) return 'focused';
  if (score >= 75) return 'stable';
  if (score >= 72) return 'balanced';
  return 'calm';
}

/**
 * Processes a single detection tick and returns the updated state.
 * Does NOT fire alerts — that's the caller's responsibility based on state changes.
 *
 * @param state - Current detector state.
 * @param input - Tick input with current score and delta time.
 * @returns Updated EdgeDetectorState.
 */
export function tickDetector(
  state: EdgeDetectorState,
  input: DetectorTickInput
): EdgeDetectorState {
  const { score, confidence, deltaSec, quietHoursActive } = input;

  // Check strong detection threshold
  const isStrong =
    score >= EDGE_DETECTOR_THRESHOLDS.STRONG.minScore &&
    confidence >= EDGE_DETECTOR_THRESHOLDS.STRONG.minConfidence;

  // Check soft detection threshold
  const isSoft =
    score >= EDGE_DETECTOR_THRESHOLDS.SOFT.minScore &&
    confidence >= EDGE_DETECTOR_THRESHOLDS.SOFT.minConfidence;

  // If neither threshold met → reset
  if (!isSoft) {
    return {
      ...state,
      isDetected: false,
      strength: 'none',
      detectedState: null,
      heldDurationSec: 0,
      consecutiveWindows: 0,
      suppressed: false,
      suppressionReason: null,
    };
  }

  // Detection is active
  const newHeldDuration = state.heldDurationSec + deltaSec;
  const newConsecutive = state.consecutiveWindows + (state.isDetected ? 0 : 1);
  const strength = isStrong ? 'strong' : 'soft';

  // Check suppression conditions
  let suppressed = false;
  let suppressionReason: string | null = null;

  if (quietHoursActive) {
    suppressed = true;
    suppressionReason = 'Quiet hours active';
  } else if (state.alertsFiredToday >= EDGE_DETECTOR_THRESHOLDS.DAILY_ALERT_CAP) {
    suppressed = true;
    suppressionReason = 'Daily alert cap reached';
  }

  // Determine if confirmed detection (minimum consecutive windows)
  const isConfirmed = newConsecutive >= EDGE_DETECTOR_THRESHOLDS.MIN_CONSECUTIVE_WINDOWS;

  return {
    isDetected: isConfirmed,
    strength: isConfirmed ? strength as 'soft' | 'strong' : 'none',
    detectedState: isConfirmed ? classifyDetectedState(score) : null,
    heldDurationSec: newHeldDuration,
    consecutiveWindows: newConsecutive,
    alertsFiredToday: state.alertsFiredToday,
    suppressed,
    suppressionReason,
  };
}

/**
 * Records that an alert was fired, incrementing the daily counter.
 *
 * @param state - Current detector state.
 * @returns Updated state with incremented alert count.
 */
export function recordAlertFired(state: EdgeDetectorState): EdgeDetectorState {
  return {
    ...state,
    alertsFiredToday: state.alertsFiredToday + 1,
  };
}

/**
 * Resets the daily alert counter (call at midnight or day boundary).
 *
 * @param state - Current detector state.
 * @returns Updated state with reset alert count.
 */
export function resetDailyAlerts(state: EdgeDetectorState): EdgeDetectorState {
  return {
    ...state,
    alertsFiredToday: 0,
  };
}

/**
 * Checks if an alert should be fired based on current state.
 * Alert conditions:
 * - Detection is confirmed
 * - Not suppressed
 * - Held duration meets threshold
 *
 * @param state - Current detector state.
 * @returns True if an alert should be fired.
 */
export function shouldFireAlert(state: EdgeDetectorState): boolean {
  return (
    state.isDetected &&
    !state.suppressed &&
    state.heldDurationSec >= EDGE_DETECTOR_THRESHOLDS.HOLD_DURATION_SEC
  );
}
