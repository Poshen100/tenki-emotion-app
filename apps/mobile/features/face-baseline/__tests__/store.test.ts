import { useFaceBaselineStore, MAX_HISTORY, DEFAULT_SCANS_REQUIRED } from '../store/faceBaselineStore';
import {
  selectQualityOk,
  selectTotalProgress,
  selectCanStartScan,
  selectActiveQualityStatus,
  selectMaturityRatio,
  selectHasBaseline,
} from '../store/selectors';
import type { RefinementEntry } from '../types/faceBaseline.types';

const reset = (): void => useFaceBaselineStore.getState().reset();

describe('faceBaselineStore — actions', () => {
  beforeEach(reset);

  it('starts in intro with sane defaults', () => {
    const s = useFaceBaselineStore.getState();
    expect(s.step).toBe('intro');
    expect(s.envReady).toBe(false);
    expect(s.baselineEstablished).toBe(false);
    expect(s.scansRequired).toBe(DEFAULT_SCANS_REQUIRED);
  });

  it('goTo sets startedAt exactly once', () => {
    const { goTo } = useFaceBaselineStore.getState();
    goTo('why_baseline');
    const first = useFaceBaselineStore.getState().startedAt;
    expect(first).not.toBeNull();
    goTo('secure' as never);
    expect(useFaceBaselineStore.getState().startedAt).toBe(first);
  });

  it('updateEnv flips envReady only when all three checks pass', () => {
    const { updateEnv } = useFaceBaselineStore.getState();
    updateEnv({ lighting: true, distance: true });
    expect(useFaceBaselineStore.getState().envReady).toBe(false);
    updateEnv({ stability: true });
    expect(useFaceBaselineStore.getState().envReady).toBe(true);
  });

  it('setRetry moves to retry_needed and stores the reason', () => {
    useFaceBaselineStore.getState().setRetry('movement');
    const s = useFaceBaselineStore.getState();
    expect(s.step).toBe('retry_needed');
    expect(s.retryReason).toBe('movement');
    s.clearRetry();
    expect(useFaceBaselineStore.getState().retryReason).toBeNull();
  });

  it('establishBaseline marks success', () => {
    useFaceBaselineStore.getState().establishBaseline(0.82);
    const s = useFaceBaselineStore.getState();
    expect(s.baselineEstablished).toBe(true);
    expect(s.baselineConfidence).toBeCloseTo(0.82);
    expect(s.processingStatus).toBe('success');
    expect(s.step).toBe('success');
  });

  it('recordScan increments count, advances maturity, and caps history', () => {
    const { recordScan } = useFaceBaselineStore.getState();
    const entry = (i: number): RefinementEntry => ({ at: i, label: `scan ${i}`, type: 'refined' });
    for (let i = 0; i < MAX_HISTORY + 5; i++) recordScan(entry(i));
    const s = useFaceBaselineStore.getState();
    expect(s.scanCount).toBe(MAX_HISTORY + 5);
    expect(s.refinementHistory).toHaveLength(MAX_HISTORY);
    expect(s.refinementHistory[0].label).toBe(`scan ${MAX_HISTORY + 4}`); // newest first
    expect(s.baselineMaturity).toBe('mature'); // > 15 scans
  });

  it('reset returns to the initial state', () => {
    const s = useFaceBaselineStore.getState();
    s.goTo('processing');
    s.establishBaseline(0.5);
    s.reset();
    expect(useFaceBaselineStore.getState().step).toBe('intro');
    expect(useFaceBaselineStore.getState().baselineEstablished).toBe(false);
  });

  it('entryContext defaults to standalone and setEntryContext updates it', () => {
    const s = useFaceBaselineStore.getState();
    expect(s.entryContext).toBe('standalone');
    s.setEntryContext('onboarding');
    expect(useFaceBaselineStore.getState().entryContext).toBe('onboarding');
  });
});

describe('selectors', () => {
  beforeEach(reset);

  it('selectTotalProgress uses processing progress while processing, else weighted capture', () => {
    const s = useFaceBaselineStore.getState();
    s.setNeutralProgress(1);
    s.setArcProgress(0);
    s.setStabilityProgress(0);
    expect(selectTotalProgress(useFaceBaselineStore.getState())).toBeCloseTo(0.5);
    s.setArcProgress(1);
    s.setStabilityProgress(1);
    expect(selectTotalProgress(useFaceBaselineStore.getState())).toBeCloseTo(1);
    s.setProcessing('running', 0.42);
    s.goTo('processing');
    expect(selectTotalProgress(useFaceBaselineStore.getState())).toBeCloseTo(0.42);
  });

  it('selectCanStartScan requires permission + envReady', () => {
    const s = useFaceBaselineStore.getState();
    expect(selectCanStartScan(useFaceBaselineStore.getState())).toBe(false);
    s.setPermission('granted');
    s.updateEnv({ lighting: true, distance: true, stability: true });
    expect(selectCanStartScan(useFaceBaselineStore.getState())).toBe(true);
  });

  it('selectActiveQualityStatus and selectQualityOk reflect quality', () => {
    const s = useFaceBaselineStore.getState();
    s.updateQuality({ sqi: 1, motion: 0, coverage: 1, brightness: 1 });
    expect(selectQualityOk(useFaceBaselineStore.getState())).toBe(true);
    expect(selectActiveQualityStatus(useFaceBaselineStore.getState())).toBe('good');
    s.updateQuality({ motion: 0.9 });
    expect(selectActiveQualityStatus(useFaceBaselineStore.getState())).toBe('movement');
  });

  it('selectMaturityRatio and selectHasBaseline track progress', () => {
    const s = useFaceBaselineStore.getState();
    expect(selectMaturityRatio(useFaceBaselineStore.getState())).toBe(0);
    expect(selectHasBaseline(useFaceBaselineStore.getState())).toBe(false);
    for (let i = 0; i < 5; i++) s.recordScan({ at: i, label: 'x', type: 'updated' });
    expect(selectMaturityRatio(useFaceBaselineStore.getState())).toBe(1); // 5 / 5, clamped
    s.establishBaseline(0.7);
    expect(selectHasBaseline(useFaceBaselineStore.getState())).toBe(true);
  });
});
