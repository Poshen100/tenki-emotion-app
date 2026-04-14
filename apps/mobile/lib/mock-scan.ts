import { useScanStore } from '../stores/scan-store';

type ScanType = 'quick' | 'deep' | 'baseline';

interface ScanDurations {
  searching: number;
  detecting: number;
  scanning: number;
  processing: number;
}

const DURATIONS_BY_TYPE: Record<ScanType, ScanDurations> = {
  quick: { searching: 1200, detecting: 1500, scanning: 4000, processing: 800 },
  deep: { searching: 1500, detecting: 1800, scanning: 8000, processing: 1200 },
  baseline: { searching: 2000, detecting: 2000, scanning: 15000, processing: 1500 },
};

const TIMEOUT_HANDLES: { current: ReturnType<typeof setTimeout>[] } = { current: [] };

/** Cancel any in-flight mock scan and reset the store. */
export function cancelMockScan(): void {
  TIMEOUT_HANDLES.current.forEach(clearTimeout);
  TIMEOUT_HANDLES.current = [];
  useScanStore.getState().reset();
}

/**
 * Simulates a scan progression through the 8 UI states with realistic metric
 * ramping. Pipes results into useScanStore so the wired UI updates live.
 *
 * Used as a stand-in for the real camera pipeline until the native build is
 * available — lets the full scan flow be exercised end-to-end in dev.
 */
export function startMockScan(scanType: ScanType): void {
  // Cancel any existing scan first
  cancelMockScan();

  const store = useScanStore.getState();
  const durations = DURATIONS_BY_TYPE[scanType];

  store.setScanType(scanType);
  store.setUiState('searching');
  store.updateMetrics({ coverage: 0, stability: 0, signalQuality: 0 });

  const schedule = (delay: number, fn: () => void) => {
    TIMEOUT_HANDLES.current.push(setTimeout(fn, delay));
  };

  let t = 0;

  // Phase 1: searching — coverage climbs
  schedule((t += 400), () => useScanStore.getState().updateMetrics({ coverage: 35 }));
  schedule((t += 400), () => useScanStore.getState().updateMetrics({ coverage: 62 }));
  schedule((t += durations.searching - 800), () => {
    useScanStore.getState().setUiState('detecting');
    useScanStore.getState().updateMetrics({ coverage: 78, signalQuality: 45 });
  });

  // Phase 2: detecting — signal quality stabilizes
  schedule((t += 500), () => useScanStore.getState().updateMetrics({ signalQuality: 62, stability: 30 }));
  schedule((t += durations.detecting - 500), () => {
    useScanStore.getState().setUiState('locked');
    useScanStore.getState().updateMetrics({ coverage: 88, signalQuality: 78, stability: 55 });
  });

  // Phase 3: locked — brief pause then auto-start scanning
  schedule((t += 600), () => {
    useScanStore.getState().setUiState('scanning');
  });

  // Phase 4: scanning — metrics ramp up over duration
  const scanSteps = 5;
  const stepDelay = durations.scanning / scanSteps;
  for (let i = 1; i <= scanSteps; i++) {
    const progress = i / scanSteps;
    schedule((t += stepDelay), () => {
      useScanStore.getState().updateMetrics({
        coverage: Math.round(88 + 10 * progress),
        signalQuality: Math.round(78 + 18 * progress),
        stability: Math.round(55 + 35 * progress),
      });
    });
  }

  // Phase 5: processing
  schedule(t + 100, () => useScanStore.getState().setUiState('processing'));

  // Phase 6: results — compute a mock edge score
  schedule(t + 100 + durations.processing, () => {
    const finalMetrics = useScanStore.getState().metrics;
    const edgeScore = generateMockEdgeScore(finalMetrics.signalQuality);
    useScanStore.getState().setResult({
      edgeScore,
      scanType,
      duration: Math.round((t + 100 + durations.processing) / 1000),
      timestamp: Date.now(),
      metrics: finalMetrics,
    });
  });
}

/** Generate a plausible edge score with some variance tied to signal quality. */
function generateMockEdgeScore(signalQuality: number): number {
  // Bias around 65 with signal quality nudge and randomness
  const base = 55 + (signalQuality - 70) * 0.4;
  const jitter = Math.floor(Math.random() * 30) - 10;
  return Math.max(10, Math.min(95, Math.round(base + jitter)));
}
