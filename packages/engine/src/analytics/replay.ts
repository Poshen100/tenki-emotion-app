/**
 * @module analytics/replay
 * @description The Replay Engine for post-session visualization.
 * Designed to generate a timeline of peaks, troughs, and overall trends.
 *
 * @version 3.0
 */

import type { EdgeScoreResult } from '../scoring/types';

export interface TimelineDataPoint {
  timestamp: number;
  score: number;
  isPeak: boolean;
  isTrough: boolean;
}

export interface ReplaySummary {
  points: TimelineDataPoint[];
  globalMax: number;
  globalMin: number;
  average: number;
}

/**
 * Analyzes a series of Edge Scores gathered during a continuous session 
 * and outputs annotated points for a visual "Replay" graph.
 * 
 * @param sessionScores - array of EdgeScoreResult in chronological order.
 */
export function generateReplayTimeline(sessionScores: EdgeScoreResult[]): ReplaySummary {
  if (!sessionScores || sessionScores.length === 0) {
    return { points: [], globalMax: 0, globalMin: 0, average: 0 };
  }

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  let maxIdx = -1;
  let minIdx = -1;

  const points: TimelineDataPoint[] = sessionScores.map((res, index) => {
    sum += res.score;
    if (res.score > max) {
      max = res.score;
      maxIdx = index;
    }
    if (res.score < min) {
      min = res.score;
      minIdx = index;
    }

    return {
      timestamp: res.metadata.computedAt,
      score: res.score,
      isPeak: false,
      isTrough: false,
    };
  });

  if (maxIdx !== -1) points[maxIdx].isPeak = true;
  if (minIdx !== -1 && minIdx !== maxIdx) points[minIdx].isTrough = true;

  const average = Math.round(sum / sessionScores.length);

  return {
    points,
    globalMax: max,
    globalMin: min,
    average
  };
}
