/**
 * @module face-baseline/store
 * @description Production Zustand store for the full Face Baseline system —
 * one-time onboarding through ongoing baseline maturity.
 *
 * Privacy: this store holds only derived/quality signals and flow state.
 * Raw biometric frames never enter the store and never leave the device.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

import { create } from 'zustand';
import type {
  CapturePhase,
  EntryContext,
  EnvironmentChecks,
  FaceLockState,
  FlowStep,
  MaturityStage,
  PermissionState,
  ProcessingStatus,
  QualityMetrics,
  RefinementEntry,
  RetryReason,
} from '../types/faceBaseline.types';
import { maturityStage } from '../utils/maturityStage';

/** Full Face Baseline store shape: state + actions. */
export interface FaceBaselineState {
  step: FlowStep;
  permission: PermissionState;
  env: EnvironmentChecks;
  envReady: boolean;
  faceLock: FaceLockState;
  capturePhase: CapturePhase;
  quality: QualityMetrics;
  neutralProgress: number;
  arcProgress: number;
  stabilityProgress: number;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  retryReason: RetryReason | null;
  baselineConfidence: number;
  baselineEstablished: boolean;
  baselineMaturity: MaturityStage;
  scanCount: number;
  scansRequired: number;
  refinementHistory: RefinementEntry[];
  startedAt: number | null;
  reducedMotion: boolean;
  entryContext: EntryContext;

  // actions
  goTo: (step: FlowStep) => void;
  setPermission: (permission: PermissionState) => void;
  updateEnv: (patch: Partial<EnvironmentChecks>) => void;
  setFaceLock: (faceLock: FaceLockState) => void;
  setCapturePhase: (capturePhase: CapturePhase) => void;
  updateQuality: (patch: Partial<QualityMetrics>) => void;
  setNeutralProgress: (value: number) => void;
  setArcProgress: (value: number) => void;
  setStabilityProgress: (value: number) => void;
  setProcessing: (status: ProcessingStatus, progress?: number) => void;
  setRetry: (reason: RetryReason) => void;
  clearRetry: () => void;
  establishBaseline: (confidence: number) => void;
  recordScan: (entry: RefinementEntry) => void;
  setReducedMotion: (value: boolean) => void;
  setEntryContext: (entryContext: EntryContext) => void;
  reset: () => void;
}

/** Maximum refinement entries retained for the history list. */
export const MAX_HISTORY = 20;

/** Default scans-to-next-stage target surfaced on the maturity screen. */
export const DEFAULT_SCANS_REQUIRED = 5;

const initialState = {
  step: 'intro' as FlowStep,
  permission: 'unknown' as PermissionState,
  env: { lighting: false, distance: false, stability: false } as EnvironmentChecks,
  envReady: false,
  faceLock: 'searching' as FaceLockState,
  capturePhase: 'idle' as CapturePhase,
  quality: {
    sqi: 0,
    motion: 1,
    coverage: 0,
    brightness: 0,
    landmarkConfidence: 0,
    headPoseRange: 0,
    lightingUniformity: 0,
    eyeVisibility: 0,
    neutralExpressionConfidence: 0,
    totalBaselineConfidence: 0,
  } as QualityMetrics,
  neutralProgress: 0,
  arcProgress: 0,
  stabilityProgress: 0,
  processingStatus: 'idle' as ProcessingStatus,
  processingProgress: 0,
  retryReason: null as RetryReason | null,
  baselineConfidence: 0,
  baselineEstablished: false,
  baselineMaturity: 'new' as MaturityStage,
  scanCount: 0,
  scansRequired: DEFAULT_SCANS_REQUIRED,
  refinementHistory: [] as RefinementEntry[],
  startedAt: null as number | null,
  reducedMotion: false,
  entryContext: 'standalone' as EntryContext,
};

export const useFaceBaselineStore = create<FaceBaselineState>((set) => ({
  ...initialState,

  goTo: (step) => set((state) => ({ step, startedAt: state.startedAt ?? Date.now() })),

  setPermission: (permission) => set({ permission }),

  updateEnv: (patch) =>
    set((state) => {
      const env = { ...state.env, ...patch };
      return { env, envReady: env.lighting && env.distance && env.stability };
    }),

  setFaceLock: (faceLock) => set({ faceLock }),

  setCapturePhase: (capturePhase) => set({ capturePhase }),

  updateQuality: (patch) => set((state) => ({ quality: { ...state.quality, ...patch } })),

  setNeutralProgress: (neutralProgress) => set({ neutralProgress }),

  setArcProgress: (arcProgress) => set({ arcProgress }),

  setStabilityProgress: (stabilityProgress) => set({ stabilityProgress }),

  setProcessing: (processingStatus, processingProgress) =>
    set((state) => ({
      processingStatus,
      processingProgress: processingProgress ?? state.processingProgress,
    })),

  setRetry: (retryReason) => set({ retryReason, step: 'retry_needed' }),

  clearRetry: () => set({ retryReason: null }),

  establishBaseline: (baselineConfidence) =>
    set({
      baselineConfidence,
      baselineEstablished: true,
      processingStatus: 'success',
      step: 'success',
    }),

  recordScan: (entry) =>
    set((state) => {
      const scanCount = state.scanCount + 1;
      return {
        scanCount,
        baselineMaturity: maturityStage(scanCount),
        refinementHistory: [entry, ...state.refinementHistory].slice(0, MAX_HISTORY),
      };
    }),

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  setEntryContext: (entryContext) => set({ entryContext }),

  reset: () => set({ ...initialState }),
}));
