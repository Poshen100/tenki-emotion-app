/**
 * @module baseline/signal-quality-gate
 * @description Multi-dimensional signal readiness gate for TENKI CORE baseline scans.
 * Checks coverage, brightness, stability, and SQI before allowing scan to proceed.
 * All failures produce human-readable messages — never "scan failed".
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 8.4
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Sensor type for readiness check. */
export type SensorType = 'finger' | 'face';

/** Input for the readiness gate check. */
export interface ReadinessCheckInput {
  /** Finger/face coverage ratio (0-1). */
  coverage: number;
  /** Ambient brightness level (0-1). */
  brightness: number;
  /** Signal stability — inverse of motion/shake (0-1). */
  stability: number;
  /** Signal Quality Index (0-100). */
  sqi: number;
  /** Sensor type being used. */
  sensorType: SensorType;
}

/** Result of a single readiness dimension check. */
export interface ReadinessCheckDimension {
  /** Whether this dimension passed its threshold. */
  passed: boolean;
  /** Measured value. */
  value: number;
  /** Required threshold for GREEN. */
  threshold: number;
  /** Minimum acceptable threshold for YELLOW. */
  minThreshold: number;
  /** Human-readable message for this dimension. */
  message: string;
}

/** Signal quality grade (aligned with ANTIGRAVITY.md §8.4). */
export type ReadinessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Complete readiness gate result. */
export interface ReadinessGateResult {
  /** Whether the signal meets minimum quality to start scanning. */
  ready: boolean;
  /** Overall grade (A-F). */
  grade: ReadinessGrade;
  /** Individual dimension checks. */
  checks: {
    coverage: ReadinessCheckDimension;
    brightness: ReadinessCheckDimension;
    stability: ReadinessCheckDimension;
    sqi: ReadinessCheckDimension;
  };
  /** Single human-readable overall status message. */
  overallMessage: string;
  /** Can proceed with a warning (degraded but usable). */
  canProceedWithWarning: boolean;
  /** Overall readiness score (0-100). */
  readinessScore: number;
}

// ─────────────────────────────────────────────
// Constants — Thresholds
// ─────────────────────────────────────────────

/** GREEN thresholds — ideal conditions. */
export const GREEN_THRESHOLDS = {
  coverage: 0.85,
  brightness: 0.50,
  stability: 0.70,
  sqi: 55,
} as const;

/** YELLOW thresholds — minimum acceptable. */
export const YELLOW_THRESHOLDS = {
  coverage: 0.60,
  brightness: 0.30,
  stability: 0.50,
  sqi: 40,
} as const;

/** Dimension weights for overall readiness score. */
export const READINESS_WEIGHTS = {
  coverage: 0.35,
  brightness: 0.15,
  stability: 0.25,
  sqi: 0.25,
} as const;

// ─────────────────────────────────────────────
// Human-Readable Messages
// ─────────────────────────────────────────────

/** Coverage messages per sensor type. */
const COVERAGE_MESSAGES: Record<SensorType, { low: string; adjusting: string; good: string }> = {
  finger: {
    low:       '請將手指完整覆蓋鏡頭',
    adjusting: '再靠近一點，幾乎到位了',
    good:      '手指位置正確',
  },
  face: {
    low:       '請將臉部對準鏡頭範圍',
    adjusting: '稍微調整角度，快到位了',
    good:      '臉部位置正確',
  },
};

/** Brightness messages. */
const BRIGHTNESS_MESSAGES = {
  low:  '光線不足，請移到較亮的地方',
  dim:  '光線偏暗，建議開燈',
  good: '光線充足',
} as const;

/** Stability messages. */
const STABILITY_MESSAGES = {
  shaky:    '偵測到晃動，請保持靜止',
  unstable: '盡量保持不動',
  good:     '保持穩定',
} as const;

/** SQI messages. */
const SQI_MESSAGES = {
  poor:     '信號品質不足，請調整位置',
  weak:     '信號較弱，嘗試調整角度',
  good:     '信號品質良好',
} as const;

// ─────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────

/**
 * Checks a single readiness dimension against its thresholds.
 *
 * @param value - Measured value.
 * @param greenThreshold - GREEN threshold (ideal).
 * @param yellowThreshold - YELLOW threshold (minimum).
 * @param messages - Human-readable messages for each state.
 * @returns ReadinessCheckDimension result.
 */
function checkDimension(
  value: number,
  greenThreshold: number,
  yellowThreshold: number,
  messages: { low: string; adjusting: string; good: string }
): ReadinessCheckDimension {
  if (value >= greenThreshold) {
    return {
      passed: true,
      value,
      threshold: greenThreshold,
      minThreshold: yellowThreshold,
      message: messages.good,
    };
  }
  if (value >= yellowThreshold) {
    return {
      passed: false,
      value,
      threshold: greenThreshold,
      minThreshold: yellowThreshold,
      message: messages.adjusting,
    };
  }
  return {
    passed: false,
    value,
    threshold: greenThreshold,
    minThreshold: yellowThreshold,
    message: messages.low,
  };
}

