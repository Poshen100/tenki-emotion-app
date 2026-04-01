/**
 * @module scenario-mode/validator
 * @description Validates user overrides against min/max bounds per scenario mode.
 */

import {
  type ScenarioMode,
  type ScenarioModeConfig,
  type ValidationResult,
  SCENARIO_MODE_DEFAULTS,
} from './types';

/** Duration bounds per mode [min, max] in seconds */
const DURATION_BOUNDS: Record<ScenarioMode, [number, number]> = {
  health: [60, 1800],
  focus: [300, 3600],
  performance: [120, 3600],
  trader: [300, 7200],
};

/** Emotion score bounds per mode [min, max] (only for modes with gating) */
const EMOTION_BOUNDS: Record<ScenarioMode, [number, number] | null> = {
  health: null,
  focus: [30, 80],
  performance: null,
  trader: [40, 90],
};

/**
 * Validates and sanitizes a partial scenario mode config override.
 * Missing fields are filled from defaults. Numeric fields are clamped.
 *
 * @param overrides - Partial config overrides from the user
 * @param mode - The scenario mode to validate against
 * @returns Validation result with sanitized config or errors
 */
export function validateModeConfig(
  overrides: Partial<ScenarioModeConfig>,
  mode: ScenarioMode
): ValidationResult {
  const errors: string[] = [];
  const defaults = SCENARIO_MODE_DEFAULTS[mode];
  const merged: ScenarioModeConfig = { ...defaults, ...overrides, mode };

  // Mode field is immutable
  if (overrides.mode !== undefined && overrides.mode !== mode) {
    errors.push(`Cannot override mode: expected "${mode}", got "${overrides.mode}"`);
  }

  // Validate timerType
  const validTimerTypes = ['countdown', 'countup', 'pomodoro', 'interval'];
  if (!validTimerTypes.includes(merged.timerType)) {
    errors.push(`Invalid timerType: "${merged.timerType}"`);
  }

  // Validate disciplineTracking
  const validWeights = ['none', 'low', 'high'];
  if (!validWeights.includes(merged.disciplineTracking)) {
    errors.push(`Invalid disciplineTracking: "${merged.disciplineTracking}"`);
  }

  // Clamp duration
  const [minDur, maxDur] = DURATION_BOUNDS[mode];
  merged.defaultDurationSec = Math.max(minDur, Math.min(maxDur, merged.defaultDurationSec));

  // Validate emotion score
  const emotionRange = EMOTION_BOUNDS[mode];
  if (merged.emotionGateEnabled && merged.emotionMinScore !== null && emotionRange) {
    const [minE, maxE] = emotionRange;
    merged.emotionMinScore = Math.max(minE, Math.min(maxE, merged.emotionMinScore));
  } else if (!merged.emotionGateEnabled) {
    merged.emotionMinScore = null;
  }

  // Boolean type checks
  if (typeof merged.breathingEnabled !== 'boolean') {
    errors.push('breathingEnabled must be boolean');
  }
  if (typeof merged.notificationsEnabled !== 'boolean') {
    errors.push('notificationsEnabled must be boolean');
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  return { valid: true, errors: [], sanitized: merged };
}
