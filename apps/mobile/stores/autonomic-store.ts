import { create } from 'zustand';

export type AutonomicSource =
  | 'face_estimate'
  | 'finger_ppg'
  | 'watch_healthkit'
  | 'ble_chest'
  | 'fusion';

export interface AutonomicStateSnapshot {
  mapValue: number;
  snsLoad: number;
  pnsRecovery: number;
  source: AutonomicSource;
  confidence: number;
  wearableHrvApplied: boolean;
  updatedAt: number | null;
}

interface AutonomicStateStore extends AutonomicStateSnapshot {
  setAutonomicState: (patch: Partial<AutonomicStateSnapshot>) => void;
  deriveAndSetFromScan: (input: {
    edgeScore: number;
    stability: number;
    signalQuality: number;
    coverage: number;
    hrvRmssdMs?: number | null;
    source?: AutonomicSource;
    confidence?: number;
    wearableHrvApplied?: boolean;
  }) => void;
  resetAutonomicState: () => void;
}

const initialState: AutonomicStateSnapshot = {
  mapValue: 50,
  snsLoad: 50,
  pnsRecovery: 50,
  source: 'face_estimate',
  confidence: 0.5,
  wearableHrvApplied: false,
  updatedAt: null,
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function derivePnsRecovery(hrvRmssdMs: number | null | undefined, edgeScore: number): number {
  if (hrvRmssdMs == null || hrvRmssdMs <= 0) {
    return clamp(edgeScore * 0.72);
  }
  return clamp(18 + hrvRmssdMs * 1.15);
}

function deriveSnsLoad(stability: number, signalQuality: number, edgeScore: number): number {
  const instability = 100 - stability;
  const weakSignalPenalty = Math.max(0, 60 - signalQuality) * 0.35;
  return clamp(instability * 0.52 + weakSignalPenalty + (100 - edgeScore) * 0.28);
}

function deriveMapValue(snsLoad: number, pnsRecovery: number, coverage: number): number {
  const raw = 50 + (snsLoad - pnsRecovery) * 0.42 + (55 - coverage) * 0.08;
  return clamp(raw);
}

export const useAutonomicStore = create<AutonomicStateStore>((set) => ({
  ...initialState,

  setAutonomicState: (patch) =>
    set((state) => ({
      ...state,
      ...patch,
      updatedAt: patch.updatedAt ?? Date.now(),
    })),

  deriveAndSetFromScan: ({
    edgeScore,
    stability,
    signalQuality,
    coverage,
    hrvRmssdMs,
    source = 'face_estimate',
    confidence = 0.5,
    wearableHrvApplied = false,
  }) => {
    const pnsRecovery = derivePnsRecovery(hrvRmssdMs, edgeScore);
    const snsLoad = deriveSnsLoad(stability, signalQuality, edgeScore);
    const mapValue = deriveMapValue(snsLoad, pnsRecovery, coverage);

    set({
      mapValue,
      snsLoad,
      pnsRecovery,
      source,
      confidence,
      wearableHrvApplied,
      updatedAt: Date.now(),
    });
  },

  resetAutonomicState: () => set(initialState),
}));
