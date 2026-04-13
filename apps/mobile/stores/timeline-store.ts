import { create } from 'zustand';

type SessionMode = 'health_reset' | 'focus' | 'performance' | 'trader';

interface CompletedSession {
  id: string;
  mode: SessionMode;
  edgeScore: number;
  durationSec: number;
  completedAt: number;
}

interface TimelineState {
  sessions: CompletedSession[];
  addSession: (session: CompletedSession) => void;
  clearAll: () => void;
}

export type { CompletedSession };

export const useTimelineStore = create<TimelineState>((set) => ({
  sessions: [],
  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),
  clearAll: () => set({ sessions: [] }),
}));
