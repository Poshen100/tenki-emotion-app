import {
  CHANNEL_CREATE_MAX_PER_WINDOW,
  CHANNEL_CREATE_WINDOW_SEC,
  CHANNEL_RATE_KEY_PREFIX,
  channelRateKey,
  isOverChannelCreationCap,
} from '../policies/channel-rate-limit';

const WINDOW_MS = CHANNEL_CREATE_WINDOW_SEC * 1000;

describe('channelRateKey', () => {
  it('keeps the same key for two moments inside one window', () => {
    const base = 1_700_000_000_000;
    const start = Math.floor(base / WINDOW_MS) * WINDOW_MS;
    expect(channelRateKey('1.2.3.4', start)).toBe(
      channelRateKey('1.2.3.4', start + WINDOW_MS - 1),
    );
  });

  it('rolls to a new key at the window boundary', () => {
    const start = Math.floor(1_700_000_000_000 / WINDOW_MS) * WINDOW_MS;
    expect(channelRateKey('1.2.3.4', start)).not.toBe(
      channelRateKey('1.2.3.4', start + WINDOW_MS),
    );
  });

  it('separates clients inside the same window', () => {
    const now = 1_700_000_000_000;
    expect(channelRateKey('1.2.3.4', now)).not.toBe(channelRateKey('5.6.7.8', now));
  });

  it('carries the namespaced prefix so the key cannot collide with alert or channel keys', () => {
    expect(channelRateKey('1.2.3.4', 1_700_000_000_000).startsWith(CHANNEL_RATE_KEY_PREFIX)).toBe(
      true,
    );
  });
});

describe('isOverChannelCreationCap', () => {
  it('lets the first creation of a window through', () => {
    expect(isOverChannelCreationCap(1)).toBe(false);
  });

  it('treats the cap as inclusive — the Nth creation still passes', () => {
    expect(isOverChannelCreationCap(CHANNEL_CREATE_MAX_PER_WINDOW)).toBe(false);
  });

  it('refuses the one past the cap', () => {
    expect(isOverChannelCreationCap(CHANNEL_CREATE_MAX_PER_WINDOW + 1)).toBe(true);
  });

  // 🔴 「量不到」不得變成「沒有上限」。0 是 counter 讀不回來的形狀，
  //    不是「這個 client 還很乾淨」—— 放行它等於把限流整條關掉而沒人會知道。
  it('refuses when the counter could not be read (0), instead of treating it as fresh', () => {
    expect(isOverChannelCreationCap(0)).toBe(true);
  });

  it('refuses NaN and negatives rather than falling through to the permissive branch', () => {
    expect(isOverChannelCreationCap(Number.NaN)).toBe(true);
    expect(isOverChannelCreationCap(-1)).toBe(true);
  });
});
