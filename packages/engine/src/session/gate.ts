/**
 * @module session/gate
 * @description Pre-session gate evaluation — determines readiness clearance.
 * Gate results control whether a session can proceed.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 5
 */

import { type GateResult, type GateEvaluation, GATE_THRESHOLDS } from './types';
import type { ConfidenceBreakdown } from '../common/types';

// ─────────────────────────────────────────────
// Gate Messages (compliance-safe)
// ─────────────────────────────────────────────

const GATE_MESSAGES: Record<GateResult, string> = {
  clear_pass: 'Your signals suggest a clearer state. You may proceed with your session.',
  soft_caution: 'Mixed signals detected. You can proceed, but consider a brief check-in first.',
  red_gate: 'Elevated strain detected. A reset or break may be more beneficial right now.',
  force_hold: 'Consecutive elevated strain readings detected. We suggest a Health Reset session first.',
};

// ─────────────────────────────────────────────
// Gate Evaluation
// ─────────────────────────────────────────────

/**
 * Evaluates the pre-session gate based on Edge Score and confidence.
 *
 * @param score - Current Edge Score (0-100).
 * @param confidence - Current confidence breakdown.
 * @param consecutiveRedGates - Number of consecutive red gates previously.
 * @returns Complete gate evaluation result.
 */
export function evaluateGate(
  score: number,
  confidence: ConfidenceBreakdown,
  consecutiveRedGates: number = 0
): GateEvaluation {
  let result: GateResult;

  // Force hold: 2+ consecutive red gates
  if (consecutiveRedGates >= GATE_THRESHOLDS.FORCE_HOLD_CONSECUTIVE_REDS && score <= GATE_THRESHOLDS.RED_GATE.maxScore) {
    result = 'force_hold';
  }
  // Red gate: score below threshold
  else if (score <= GATE_THRESHOLDS.RED_GATE.maxScore) {
    result = 'red_gate';
  }
  // Clear pass: high score AND high confidence
  else if (
    score >= GATE_THRESHOLDS.CLEAR_PASS.minScore &&
    confidence.overall >= GATE_THRESHOLDS.CLEAR_PASS.minConfidence
  ) {
    result = 'clear_pass';
  }
  // Soft caution: everything else
  else {
    result = 'soft_caution';
  }

  return {
    result,
    scoreAtGate: score,
    confidenceAtGate: confidence.overall,
    message: GATE_MESSAGES[result],
    consecutiveRedGates: result === 'red_gate' || result === 'force_hold'
      ? consecutiveRedGates + 1
      : 0,
  };
}

/**
 * Determines if a gate result allows proceeding to the active session.
 *
 * @param gateResult - The gate result to check.
 * @returns True if the session can proceed (user may still see caution).
 */
export function canProceed(gateResult: GateResult): boolean {
  return gateResult === 'clear_pass' || gateResult === 'soft_caution';
}

/**
 * Determines if a gate result suggests redirecting to Health Reset.
 *
 * @param gateResult - The gate result to check.
 * @returns True if Health Reset should be suggested.
 */
export function shouldSuggestReset(gateResult: GateResult): boolean {
  return gateResult === 'force_hold';
}
