/**
 * @module stores/scan-store
 * @description Zustand store for scan state, now backed by the real v3 TENKI Engine.
 *
 * Exposes `startScan` and `cancelScan` actions that pipe through the
 * engine adapter, feeding live metrics back to the UI and producing
 * genuine EdgeScoreResult outputs.
 *
 * @version 3.0
 */

import { create } from 'zustand';
import type {
  ScanType,
  ScanUIState,
  LiveScanMetrics,
  EngineScanResult,
} from '../lib/engine-adapter';
import {
  startEngineScan,
  cancelEngineScan,
} from '../lib/engine-adapter';
import { useBaselineStore } from './baseline-store';

// ─────────────────────────────────────────────
// Public types (consumed by scan.tsx, index.tsx)
// ─────────────────────────────────────────────

export type { ScanType, ScanUIState, LiveScanMetrics };

export interface ScanResultSnapshot {
  /** Final Edge Score (0-100) */
  edgeScore: number;
  /** Zone label */
  zone: 'clear' | 'neutral' | 'strain';
  /** Confidence overall (0-1) */
  confidence: number;
  /** Confidence band */
  confidenceBand: 'high' | 'moderate' | 'low';
  /** Compliance-safe headline */
  headline: string;
  /** Compliance-safe body copy */
  body: string;
  /** Full driver breakdown */
  drivers: EngineScanResult['edgeScore']['drivers'];
  /** Scan type used */
  scanType: ScanType;
  /** Duration in seconds */
  duration: number;
  /** Unix ms timestamp */
  timestamp: number;
  /** Final live metrics */
  metrics: LiveScanMetrics;
}

// ─────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────

interface ScanState {
  scanType: ScanType;
  uiState: ScanUIState;
  metrics: LiveScanMetrics;
  lastResult: ScanResultSnapshot | null;
  errorMessage: string | null;

  setScanType: (type: ScanType) => void;
  startScan: () => void;
  cancelScan: () => void;
  reset: () => void;
}

const INITIAL_METRICS: LiveScanMetrics = { coverage: 0, stability: 0, signalQuality: 0 };

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useScanStore = create<ScanState>((set, get) => ({
  scanType: 'quick',
  uiState: 'idle',
  metrics: INITIAL_METRICS,
  lastResult: null,
  errorMessage: null,

  setScanType: (scanType) => {
    if (get().uiState !== 'idle') return; // Can't switch while scanning
    set({ scanType });
  },

  startScan: () => {
    const { scanType } = get();
    const baselineStore = useBaselineStore.getState();

    set({ uiState: 'searching', metrics: INITIAL_METRICS, errorMessage: null });

    startEngineScan(
      scanType,
      baselineStore.profile,
      baselineStore.recentScores,
      {
        onStateChange: (uiState) => set({ uiState }),

        onMetricsUpdate: (metrics) => set({ metrics }),

        onComplete: (result) => {
          // Snapshot the result into a UI-friendly shape
          const snapshot: ScanResultSnapshot = {
            edgeScore: result.edgeScore.score,
            zone: result.edgeScore.zone,
            confidence: result.edgeScore.confidence.overall,
            confidenceBand: result.edgeScore.confidence.band,
            headline: result.edgeScore.copy.headline,
            body: result.edgeScore.copy.body,
            drivers: result.edgeScore.drivers,
            scanType: result.scanType,
            duration: result.durationSec,
            timestamp: result.timestamp,
            metrics: result.finalMetrics,
          };

          set({ lastResult: snapshot });

          // Persist updated baseline and recent score
          baselineStore.setProfile(result.updatedBaseline);
          baselineStore.addRecentScore(result.edgeScore.score);
        },

        onError: (reason) => {
          set({ uiState: 'error', errorMessage: reason });
        },
      },
    );
  },

  cancelScan: () => {
    cancelEngineScan();
    set({ uiState: 'idle', metrics: INITIAL_METRICS });
  },

  reset: () => {
    cancelEngineScan();
    set({ uiState: 'idle', metrics: INITIAL_METRICS });
  },
}));
