import { buildAlertContract } from '../contracts/alert-contract';
import type { AlertContract } from '../contracts/alert-contract';
import {
  ALERT_COOLDOWN_SEC,
  ALERT_DAILY_SURFACE_CAP,
  createEmptyAlertThrottleState,
  evaluateAlertDelivery,
  groupSimultaneousAlerts,
  recordAlertSurfaced,
  resolveAlertDayKey,
} from '../policies/alert-policy';
import type { AlertDeliveryInput, AlertThrottleState } from '../policies/alert-policy';

const NOON_UTC = Date.UTC(2026, 6, 11, 12, 0, 0);

function createAlert(overrides: { id?: string; symbol?: string; receivedAt?: number } = {}): AlertContract {
  return buildAlertContract(
    { symbol: overrides.symbol ?? 'NVDA', condition: 'Breakout' },
    {
      id: overrides.id ?? 'alert-1',
      source: 'simulated',
      receivedAt: overrides.receivedAt ?? NOON_UTC,
    },
  );
}

function createInput(overrides: Partial<AlertDeliveryInput> = {}): AlertDeliveryInput {
  return {
    alert: createAlert(),
    zone: 'neutral',
    throttleState: createEmptyAlertThrottleState(NOON_UTC),
    nowMs: NOON_UTC,
    featureFlagEnabled: true,
    tierAllowsAlerts: true,
    sessionActive: false,
    activeSessionSymbol: null,
    ...overrides,
  };
}

describe('evaluateAlertDelivery', () => {
  it('surfaces an alert when all checks pass', () => {
    const result = evaluateAlertDelivery(createInput());
    expect(result.decision).toBe('surfaced');
  });

  it('surfaces in clear zone', () => {
    expect(evaluateAlertDelivery(createInput({ zone: 'clear' })).decision).toBe('surfaced');
  });

  it('receives silently in strain zone', () => {
    const result = evaluateAlertDelivery(createInput({ zone: 'strain' }));
    expect(result.decision).toBe('silent_received');
    expect(result.reason).toContain('strain');
  });

  it('receives silently when the feature flag is off', () => {
    const result = evaluateAlertDelivery(createInput({ featureFlagEnabled: false }));
    expect(result.decision).toBe('silent_received');
    expect(result.reason).toContain('flag');
  });

  it('receives silently when the tier lacks the alert bridge', () => {
    const result = evaluateAlertDelivery(createInput({ tierAllowsAlerts: false }));
    expect(result.decision).toBe('silent_received');
    expect(result.reason).toContain('tier');
  });

  it('never interrupts an active decision session', () => {
    const result = evaluateAlertDelivery(createInput({ sessionActive: true }));
    expect(result.decision).toBe('silent_received');
    expect(result.reason).toContain('session');
  });

  it('turns a same-symbol alert during an active session into a quiet update', () => {
    const result = evaluateAlertDelivery(
      createInput({
        alert: createAlert({ symbol: 'ES1!' }),
        sessionActive: true,
        activeSessionSymbol: 'ES1!',
      }),
    );
    expect(result.decision).toBe('session_quiet_update');
    expect(result.reason).toContain('same-symbol');
  });

  it('keeps a different-symbol alert silent during an active session', () => {
    const result = evaluateAlertDelivery(
      createInput({
        alert: createAlert({ symbol: 'NVDA' }),
        sessionActive: true,
        activeSessionSymbol: 'ES1!',
      }),
    );
    expect(result.decision).toBe('silent_received');
  });

  describe('same-symbol cooldown boundaries', () => {
    function inputAfterSurface(elapsedSec: number): AlertDeliveryInput {
      const surfaced = recordAlertSurfaced(
        createEmptyAlertThrottleState(NOON_UTC),
        'NVDA',
        NOON_UTC,
      );
      return createInput({
        throttleState: surfaced,
        nowMs: NOON_UTC + elapsedSec * 1000,
      });
    }

    it('suppresses at 299s after the last surface', () => {
      expect(evaluateAlertDelivery(inputAfterSurface(ALERT_COOLDOWN_SEC - 1)).decision).toBe(
        'suppressed_cooldown',
      );
    });

    it('surfaces at exactly 300s', () => {
      expect(evaluateAlertDelivery(inputAfterSurface(ALERT_COOLDOWN_SEC)).decision).toBe(
        'surfaced',
      );
    });

    it('surfaces at 301s', () => {
      expect(evaluateAlertDelivery(inputAfterSurface(ALERT_COOLDOWN_SEC + 1)).decision).toBe(
        'surfaced',
      );
    });

    it('does not throttle a different symbol during cooldown', () => {
      const surfaced = recordAlertSurfaced(
        createEmptyAlertThrottleState(NOON_UTC),
        'NVDA',
        NOON_UTC,
      );
      const result = evaluateAlertDelivery(
        createInput({
          alert: createAlert({ id: 'alert-2', symbol: 'TSLA' }),
          throttleState: surfaced,
          nowMs: NOON_UTC + 1000,
        }),
      );
      expect(result.decision).toBe('surfaced');
    });
  });

  describe('daily surface cap', () => {
    it('receives silently once the cap is reached', () => {
      const capped: AlertThrottleState = {
        lastSurfacedAtMsBySymbol: {},
        surfacedTodayCount: ALERT_DAILY_SURFACE_CAP,
        dayKey: resolveAlertDayKey(NOON_UTC),
      };
      const result = evaluateAlertDelivery(createInput({ throttleState: capped }));
      expect(result.decision).toBe('silent_received');
      expect(result.reason).toContain('cap');
    });

    it('resets the cap after a UTC day rollover', () => {
      const capped: AlertThrottleState = {
        lastSurfacedAtMsBySymbol: {},
        surfacedTodayCount: ALERT_DAILY_SURFACE_CAP,
        dayKey: resolveAlertDayKey(NOON_UTC),
      };
      const nextDay = NOON_UTC + 24 * 60 * 60 * 1000;
      const result = evaluateAlertDelivery(
        createInput({ throttleState: capped, nowMs: nextDay }),
      );
      expect(result.decision).toBe('surfaced');
    });
  });
});

