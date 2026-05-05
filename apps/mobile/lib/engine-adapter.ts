/**
 * @module lib/engine-adapter
 * @description Bridge between the mobile scan UI loop and the v3 TENKI Engine.
 *
 * During development (no real camera pipeline), this adapter generates
 * physiologically plausible biometric readings and feeds them through the
 * **real** engine scoring pipeline — so every Edge Score, Zone, Confidence,
 * and Driver result is authentic engine output, not faked numbers.
 *
 * When the native camera SDK becomes available, the only change required
 * is swapping `generateSimulatedReading` for the real PPG frame processor.
 *
 * @version 3.0
 */

import type {
  BiometricReading,
  BaselineProfile,
  SignalQuality,
  SleepRecoveryInput,
  ConfidenceBreakdown,
} from '../../../packages/engine/src/common/types';

import type {
  EdgeScoreResult,
  EdgeZone,
  ScoreDriver,
} from '../../../packages/engine/src/scoring/types';

import {
  calculateEdgeScore,
  classifyEdgeZone,
} from '../../../packages/engine/src/scoring/edge-score';

import type { EdgeScoreInput } from '../../../packages/engine/src/scoring/edge-score';

import {
  createEmptyBaselineProfile,
  updateBaselineProfile,
} from '../../../packages/engine/src/baseline/baseline';

import {
  calculateStressProxy,
} from '../../../packages/engine/src/biometric/stress-proxy';

import {
  getTimeBucket,
} from '../../../packages/engine/src/scoring/edge-score';

// ─────────────────────────────────────────────
// Types re-exported for mobile consumption
// ─────────────────────────────────────────────

export type { BiometricReading, BaselineProfile, SignalQuality, EdgeScoreResult, EdgeZone, ConfidenceBreakdown, ScoreDriver };

// ─────────────────────────────────────────────
// Scan Type → Duration mapping
// ─────────────────────────────────────────────

export type ScanType = 'quick' | 'deep' | 'baseline';

interface ScanDurationConfig {
  /** Total scan window in ms */
  totalMs: number;
  /** Number of biometric ticks during scan */
  tickCount: number;
  /** Minimum signal quality threshold (0-100) */
  minSignalQuality: number;
}

const SCAN_CONFIGS: Record<ScanType, ScanDurationConfig> = {
  quick:    { totalMs: 5_000,  tickCount: 5,  minSignalQuality: 55 },
  deep:     { totalMs: 10_000, tickCount: 8,  minSignalQuality: 65 },
  baseline: { totalMs: 18_000, tickCount: 12, minSignalQuality: 72 },
};

// ─────────────────────────────────────────────
// Simulated Reading Generator
// ─────────────────────────────────────────────

/**
 * Generates a physiologically plausible BiometricReading.
 *
 * Values are randomised around healthy-adult resting norms:
 *   HR  ~68 BPM (±8)
 *   HRV ~45 ms  (±12)
 *   RR  ~15 BrPM (±2)
 *
 * The `progress` parameter (0→1) simulates the user settling in
 * during a scan — later ticks tend to be slightly calmer.
 */
export function generateSimulatedReading(progress: number): BiometricReading {
  const settlingBias = progress * 0.15; // calmer as scan progresses
  const jitter = () => (Math.random() - 0.5) * 2;

  return {
    hrBpm: Math.round(68 + jitter() * 8 - settlingBias * 5),
    hrvRmssdMs: Math.round((45 + jitter() * 12 + settlingBias * 8) * 10) / 10,
    rrBrpm: Math.round((15 + jitter() * 2 - settlingBias * 1) * 10) / 10,
    timestamp: Date.now(),
  };
}

// ─────────────────────────────────────────────
// Simulated Signal Quality
// ─────────────────────────────────────────────

/**
 * Simulates signal quality ramping up over a scan window.
 * Early in the scan → lower quality; towards the end → near-perfect.
 */
export function generateSimulatedSignalQuality(progress: number): SignalQuality {
  const base = 50 + progress * 45 + (Math.random() - 0.5) * 10;
  const score = Math.max(20, Math.min(100, Math.round(base)));
  const coverage = Math.min(1, 0.55 + progress * 0.42 + Math.random() * 0.05);
  const stability = Math.min(1, 0.35 + progress * 0.55 + Math.random() * 0.08);

  const grade: SignalQuality['grade'] =
    score >= 85 ? 'A' :
    score >= 70 ? 'B' :
    score >= 55 ? 'C' :
    score >= 40 ? 'D' : 'F';

  return {
    score,
    grade,
    coverage: Math.round(coverage * 100) / 100,
    stability: Math.round(stability * 100) / 100,
    acceptable: score >= 40,
  };
}

// ─────────────────────────────────────────────
// Default sleep (no wearable connected yet)
// ─────────────────────────────────────────────

export const DEFAULT_SLEEP: SleepRecoveryInput = {
  durationHours: null,
  qualityScore: null,
  source: 'none',
  stalenessHours: 0,
};

// ─────────────────────────────────────────────
// Engine Scan Runner
// ─────────────────────────────────────────────

export interface EngineScanCallbacks {
  /** Called when UI state should transition */
  onStateChange: (state: ScanUIState) => void;
  /** Called each tick with live metrics for the meters */
  onMetricsUpdate: (metrics: LiveScanMetrics) => void;
  /** Called once when the scan completes with full engine result */
  onComplete: (result: EngineScanResult) => void;
  /** Called on fatal error */
  onError: (reason: string) => void;
}

