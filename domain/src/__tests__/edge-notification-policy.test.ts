import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  EDGE_NOTIFICATION_COOLDOWN_SEC,
  EDGE_NOTIFICATION_DAILY_CAP,
  createDefaultEdgeNotificationSettings,
  createEmptyEdgeNotificationState,
  evaluateEdgeNotification,
  isWithinQuietHours,
  recordEdgeNotificationSent,
  resolveEdgeNotificationDayKey,
} from '../index';
import type {
  EdgeDetectedEvent,
  EdgeNotificationInput,
  EdgeNotificationSettings,
  EdgeNotificationThrottleState,
} from '../index';

const NOW = 1_775_000_000_000;
const DAY = '2026-08-14';

/** Builds a live-eligible detection event. */
function makeEvent(overrides: Partial<EdgeDetectedEvent> = {}): EdgeDetectedEvent {
  return {
    eventId: 'evt_1',
    detectedAtMs: NOW,
    windowStartedAtMs: NOW - 180_000,
    strength: 'strong',
    detectedState: 'focused',
    heldDurationSec: 180,
    timeBucket: 'morning',
    confidenceBand: 'high',
    source: 'foreground_active',
    ...overrides,
  };
}

/** Builds an input that would otherwise deliver. */
function makeInput(overrides: Partial<EdgeNotificationInput> = {}): EdgeNotificationInput {
  return {
    event: makeEvent(),
    tierAllowsAlerts: true,
    sessionActive: false,
    localHour: 10,
    dayKey: DAY,
    nowMs: NOW,
    throttleState: createEmptyEdgeNotificationState(DAY),
    ...overrides,
  };
}

describe('quiet hours', () => {
  it('handles a window that crosses midnight', () => {
    const start = DEFAULT_QUIET_HOURS_START;
    const end = DEFAULT_QUIET_HOURS_END;

    expect(isWithinQuietHours(23, start, end)).toBe(true);
    expect(isWithinQuietHours(2, start, end)).toBe(true);
    expect(isWithinQuietHours(22, start, end)).toBe(true);
    expect(isWithinQuietHours(6, start, end)).toBe(true);
  });

  it('excludes hours outside a midnight-crossing window', () => {
    expect(isWithinQuietHours(7, DEFAULT_QUIET_HOURS_START, DEFAULT_QUIET_HOURS_END)).toBe(
      false
    );
    expect(isWithinQuietHours(12, DEFAULT_QUIET_HOURS_START, DEFAULT_QUIET_HOURS_END)).toBe(
      false
    );
    expect(isWithinQuietHours(21, DEFAULT_QUIET_HOURS_START, DEFAULT_QUIET_HOURS_END)).toBe(
      false
    );
  });

  it('handles a same-day window', () => {
    expect(isWithinQuietHours(12, 11, 14)).toBe(true);
    expect(isWithinQuietHours(11, 11, 14)).toBe(true);
    expect(isWithinQuietHours(14, 11, 14)).toBe(false);
    expect(isWithinQuietHours(9, 11, 14)).toBe(false);
  });

  it('treats an empty window as never quiet', () => {
    expect(isWithinQuietHours(10, 10, 10)).toBe(false);
  });
});

describe('local day key', () => {
  it('zero-pads month and day', () => {
    expect(resolveEdgeNotificationDayKey(2026, 8, 4)).toBe('2026-08-04');
    expect(resolveEdgeNotificationDayKey(2026, 12, 31)).toBe('2026-12-31');
  });
});

