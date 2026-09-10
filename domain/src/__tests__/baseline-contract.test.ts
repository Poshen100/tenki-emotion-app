import {
  MIN_SECONDS_FOR_HRV_BASELINE,
  NEXT_ACTIONS,
  ONBOARDING_STEP_ORDER,
  SENSOR_CHOICES,
  createInitialOnboardingState,
} from '../index';

describe('baseline contract constants', () => {
  it('defines the canonical 6-step order', () => {
    expect(ONBOARDING_STEP_ORDER).toHaveLength(6);
    expect(ONBOARDING_STEP_ORDER[0]).toBe('intro');
    expect(ONBOARDING_STEP_ORDER[ONBOARDING_STEP_ORDER.length - 1]).toBe('next_action');
    expect(new Set(ONBOARDING_STEP_ORDER).size).toBe(ONBOARDING_STEP_ORDER.length);
  });

  it('offers finger (stable) and face (beta) sensors with time estimates', () => {
    expect(SENSOR_CHOICES).toHaveLength(2);
    const finger = SENSOR_CHOICES.find((c) => c.id === 'finger');
    const face = SENSOR_CHOICES.find((c) => c.id === 'face_beta');
    expect(finger?.isBeta).toBe(false);
    expect(finger?.estimatedTimeSec).toBe(90);
    expect(face?.isBeta).toBe(true);
    expect(face?.estimatedTimeSec).toBe(60);
  });

  it('offers three distinct post-baseline next actions', () => {
    expect(NEXT_ACTIONS).toHaveLength(3);
    expect(new Set(NEXT_ACTIONS.map((a) => a.id)).size).toBe(3);
  });
});

describe('createInitialOnboardingState', () => {
  it('starts a first-time user at intro with clean attempt state', () => {
    const before = Date.now();
    const state = createInitialOnboardingState();
    const after = Date.now();

    expect(state.currentStep).toBe('intro');
    expect(state.sensorChoice).toBeNull();
    expect(state.isFirstTime).toBe(true);
    expect(state.attemptCount).toBe(1);
    expect(state.failureReasons).toEqual([]);
    expect(state.baselineEstablished).toBe(false);
    expect(state.completedAt).toBeNull();
    expect(state.startedAt).toBeGreaterThanOrEqual(before);
    expect(state.startedAt).toBeLessThanOrEqual(after);
  });
});

describe('the sensor choice cannot promise what the signal chain cannot do', () => {
  it('never offers an HRV baseline in less time than one can be measured', () => {
    // 🔴 The previous value was 30 seconds, and a test asserted it — locking a
    // promise in place without ever checking it was achievable. Measured, a
    // 30-second window produced an HRV estimate 0 times out of 12.
    const finger = SENSOR_CHOICES.find((c) => c.id === 'finger');

    expect(finger?.estimatedTimeSec).toBeGreaterThanOrEqual(MIN_SECONDS_FOR_HRV_BASELINE);
  });

  it('does not claim one sensor is steadier than the other', () => {
    // A comparative claim with no measurement behind it. The source priority
    // already ranks them; the copy does not need to editorialise.
    for (const choice of SENSOR_CHOICES) {
      expect(choice.description).not.toContain('較穩定');
      expect(choice.description).not.toContain('更準');
    }
  });
});
