import type { DomainTradeResult } from '../contracts/trade-result';
import {
  DAILY_TRADE_BUDGET,
  resolveDayCadence,
  resolveTradingDayKey,
} from '../policies/day-cadence';

/** 2026-08-04 10:00 ET (14:00 UTC, EDT) — a normal in-session weekday morning. */
const MORNING_ET = Date.parse('2026-08-04T14:00:00Z');

function rec(result: DomainTradeResult | null, offsetMs = 0) {
  return { ts: MORNING_ET + offsetMs, tradeResult: result };
}

const MIN = 60_000;

describe('resolveTradingDayKey', () => {
  it('uses the ET calendar day, not UTC', () => {
    // 2026-08-04 21:00 ET = 2026-08-05 01:00 UTC. A UTC key would say the 5th.
    const eveningET = Date.parse('2026-08-05T01:00:00Z');
    expect(resolveTradingDayKey(eveningET)).toBe('2026-08-04');
  });

  it('is DST-aware (EST vs EDT both land on the ET date)', () => {
    // January = EST (UTC-5): 2026-01-15 20:00 ET = 2026-01-16 01:00 UTC
    expect(resolveTradingDayKey(Date.parse('2026-01-16T01:00:00Z'))).toBe('2026-01-15');
    // July = EDT (UTC-4): 2026-07-15 21:00 ET = 2026-07-16 01:00 UTC
    expect(resolveTradingDayKey(Date.parse('2026-07-16T01:00:00Z'))).toBe('2026-07-15');
  });
});

describe('resolveDayCadence — §6.1 daily cadence', () => {
  it('no records at all → fresh', () => {
    const out = resolveDayCadence([], MORNING_ET);
    expect(out.state).toBe('fresh');
    expect(out.tradesToday).toBe(0);
  });

  it('first trade taken profit → stop_after_win（贏停規則）', () => {
    const out = resolveDayCadence([rec('profit_taken')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('stop_after_win');
    expect(out.tradesToday).toBe(1);
  });

  it('first trade stopped out → second_chance（輸的續作）', () => {
    const out = resolveDayCadence([rec('stopped_out')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('second_chance');
    expect(out.tradesToday).toBe(1);
  });

  it('two stop-outs → circuit_break（雙輸熔斷）', () => {
    const out = resolveDayCadence(
      [rec('stopped_out'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('circuit_break');
    expect(out.tradesToday).toBe(2);
  });

  it('win then loss → day_complete, NOT circuit_break', () => {
    const out = resolveDayCadence(
      [rec('profit_taken'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
    expect(out.tradesToday).toBe(2);
  });

  it('scratch is not a win — it does not trigger 贏停', () => {
    const out = resolveDayCadence([rec('scratch')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('second_chance');
  });

  it('scratch is not a loss — two scratches never circuit-break', () => {
    const out = resolveDayCadence(
      [rec('scratch'), rec('scratch', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
  });

  it('one scratch + one stop-out is not a double loss', () => {
    const out = resolveDayCadence(
      [rec('scratch'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
  });

  it('no_entry never consumes the daily budget（§7 step 7 是紀律，不是交易）', () => {
    const out = resolveDayCadence(
      [rec('no_entry'), rec('no_entry', 10 * MIN), rec('no_entry', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('records predating the contract (null result) are not guessed at', () => {
    const out = resolveDayCadence([rec(null), rec(null, 10 * MIN)], MORNING_ET + 30 * MIN);
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('ignores yesterday — the tally resets on the ET day boundary', () => {
    const yesterday = MORNING_ET - 24 * 60 * MIN;
    const out = resolveDayCadence(
      [
        { ts: yesterday, tradeResult: 'stopped_out' },
        { ts: yesterday + 20 * MIN, tradeResult: 'stopped_out' },
      ],
      MORNING_ET,
    );
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('a late-evening ET trade still belongs to that ET day, not the next UTC day', () => {
    // 2026-08-04 21:00 ET (= 2026-08-05 01:00 UTC)
    const eveningET = Date.parse('2026-08-05T01:00:00Z');
    const out = resolveDayCadence(
      [{ ts: eveningET, tradeResult: 'profit_taken' }],
      eveningET + 10 * MIN,
    );
    expect(out.tradesToday).toBe(1);
    expect(out.state).toBe('stop_after_win');
  });

  it('orders by timestamp, not array order, when deciding "the first two"', () => {
    // Loss recorded second in the array but FIRST in time → first two are both losses.
    const out = resolveDayCadence(
      [rec('stopped_out', 20 * MIN), rec('stopped_out')],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('circuit_break');
  });

  it('over-budget days still just state the fact', () => {
    const out = resolveDayCadence(
      [rec('profit_taken'), rec('scratch', 10 * MIN), rec('scratch', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.tradesToday).toBe(3);
    expect(out.state).toBe('day_complete');
  });

  it('exposes the §6.1 daily budget as a named constant', () => {
    expect(DAILY_TRADE_BUDGET).toBe(2);
  });
});

describe('resolveDayCadence — compliance of the context line', () => {
  const BANNED = ['勝率', '建議', '應該', '休息', '表現', '獲利率', '期望值', '停手吧'];

  it('every state produces a factual line with no advice or evaluation', () => {
    const cases = [
      resolveDayCadence([], MORNING_ET),
      resolveDayCadence([rec('profit_taken')], MORNING_ET + 30 * MIN),
      resolveDayCadence([rec('stopped_out')], MORNING_ET + 30 * MIN),
      resolveDayCadence(
        [rec('stopped_out'), rec('stopped_out', 20 * MIN)],
        MORNING_ET + 30 * MIN,
      ),
      resolveDayCadence(
        [rec('profit_taken'), rec('scratch', 20 * MIN)],
        MORNING_ET + 30 * MIN,
      ),
    ];
    for (const out of cases) {
      expect(out.contextZh.length).toBeGreaterThan(0);
      for (const word of BANNED) {
        expect(out.contextZh).not.toContain(word);
      }
    }
  });
});
