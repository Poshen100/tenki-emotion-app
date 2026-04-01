/**
 * @module templates/validator
 * @description Validates template config overrides, enforcing immutable
 * fields and clamping adjustable fields within spec bounds.
 */

import type { TemplateConfig, TemplateValidationResult } from './types';
import { TEMPLATE_DEFAULTS } from './defaults';

/** Bounds definition: [min, max] */
type Bounds = [number, number];

/** Adjustable field bounds per template */
const BOUNDS: Record<string, Record<string, Bounds>> = {
  fbd: {
    durationSec: [300, 1800],
    lockWindowSec: [0, 300],
    emotionMinScore: [45, 70],
    acceptancePromptRatio: [0.3, 0.7],
  },
  canslim: {
    durationSec: [900, 3600],
    entryLockWindowSec: [0, 600],
    emotionMinScore: [55, 75],
    fastCompletionThreshold: [65, 85],
  },
  mode2: {
    durationSec: [2700, 3600],
    emotionMinScore: [60, 75],
    violationPenaltyPoints: [5, 20],
  },
};

/** Fields that cannot be overridden by the user */
const IMMUTABLE_FIELDS: Record<string, string[]> = {
  fbd: ['templateId', 'addPositionAllowed'],
  canslim: ['templateId', 'stopLossRequired'],
  mode2: ['templateId', 'maxTradesPerDay'],
};

/**
 * Validates and sanitizes a partial template configuration.
 * Immutable fields are rejected. Adjustable fields are clamped.
 *
 * @param config - Partial config with a required templateId
 * @returns Validation result with sanitized config or errors
 */
export function validateTemplateConfig(
  config: Partial<TemplateConfig>
): TemplateValidationResult {
  const errors: string[] = [];
  const tid = config.templateId;

  if (!tid || !(tid in TEMPLATE_DEFAULTS)) {
    return { valid: false, errors: [`Invalid or missing templateId: "${tid}"`], sanitized: null };
  }

  const defaults = TEMPLATE_DEFAULTS[tid];
  const immutable = IMMUTABLE_FIELDS[tid];
  const bounds = BOUNDS[tid];

  // Check immutable field overrides
  for (const field of immutable) {
    if (field === 'templateId') continue;
    const key = field as keyof typeof config;
    if (key in config && config[key] !== (defaults as Record<string, unknown>)[key]) {
      errors.push(`Cannot override immutable field "${field}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  // Merge with defaults and clamp
  const merged = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(config)) {
    if (immutable.includes(key)) continue;
    if (key in bounds && typeof value === 'number') {
      const [min, max] = bounds[key];
      merged[key] = Math.max(min, Math.min(max, value));
    } else if (key in merged) {
      merged[key] = value;
    }
  }

  return { valid: true, errors: [], sanitized: merged as TemplateConfig };
}
