/**
 * @module scoring/edge-detector.test
 * @description Unit tests for the Edge Detector.
 */

import {
  createEdgeDetectorState,
  tickDetector,
  recordAlertFired,
  resetDailyAlerts,
  shouldFireAlert,
  DetectorTickInput,
} from '../edge-detector';
import { EDGE_DETECTOR_THRESHOLDS } from '../types';

function createTick(overrides: Partial<DetectorTickInput> = {}): DetectorTickInput {
  return {
    score: 80,
    confidence: 0.85,
    deltaSec: 60,
    quietHoursActive: false,
    ...overrides,
  };
}

describe('createEdgeDetectorState', () => {
  it('should start with no detection', () => {
    const state = createEdgeDetectorState();
    expect(state.isDetected).toBe(false);
    expect(state.strength).toBe('none');
    expect(state.detectedState).toBeNull();
    expect(state.alertsFiredToday).toBe(0);
  });
});

describe('tickDetector', () => {
  it('should not detect below soft threshold', () => {
    const state = createEdgeDetectorState();
    const result = tickDetector(state, createTick({ score: 50, confidence: 0.50 }));
    expect(result.isDetected).toBe(false);
  });

  it('should accumulate consecutive windows on soft detect', () => {
    let state = createEdgeDetectorState();
    state = tickDetector(state, createTick({ score: 70, confidence: 0.72 }));
    expect(state.consecutiveWindows).toBe(1);

    state = tickDetector(state, createTick({ score: 72, confidence: 0.74 }));
    expect(state.consecutiveWindows).toBeGreaterThanOrEqual(1);
  });

  it('should confirm after MIN_CONSECUTIVE_WINDOWS', () => {
    let state = createEdgeDetectorState();

    // First tick — not yet confirmed
    state = tickDetector(state, createTick({ score: 80, confidence: 0.85 }));

    // Second tick — should be confirmed (MIN = 2)
    state = tickDetector(state, createTick({ score: 82, confidence: 0.85 }));
    expect(state.isDetected).toBe(true);
    expect(state.strength).not.toBe('none');
  });

  it('should reset on score drop below threshold', () => {
    let state = createEdgeDetectorState();
    state = tickDetector(state, createTick({ score: 80, confidence: 0.85 }));
    state = tickDetector(state, createTick({ score: 82, confidence: 0.85 }));
    expect(state.isDetected).toBe(true);

    state = tickDetector(state, createTick({ score: 30, confidence: 0.40 }));
    expect(state.isDetected).toBe(false);
    expect(state.consecutiveWindows).toBe(0);
  });

  it('should suppress during quiet hours', () => {
    let state = createEdgeDetectorState();
    state = tickDetector(state, createTick({ quietHoursActive: true }));
    state = tickDetector(state, createTick({ quietHoursActive: true }));
    expect(state.suppressed).toBe(true);
    expect(state.suppressionReason).toContain('Quiet hours');
  });

  it('should classify strong detection', () => {
    let state = createEdgeDetectorState();
    state = tickDetector(state, createTick({
      score: EDGE_DETECTOR_THRESHOLDS.STRONG.minScore,
      confidence: EDGE_DETECTOR_THRESHOLDS.STRONG.minConfidence,
    }));
    state = tickDetector(state, createTick({
      score: EDGE_DETECTOR_THRESHOLDS.STRONG.minScore + 2,
      confidence: EDGE_DETECTOR_THRESHOLDS.STRONG.minConfidence,
    }));
    expect(state.strength).toBe('strong');
  });

  it('should accumulate heldDurationSec', () => {
    let state = createEdgeDetectorState();
    state = tickDetector(state, createTick({ deltaSec: 30 }));
    state = tickDetector(state, createTick({ deltaSec: 45 }));
    expect(state.heldDurationSec).toBe(75);
  });
});

describe('recordAlertFired', () => {
  it('should increment alert count', () => {
    const state = createEdgeDetectorState();
    const updated = recordAlertFired(state);
    expect(updated.alertsFiredToday).toBe(1);
  });
});

describe('resetDailyAlerts', () => {
  it('should reset alert count to 0', () => {
    let state = createEdgeDetectorState();
    state = recordAlertFired(state);
    state = recordAlertFired(state);
    const reset = resetDailyAlerts(state);
    expect(reset.alertsFiredToday).toBe(0);
  });
});

describe('shouldFireAlert', () => {
  it('should not fire if not detected', () => {
    const state = createEdgeDetectorState();
    expect(shouldFireAlert(state)).toBe(false);
  });

  it('should not fire if suppressed', () => {
    const state = {
      ...createEdgeDetectorState(),
      isDetected: true,
      heldDurationSec: 200,
      suppressed: true,
      suppressionReason: 'test',
    };
    expect(shouldFireAlert(state)).toBe(false);
  });

  it('should not fire if held duration insufficient', () => {
    const state = {
      ...createEdgeDetectorState(),
      isDetected: true,
      heldDurationSec: 60, // Below HOLD_DURATION_SEC (180)
    };
    expect(shouldFireAlert(state)).toBe(false);
  });

  it('should fire when detected + not suppressed + held long enough', () => {
    const state = {
      ...createEdgeDetectorState(),
      isDetected: true,
      heldDurationSec: EDGE_DETECTOR_THRESHOLDS.HOLD_DURATION_SEC,
      suppressed: false,
    };
    expect(shouldFireAlert(state)).toBe(true);
  });

  it('should suppress when daily cap reached', () => {
    let state = createEdgeDetectorState();
    for (let i = 0; i < EDGE_DETECTOR_THRESHOLDS.DAILY_ALERT_CAP; i++) {
      state = recordAlertFired(state);
    }
    state = tickDetector(state, createTick());
    state = tickDetector(state, createTick());
    expect(state.suppressed).toBe(true);
  });
});
