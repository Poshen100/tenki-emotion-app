// DORMANT: awaiting native wiring — TENKI Pulse last-mile (scan screens -> playPattern/recordScan),
// see MEMORY.md 2026-06-14 entry. Not an orphan; do not delete.
/**
 * Pulse Profile Store (TENKI Pulse)
 *
 * Holds the user's evolving haptic "signature" — the on-device learning that
 * makes the scan feel alive and personalized over time. Updated once per
 * completed scan via {@link evolvePulseProfile}.
 *
 * Privacy: local-only (AsyncStorage). No biometric data, nothing uploaded.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPulseProfile,
  evolvePulseProfile,
  type PulseProfile,
  type PulseZone,
} from '../features/face-baseline/utils/pulse';

interface PulseProfileState {
  /** The current evolving profile. */
  profile: PulseProfile;
  /** Record one completed scan → evolves the signature (the learning iteration). */
  recordScan: (zone: PulseZone, score: number) => void;
  /** Reset to a fresh generic profile. */
  reset: () => void;
}

export const usePulseProfileStore = create<PulseProfileState>()(
  persist(
    (set, get) => ({
      profile: createPulseProfile(),
      recordScan: (zone, score) => set({ profile: evolvePulseProfile(get().profile, { zone, score }) }),
      reset: () => set({ profile: createPulseProfile() }),
    }),
    {
      name: 'tenki-pulse-profile',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
