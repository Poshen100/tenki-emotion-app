import { ALERT_PAYLOAD_MAX_STRING_LENGTH } from '../contracts/alert-contract';
import {
  assertAlertPayloadContract,
  validateAlertPayloadContract,
} from '../schemas/alert-schema';

const FULL_PAYLOAD = {
  symbol: 'NVDA',
  price: 128.5,
  condition: 'Breakout',
  timeframe: '5m',
  strategy: 'CANSLIM',
  note: 'RS High + Volume Spike',
};

describe('validateAlertPayloadContract', () => {
  it('accepts a full valid payload and preserves its fields', () => {
    const result = validateAlertPayloadContract(FULL_PAYLOAD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual(FULL_PAYLOAD);
    }
  });

  it('accepts a symbol-only payload', () => {
    const result = validateAlertPayloadContract({ symbol: 'TSLA' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ symbol: 'TSLA' });
    }
  });

  it('rejects non-object input', () => {
    const result = validateAlertPayloadContract('NVDA');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['alert payload must be an object']);
    }
  });

  it('rejects a missing symbol', () => {
    const result = validateAlertPayloadContract({ price: 128.5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('symbol');
    }
  });

  it('rejects a whitespace-only symbol', () => {
    const result = validateAlertPayloadContract({ symbol: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric price', () => {
    const result = validateAlertPayloadContract({ symbol: 'NVDA', price: '128.5' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('price');
    }
  });

  it('rejects over-length optional text', () => {
    const result = validateAlertPayloadContract({
      symbol: 'NVDA',
      note: 'x'.repeat(ALERT_PAYLOAD_MAX_STRING_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('note');
    }
  });

  it('accepts optional text at exactly the length limit', () => {
    const result = validateAlertPayloadContract({
      symbol: 'NVDA',
      note: 'x'.repeat(ALERT_PAYLOAD_MAX_STRING_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it('collects multiple errors in one pass', () => {
    const result = validateAlertPayloadContract({ price: Number.NaN, condition: 42 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('assertAlertPayloadContract', () => {
  it('passes through a valid payload', () => {
    expect(() => assertAlertPayloadContract(FULL_PAYLOAD)).not.toThrow();
  });

  it('throws with joined error messages on invalid payload', () => {
    expect(() => assertAlertPayloadContract({})).toThrow('symbol');
  });
});
