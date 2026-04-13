import { create } from 'zustand';

interface UserState {
  hasBaseline: boolean;
  baselineScore: number | null;
  cameraPermission: boolean;
  preferredMode: string | null;
  setHasBaseline: (has: boolean) => void;
  setBaselineScore: (score: number) => void;
  setCameraPermission: (granted: boolean) => void;
  setPreferredMode: (mode: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  hasBaseline: false,
  baselineScore: null,
  cameraPermission: false,
  preferredMode: null,
  setHasBaseline: (hasBaseline) => set({ hasBaseline }),
  setBaselineScore: (baselineScore) => set({ baselineScore, hasBaseline: true }),
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),
  setPreferredMode: (preferredMode) => set({ preferredMode }),
}));
