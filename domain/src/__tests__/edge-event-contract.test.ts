import {
  FORBIDDEN_EVENT_FIELDS,
  buildEventDedupeKey,
  isDuplicateEvent,
  isLiveAlertEligible,
  validateEdgeEvent,
} from '../index';
import type { EdgeDetectedEvent } from '../index';

const DETECTED_AT = 1_775_000_000_000;

/** Builds a valid edge event with overrides. */
function makeEvent(overrides: Partial<EdgeDetectedEvent> = {}): EdgeDetectedEvent {
  return {
    eventId: 'evt_1',
    detectedAtMs: DETECTED_AT,
    windowStartedAtMs: DETECTED_AT - 180_000,
    strength: 'strong',
    detectedState: 'focused',
    heldDurationSec: 180,
    timeBucket: 'morning',
    confidenceBand: 'high',
    source: 'foreground_active',
    ...overrides,
  };
}

describe('event validation', () => {
  it('accepts a well-formed event', () => {
    const result = validateEdgeEvent(makeEvent());
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects an event carrying the Edge Score', () => {
    const result = validateEdgeEvent({ ...makeEvent(), edgeScore: 84 });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('forbidden_field');
    expect(result.forbiddenFields).toContain('edgeScore');
  });

  it('rejects an event carrying a raw physiological value', () => {
    for (const field of ['hrv', 'heartRate', 'rrIntervals', 'ansBalance'] as const) {
      const result = validateEdgeEvent({ ...makeEvent(), [field]: 51 });
      expect(result.valid).toBe(false);
      expect(result.forbiddenFields).toContain(field);
    }
  });

  it('rejects an event carrying the raw confidence coefficient', () => {
    const result = validateEdgeEvent({ ...makeEvent(), confidence: 0.83 });
    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain('confidence');
  });

  it('guards every documented forbidden field', () => {
    for (const field of FORBIDDEN_EVENT_FIELDS) {
      const result = validateEdgeEvent({ ...makeEvent(), [field]: 'x' });
      expect(result.forbiddenFields).toContain(field);
    }
  });

  it('rejects a missing event id', () => {
    expect(validateEdgeEvent(makeEvent({ eventId: '' })).reasons).toContain(
      'missing_event_id'
    );
  });

  it('rejects a negative hold duration', () => {
    expect(validateEdgeEvent(makeEvent({ heldDurationSec: -1 })).reasons).toContain(
      'negative_hold_duration'
    );
  });

  it('rejects a window that started after it was detected', () => {
    const result = validateEdgeEvent(
      makeEvent({ windowStartedAtMs: DETECTED_AT + 1000 })
    );
    expect(result.reasons).toContain('window_start_after_detection');
  });

  it('allows a window that started exactly at detection', () => {
    const result = validateEdgeEvent(makeEvent({ windowStartedAtMs: DETECTED_AT }));
    expect(result.valid).toBe(true);
  });
});

describe('deduplication', () => {
  it('keys on the window start, not the confirmation time', () => {
    const first = makeEvent({ detectedAtMs: DETECTED_AT });
    const reconfirmed = makeEvent({ detectedAtMs: DETECTED_AT + 60_000 });
    expect(buildEventDedupeKey(first)).toBe(buildEventDedupeKey(reconfirmed));
  });

  it('treats a new window as a new event', () => {
    const first = makeEvent();
    const later = makeEvent({ windowStartedAtMs: DETECTED_AT + 3_600_000 });
    expect(buildEventDedupeKey(first)).not.toBe(buildEventDedupeKey(later));
  });

  it('detects a duplicate against recorded keys', () => {
    const event = makeEvent();
    expect(isDuplicateEvent(event, [buildEventDedupeKey(event)])).toBe(true);
    expect(isDuplicateEvent(event, [])).toBe(false);
  });

  it('separates identical window starts in different buckets', () => {
    const morning = makeEvent({ timeBucket: 'morning' });
    const evening = makeEvent({ timeBucket: 'evening' });
    expect(buildEventDedupeKey(morning)).not.toBe(buildEventDedupeKey(evening));
  });
});

describe('live alert eligibility', () => {
  it('allows foreground-sourced events', () => {
    expect(isLiveAlertEligible(makeEvent({ source: 'foreground_active' }))).toBe(true);
    expect(isLiveAlertEligible(makeEvent({ source: 'foreground_passive' }))).toBe(true);
  });

  it('never allows a background event to drive a live alert', () => {
    expect(isLiveAlertEligible(makeEvent({ source: 'background_retrospective' }))).toBe(
      false
    );
  });
});
