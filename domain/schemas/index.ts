/**
 * @module domain/schemas
 * @description Canonical data schemas for TENKI CORE v3 Domain Layer.
 * These schemas represent structured persistence models before writing to LocalStorage.
 *
 * @version 3.0
 */

import type { EdgeScoreResult, TimeBucket, BiometricSource } from '@tenki/engine';

/**
 * Represents a single raw biometric scan event.
 */
export interface ScanRecord {
  id: string;
  timestamp: number;
  timeBucket: TimeBucket;
  source: BiometricSource;
  rawHrBpm: number;
  rawHrvRmssdMs: number;
  rawRrBrpm: number;
  /** Score out of 100 representing scan stability & coverage */
  signalQualityScore: number;
  isAccepted: boolean;
}

/**
 * Represents a calculated evaluation session containing Edge Score results.
 */
export interface EvaluationSession {
  id: string;
  userId: string;
  startedAt: number;
  completedAt: number;
  scanRecordId: string;
  result: EdgeScoreResult;
  /** Whether this session passed the gate or was aborted early */
  status: 'completed' | 'aborted_at_gate';
  metadata: {
    clientVersion: string;
    osVersion: string;
  };
}

/**
 * Daily aggregate metrics for quick lookups and insights.
 */
export interface DailyMetrics {
  dateString: string; // YYYY-MM-DD
  userId: string;
  scanCount: number;
  averageScore: number | null;
  dominantZone: string | null;
  notableInsights: string[];
}
