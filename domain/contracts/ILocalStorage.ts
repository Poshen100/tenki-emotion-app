/**
 * @module domain/contracts
 * @description Interfaces establishing standard boundary for persistent storage operations.
 * Implemented specifically with Drizzle ORM + expo-sqlite in mind.
 *
 * @version 3.0
 */

import { BaselineProfile, BiometricReading } from '@tenki/engine';
import { EvaluationSession, ScanRecord } from '../schemas';

/**
 * Storage adapter ensuring Local-First constraints for Biometric events and sessions.
 * Concrete implementation will use Drizzle ORM with `expo-sqlite`.
 */
export interface ILocalStorage {
  /**
   * Initialize or verify Drizzle migrations + db instance.
   */
  init(): Promise<void>;

  /**
   * Save a newly accepted or rejected Biometric Reading via ScanRecord payload.
   */
  saveScanRecord(record: ScanRecord): Promise<void>;

  /**
   * Fetches user's latest baseline profile. Must never leave the device.
   */
  getBaselineProfile(userId: string): Promise<BaselineProfile | null>;

  /**
   * Atomically save the outcome of an evaluated session along with updating the baseline.
   * Drizzle transactions should handle this atomically.
   */
  saveSessionAndBaseline(
    session: EvaluationSession, 
    updatedBaseline: BaselineProfile
  ): Promise<void>;

  /**
   * Fetches recent Edge Scores to input into the Decision Edge Score Engine.
   */
  getRecentEdgeScores(userId: string, limit?: number): Promise<number[]>;

  /**
   * Clear all data adhering to the zero-cloud / right-to-forget privacy rules.
   */
  wipeAllData(userId: string): Promise<void>;
}
