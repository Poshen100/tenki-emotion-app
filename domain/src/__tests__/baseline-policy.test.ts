import {
  MAX_CALIBRATION_ATTEMPTS,
  ONBOARDING_STEP_ORDER,
  TARGET_COMPLETION_SEC,
  canTransitionTo,
  createInitialOnboardingState,
  evaluateRetryStrategy,
  getNextStep,
  getPreviousStep,
  isWithinTargetTime,
  shouldShowBaselineOnboarding,
} from '../index';
import type {
  BaselineFailureReason,
  BaselineOnboardingState,
  BaselineOnboardingStep,
} from '../index';

/** Builds an onboarding state with overrides for policy scenarios. */
function makeState(overrides: Partial<BaselineOnboardingState> = {}): BaselineOnboardingState {
  return { ...createInitialOnboardingState(), ...overrides };
}

describe('baseline step navigation', () => {
  it('walks the 6 steps forward in canonical order', () => {
    const walked: (BaselineOnboardingStep | null)[] = [];
    let step: BaselineOnboardingStep | null = 'intro';
    while (step !== null) {
      step = getNextStep(step);
      walked.push(step);
    }
    expect(walked).toEqual([
      'sensor_choice',
      'readiness_check',
      'calibration_scan',
      'baseline_result',
      'next_action',
      null,
    ]);
  });

  it('returns null when advancing past the final step', () => {
    expect(getNextStep('next_action')).toBeNull();
  });

  it('returns null when going back from the first step', () => {
    expect(getPreviousStep('intro')).toBeNull();
  });

  it('walks backward symmetrically to the forward order', () => {
    for (let i = 1; i < ONBOARDING_STEP_ORDER.length; i++) {
      expect(getPreviousStep(ONBOARDING_STEP_ORDER[i])).toBe(ONBOARDING_STEP_ORDER[i - 1]);
    }
  });
});

describe('baseline step transition policy', () => {
  it('always allows going backward', () => {
    const state = makeState({ currentStep: 'baseline_result' });
    expect(canTransitionTo(state, 'intro')).toBe(true);
    expect(canTransitionTo(state, 'calibration_scan')).toBe(true);
  });

  it('blocks skipping more than one step forward', () => {
    const state = makeState({ currentStep: 'intro' });
    expect(canTransitionTo(state, 'readiness_check')).toBe(false);
    expect(canTransitionTo(state, 'next_action')).toBe(false);
  });

  it('requires a sensor choice before the readiness check', () => {
    const noSensor = makeState({ currentStep: 'sensor_choice', sensorChoice: null });
    expect(canTransitionTo(noSensor, 'readiness_check')).toBe(false);

    const withSensor = makeState({ currentStep: 'sensor_choice', sensorChoice: 'finger' });
    expect(canTransitionTo(withSensor, 'readiness_check')).toBe(true);
  });

  it('lets the readiness gate own entry into calibration_scan', () => {
    const state = makeState({ currentStep: 'readiness_check', sensorChoice: 'finger' });
    expect(canTransitionTo(state, 'calibration_scan')).toBe(true);
  });

  it('only reaches baseline_result from calibration_scan', () => {
    const fromScan = makeState({ currentStep: 'calibration_scan', sensorChoice: 'finger' });
    expect(canTransitionTo(fromScan, 'baseline_result')).toBe(true);
  });

  it('requires an established baseline before next_action', () => {
    const notEstablished = makeState({ currentStep: 'baseline_result', baselineEstablished: false });
    expect(canTransitionTo(notEstablished, 'next_action')).toBe(false);

    const established = makeState({ currentStep: 'baseline_result', baselineEstablished: true });
    expect(canTransitionTo(established, 'next_action')).toBe(true);
  });
});

describe('baseline retry strategy', () => {
  const ALL_FAILURE_REASONS: BaselineFailureReason[] = [
    'coverage_insufficient',
    'brightness_insufficient',
    'stability_insufficient',
    'sqi_insufficient',
    'scan_timeout',
    'user_cancelled',
    'no_readings',
    'all_rejected',
    'insufficient_duration',
    'insufficient_quality',
  ];

  it('allows retry below the attempt cap', () => {
    const state = makeState({ attemptCount: MAX_CALIBRATION_ATTEMPTS - 1 });
    const result = evaluateRetryStrategy(state);
    expect(result.canRetry).toBe(true);
    expect(result.suggestAlternativeSensor).toBe(false);
  });

  it('gives generic guidance when no failure has been classified', () => {
    const result = evaluateRetryStrategy(makeState({ attemptCount: 1, failureReasons: [] }));
    expect(result.guidance).toBe('請再試一次');
  });

  it.each(ALL_FAILURE_REASONS)('gives actionable guidance for %s', (reason) => {
    const result = evaluateRetryStrategy(
      makeState({ attemptCount: 1, failureReasons: [reason] }),
    );
    expect(result.canRetry).toBe(true);
    expect(result.guidance.length).toBeGreaterThan(5);
  });

  it('bases guidance on the most recent failure', () => {
    const result = evaluateRetryStrategy(
      makeState({
        attemptCount: 2,
        failureReasons: ['scan_timeout', 'brightness_insufficient'],
      }),
    );
    expect(result.guidance).toContain('光線');
  });

  it('prefixes repeat-attempt guidance with last-time context', () => {
    const result = evaluateRetryStrategy(
      makeState({ attemptCount: 2, failureReasons: ['coverage_insufficient'] }),
    );
    expect(result.guidance.startsWith('上次的問題是')).toBe(true);
  });

  it('suggests the alternative sensor after max finger attempts', () => {
    const result = evaluateRetryStrategy(
      makeState({ attemptCount: MAX_CALIBRATION_ATTEMPTS, sensorChoice: 'finger' }),
    );
    expect(result.canRetry).toBe(false);
    expect(result.suggestAlternativeSensor).toBe(true);
    expect(result.guidance).toContain('臉部');
  });

  it('suggests environment adjustment after max face attempts', () => {
    const result = evaluateRetryStrategy(
      makeState({ attemptCount: MAX_CALIBRATION_ATTEMPTS, sensorChoice: 'face_beta' }),
    );
    expect(result.canRetry).toBe(false);
    expect(result.guidance).toContain('光線');
  });
});

describe('baseline success criteria', () => {
  it('is not within target while incomplete', () => {
    expect(isWithinTargetTime(makeState({ completedAt: null }))).toBe(false);
  });

  it('accepts completion at exactly the target boundary', () => {
    const startedAt = 1_000_000;
    const state = makeState({
      startedAt,
      completedAt: startedAt + TARGET_COMPLETION_SEC * 1000,
    });
    expect(isWithinTargetTime(state)).toBe(true);
  });

  it('rejects completion past the target', () => {
    const startedAt = 1_000_000;
    const state = makeState({
      startedAt,
      completedAt: startedAt + (TARGET_COMPLETION_SEC + 1) * 1000,
    });
    expect(isWithinTargetTime(state)).toBe(false);
  });
});

describe('baseline onboarding eligibility', () => {
  it('shows onboarding when no baseline exists', () => {
    expect(shouldShowBaselineOnboarding(false, 'mature')).toBe(true);
  });

  it('shows onboarding while the baseline is still new', () => {
    expect(shouldShowBaselineOnboarding(true, 'new')).toBe(true);
  });

  it('skips onboarding once the baseline is past new', () => {
    expect(shouldShowBaselineOnboarding(true, 'building')).toBe(false);
    expect(shouldShowBaselineOnboarding(true, 'mature')).toBe(false);
  });
});
