/**
 * @module analytics/insight-generator
 * @description Extracts non-medical, compliant patterns from the user's Edge Score history.
 * Designed safely around the `compliance/safe-copy` system boundaries.
 *
 * @version 3.0
 */

import { EdgeScoreResult, EdgeZone } from '../scoring/types';

export interface InsightPayload {
  insightText: string;
  driverId: string;
  /** Importance score to rank insights 0-100 */
  relevance: number;
}

/**
 * Identify patterns to encourage users. 
 * This generator is explicitly stripped of financial/medical terminology.
 *
 * @param history chronological array of results
 */
export function generateInsights(history: EdgeScoreResult[]): InsightPayload[] {
  if (history.length < 3) return [];

  const insights: InsightPayload[] = [];
  const recentScores = history.slice(-5);
  
  // 1. Check for stability
  const allClear = recentScores.every(r => r.zone === 'clear');
  if (allClear) {
    insights.push({
      insightText: 'Sustained cognitive readiness detected. You have maintained a Clear Zone for consecutive sessions.',
      driverId: 'stability_streak',
      relevance: 80
    });
  }

  // 2. Check for HRV Driver Improvement
  const hrvDrivers = history.map(h => h.drivers.find(d => d.key === 'hrv_vs_baseline')?.impact || 0);
  const isImproving = hrvDrivers.length > 2 && hrvDrivers[hrvDrivers.length - 1] > hrvDrivers[hrvDrivers.length - 2];
  if (isImproving) {
    insights.push({
      insightText: 'Your heart rate variability adaptation is improving compared to your baseline.',
      driverId: 'hrv_improving',
      relevance: 60
    });
  }

  return insights.sort((a, b) => b.relevance - a.relevance);
}