export type ScanUIState =
  | 'idle'
  | 'searching'
  | 'detecting'
  | 'locked'
  | 'scanning'
  | 'processing'
  | 'results'
  | 'error';

export interface LiveScanMetrics {
  coverage: number;
  stability: number;
  signalQuality: number;
}

export interface EngineScanResult {
  edgeScore: EdgeScoreResult;
  scanType: ScanType;
  durationSec: number;
  timestamp: number;
  /** The updated baseline after this scan */
  updatedBaseline: BaselineProfile;
  /** UI-level metrics snapshot at scan completion */
  finalMetrics: LiveScanMetrics;
}

// ─────────────────────────────────────────────
// Active Scan Handle (for cancellation)
// ─────────────────────────────────────────────

let activeScanTimers: ReturnType<typeof setTimeout>[] = [];

export function cancelEngineScan(): void {
  activeScanTimers.forEach(clearTimeout);
  activeScanTimers = [];
}

// ─────────────────────────────────────────────
// Main: startEngineScan
// ─────────────────────────────────────────────

/**
 * Orchestrates a full scan using the real v3 engine.
 *
 * Flow:
 *   idle → searching → detecting → locked → scanning (N ticks) → processing → results
 *
 * Each tick during `scanning` generates a simulated BiometricReading,
 * runs it through the real engine's scoring pipeline, and feeds
 * live metrics back to the UI.
 *
 * The final EdgeScoreResult comes from `calculateEdgeScore` —
 * the exact same function used by the production pipeline.
 */
export function startEngineScan(
  scanType: ScanType,
  baseline: BaselineProfile,
  recentScores: number[],
  callbacks: EngineScanCallbacks,
): void {
  cancelEngineScan();

  const config = SCAN_CONFIGS[scanType];
  const schedule = (delay: number, fn: () => void) => {
    activeScanTimers.push(setTimeout(fn, delay));
  };

  let t = 0;
  let currentBaseline = { ...baseline };
  const readings: BiometricReading[] = [];
  let lastSignalQuality: SignalQuality | null = null;

  // ── Phase 1: Searching (camera warm-up) ──
  callbacks.onStateChange('searching');
  callbacks.onMetricsUpdate({ coverage: 0, stability: 0, signalQuality: 0 });

  schedule((t += 400), () => {
    callbacks.onMetricsUpdate({ coverage: 32, stability: 0, signalQuality: 15 });
  });

  schedule((t += 500), () => {
    callbacks.onMetricsUpdate({ coverage: 58, stability: 18, signalQuality: 35 });
  });

  // ── Phase 2: Detecting ──
  schedule((t += 600), () => {
    callbacks.onStateChange('detecting');
    callbacks.onMetricsUpdate({ coverage: 72, stability: 38, signalQuality: 52 });
  });

  schedule((t += 800), () => {
    callbacks.onMetricsUpdate({ coverage: 84, stability: 52, signalQuality: 65 });
  });

  // ── Phase 3: Locked ──
  schedule((t += 600), () => {
    callbacks.onStateChange('locked');
    callbacks.onMetricsUpdate({ coverage: 90, stability: 62, signalQuality: 74 });
  });

  // ── Phase 4: Scanning (real engine ticks) ──
  schedule((t += 500), () => {
    callbacks.onStateChange('scanning');
  });

  const tickInterval = config.totalMs / config.tickCount;

  for (let i = 0; i < config.tickCount; i++) {
    const tickIndex = i;
    schedule((t += tickInterval), () => {
      const progress = (tickIndex + 1) / config.tickCount;
      const reading = generateSimulatedReading(progress);
      const sq = generateSimulatedSignalQuality(progress);

      readings.push(reading);
      lastSignalQuality = sq;

      // Feed UI meters
      callbacks.onMetricsUpdate({
        coverage: Math.round(sq.coverage * 100),
        stability: Math.round(sq.stability * 100),
        signalQuality: sq.score,
      });

      // Update baseline with each accepted tick
      const timeBucket = getTimeBucket(reading.timestamp);
      const hrBaseline = currentBaseline.hr[timeBucket];
      const hrvBaseline = currentBaseline.hrv[timeBucket];
      const stress = calculateStressProxy(reading, hrBaseline, hrvBaseline);

      currentBaseline = updateBaselineProfile(
        currentBaseline,
        reading,
        stress.score,
      );
    });
  }

  // ── Phase 5: Processing ──
  schedule((t += 200), () => {
    callbacks.onStateChange('processing');
  });

  // ── Phase 6: Final edge score calculation ──
  schedule((t += 800), () => {
    if (!lastSignalQuality || readings.length === 0) {
      callbacks.onError('Insufficient data collected during scan');
      return;
    }

    // Use the last reading as the "representative" reading
    const finalReading = readings[readings.length - 1];

    const edgeInput: EdgeScoreInput = {
      reading: finalReading,
      baseline: currentBaseline,
      signalQuality: lastSignalQuality,
      sleepRecovery: DEFAULT_SLEEP,
      recentScores,
    };

    const edgeScoreResult = calculateEdgeScore(edgeInput);

    const result: EngineScanResult = {
      edgeScore: edgeScoreResult,
      scanType,
      durationSec: Math.round(t / 1000),
      timestamp: Date.now(),
      updatedBaseline: currentBaseline,
      finalMetrics: {
        coverage: Math.round(lastSignalQuality.coverage * 100),
        stability: Math.round(lastSignalQuality.stability * 100),
        signalQuality: lastSignalQuality.score,
      },
    };

    callbacks.onStateChange('results');
    callbacks.onComplete(result);
  });
}
