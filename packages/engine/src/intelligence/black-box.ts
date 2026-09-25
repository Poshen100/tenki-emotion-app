/**
 * @module intelligence/black-box
 * @description Decision Black Box — the flight recorder.
 *
 * It assembles scan → drift → calibration → judgment into one ordered chain of
 * timestamped facts, each carrying the evidence behind it so any line can be
 * opened into the Evidence X-Ray.
 *
 * 🔴 It is a **recorder, not an analyst**. It draws no conclusions across
 * events; it puts facts in order. Every claim in the chain was already made —
 * and already justified — by the module that produced it.
 *
 * 🔴 A result that refused to make a claim ({@link InsufficientEvidence}) does
 * not become an event. The chain must never contain a line the engine was not
 * willing to say out loud.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 4.4
 */

import type { CalibrationResult } from './calibration';
import type { DriftResult } from './drift';
import { countDistinctDays, type EvidenceBasis } from './evidence';
import type { DecisionTwinResult } from './twin';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** What one line of the chain records. */
export type BlackBoxDetail =
  /** A reading was taken. */
  | { kind: 'scan'; value: number }
  /** How far that reading sat from the personal reference. */
  | { kind: 'drift'; distance: number; magnitude: string; direction: string }
  /** What a calibration did to the reading. */
  | { kind: 'calibration'; verdict: string; shift: number }
  /** What the user did with the decision. */
  | { kind: 'decision'; templateId: string | null; followedProcess: boolean }
  /** A pattern the system noticed in the user's own history. */
  | { kind: 'noticed'; matchCount: number; divergedCount: number };

/** One line of the chain. */
export interface BlackBoxEvent {
  /** When it happened (Unix ms). */
  ts: number;
  /** What happened. */
  detail: BlackBoxDetail;
  /** The evidence behind it, or null for a plain fact that claims nothing. */
  evidence: EvidenceBasis | null;
}

/** A scan reading, as fed to the recorder. */
export interface ScanEntry {
  /** When the reading was taken (Unix ms). */
  ts: number;
  /** Readiness value on the canonical 0-100 axis. */
  value: number;
}

/** A drift assessment, as fed to the recorder. */
export interface DriftEntry {
  /** When it was assessed (Unix ms). */
  ts: number;
  /** The result, which may be a refusal. */
  result: DriftResult;
}

/** A calibration, as fed to the recorder. */
export interface CalibrationEntry {
  /** When it completed (Unix ms). */
  ts: number;
  /** The result, which may be a refusal. */
  result: CalibrationResult;
}

/** A twin observation, as fed to the recorder. */
export interface TwinEntry {
  /** When it was observed (Unix ms). */
  ts: number;
  /** The result, which may be a refusal. */
  result: DecisionTwinResult;
}

/** A completed decision, as fed to the recorder. */
export interface DecisionEntry {
  /** When it was judged (Unix ms). */
  ts: number;
  /** Which process was running, or null. */
  templateId: string | null;
  /** Whether the user followed their own process. Behavioral fact, not an outcome. */
  followedProcess: boolean;
}

/** Everything the recorder may draw on. All parts optional. */
export interface BlackBoxSource {
  /** Readings taken. */
  scans?: readonly ScanEntry[];
  /** Drift assessments made. */
  drifts?: readonly DriftEntry[];
  /** Calibrations run. */
  calibrations?: readonly CalibrationEntry[];
  /** Patterns noticed. */
  noticed?: readonly TwinEntry[];
  /** Decisions judged. */
  decisions?: readonly DecisionEntry[];
}

/** The assembled chain. */
export interface BlackBoxTimeline {
  /** Events in chronological order. */
  events: BlackBoxEvent[];
  /** How many distinct days the chain spans. */
  windowDays: number;
  /** How many events carry a claim (i.e. have evidence attached). */
  claimCount: number;
}

// ─────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────

/**
 * Assembles the decision chain from whatever the caller has.
 *
 * Results that refused to make a claim are skipped rather than rendered as
 * empty lines: the chain is a record of what the engine was willing to say.
 *
 * @param source - Scans, drift assessments, calibrations, twins and decisions.
 * @returns The chain in chronological order, with per-event evidence.
 */
export function buildBlackBox(source: BlackBoxSource): BlackBoxTimeline {
  const events: BlackBoxEvent[] = [];

  for (const scan of source.scans ?? []) {
    if (!Number.isFinite(scan.ts) || !Number.isFinite(scan.value)) continue;
    // A reading is a plain fact: it asserts nothing beyond "this was measured",
    // so it carries no evidence basis of its own.
    events.push({ ts: scan.ts, detail: { kind: 'scan', value: scan.value }, evidence: null });
  }

  for (const entry of source.drifts ?? []) {
    if (!Number.isFinite(entry.ts) || entry.result.state !== 'assessed') continue;
    events.push({
      ts: entry.ts,
      detail: {
        kind: 'drift',
        distance: entry.result.distance,
        magnitude: entry.result.magnitude,
        direction: entry.result.direction,
      },
      evidence: entry.result.evidence,
    });
  }

  for (const entry of source.calibrations ?? []) {
    if (!Number.isFinite(entry.ts) || entry.result.state !== 'assessed') continue;
    events.push({
      ts: entry.ts,
      detail: {
        kind: 'calibration',
        verdict: entry.result.verdict,
        shift: entry.result.shift,
      },
      evidence: entry.result.evidence,
    });
  }

  for (const entry of source.noticed ?? []) {
    if (!Number.isFinite(entry.ts) || entry.result.state !== 'assessed') continue;
    events.push({
      ts: entry.ts,
      detail: {
        kind: 'noticed',
        matchCount: entry.result.matchCount,
        divergedCount: entry.result.divergedCount,
      },
      evidence: entry.result.evidence,
    });
  }

  for (const decision of source.decisions ?? []) {
    if (!Number.isFinite(decision.ts)) continue;
    events.push({
      ts: decision.ts,
      detail: {
        kind: 'decision',
        templateId: decision.templateId,
        followedProcess: decision.followedProcess,
      },
      evidence: null,
    });
  }

  events.sort((a, b) => a.ts - b.ts);

  return {
    events,
    windowDays: countDistinctDays(events.map((e) => e.ts)),
    claimCount: events.filter((e) => e.evidence !== null).length,
  };
}
