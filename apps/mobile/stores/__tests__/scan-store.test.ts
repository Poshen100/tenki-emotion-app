import { useScanStore } from '../scan-store';

describe('scan-store', () => {
  beforeEach(() => {
    useScanStore.setState({
      scanType: 'quick',
      uiState: 'idle',
      metrics: { coverage: 0, stability: 0, signalQuality: 0 },
      lastResult: null,
    });
  });

  it('starts idle with zeroed metrics and no result', () => {
    const s = useScanStore.getState();
    expect(s.scanType).toBe('quick');
    expect(s.uiState).toBe('idle');
    expect(s.metrics).toEqual({ coverage: 0, stability: 0, signalQuality: 0 });
    expect(s.lastResult).toBeNull();
  });

  it('updateMetrics merges partial values without clobbering the rest', () => {
    const { updateMetrics } = useScanStore.getState();
    updateMetrics({ coverage: 0.4 });
    updateMetrics({ stability: 0.9 });
    expect(useScanStore.getState().metrics).toEqual({
      coverage: 0.4,
      stability: 0.9,
      signalQuality: 0,
    });
  });

  it('setResult stores the result and jumps uiState to results', () => {
    const result = {
      edgeScore: 74,
      scanType: 'deep' as const,
      duration: 30,
      timestamp: 123,
      metrics: { coverage: 1, stability: 1, signalQuality: 0.8 },
    };
    useScanStore.getState().setResult(result);
    const s = useScanStore.getState();
    expect(s.lastResult).toEqual(result);
    expect(s.uiState).toBe('results');
  });

  it('reset clears uiState and metrics but keeps scanType and lastResult', () => {
    const store = useScanStore.getState();
    store.setScanType('baseline');
    store.updateMetrics({ coverage: 0.7 });
    store.setResult({
      edgeScore: 60,
      scanType: 'baseline',
      duration: 10,
      timestamp: 1,
      metrics: { coverage: 0.7, stability: 0, signalQuality: 0 },
    });
    useScanStore.getState().reset();

    const s = useScanStore.getState();
    expect(s.uiState).toBe('idle');
    expect(s.metrics).toEqual({ coverage: 0, stability: 0, signalQuality: 0 });
    expect(s.scanType).toBe('baseline');
    expect(s.lastResult).not.toBeNull();
  });
});
