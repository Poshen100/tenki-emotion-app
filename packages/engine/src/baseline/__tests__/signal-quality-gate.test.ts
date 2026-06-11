/**
 * @module baseline/__tests__/signal-quality-gate.test
 * @description Tests for the Signal Quality Gate.
 */
import {
  evaluateReadinessGate,
  computeReadinessGrade,
  GREEN_THRESHOLDS,
  type ReadinessCheckInput,
} from '../signal-quality-gate';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeInput(overrides: Partial<ReadinessCheckInput> = {}): ReadinessCheckInput {
  return {
    coverage: 0.90,
    brightness: 0.60,
    stability: 0.80,
    sqi: 70,
    sensorType: 'finger',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('evaluateReadinessGate', () => {
  it('returns ready=true when all dimensions are GREEN', () => {
    const result = evaluateReadinessGate(makeInput());
    expect(result.ready).toBe(true);
    expect(result.canProceedWithWarning).toBe(false);
    expect(result.checks.coverage.passed).toBe(true);
    expect(result.checks.brightness.passed).toBe(true);
    expect(result.checks.stability.passed).toBe(true);
    expect(result.checks.sqi.passed).toBe(true);
    expect(result.overallMessage).toBe('準備就緒，可以開始');
  });

  it('returns ready=false but canProceedWithWarning=true when in YELLOW zone', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.70,   // YELLOW
      brightness: 0.40, // YELLOW
      stability: 0.60,  // YELLOW
      sqi: 50,          // YELLOW
    }));
    expect(result.ready).toBe(false);
    expect(result.canProceedWithWarning).toBe(true);
  });

  it('returns ready=false and canProceedWithWarning=false when any dimension is RED', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.40, // RED
    }));
    expect(result.ready).toBe(false);
    expect(result.canProceedWithWarning).toBe(false);
  });

  it('shows coverage message when coverage is low (finger)', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.30,
      sensorType: 'finger',
    }));
    expect(result.overallMessage).toBe('請將手指完整覆蓋鏡頭');
  });

  it('shows coverage message when coverage is low (face)', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.30,
      sensorType: 'face',
    }));
    expect(result.overallMessage).toBe('請將臉部對準鏡頭範圍');
  });

  it('shows brightness message when brightness is the bottleneck', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.90,
      brightness: 0.15,
      stability: 0.80,
      sqi: 70,
    }));
    expect(result.overallMessage).toBe('光線不足，請移到較亮的地方');
  });

  it('shows stability message when stability is the bottleneck', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.90,
      brightness: 0.60,
      stability: 0.30,
      sqi: 70,
    }));
    expect(result.overallMessage).toBe('偵測到晃動，請保持靜止');
  });

  it('shows SQI message when SQI is the bottleneck', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0.90,
      brightness: 0.60,
      stability: 0.80,
      sqi: 20,
    }));
    expect(result.overallMessage).toBe('信號品質不足，請調整位置');
  });

  it('computes readiness score as weighted average', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 1.0,
      brightness: 1.0,
      stability: 1.0,
      sqi: 100,
    }));
    expect(result.readinessScore).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('handles all zeros gracefully', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: 0,
      brightness: 0,
      stability: 0,
      sqi: 0,
    }));
    expect(result.ready).toBe(false);
    expect(result.canProceedWithWarning).toBe(false);
    expect(result.readinessScore).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('handles edge case at GREEN threshold boundaries', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: GREEN_THRESHOLDS.coverage,
      brightness: GREEN_THRESHOLDS.brightness,
      stability: GREEN_THRESHOLDS.stability,
      sqi: GREEN_THRESHOLDS.sqi,
    }));
    expect(result.ready).toBe(true);
    expect(result.checks.coverage.passed).toBe(true);
  });

  it('handles edge case just below GREEN threshold', () => {
    const result = evaluateReadinessGate(makeInput({
      coverage: GREEN_THRESHOLDS.coverage - 0.01,
    }));
    expect(result.checks.coverage.passed).toBe(false);
    expect(result.ready).toBe(false);
  });
});

describe('computeReadinessGrade', () => {
  it('returns A for scores >= 85', () => {
    expect(computeReadinessGrade(85)).toBe('A');
    expect(computeReadinessGrade(100)).toBe('A');
  });

  it('returns B for scores 70-84', () => {
    expect(computeReadinessGrade(70)).toBe('B');
    expect(computeReadinessGrade(84)).toBe('B');
  });

  it('returns C for scores 55-69', () => {
    expect(computeReadinessGrade(55)).toBe('C');
    expect(computeReadinessGrade(69)).toBe('C');
  });

  it('returns D for scores 40-54', () => {
    expect(computeReadinessGrade(40)).toBe('D');
    expect(computeReadinessGrade(54)).toBe('D');
  });

  it('returns F for scores < 40', () => {
    expect(computeReadinessGrade(39)).toBe('F');
    expect(computeReadinessGrade(0)).toBe('F');
  });
});
