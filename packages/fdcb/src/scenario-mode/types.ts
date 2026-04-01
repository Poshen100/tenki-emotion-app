/**
 * @module scenario-mode/types
 * @description Scenario mode type definitions and default configurations.
 * Each mode optimizes the FDCB for a specific use case.
 */

/** Available scenario modes */
export type ScenarioMode = 'health' | 'focus' | 'performance' | 'trader';

/** Timer display variants */
export type TimerType = 'countdown' | 'countup' | 'pomodoro' | 'interval';

/** Discipline tracking intensity */
export type DisciplineWeight = 'none' | 'low' | 'high';

/** Full configuration for a scenario mode */
export interface ScenarioModeConfig {
  /** Active mode identifier */
  mode: ScenarioMode;
  /** Timer display style */
  timerType: TimerType;
  /** Whether breathing guidance is shown during scan */
  breathingEnabled: boolean;
  /** Whether push notifications are sent */
  notificationsEnabled: boolean;
  /** Discipline tracking intensity (violations, penalties) */
  disciplineTracking: DisciplineWeight;
  /** Default session duration in seconds */
  defaultDurationSec: number;
  /** Whether emotion score gating is active before entry */
  emotionGateEnabled: boolean;
  /** Minimum emotion score to pass gate (null = disabled) */
  emotionMinScore: number | null;
}

/** Validation result returned by config validators */
export interface ValidationResult {
  /** Whether the config is valid */
  valid: boolean;
  /** List of validation error messages */
  errors: string[];
  /** The sanitized/clamped config (only if valid) */
  sanitized: ScenarioModeConfig | null;
}

/** Default configuration per scenario mode */
export const SCENARIO_MODE_DEFAULTS: Record<ScenarioMode, ScenarioModeConfig> = {
  health: {
    mode: 'health',
    timerType: 'countup',
    breathingEnabled: true,
    notificationsEnabled: false,
    disciplineTracking: 'none',
    defaultDurationSec: 300,
    emotionGateEnabled: false,
    emotionMinScore: null,
  },
  focus: {
    mode: 'focus',
    timerType: 'pomodoro',
    breathingEnabled: false,
    notificationsEnabled: false,
    disciplineTracking: 'low',
    defaultDurationSec: 1500,
    emotionGateEnabled: true,
    emotionMinScore: 50,
  },
  performance: {
    mode: 'performance',
    timerType: 'interval',
    breathingEnabled: true,
    notificationsEnabled: false,
    disciplineTracking: 'none',
    defaultDurationSec: 600,
    emotionGateEnabled: false,
    emotionMinScore: null,
  },
  trader: {
    mode: 'trader',
    timerType: 'countdown',
    breathingEnabled: true,
    notificationsEnabled: true,
    disciplineTracking: 'high',
    defaultDurationSec: 1800,
    emotionGateEnabled: true,
    emotionMinScore: 55,
  },
};
