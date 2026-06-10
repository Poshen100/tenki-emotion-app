/**
 * @module face-baseline/utils/retryReason
 * @description Maps live signal context to a single recovery reason, and each
 * reason to a copy key for the Face Detection Recovery screen.
 * Recovery is supportive — every reason resolves to one clear, fixable action.
 */

import type { FaceLockState, QualityMetrics, RetryReason } from '../types/faceBaseline.types';
import { QUALITY_OK } from './qualityThresholds';

/** Context used to classify why a capture could not complete. */
export interface RetryContext {
  quality: QualityMetrics;
  faceLock: FaceLockState;
  faceCount: number;
  timedOut: boolean;
  computeError: boolean;
}

/**
 * Classifies the most actionable retry reason from the current context.
 * Order reflects what the user should fix first.
 */
export function classifyRetryReason(ctx: RetryContext): RetryReason {
  if (ctx.computeError) return 'computeError';
  if (ctx.faceCount > 1) return 'multipleFaces';
  if (ctx.faceCount === 0) return ctx.timedOut ? 'timeout' : 'noFace';
  if (ctx.faceLock === 'lost') return 'lostLock';
  if (ctx.quality.brightness < QUALITY_OK.brightness) return 'lowLight';
  if (ctx.quality.coverage < QUALITY_OK.coverage) return 'tooFar';
  if (ctx.quality.motion > QUALITY_OK.motion) return 'movement';
  return 'noFace';
}

/** Stable copy keys per reason (resolved by the compliance copy layer). */
export const RETRY_COPY_KEY: Record<RetryReason, string> = {
  lowLight: 'recovery.lowLight',
  tooClose: 'recovery.tooClose',
  tooFar: 'recovery.tooFar',
  movement: 'recovery.movement',
  noFace: 'recovery.noFace',
  multipleFaces: 'recovery.multipleFaces',
  glasses: 'recovery.glasses',
  lostLock: 'recovery.lostLock',
  timeout: 'recovery.timeout',
  computeError: 'recovery.computeError',
} as const;
