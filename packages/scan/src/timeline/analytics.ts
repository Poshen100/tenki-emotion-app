/**
 * @module timeline/analytics
 * @description Analyzes completed timeline sessions to extract
 * discipline metrics, emotion trends, and session statistics.
 */

import type { TimelineSession, SessionAnalytics } from './types';

/**
 * Analyzes a timeline session and returns aggregate metrics.
 *
 * Discipline score formula:
 *   100 * (1 - violationCount / max(totalNodes, 1))
 *   Clamped to [0, 100].
 *
 * @param session - The completed timeline session to analyze
 * @returns Session analytics summary
 */
export function analyzeSession(session: TimelineSession): SessionAnalytics {
  const nodes = session.nodes;

  if (nodes.length === 0) {
    return {
      avgEmotionScore: 0,
      minEmotionScore: 0,
      emotionAtEntry: null,
      violationCount: 0,
      violationTimestamps: [],
      lockCount: 0,
      disciplineScore: 100,
    };
  }

  let totalEmotion = 0;
  let minEmotion = Infinity;
  let emotionAtEntry: number | null = null;
  let violationCount = 0;
  const violationTimestamps: number[] = [];
  let lockCount = 0;

  for (const node of nodes) {
    totalEmotion += node.emotionScore;

    if (node.emotionScore < minEmotion) {
      minEmotion = node.emotionScore;
    }

    if (node.eventType === 'entry_attempted' && emotionAtEntry === null) {
      emotionAtEntry = node.emotionScore;
    }

    if (node.ruleViolation) {
      violationCount++;
      violationTimestamps.push(node.timestampMs);
    }

    if (node.eventType === 'lock_applied') {
      lockCount++;
    }
  }

  const avgEmotionScore = Math.round((totalEmotion / nodes.length) * 100) / 100;
  const raw = 1 - violationCount / Math.max(nodes.length, 1);
  const disciplineScore = Math.round(Math.max(0, Math.min(100, raw * 100)));

  return {
    avgEmotionScore,
    minEmotionScore: minEmotion,
    emotionAtEntry,
    violationCount,
    violationTimestamps,
    lockCount,
    disciplineScore,
  };
}
