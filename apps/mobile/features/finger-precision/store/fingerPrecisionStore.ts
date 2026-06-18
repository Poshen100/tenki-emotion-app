/**
 * @module finger-precision/store/fingerPrecisionStore
 * @description Zustand store for Finger PPG Precision Flow.
 *
 * @version 1.0
 */

import { create } from 'zustand';
import type {
  FingerFlowStep,
  DotStatus,
  FingerQualityMetrics,
  PrecisionProgress,
  FingerPrecisionResult,
  FingerRecoveryReason,
} from '../types';

export interface FingerPrecisionState {
  step: FingerFlowStep;
  cameraPermission: 'unknown' | 'granted' | 'denied' | 'blocked';
  torchAvailable: boolean;
  
  coverStatus: DotStatus;
  stillStatus: DotStatus;
  pressureStatus: DotStatus;
  readinessReady: boolean;
  
  quality: FingerQualityMetrics;
  
  contactDetected: boolean;
  signalLocked: boolean;
  currentBpm: number | null;
  currentHrvRmssd: number | null;
  
  precision: PrecisionProgress;
  
  processingStatus: 'idle' | 'computing' | 'blending' | 'done';
  processingProgress: number;
  
  result: FingerPrecisionResult | null;
  blendMode: 'high_confidence_blend' | 'signal_added' | 'face_only' | null;
  
  recoveryCount: number;
  recoveryReason: FingerRecoveryReason | null;
  
  retryCount: number;
  retryReason: string | null;
  
  reducedMotion: boolean;
  startedAt: number | null;

  // Actions
  goTo: (step: FingerFlowStep) => void;
  setCameraPermission: (permission: 'unknown' | 'granted' | 'denied' | 'blocked') => void;
  setTorchAvailable: (available: boolean) => void;
  updateQuality: (patch: Partial<FingerQualityMetrics>) => void;
  setDotStatus: (dots: { cover?: DotStatus; still?: DotStatus; pressure?: DotStatus }) => void;
  setContactDetected: (detected: boolean) => void;
  setSignalLocked: (locked: boolean) => void;
  setCurrentBpm: (bpm: number | null) => void;
  setCurrentHrvRmssd: (hrv: number | null) => void;
  updatePrecision: (patch: Partial<PrecisionProgress>) => void;
  setProcessing: (status: 'idle' | 'computing' | 'blending' | 'done', progress?: number) => void;
  setResult: (result: FingerPrecisionResult | null, blendMode?: 'high_confidence_blend' | 'signal_added' | 'face_only' | null) => void;
  incrementRecovery: (reason: FingerRecoveryReason) => void;
  resetRecovery: () => void;
  incrementRetry: (reason: string) => void;
  clearRetry: () => void;
  setReducedMotion: (value: boolean) => void;
  reset: () => void;
}

const defaultQuality: FingerQualityMetrics = {
  fingerCoverage: 0,
  flashVisibility: 0,
  contactPressure: 0,
  motionStability: 1, // 1 means stable (idle)
  pulseWaveform: 0,
  beatRegularity: 0,
  ambientLight: 0,
  totalPpgConfidence: 0,
};

const defaultPrecision: PrecisionProgress = {
  validBeats: 0,
  targetBeats: 150,
  elapsedMs: 0,
  currentTier: 'quick',
  tierProgress: 0,
  overallProgress: 0,
  canStopEarly: false,
};

const initialState = {
  step: 'intro' as FingerFlowStep,
  cameraPermission: 'unknown' as 'unknown' | 'granted' | 'denied' | 'blocked',
  torchAvailable: false,
  
  coverStatus: 'red' as DotStatus,
  stillStatus: 'red' as DotStatus,
  pressureStatus: 'red' as DotStatus,
  readinessReady: false,
  
  quality: defaultQuality,
  
  contactDetected: false,
  signalLocked: false,
  currentBpm: null as number | null,
  currentHrvRmssd: null as number | null,
  
  precision: defaultPrecision,
  
  processingStatus: 'idle' as 'idle' | 'computing' | 'blending' | 'done',
  processingProgress: 0,
  
  result: null as FingerPrecisionResult | null,
  blendMode: null as 'high_confidence_blend' | 'signal_added' | 'face_only' | null,
  
  recoveryCount: 0,
  recoveryReason: null as FingerRecoveryReason | null,
  
  retryCount: 0,
  retryReason: null as string | null,
  
  reducedMotion: false,
  startedAt: null as number | null,
};

export const useFingerPrecisionStore = create<FingerPrecisionState>((set) => ({
  ...initialState,

  goTo: (step) => set((state) => ({ step, startedAt: state.startedAt ?? Date.now() })),

  setCameraPermission: (cameraPermission) => set({ cameraPermission }),

  setTorchAvailable: (torchAvailable) => set({ torchAvailable }),

  updateQuality: (patch) => set((state) => ({ quality: { ...state.quality, ...patch } })),

  setDotStatus: (dots) =>
    set((state) => {
      const coverStatus = dots.cover ?? state.coverStatus;
      const stillStatus = dots.still ?? state.stillStatus;
      const pressureStatus = dots.pressure ?? state.pressureStatus;

      // Readiness logic: all must be >= yellow (green or yellow), and at least two must be green.
      const statuses = [coverStatus, stillStatus, pressureStatus];
      const allAtLeastYellow = statuses.every((s) => s === 'green' || s === 'yellow');
      const greenCount = statuses.filter((s) => s === 'green').length;
      const readinessReady = allAtLeastYellow && greenCount >= 2;

      return {
        coverStatus,
        stillStatus,
        pressureStatus,
        readinessReady,
      };
    }),

  setContactDetected: (contactDetected) => set({ contactDetected }),

  setSignalLocked: (signalLocked) => set({ signalLocked }),

  setCurrentBpm: (currentBpm) => set({ currentBpm }),

  setCurrentHrvRmssd: (currentHrvRmssd) => set({ currentHrvRmssd }),

  updatePrecision: (patch) =>
    set((state) => {
      const precision = { ...state.precision, ...patch };
      return { precision };
    }),

  setProcessing: (processingStatus, processingProgress) =>
    set((state) => ({
      processingStatus,
      processingProgress: processingProgress ?? state.processingProgress,
    })),

  setResult: (result, blendMode) =>
    set({
      result,
      blendMode: blendMode ?? null,
      processingStatus: result ? 'done' : 'idle',
    }),

  incrementRecovery: (recoveryReason) =>
    set((state) => ({
      recoveryCount: state.recoveryCount + 1,
      recoveryReason,
    })),

  resetRecovery: () => set({ recoveryCount: 0, recoveryReason: null }),

  incrementRetry: (retryReason) =>
    set((state) => ({
      retryCount: state.retryCount + 1,
      retryReason,
      step: 'retry_needed',
    })),

  clearRetry: () => set({ retryReason: null }),

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  reset: () => set({ ...initialState }),
}));
