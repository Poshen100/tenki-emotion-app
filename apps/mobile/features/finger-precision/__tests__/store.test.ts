import { useFingerPrecisionStore } from '../store/fingerPrecisionStore';
import {
  selectReadinessReady,
  selectCanStartScan,
  selectTotalProgress,
  selectCanStopEarly,
} from '../store/selectors';

const reset = (): void => useFingerPrecisionStore.getState().reset();

describe('fingerPrecisionStore — actions', () => {
  beforeEach(reset);

  it('starts in intro with sane defaults', () => {
    const s = useFingerPrecisionStore.getState();
    expect(s.step).toBe('intro');
    expect(s.readinessReady).toBe(false);
    expect(s.result).toBeNull();
    expect(s.contactDetected).toBe(false);
  });

  it('goTo sets startedAt exactly once', () => {
    const { goTo } = useFingerPrecisionStore.getState();
    goTo('placement_guide');
    const first = useFingerPrecisionStore.getState().startedAt;
    expect(first).not.toBeNull();
    goTo('signal_locking');
    expect(useFingerPrecisionStore.getState().startedAt).toBe(first);
  });

  it('setDotStatus flips readinessReady only when conditions met', () => {
    const { setDotStatus } = useFingerPrecisionStore.getState();
    
    // Set two red, one green
    setDotStatus({ cover: 'green', still: 'red', pressure: 'red' });
    expect(useFingerPrecisionStore.getState().readinessReady).toBe(false);

    // Set all green
    setDotStatus({ cover: 'green', still: 'green', pressure: 'green' });
    expect(useFingerPrecisionStore.getState().readinessReady).toBe(true);

    // Set two green, one yellow (should pass)
    setDotStatus({ cover: 'green', still: 'green', pressure: 'yellow' });
    expect(useFingerPrecisionStore.getState().readinessReady).toBe(true);

    // Set one green, two yellow (should fail - needs at least two green)
    setDotStatus({ cover: 'green', still: 'yellow', pressure: 'yellow' });
    expect(useFingerPrecisionStore.getState().readinessReady).toBe(false);
  });

  it('incrementRecovery stores reason and increments count', () => {
    const { incrementRecovery } = useFingerPrecisionStore.getState();
    incrementRecovery('pressure_high');
    let s = useFingerPrecisionStore.getState();
    expect(s.recoveryCount).toBe(1);
    expect(s.recoveryReason).toBe('pressure_high');

    incrementRecovery('finger_moved');
    s = useFingerPrecisionStore.getState();
    expect(s.recoveryCount).toBe(2);
    expect(s.recoveryReason).toBe('finger_moved');
  });

  it('setResult updates store with final results', () => {
    const { setResult } = useFingerPrecisionStore.getState();
    const mockResult = {
      bpm: 72,
      hrvRmssdMs: 45,
      rrBrpm: 14,
      validBeats: 150,
      signalQualityScore: 92,
      confidenceUplift: 0.12,
    };
    setResult(mockResult, 'high_confidence_blend');
    const s = useFingerPrecisionStore.getState();
    expect(s.result).toEqual(mockResult);
    expect(s.blendMode).toBe('high_confidence_blend');
    expect(s.processingStatus).toBe('done');
  });
});

describe('selectors', () => {
  beforeEach(reset);

  it('selectCanStartScan requires cameraPermission + readinessReady', () => {
    const s = useFingerPrecisionStore.getState();
    expect(selectCanStartScan(useFingerPrecisionStore.getState())).toBe(false);
    
    s.setCameraPermission('granted');
    s.setDotStatus({ cover: 'green', still: 'green', pressure: 'green' });
    expect(selectCanStartScan(useFingerPrecisionStore.getState())).toBe(true);
  });

  it('selectTotalProgress behaves correctly based on active step', () => {
    const s = useFingerPrecisionStore.getState();
    expect(selectTotalProgress(useFingerPrecisionStore.getState())).toBe(0);

    // During build
    s.goTo('precision_build');
    s.updatePrecision({ overallProgress: 0.45 });
    expect(selectTotalProgress(useFingerPrecisionStore.getState())).toBe(0.45);

    // During processing
    s.goTo('processing');
    s.setProcessing('computing', 0.85);
    expect(selectTotalProgress(useFingerPrecisionStore.getState())).toBe(0.85);
  });
});
