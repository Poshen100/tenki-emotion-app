/**
 * @module shared/growth/edge-status
 * @description EDGE STATUS — the persistent status chip that tells someone
 * where their signals sit right now.
 *
 * Pure resolution logic and copy; no React Native components, so it can be
 * tested and reused across the mobile app and any preview surface.
 *
 * Note the deliberate mismatch with the engine's zones. Zones are `clear`,
 * `neutral`, `strain`; the status chip reads Edge Active, Neutral, Recovery.
 * "Strain" describes a problem, "Recovery" describes what the body is doing —
 * equally honest, but the chip is on screen all day, and a permanent
 * "Elevated Strain" badge manufactures the anxiety the notification rules
 * (ANTIGRAVITY §2.2) exist to avoid. The zone vocabulary itself does not
 * change: engine semantics, DPD records and benchmark buckets all keep
 * clear/neutral/strain. This translation happens only at the chip.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §8
 */

import type { EdgeZone } from '../../../engine/src/scoring/types';

// ─────────────────────────────────────────────
// States
// ─────────────────────────────────────────────

/** The three status-chip states. */
export const EDGE_STATUS_STATES = ['edge_active', 'neutral', 'recovery'] as const;
export type EdgeStatusState = typeof EDGE_STATUS_STATES[number];

/** What the chip needs to render. */
export interface EdgeStatusView {
  readonly state: EdgeStatusState;
  /** Chip label. */
  readonly label: string;
  /** One-line description of the state. Never an instruction. */
  readonly description: string;
  /** Design-token key for the chip colour. */
  readonly tone: 'cyan' | 'slate' | 'ember';
}

/** Inputs for resolving the chip. */
export interface EdgeStatusInput {
  /** Whether the detector currently has a confirmed window. */
  readonly detectionConfirmed: boolean;
  /** Zone from the most recent scoring pass. */
  readonly zone: EdgeZone;
}

// ─────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────

/**
 * Chip copy. Every line describes a STATE, never a moment to act on — "your
 * signals suggest a steady state" is an observation, "now is a good time" is
 * advice about timing, and advice about timing plus physiology is exactly what
 * the compliance rules exclude.
 */
export const EDGE_STATUS_COPY: Readonly<Record<EdgeStatusState, EdgeStatusView>> = {
  edge_active: {
    state: 'edge_active',
    label: 'Edge Active',
    description: 'Your signals suggest a steady, focused state.',
    tone: 'cyan',
  },
  neutral: {
    state: 'neutral',
    label: 'Neutral',
    description: 'Your signals are sitting close to your usual range.',
    tone: 'slate',
  },
  recovery: {
    state: 'recovery',
    label: 'Recovery',
    description: 'Your signals suggest your body is recovering.',
    tone: 'ember',
  },
};

// ─────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────

/**
 * Resolves the status chip from detector state and zone.
 *
 * Detection wins over zone: a confirmed window is a stronger, more recent
 * statement than the zone of the last scoring pass.
 *
 * @param input - Detector confirmation and current zone.
 * @returns The state to render.
 */
export function resolveEdgeStatus(input: EdgeStatusInput): EdgeStatusState {
  if (input.detectionConfirmed) return 'edge_active';
  if (input.zone === 'strain') return 'recovery';
  return 'neutral';
}

/**
 * Resolves the full chip view.
 *
 * @param input - Detector confirmation and current zone.
 * @returns The view model for the chip.
 */
export function resolveEdgeStatusView(input: EdgeStatusInput): EdgeStatusView {
  return EDGE_STATUS_COPY[resolveEdgeStatus(input)];
}

// ─────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────

/**
 * States whose exit is never announced to the user.
 *
 * `edge_active` is the load-bearing entry. Telling someone their clear window
 * just closed manufactures a sense of having missed something, and reducing
 * impulse is the entire product thesis — building a fear-of-missing-out trigger
 * into it would work directly against what it exists to do.
 *
 * The chip changes silently instead. Someone looking at it sees the new state;
 * someone not looking at it is not interrupted to be told about a state they
 * are no longer in.
 */
export const SILENT_EXIT_STATES: readonly EdgeStatusState[] = [
  'edge_active',
  'neutral',
  'recovery',
];

/**
 * Whether leaving a state should be announced to the user.
 *
 * Currently false for every state — the chip is a passive surface. Live
 * notifications come from the detector's own alert path, which announces
 * entering a window, never leaving one.
 *
 * @param from - The state being left.
 * @returns True when the exit warrants a user-visible announcement.
 */
export function shouldAnnounceExit(from: EdgeStatusState): boolean {
  return !SILENT_EXIT_STATES.includes(from);
}

/**
 * Formats a held duration for the chip, e.g. "4m 20s".
 *
 * @param seconds - Seconds held.
 * @returns Formatted duration.
 */
export function formatHeldDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder}s`;
}
