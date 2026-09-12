/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module common/types
 * @description TENKI CORE v3 — common type definitions shared across all engine layers.
 * This file defines the foundational types for the privacy-first cognitive wellness system.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1
 */
/** Minimum accepted scans for baseline thresholds. */
export const BASELINE_THRESHOLDS = {
    /** Minimum scans to transition from 'new' to 'building'. */
    BUILDING: 1,
    /** Minimum scans to transition from 'building' to 'ready'. */
    READY: 5,
    /** Minimum scans across at least 3 days for 'mature'. */
    MATURE: 15,
    /** Minimum distinct days for 'mature'. */
    MATURE_DAYS: 3,
};
/** Confidence band thresholds. */
export const CONFIDENCE_BANDS = {
    HIGH: { min: 0.80, max: 1.00 },
    MODERATE: { min: 0.55, max: 0.79 },
    LOW: { min: 0.00, max: 0.54 },
};
