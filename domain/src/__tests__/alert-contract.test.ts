import {
  DOMAIN_ALERT_DELIVERY_DECISIONS,
  DOMAIN_ALERT_LIFECYCLE_STATES,
  buildAlertContract,
} from '../contracts/alert-contract';
import type { AlertContractMeta, AlertPayloadContract } from '../contracts/alert-contract';

function createPayload(overrides: Partial<AlertPayloadContract> = {}): AlertPayloadContract {
  return {
    symbol: 'NVDA',
    price: 128.5,
    condition: 'Breakout',
    timeframe: '5m',
    strategy: 'CANSLIM',
    note: 'RS High + Volume Spike',
    ...overrides,
  };
}

function createMeta(overrides: Partial<AlertContractMeta> = {}): AlertContractMeta {
  return {
    id: 'alert-1',
    source: 'tradingview',
    receivedAt: 1_750_000_000_000,
    ...overrides,
  };
}

describe('buildAlertContract', () => {
  it('builds a canonical alert from a full payload', () => {
    const alert = buildAlertContract(createPayload(), createMeta());

    expect(alert).toEqual({
      id: 'alert-1',
      source: 'tradingview',
      symbol: 'NVDA',
      price: 128.5,
      condition: 'Breakout',
      timeframe: '5m',
      strategyHint: 'CANSLIM',
      note: 'RS High + Volume Spike',
      receivedAt: 1_750_000_000_000,
      priority: 'normal',
    });
  });

  it('normalizes symbol to trimmed uppercase', () => {
    const alert = buildAlertContract(createPayload({ symbol: '  nvda ' }), createMeta());
    expect(alert.symbol).toBe('NVDA');
  });

  it('maps missing optional fields to null', () => {
    const alert = buildAlertContract({ symbol: 'TSLA' }, createMeta());

    expect(alert.price).toBeNull();
    expect(alert.condition).toBeNull();
    expect(alert.timeframe).toBeNull();
    expect(alert.strategyHint).toBeNull();
    expect(alert.note).toBeNull();
  });

  it('treats whitespace-only optional text as null', () => {
    const alert = buildAlertContract(createPayload({ condition: '   ' }), createMeta());
    expect(alert.condition).toBeNull();
  });

  it('honors an explicit priority', () => {
    const alert = buildAlertContract(createPayload(), createMeta({ priority: 'high' }));
    expect(alert.priority).toBe('high');
  });

  it('throws on an empty symbol', () => {
    expect(() => buildAlertContract(createPayload({ symbol: '  ' }), createMeta())).toThrow(
      'Alert symbol must be a non-empty string',
    );
  });

  it('throws on an empty id', () => {
    expect(() => buildAlertContract(createPayload(), createMeta({ id: ' ' }))).toThrow(
      'Alert id must be a non-empty string',
    );
  });

  it('throws on a non-positive receivedAt', () => {
    expect(() => buildAlertContract(createPayload(), createMeta({ receivedAt: 0 }))).toThrow(
      'Alert receivedAt must be a positive timestamp',
    );
  });

  it('throws on a non-finite price', () => {
    expect(() =>
      buildAlertContract(createPayload({ price: Number.POSITIVE_INFINITY }), createMeta()),
    ).toThrow('Alert price must be a finite number when provided');
  });
});

describe('alert lifecycle vocabulary', () => {
  it('keeps delivery decisions and lifecycle states process-neutral', () => {
    expect(DOMAIN_ALERT_DELIVERY_DECISIONS).toEqual([
      'surfaced',
      'silent_received',
      'suppressed_cooldown',
      'aggregated',
    ]);
    expect(DOMAIN_ALERT_LIFECYCLE_STATES).toEqual([
      'received',
      'surfaced',
      'engaged',
      'dismissed',
      'expired',
    ]);
  });
});
