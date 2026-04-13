/**
 * @module templates/types
 * @description Trader template type definitions for FDCB decision sessions.
 * Each template enforces specific timing, gating, and discipline rules.
 */

/** Available trader template identifiers */
export type TraderTemplate = 'fbd' | 'canslim' | 'mode2';

/** Market condition classification for template selection */
export type MarketCondition = 'trending' | 'choppy' | 'breakout';

/** FBD (Focused Breakout Decision) template configuration */
export interface FBDConfig {
  /** Template identifier */
  templateId: 'fbd';
  /** Session duration in seconds (300–1800, default 900) */
  durationSec: number;
  /** Lock window duration in seconds (0–300, default 180) */
  lockWindowSec: number;
  /** Minimum emotion score to allow entry (45–70, default 55) */
  emotionMinScore: number;
  /** Adding to position is never allowed in FBD */
  addPositionAllowed: false;
  /** Ratio of acceptance prompts to total events (0.3–0.7, default 0.5) */
  acceptancePromptRatio: number;
}

/** CANSLIM growth template configuration */
export interface CANSLIMConfig {
  /** Template identifier */
  templateId: 'canslim';
  /** Session duration in seconds (900–3600, default 1800) */
  durationSec: number;
  /** Entry lock window in seconds (0–600, default 300) */
  entryLockWindowSec: number;
  /** Stop loss is always required in CANSLIM */
  stopLossRequired: true;
  /** Minimum emotion score for entry (55–75, default 60) */
  emotionMinScore: number;
  /** Score threshold for fast completion (65–85, default 75) */
  fastCompletionThreshold: number;
}

/** Mode 2 (single-trade-per-day) template configuration */
export interface Mode2Config {
  /** Template identifier */
  templateId: 'mode2';
  /** Session duration in seconds (2700–3600, default 2700) */
  durationSec: number;
  /** Maximum one trade per day (immutable) */
  maxTradesPerDay: 1;
  /** Minimum emotion score for entry (60–75, default 65) */
  emotionMinScore: number;
  /** Penalty points per rule violation (5–20, default 10) */
  violationPenaltyPoints: number;
}

/** Union of all template configurations */
export type TemplateConfig = FBDConfig | CANSLIMConfig | Mode2Config;

/** Validation result for template config */
export interface TemplateValidationResult {
  /** Whether the config is valid */
  valid: boolean;
  /** List of validation error messages */
  errors: string[];
  /** The sanitized/clamped config (only if valid) */
  sanitized: TemplateConfig | null;
}
