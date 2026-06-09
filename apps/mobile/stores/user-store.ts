import { create } from 'zustand';

interface UserState {
  hasBaseline: boolean;
  baselineScore: number | null;
  cameraPermission: boolean;
  preferredMode: string | null;
  fingerReminderDismissed: boolean;
  faceBaselineCount: number;
  lastFingerCalibrationTime: number | null;
  setHasBaseline: (has: boolean) => void;
  setBaselineScore: (score: number) => void;
  setCameraPermission: (granted: boolean) => void;
  setPreferredMode: (mode: string) => void;
  setFingerReminderDismissed: (dismissed: boolean) => void;
  setLastFingerCalibrationTime: (time: number | null) => void;
  setFaceBaselineCount: (count: number) => void;
  incrementFaceBaselineCount: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  hasBaseline: false,
  baselineScore: null,
  cameraPermission: false,
  preferredMode: null,
  fingerReminderDismissed: false,
  faceBaselineCount: 1,
  lastFingerCalibrationTime: null,
  setHasBaseline: (hasBaseline) => set({ hasBaseline }),
  setBaselineScore: (baselineScore) => set({ baselineScore, hasBaseline: true }),
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),
  setPreferredMode: (preferredMode) => set({ preferredMode }),
  setFingerReminderDismissed: (fingerReminderDismissed) => set({ fingerReminderDismissed }),
  setLastFingerCalibrationTime: (lastFingerCalibrationTime) => set({ lastFingerCalibrationTime }),
  setFaceBaselineCount: (faceBaselineCount) => set({ faceBaselineCount }),
  incrementFaceBaselineCount: () => set((state) => ({ faceBaselineCount: state.faceBaselineCount + 1 })),
}));