/**
 * Computes the overall readiness grade from the readiness score.
 *
 * @param score - Readiness score (0-100).
 * @returns Grade A-F.
 */
export function computeReadinessGrade(score: number): ReadinessGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Determines the single overall status message to show the user.
 * Only shows 1 thing — the most critical issue.
 *
 * @param checks - Individual dimension check results.
 * @returns Single human-readable message.
 */
function resolveOverallMessage(checks: ReadinessGateResult['checks']): string {
  // Priority order: coverage > stability > brightness > sqi
  if (!checks.coverage.passed && checks.coverage.value < YELLOW_THRESHOLDS.coverage) {
    return checks.coverage.message;
  }
  if (!checks.stability.passed && checks.stability.value < YELLOW_THRESHOLDS.stability) {
    return checks.stability.message;
  }
  if (!checks.brightness.passed && checks.brightness.value < YELLOW_THRESHOLDS.brightness) {
    return checks.brightness.message;
  }
  if (!checks.sqi.passed && checks.sqi.value < YELLOW_THRESHOLDS.sqi) {
    return checks.sqi.message;
  }

  // All above minimum — check for warnings
  const failedCount = [
    checks.coverage.passed,
    checks.brightness.passed,
    checks.stability.passed,
    checks.sqi.passed,
  ].filter(p => !p).length;

  if (failedCount === 0) {
    return '準備就緒，可以開始';
  }
  if (failedCount === 1) {
    // Find the one that's not passed and return its adjusting message
    if (!checks.coverage.passed) return checks.coverage.message;
    if (!checks.stability.passed) return checks.stability.message;
    if (!checks.brightness.passed) return checks.brightness.message;
    return checks.sqi.message;
  }
  return '請調整位置和環境，準備進行掃描';
}

/**
 * Evaluates whether the signal quality meets the readiness gate requirements.
 * This is the primary entry point for the Signal Quality Gate.
 *
 * UX Standard: "掃描前就讓使用者知道成功條件"
 * — Every failure is explainable with human-readable messages.
 *
 * @param input - Readiness check input with all sensor dimensions.
 * @returns ReadinessGateResult with pass/fail, grade, individual checks, and overall message.
 */
export function evaluateReadinessGate(input: ReadinessCheckInput): ReadinessGateResult {
  const { coverage, brightness, stability, sqi, sensorType } = input;

  // Check each dimension
  const coverageCheck = checkDimension(
    coverage,
    GREEN_THRESHOLDS.coverage,
    YELLOW_THRESHOLDS.coverage,
    COVERAGE_MESSAGES[sensorType]
  );

  const brightnessCheck = checkDimension(
    brightness,
    GREEN_THRESHOLDS.brightness,
    YELLOW_THRESHOLDS.brightness,
    { low: BRIGHTNESS_MESSAGES.low, adjusting: BRIGHTNESS_MESSAGES.dim, good: BRIGHTNESS_MESSAGES.good }
  );

  const stabilityCheck = checkDimension(
    stability,
    GREEN_THRESHOLDS.stability,
    YELLOW_THRESHOLDS.stability,
    { low: STABILITY_MESSAGES.shaky, adjusting: STABILITY_MESSAGES.unstable, good: STABILITY_MESSAGES.good }
  );

  const sqiCheck = checkDimension(
    sqi,
    GREEN_THRESHOLDS.sqi,
    YELLOW_THRESHOLDS.sqi,
    { low: SQI_MESSAGES.poor, adjusting: SQI_MESSAGES.weak, good: SQI_MESSAGES.good }
  );

  const checks = {
    coverage: coverageCheck,
    brightness: brightnessCheck,
    stability: stabilityCheck,
    sqi: sqiCheck,
  };

  // Compute weighted readiness score
  const normalizedSqi = Math.min(100, sqi) / 100;
  const readinessScore = Math.round(
    (coverage * READINESS_WEIGHTS.coverage +
     brightness * READINESS_WEIGHTS.brightness +
     stability * READINESS_WEIGHTS.stability +
     normalizedSqi * READINESS_WEIGHTS.sqi) * 100
  );

  const grade = computeReadinessGrade(readinessScore);

  // All dimensions must be at least YELLOW to proceed
  const allAboveMinimum =
    coverage >= YELLOW_THRESHOLDS.coverage &&
    brightness >= YELLOW_THRESHOLDS.brightness &&
    stability >= YELLOW_THRESHOLDS.stability &&
    sqi >= YELLOW_THRESHOLDS.sqi;

  // All dimensions GREEN = fully ready
  const allGreen =
    coverageCheck.passed &&
    brightnessCheck.passed &&
    stabilityCheck.passed &&
    sqiCheck.passed;

  const overallMessage = resolveOverallMessage(checks);

  return {
    ready: allGreen,
    grade,
    checks,
    overallMessage,
    canProceedWithWarning: allAboveMinimum && !allGreen,
    readinessScore,
  };
}
