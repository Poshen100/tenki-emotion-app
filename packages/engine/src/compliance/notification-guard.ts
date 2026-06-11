/**
 * @module compliance/notification-guard
 * @description Notification guardrail — validates notification content before sending.
 * Ensures no action-oriented, medical, or financial language in push notifications.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 2
 */

import { findProhibitedTerms } from './safe-copy';

// ─────────────────────────────────────────────
// Safe Notification Templates
// ─────────────────────────────────────────────

/** Pre-approved notification templates. */
export const SAFE_NOTIFICATION_TEMPLATES = {
  /** Daily check-in reminder. */
  DAILY_CHECKIN: 'Time for your daily readiness scan.',
  /** Gentle nudge for check-in. */
  GENTLE_NUDGE: 'You may be in a more stable state for a quick check-in.',
  /** Focus window starting. */
  FOCUS_WINDOW: 'Your preferred focus window may be starting soon.',
  /** Streak reminder. */
  STREAK_REMINDER: 'Keep your readiness streak going — scan today.',
  /** Weekly summary available. */
  WEEKLY_SUMMARY: 'Your weekly clarity summary is ready in TENKI.',
  /** Baseline needs refresh. */
  BASELINE_REFRESH: 'Your baseline could use a fresh scan for better accuracy.',
} as const;

/** Notification template identifier. */
export type NotificationTemplateId = keyof typeof SAFE_NOTIFICATION_TEMPLATES;

// ─────────────────────────────────────────────
// Prohibited Notification Patterns
// ─────────────────────────────────────────────

/** Additional phrases specifically prohibited in notifications. */
const NOTIFICATION_PROHIBITED = [
  'you have an edge',
  'good time to trade',
  'take the setup',
  'execute now',
  'act now',
  'don\'t miss',
  'urgent',
  'your body says',
  'you are safe to',
  'guaranteed',
] as const;

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

/** Result of notification compliance validation. */
export interface NotificationValidation {
  /** Whether the notification is compliant. */
  isCompliant: boolean;
  /** Prohibited terms found (if any). */
  violations: string[];
  /** Sanitized text (original if compliant, template fallback if not). */
  sanitizedText: string;
}

/**
 * Validates notification content for compliance.
 * Checks both general prohibited vocabulary and notification-specific patterns.
 *
 * @param text - The notification text to validate.
 * @returns Validation result with compliance status and any violations.
 */
export function validateNotification(text: string): NotificationValidation {
  const generalViolations = findProhibitedTerms(text);

  const lowerText = text.toLowerCase();
  const notifViolations: string[] = [];
  for (const phrase of NOTIFICATION_PROHIBITED) {
    if (lowerText.includes(phrase)) {
      notifViolations.push(phrase);
    }
  }

  const allViolations = [...generalViolations, ...notifViolations];

  return {
    isCompliant: allViolations.length === 0,
    violations: allViolations,
    sanitizedText: allViolations.length === 0
      ? text
      : SAFE_NOTIFICATION_TEMPLATES.DAILY_CHECKIN, // Fallback to safe default
  };
}

/**
 * Returns a pre-approved notification text by template ID.
 * Guaranteed compliant, no validation needed.
 *
 * @param templateId - The safe notification template identifier.
 * @returns The pre-approved notification text.
 */
export function getSafeNotification(templateId: NotificationTemplateId): string {
  return SAFE_NOTIFICATION_TEMPLATES[templateId];
}
