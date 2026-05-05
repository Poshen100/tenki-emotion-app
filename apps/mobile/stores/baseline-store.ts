/**
 * @module stores/baseline-store
 * @description Zustand store for the user's BaselineProfile and recent Edge Scores.
 *
 * This is the single source of truth for the user's biometric baseline.
 * The scan store writes to it after each successful scan; the Today/Timeline
 * screens read from it.
 *
 * In production, this store will be hydrated from encrypted local SQLite.
 * For now it initialises with an empty profile.
 *
 * @version 3.0
 */

import { create } from 'zustand';
import type { BaselineProfile } from '../lib/engine-adapter';
import { createEmptyBaselineProfile } from '../../../packages/engine/src/baseline/baseline';

/** Maximum recent scores to retain (for the trend factor). */
const MAX_RECENT_SCORES = 10;

interface BaselineState {
  /** User's current baseline profile */
  profile: BaselineProfile;
  /** Recent Edge Scores, newest first (up to MAX_RECENT_SCORES) */
  recentScores: number[];
  /** Total completed scans (across all sessions) */
  totalScans: number;

  setProfile: (profile: BaselineProfile) => void;
  addRecentScore: (score: number) => void;
  resetBaseline: () => void;
}

export const useBaselineStore = create<BaselineState>((set) => ({
  profile: createEmptyBaselineProfile(),
  recentScores: [],
  totalScans: 0,

  setProfile: (profile) =>
    set((state) => ({ profile, totalScans: state.totalScans + 1 })),

  addRecentScore: (score) =>
    set((state) => ({
      recentScores: [score, ...state.recentScores].slice(0, MAX_RECENT_SCORES),
    })),

  resetBaseline: () =>
    set({
      profile: createEmptyBaselineProfile(),
      recentScores: [],
      totalScans: 0,
    }),
}));