describe('delivery evaluation', () => {
  it('delivers when every check passes', () => {
    const result = evaluateEdgeNotification(makeInput());
    expect(result.decision).toBe('deliver');
    expect(result.reason).toBeNull();
  });

  it('withholds when the tier excludes live alerts', () => {
    const result = evaluateEdgeNotification(makeInput({ tierAllowsAlerts: false }));
    expect(result.decision).toBe('withhold');
    expect(result.reason).toBe('tier_excludes_alerts');
  });

  it('never delivers a background-sourced event as live', () => {
    const result = evaluateEdgeNotification(
      makeInput({ event: makeEvent({ source: 'background_retrospective' }) })
    );
    expect(result.decision).toBe('withhold');
    expect(result.reason).toBe('background_event');
  });

  it('withholds during an active decision session', () => {
    const result = evaluateEdgeNotification(makeInput({ sessionActive: true }));
    expect(result.reason).toBe('session_active');
  });

  it('withholds during quiet hours', () => {
    const result = evaluateEdgeNotification(makeInput({ localHour: 23 }));
    expect(result.reason).toBe('quiet_hours');
  });

  it('withholds inside the cooldown', () => {
    const state: EdgeNotificationThrottleState = {
      lastNotifiedAtMs: NOW - (EDGE_NOTIFICATION_COOLDOWN_SEC - 1) * 1000,
      notifiedTodayCount: 1,
      dayKey: DAY,
    };
    expect(evaluateEdgeNotification(makeInput({ throttleState: state })).reason).toBe(
      'cooldown'
    );
  });

  it('delivers once the cooldown has elapsed', () => {
    const state: EdgeNotificationThrottleState = {
      lastNotifiedAtMs: NOW - EDGE_NOTIFICATION_COOLDOWN_SEC * 1000,
      notifiedTodayCount: 1,
      dayKey: DAY,
    };
    expect(evaluateEdgeNotification(makeInput({ throttleState: state })).decision).toBe(
      'deliver'
    );
  });

  it('withholds at the daily cap', () => {
    const state: EdgeNotificationThrottleState = {
      lastNotifiedAtMs: null,
      notifiedTodayCount: EDGE_NOTIFICATION_DAILY_CAP,
      dayKey: DAY,
    };
    expect(evaluateEdgeNotification(makeInput({ throttleState: state })).reason).toBe(
      'daily_cap'
    );
  });

  it('treats a stale day key as a fresh allowance', () => {
    const yesterday: EdgeNotificationThrottleState = {
      lastNotifiedAtMs: null,
      notifiedTodayCount: EDGE_NOTIFICATION_DAILY_CAP,
      dayKey: '2026-08-13',
    };
    expect(evaluateEdgeNotification(makeInput({ throttleState: yesterday })).decision).toBe(
      'deliver'
    );
  });

  it('checks tier before anything else', () => {
    const result = evaluateEdgeNotification(
      makeInput({
        tierAllowsAlerts: false,
        sessionActive: true,
        localHour: 23,
        event: makeEvent({ source: 'background_retrospective' }),
      })
    );
    expect(result.reason).toBe('tier_excludes_alerts');
  });

  it('respects custom settings over the defaults', () => {
    const settings: EdgeNotificationSettings = {
      ...createDefaultEdgeNotificationSettings(),
      quietHoursStart: 9,
      quietHoursEnd: 11,
    };
    expect(evaluateEdgeNotification(makeInput({ settings })).reason).toBe('quiet_hours');
  });
});

describe('recording a delivery', () => {
  it('increments the count and stamps the time', () => {
    const state = createEmptyEdgeNotificationState(DAY);
    const next = recordEdgeNotificationSent(state, DAY, NOW);
    expect(next.notifiedTodayCount).toBe(1);
    expect(next.lastNotifiedAtMs).toBe(NOW);
    expect(next.dayKey).toBe(DAY);
  });

  it('resets the count across a local day boundary', () => {
    const yesterday: EdgeNotificationThrottleState = {
      lastNotifiedAtMs: NOW - 86_400_000,
      notifiedTodayCount: 3,
      dayKey: '2026-08-13',
    };
    const next = recordEdgeNotificationSent(yesterday, DAY, NOW);
    expect(next.notifiedTodayCount).toBe(1);
  });

  it('does not mutate the input state', () => {
    const state = createEmptyEdgeNotificationState(DAY);
    const snapshot = { ...state };
    recordEdgeNotificationSent(state, DAY, NOW);
    expect(state).toEqual(snapshot);
  });

  it('caps out after the configured number of deliveries', () => {
    let state = createEmptyEdgeNotificationState(DAY);
    for (let i = 0; i < EDGE_NOTIFICATION_DAILY_CAP; i++) {
      state = recordEdgeNotificationSent(state, DAY, NOW + i * 3_600_000);
    }
    const result = evaluateEdgeNotification(
      makeInput({ throttleState: state, nowMs: NOW + 86_000_000 })
    );
    expect(result.reason).toBe('daily_cap');
  });
});

describe('separation from the trading alert policy', () => {
  it('defaults are stricter than the external alert bridge', () => {
    // Wellness nudges should be rarer than trading alerts: 3 a day against 10,
    // and a 30-minute cooldown against 5 minutes.
    expect(EDGE_NOTIFICATION_DAILY_CAP).toBeLessThan(10);
    expect(EDGE_NOTIFICATION_COOLDOWN_SEC).toBeGreaterThan(300);
  });

  it('carries no notion of a trading symbol', () => {
    const settings = createDefaultEdgeNotificationSettings();
    expect(Object.keys(settings)).not.toContain('symbol');
    expect(Object.keys(createEmptyEdgeNotificationState(DAY))).not.toContain('symbol');
  });
});
