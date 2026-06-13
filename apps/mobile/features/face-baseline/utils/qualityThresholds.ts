/**
 * @module face-baseline/utils/qualityThresholds
 * @description Per-phase capture quality gates + single-issue status derivation.
 *
 * Capture quality is never a single score: each phase reads only the signals it
 * cares about. The first baseline is held to a STRICTER bar than daily rescans
 * (`{ strict: true }`) — per the North Star, rather +8s than a loose baseline.
 */

import type { QualityMetrics, QualityStatus } from '../types/faceBaseline.types';

/**
 * Shared lower/upper bounds for the generic capture signals.
 * `motion` is an upper bound (lower is better); the rest are lower bounds.
 */
export const QUALITY_OK = {
  sqi: 0.7,
  motion: 0.35,
  coverage: 0.8,
  brightness: 0.45,
} as const;

/** Which capture phase a gate applies to. */
export type CaptureGatePhase = 'neutral' | 'arc' | 'stability';

/** Options accepted by every phase gate. */
export interface GateOptions {
  /** First-baseline enrollment holds a stricter bar than daily rescans. */
  strict?: boolean;
}

/** Amount lower bounds are raised (and motion ceilings tightened) when strict. */
export const STRICT_DELTA = 0.08;

/** Live-nudge motion ceiling per phase (arc tolerates the head turn). */
const NUDGE_MOTION_MAX: Record<CaptureGatePhase, number> = {
  neutral: 0.35,
  arc: 0.6,
  stability: 0.3,
};

/** Minimum head-pose-range coverage that counts as "turned enough" in the arc. */
export const ARC_POSE_MIN = 0.7;

/** Raises a lower bound when strict. */
function floor(base: number, strict: boolean): number {
  return strict ? Math.min(1, base + STRICT_DELTA) : base;
}

/** Tightens an upper (motion) bound when strict. */
function ceil(base: number, strict: boolean): number {
  return strict ? Math.max(0, base - STRICT_DELTA) : base;
}

/**
 * Neutral anchor gate — the resting-state reference. Wants a still face, clean
 * signal, good light, confident landmarks, visible eyes, and a relaxed expression.
 */
export function neutralGate(q: QualityMetrics, { strict = false }: GateOptions = {}): boolean {
  return (
    q.sqi >= floor(0.7, strict) &&
    q.motion <= ceil(0.35, strict) &&
    q.coverage >= floor(0.8, strict) &&
    q.brightness >= floor(0.45, strict) &&
    q.landmarkConfidence >= floor(0.7, strict) &&
    q.eyeVisibility >= floor(0.7, strict) &&
    q.neutralExpressionConfidence >= floor(0.6, strict)
  );
}

/**
 * Guided-arc gate — multi-angle landmark coverage. Wants confident landmarks,
 * enough head-pose range achieved, even lighting, coverage held, and a controlled
 * (not jerky) turn.
 */
export function arcGate(q: QualityMetrics, { strict = false }: GateOptions = {}): boolean {
  return (
    q.landmarkConfidence >= floor(0.65, strict) &&
    q.headPoseRange >= floor(ARC_POSE_MIN, strict) &&
    q.lightingUniformity >= floor(0.5, strict) &&
    q.coverage >= floor(0.7, strict) &&
    q.motion <= ceil(0.6, strict)
  );
}

/**
 * Stability-pass gate — the emotional (not just geometric) anchor. Wants a
 * relaxed expression, visible eyes, a still head, and clean signal.
 */
export function stabilityGate(q: QualityMetrics, { strict = false }: GateOptions = {}): boolean {
  return (
    q.neutralExpressionConfidence >= floor(0.7, strict) &&
    q.eyeVisibility >= floor(0.7, strict) &&
    q.motion <= ceil(0.3, strict) &&
    q.sqi >= floor(0.7, strict)
  );
}

/** Phase → gate dispatch, for callers that hold the active phase. */
export function phaseGate(
  phase: CaptureGatePhase,
  q: QualityMetrics,
  options: GateOptions = {},
): boolean {
  if (phase === 'arc') return arcGate(q, options);
  if (phase === 'stability') return stabilityGate(q, options);
  return neutralGate(q, options);
}

/**
 * Backward-compatible generic gate (the neutral signals only). Retained for
 * selectors and recovery classification that pre-date the per-phase gates.
 */
export function isQualityOk(q: QualityMetrics): boolean {
  return (
    q.sqi >= QUALITY_OK.sqi &&
    q.motion <= QUALITY_OK.motion &&
    q.coverage >= QUALITY_OK.coverage &&
    q.brightness >= QUALITY_OK.brightness
  );
}

/**
 * Derives the single most important quality nudge to surface for `phase`.
 * Priority: movement → pose range (arc only) → low light → reframe. Exactly one
 * status — never a list.
 */
export function deriveQualityStatus(
  q: QualityMetrics,
  phase: CaptureGatePhase = 'neutral',
): QualityStatus {
  if (q.motion > NUDGE_MOTION_MAX[phase]) return 'movement';
  if (phase === 'arc' && q.headPoseRange < ARC_POSE_MIN) return 'poseRange';
  if (q.brightness < QUALITY_OK.brightness) return 'lowLight';
  if (q.coverage < QUALITY_OK.coverage) return 'reframe';
  return 'good';
}
