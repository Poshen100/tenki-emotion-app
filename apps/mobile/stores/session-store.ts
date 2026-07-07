import type { DomainGateResult } from '@tenki/domain';
import { create } from 'zustand';
import { useTimelineStore } from './timeline-store';

type SessionMode = 'health_reset' | 'focus' | 'performance' | 'trader';
type SessionState = 'draft' | 'configured' | 'precheck' | 'scanning' | 'gated' | 'active' | 'paused' | 'completed' | 'reflection_pending' | 'archived';
type GateResult = DomainGateResult;

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
  completeSession: () => void;
  reset: () => void;
}

let nextSessionId = 1;

export const useSessionStore = create<SessionStoreState>((set, get) => ({
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
  completeSession: () => {
    const { mode, edgeScore, elapsedSec } = get();
    if (mode) {
      useTimelineStore.getState().addSession({
        id: String(nextSessionId++),
        mode,
        edgeScore: edgeScore ?? 0,
        durationSec: elapsedSec,
        completedAt: Date.now(),
      });
    }
    set({ state: 'completed' });
  },
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
