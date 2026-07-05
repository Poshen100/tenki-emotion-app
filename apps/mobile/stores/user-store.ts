import { create } from 'zustand';

interface UserState {
  hasBaseline: boolean;
  baselineScore: number | null;
  cameraPermission: boolean;
  preferredMode: string | null;
  faceBaselineCount: number;
  setHasBaseline: (has: boolean) => void;
  setBaselineScore: (score: number) => void;
  setCameraPermission: (granted: boolean) => void;
  setPreferredMode: (mode: string) => void;
  setFaceBaselineCount: (count: number) => void;
  incrementFaceBaselineCount: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  hasBaseline: false,
  baselineScore: null,
  cameraPermission: false,
  preferredMode: null,
  faceBaselineCount: 1,
  setHasBaseline: (hasBaseline) => set({ hasBaseline }),
  setBaselineScore: (baselineScore) => set({ baselineScore, hasBaseline: true }),
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),
  setPreferredMode: (preferredMode) => set({ preferredMode }),
  setFaceBaselineCount: (faceBaselineCount) => set({ faceBaselineCount }),
  incrementFaceBaselineCount: () => set((state) => ({ faceBaselineCount: state.faceBaselineCount + 1 })),
}));
