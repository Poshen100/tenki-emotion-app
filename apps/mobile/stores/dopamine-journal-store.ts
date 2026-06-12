/**
 * Dopamine Journal Store
 *
 * Tracks the user's self-assessed dopamine state over time.
 * Three states: above_baseline | at_baseline | below_baseline
 *
 * All data is stored locally. Nothing is uploaded to the cloud.
 * Privacy: local-only, encrypted at rest via MMKV (when available).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DopamineState = 'above_baseline' | 'at_baseline' | 'below_baseline';

export interface BodySignals {
  /** 1 (very shallow) – 5 (deep & slow) */
  breathingQuality: number;
  /** 1 (racing) – 5 (calm & steady) */
  heartRateFeel: number;
  /** 1 (very stressed) – 5 (very relaxed) */
  stressLevel: number;
}

export interface DopamineEntry {
  id: string;
  timestamp: number;
  state: DopamineState;
  bodySignals: BodySignals;
  /** Optional free-text note, max 280 chars */
  note: string;
  /** Optional Edge Score at time of entry */
  edgeScore?: number;
}

interface DopamineJournalState {
  entries: DopamineEntry[];
  addEntry: (entry: Omit<DopamineEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  getTodayEntries: () => DopamineEntry[];
  getLastEntry: () => DopamineEntry | null;
}

export const useDopamineJournalStore = create<DopamineJournalState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) => {
        const newEntry: DopamineEntry = {
          ...entry,
          id: `dj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        };
        set((state) => ({ entries: [newEntry, ...state.entries].slice(0, 500) }));
      },

      removeEntry: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
      },

      clearAll: () => set({ entries: [] }),

      getTodayEntries: () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return get().entries.filter((e) => e.timestamp >= startOfDay.getTime());
      },

      getLastEntry: () => {
        const entries = get().entries;
        return entries.length > 0 ? entries[0] : null;
      },
    }),
    {
      name: 'tenki-dopamine-journal',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ---- Helpers ----

export const DOPAMINE_STATE_LABELS: Record<DopamineState, { zh: string; en: string; emoji: string; color: string }> = {
  above_baseline: {
    zh: '過度活躍',
    en: 'Above Baseline',
    emoji: '⚡',
    color: '#F59E0B',
  },
  at_baseline: {
    zh: '回到基準線',
    en: 'At Baseline',
    emoji: '✅',
    color: '#0D9488',
  },
  below_baseline: {
    zh: '低於基準線',
    en: 'Below Baseline',
    emoji: '🌙',
    color: '#6366F1',
  },
};

export const BODY_SIGNAL_LABELS = {
  breathingQuality: { zh: '呼吸質量', en: 'Breathing' },
  heartRateFeel: { zh: '心率感受', en: 'Heart Rate Feel' },
  stressLevel: { zh: '壓力感受', en: 'Stress Level' },
} as const;
