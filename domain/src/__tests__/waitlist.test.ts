import {
  WAITLIST_EMAIL_MAX_LENGTH,
  WAITLIST_MAX_PER_WINDOW,
  WAITLIST_WINDOW_SEC,
  isOverWaitlistCap,
  normalizeWaitlistEmail,
  waitlistRateKey,
} from '../policies/waitlist';

describe('normalizeWaitlistEmail', () => {
  it('trims and lower-cases a usable address', () => {
    expect(normalizeWaitlistEmail('  Trader@Example.COM ')).toBe('trader@example.com');
  });

  it.each([
    ['not a string', 42],
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
    ['no at sign', 'trader.example.com'],
    ['no domain dot', 'trader@example'],
    ['inner whitespace', 'tra der@example.com'],
    ['two at signs', 'a@b@example.com'],
    ['nothing before the at sign', '@example.com'],
  ])('refuses %s', (_label, raw) => {
    expect(normalizeWaitlistEmail(raw)).toBeNull();
  });

  it('accepts the longest allowed address and refuses one character more', () => {
    const domain = '@example.com';
    const longest = 'a'.repeat(WAITLIST_EMAIL_MAX_LENGTH - domain.length) + domain;
    expect(normalizeWaitlistEmail(longest)).toBe(longest);
    expect(normalizeWaitlistEmail(`a${longest}`)).toBeNull();
  });
});

describe('waitlistRateKey', () => {
  const windowMs = WAITLIST_WINDOW_SEC * 1000;

  it('is stable inside a window and rolls at its edge', () => {
    const start = 500 * windowMs;
    expect(waitlistRateKey('1.2.3.4', start)).toBe(waitlistRateKey('1.2.3.4', start + windowMs - 1));
    expect(waitlistRateKey('1.2.3.4', start)).not.toBe(waitlistRateKey('1.2.3.4', start + windowMs));
  });

  it('keeps clients apart', () => {
    expect(waitlistRateKey('1.2.3.4', 0)).not.toBe(waitlistRateKey('5.6.7.8', 0));
  });
});

describe('isOverWaitlistCap', () => {
  it('lets the cap itself through and refuses the next one', () => {
    expect(isOverWaitlistCap(1)).toBe(false);
    expect(isOverWaitlistCap(WAITLIST_MAX_PER_WINDOW)).toBe(false);
    expect(isOverWaitlistCap(WAITLIST_MAX_PER_WINDOW + 1)).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses an unreadable count (%s) instead of treating it as a fresh client',
    (count) => {
      expect(isOverWaitlistCap(count)).toBe(true);
    },
  );
});
