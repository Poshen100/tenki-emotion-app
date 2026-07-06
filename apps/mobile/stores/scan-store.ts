import type { DomainScanType } from '@tenki/domain';
import { create } from 'zustand';

type ScanType = DomainScanType;
type ScanUIState = 'idle' | 'searching' | 'detecting' | 'locked' | 'scanning' | 'processing' | 'results' | 'error';

interface ScanMetrics {
  coverage: number;
  stability: number;
  signalQuality: number;
}

interface ScanResult {
  edgeScore: number;
  scanType: ScanType;
  duration: number;
  timestamp: number;
  metrics: ScanMetrics;
}

interface ScanState {
  scanType: ScanType;
  uiState: ScanUIState;
  metrics: ScanMetrics;
  lastResult: ScanResult | null;
  setScanType: (type: ScanType) => void;
  setUiState: (state: ScanUIState) => void;
  updateMetrics: (metrics: Partial<ScanMetrics>) => void;
  setResult: (result: ScanResult) => void;
  reset: () => void;
}

const initialMetrics: ScanMetrics = { coverage: 0, stability: 0, signalQuality: 0 };

export const useScanStore = create<ScanState>((set) => ({
  scanType: 'quick',
  uiState: 'idle',
  metrics: initialMetrics,
  lastResult: null,
  setScanType: (scanType) => set({ scanType }),
  setUiState: (uiState) => set({ uiState }),
  updateMetrics: (partial) =>
    set((state) => ({ metrics: { ...state.metrics, ...partial } })),
  setResult: (lastResult) => set({ lastResult, uiState: 'results' }),
  reset: () => set({ uiState: 'idle', metrics: initialMetrics }),
}));
