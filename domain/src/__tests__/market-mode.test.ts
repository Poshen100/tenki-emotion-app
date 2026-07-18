import { buildAlertContract } from '../contracts/alert-contract';
import type { AlertContract } from '../contracts/alert-contract';
import {
  MARKET_MODE_CONTEXT_ZH,
  extractMarketMode,
  resolveMarketModeContext,
} from '../policies/market-mode';

const NOON_UTC = Date.UTC(2026, 6, 11, 12, 0, 0);

function createAlert(fields: { condition?: string; note?: string }): AlertContract {
  return buildAlertContract(
    { symbol: 'ES1!', condition: fields.condition, note: fields.note },
    { id: 'alert-1', source: 'simulated', receivedAt: NOON_UTC },
  );
}

describe('extractMarketMode', () => {
  it('reads Mode 1 from condition', () => {
    expect(extractMarketMode(createAlert({ condition: 'Reclaim · Mode 1' }))).toBe('mode_1');
  });

  it('reads Mode 2 from condition', () => {
    expect(extractMarketMode(createAlert({ condition: 'FBD Mode 2 trap' }))).toBe('mode_2');
  });

  it('is case- and space-insensitive', () => {
    expect(extractMarketMode(createAlert({ condition: 'mode2' }))).toBe('mode_2');
    expect(extractMarketMode(createAlert({ condition: 'MODE  1 day' }))).toBe('mode_1');
  });

  it('falls back to note when condition has no marker', () => {
    expect(extractMarketMode(createAlert({ condition: 'Key Low', note: 'context: Mode 2' }))).toBe(
      'mode_2',
    );
  });

  it('prefers condition over note', () => {
    expect(
      extractMarketMode(createAlert({ condition: 'Mode 1 trend', note: 'Mode 2 range' })),
    ).toBe('mode_1');
  });

  it('returns null when unmarked', () => {
    expect(extractMarketMode(createAlert({ condition: 'Breakout' }))).toBeNull();
    expect(extractMarketMode(createAlert({}))).toBeNull();
  });

  it('returns null for out-of-range mode digits', () => {
    expect(extractMarketMode(createAlert({ condition: 'Mode 3' }))).toBeNull();
    // "Mode 12" -> \b after the captured digit fails, so no false match
    expect(extractMarketMode(createAlert({ condition: 'Mode 12' }))).toBeNull();
  });
});

describe('resolveMarketModeContext', () => {
  it('returns the fact context line for a marked alert', () => {
    expect(resolveMarketModeContext(createAlert({ condition: 'Mode 1' }))).toBe(
      MARKET_MODE_CONTEXT_ZH.mode_1,
    );
  });

  it('returns null for an unmarked alert', () => {
    expect(resolveMarketModeContext(createAlert({ condition: 'Breakout' }))).toBeNull();
  });
});
