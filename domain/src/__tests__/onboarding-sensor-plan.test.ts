import {
  DRIVERS_LOST_WITHOUT_HRV,
  EDGE_WEIGHT_WITHOUT_HRV,
  hasHrvCapableSource,
  planOnboardingBaselines,
} from '../policies/onboarding-sensor-plan';

describe('which baselines a new user builds', () => {
  it('always builds the face baseline — the finger path never replaces it', () => {
    // 🔴 The two measure different things. The face baseline is Soul Scan's
    // reference; the finger baseline is HRV's. `SOUL-SCAN-NORTH-STAR.md` §1
    // keeps the face as the daily entry point, and nothing here changes that.
    for (const connectedPlatforms of [[], ['healthkit'], ['ble_chest']] as const) {
      const plan = planOnboardingBaselines({ connectedPlatforms });
      expect(plan.steps[0]).toBe('face_baseline');
    }
  });

  it('adds the finger baseline when nothing else can supply HRV', () => {
    const plan = planOnboardingBaselines({ connectedPlatforms: [] });

    expect(plan.steps).toEqual(['face_baseline', 'finger_pulse_baseline']);
    expect(plan.fingerRationale).toBe('only_pulse_reference');
  });

  it('leaves it out when a connected wearable already supplies HRV', () => {
    for (const platform of ['healthkit', 'health_connect', 'ble_chest'] as const) {
      const plan = planOnboardingBaselines({ connectedPlatforms: [platform] });
      expect(plan.steps).toEqual(['face_baseline']);
      expect(plan.fingerRationale).toBe('wearable_supplies_hrv');
    }
  });

  it('does not count a source that supplies no HRV', () => {
    // The camera is a source, but not of HRV — the repo's own ranking puts it
    // below finger_scan. Manual entry and the Garmin cloud supply none either.
    for (const platform of ['camera', 'manual', 'garmin_api', 'finger_scan'] as const) {
      expect(hasHrvCapableSource({ connectedPlatforms: [platform] })).toBe(false);
    }
  });

  it('keeps the finger step skippable', () => {
    // A baseline built by a cornered user is a baseline built badly. The honest
    // move is to say what skipping costs, not to remove the door.
    expect(planOnboardingBaselines({ connectedPlatforms: [] }).fingerSkippable).toBe(true);
  });

  it('names exactly the drivers that go unmeasured, and what they are worth', () => {
    // The cost of skipping, in the score's own terms.
    expect(DRIVERS_LOST_WITHOUT_HRV).toEqual(['hrv_vs_baseline', 'stress_proxy_vs_baseline']);
    expect(EDGE_WEIGHT_WITHOUT_HRV).toBe(40);
  });
});
