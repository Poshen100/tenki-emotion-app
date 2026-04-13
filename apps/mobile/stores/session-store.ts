import { create } from 'zustand';

type SessionMode = 'health_reset' | 'focus' | 'performance' | 'trader';
type SessionState = 'draft' | 'configured' | 'precheck' | 'scanning' | 'gated' | 'active' | 'paused' | 'completed' | 'reflection_pending' | 'archived';
type GateResult = 'clear_pass' | 'soft_caution' | 'red_gate' | 'force_hold';

interface SessionStoreState {
  mode: SessionMode | null;
  state: SessionState;
  gateResult: GateResult | null;
  edgeScore: number | null;
  elapsedSec: number;
  reflection: string;
  setMode: (mode: SessionMode) => void;
  setState: (state: SessionState) => void;
  setGateResult: (result: GateResult) => void;
  setEdgeScore: (score: number) => void;
  tick: () => void;
  setReflection: (text: string) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  mode: null,
  state: 'draft',
  gateResult: null,
  edgeScore: null,
  elapsedSec: 0,
  reflection: '',
  setMode: (mode) => set({ mode, state: 'configured' }),
  setState: (state) => set({ state }),
  setGateResult: (gateResult) => set({ gateResult }),
  setEdgeScore: (edgeScore) => set({ edgeScore }),
  tick: () => set((s) => ({ elapsedSec: s.elapsedSec + 1 })),
  setReflection: (reflection) => set({ reflection }),
  reset: () =>
    set({
      mode: null,
      state: 'draft',
      gateResult: null,
      edgeScore: null,
      elapsedSec: 0,
      reflection: '',
    }),
}));