describe('recordAlertSurfaced', () => {
  it('stamps the symbol and increments the daily count without mutating input', () => {
    const initial = createEmptyAlertThrottleState(NOON_UTC);
    const next = recordAlertSurfaced(initial, 'NVDA', NOON_UTC);

    expect(next.lastSurfacedAtMsBySymbol.NVDA).toBe(NOON_UTC);
    expect(next.surfacedTodayCount).toBe(1);
    expect(initial.surfacedTodayCount).toBe(0);
    expect(initial.lastSurfacedAtMsBySymbol.NVDA).toBeUndefined();
  });

  it('resets the daily count on day rollover', () => {
    const surfaced = recordAlertSurfaced(createEmptyAlertThrottleState(NOON_UTC), 'NVDA', NOON_UTC);
    const nextDay = NOON_UTC + 24 * 60 * 60 * 1000;
    const next = recordAlertSurfaced(surfaced, 'TSLA', nextDay);

    expect(next.surfacedTodayCount).toBe(1);
    expect(next.dayKey).toBe(resolveAlertDayKey(nextDay));
  });
});

describe('groupSimultaneousAlerts', () => {
  it('groups alerts within the aggregation window', () => {
    const first = createAlert({ id: 'a', symbol: 'NVDA', receivedAt: NOON_UTC });
    const second = createAlert({ id: 'b', symbol: 'TSLA', receivedAt: NOON_UTC + 30_000 });
    const groups = groupSimultaneousAlerts([first, second]);

    expect(groups).toHaveLength(1);
    expect(groups[0].map(alert => alert.symbol)).toEqual(['NVDA', 'TSLA']);
  });

  it('splits alerts beyond the window into separate groups', () => {
    const first = createAlert({ id: 'a', symbol: 'NVDA', receivedAt: NOON_UTC });
    const second = createAlert({ id: 'b', symbol: 'TSLA', receivedAt: NOON_UTC + 61_000 });
    const groups = groupSimultaneousAlerts([first, second]);

    expect(groups).toHaveLength(2);
  });

  it('sorts unordered input by receive time before grouping', () => {
    const late = createAlert({ id: 'b', symbol: 'TSLA', receivedAt: NOON_UTC + 10_000 });
    const early = createAlert({ id: 'a', symbol: 'NVDA', receivedAt: NOON_UTC });
    const groups = groupSimultaneousAlerts([late, early]);

    expect(groups[0][0].symbol).toBe('NVDA');
  });

  it('returns no groups for no alerts', () => {
    expect(groupSimultaneousAlerts([])).toEqual([]);
  });
});
