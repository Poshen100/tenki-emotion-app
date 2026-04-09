/**
 * @module compliance/notification-guard.test
 * @description Unit tests for the Notification Guardrail.
 */

import {
  validateNotification,
  getSafeNotification,
  SAFE_NOTIFICATION_TEMPLATES,
} from '../notification-guard';
import { isCompliantCopy } from '../safe-copy';

// ─── validateNotification ───────────────────

describe('validateNotification', () => {
  it('should accept safe notification text', () => {
    const result = validateNotification('Time for your daily readiness scan.');
    expect(result.isCompliant).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.sanitizedText).toBe('Time for your daily readiness scan.');
  });

  it('should reject "you have an edge"', () => {
    const result = validateNotification('You have an edge now, take it!');
    expect(result.isCompliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should reject "good time to trade"', () => {
    const result = validateNotification('Good time to trade based on your state.');
    expect(result.isCompliant).toBe(false);
  });

  it('should reject "act now"', () => {
    const result = validateNotification('Act now before you lose clarity.');
    expect(result.isCompliant).toBe(false);
  });

  it('should reject "urgent" notifications', () => {
    const result = validateNotification('Urgent: your readings are optimal.');
    expect(result.isCompliant).toBe(false);
  });

  it('should reject "your body says"', () => {
    const result = validateNotification('Your body says it is time.');
    expect(result.isCompliant).toBe(false);
  });

  it('should fallback to safe template when non-compliant', () => {
    const result = validateNotification('Urgent! Trade now for profit!');
    expect(result.isCompliant).toBe(false);
    expect(result.sanitizedText).toBe(SAFE_NOTIFICATION_TEMPLATES.DAILY_CHECKIN);
  });

  it('should accept empty string', () => {
    const result = validateNotification('');
    expect(result.isCompliant).toBe(true);
  });
});

// ─── getSafeNotification ────────────────────

describe('getSafeNotification', () => {
  it('should return DAILY_CHECKIN template', () => {
    const text = getSafeNotification('DAILY_CHECKIN');
    expect(text).toBe('Time for your daily readiness scan.');
  });

  it('should return GENTLE_NUDGE template', () => {
    const text = getSafeNotification('GENTLE_NUDGE');
    expect(text).toContain('stable state');
  });

  it('should return compliant text for all templates', () => {
    const templateIds = Object.keys(SAFE_NOTIFICATION_TEMPLATES) as Array<keyof typeof SAFE_NOTIFICATION_TEMPLATES>;
    for (const id of templateIds) {
      const text = getSafeNotification(id);
      expect(text).toBeTruthy();
      expect(isCompliantCopy(text)).toBe(true);
    }
  });
});

// ─── SAFE_NOTIFICATION_TEMPLATES ────────────

describe('SAFE_NOTIFICATION_TEMPLATES', () => {
  it('should have at least 5 templates', () => {
    expect(Object.keys(SAFE_NOTIFICATION_TEMPLATES).length).toBeGreaterThanOrEqual(5);
  });

  it('all templates should be non-empty strings', () => {
    for (const [key, value] of Object.entries(SAFE_NOTIFICATION_TEMPLATES)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
