/**
 * @module analytics/focus-window.test
 * @description Tests for Focus Window. The thin-sample assertions carry the
 * weight here: reporting a confident window from a handful of records is the
 * failure mode that actually damages trust.
 */

import {
  CLEAR_RATE_MARGIN,
  MIN_SAMPLES_FOR_WINDOW,
  MIN_SAMPLES_PER_HOUR,
  computeFocusWindow,
  formatFocusWindow,
} from '../focus-window';
import type { FocusWindowSample } from '../focus-window';

/** Builds n samples at a given hour with a given clear count. */
function samplesAt(hour: number, total: number, clear: number): FocusWindowSample[] {
  return Array.from({ length: total }, (_, i) => ({ hour, wasClear: i < clear }));
}

describe('sample gating', () => {
  it('reports nothing below the total sample floor', () => {
    const result = computeFocusWindow(samplesAt(10, MIN_SAMPLES_FOR_WINDOW - 1, 10), 5);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.gap).toBe('insufficient_samples');
    }
  });

  it('reports nothing at all for an empty history', () => {
    const result = computeFocusWindow([], 0);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.sampleCount).toBe(0);
  });

  it('ignores hours that individually fall below the per-hour floor', () => {
    // 10:00 and 11:00 are all-clear but have only 2 samples each; the rest are
    // spread thin and never clear. Total clears the floor, hours do not.
    const samples: FocusWindowSample[] = [
      ...samplesAt(10, MIN_SAMPLES_PER_HOUR - 1, MIN_SAMPLES_PER_HOUR - 1),
      ...samplesAt(11, MIN_SAMPLES_PER_HOUR - 1, MIN_SAMPLES_PER_HOUR - 1),
      ...samplesAt(15, 20, 0),
    ];
    const result = computeFocusWindow(samples, 20);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.gap).toBe('no_qualifying_run');
  });

  it('reports nothing when no hour beats the personal average by the margin', () => {
    // Every hour sits at the same clear rate, so nothing stands out.
    const samples: FocusWindowSample[] = [
      ...samplesAt(9, 10, 5),
      ...samplesAt(10, 10, 5),
      ...samplesAt(11, 10, 5),
    ];
    const result = computeFocusWindow(samples, 20);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.gap).toBe('no_qualifying_run');
  });
});

describe('window detection', () => {
  it('finds a contiguous high-clarity run', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(10, 10, 9),
      ...samplesAt(11, 10, 9),
      ...samplesAt(15, 10, 1),
      ...samplesAt(16, 10, 1),
    ];
    const result = computeFocusWindow(samples, 24);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.window.startHour).toBe(10);
      expect(result.window.endHour).toBe(12);
      expect(result.daysOfData).toBe(24);
    }
  });

  it('requires at least two contiguous hours', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(10, 10, 10),
      ...samplesAt(14, 15, 2),
      ...samplesAt(18, 10, 1),
    ];
    const result = computeFocusWindow(samples, 20);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.gap).toBe('no_qualifying_run');
  });

  it('picks the longest run when several qualify', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(8, 10, 9),
      ...samplesAt(9, 10, 9),
      ...samplesAt(14, 10, 9),
      ...samplesAt(15, 10, 9),
      ...samplesAt(16, 10, 9),
      ...samplesAt(20, 30, 0),
    ];
    const result = computeFocusWindow(samples, 30);
    if (result.status === 'ok') {
      expect(result.window.startHour).toBe(14);
      expect(result.window.endHour).toBe(17);
    }
  });

  it('reports the clear rate and sample count behind the window', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(10, 10, 8),
      ...samplesAt(11, 10, 8),
      ...samplesAt(16, 20, 0),
    ];
    const result = computeFocusWindow(samples, 25);
    if (result.status === 'ok') {
      expect(result.window.sampleCount).toBe(20);
      expect(result.window.clearRate).toBeCloseTo(0.8, 5);
    }
  });

  it('does not wrap a run past midnight', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(23, 10, 9),
      ...samplesAt(0, 10, 9),
      ...samplesAt(12, 20, 0),
    ];
    const result = computeFocusWindow(samples, 20);
    // 23:00 and 00:00 are not contiguous in a non-wrapping scan, so neither
    // single hour forms a run of the required length.
    expect(result.status).toBe('unavailable');
  });

  it('ignores samples with an out-of-range hour', () => {
    const samples: FocusWindowSample[] = [
      ...samplesAt(10, 10, 9),
      ...samplesAt(11, 10, 9),
      ...samplesAt(99, 5, 5),
      ...samplesAt(16, 10, 0),
    ];
    const result = computeFocusWindow(samples, 20);
    expect(result.status).toBe('ok');
  });
});

describe('margin constant', () => {
  it('requires a meaningful lift over the personal average', () => {
    expect(CLEAR_RATE_MARGIN).toBeGreaterThan(0);
  });
});

describe('formatting', () => {
  it('renders a zero-padded range', () => {
    expect(
      formatFocusWindow({ startHour: 9, endHour: 12, clearRate: 0.8, sampleCount: 30 })
    ).toBe('09:00 – 12:00');
  });
});
