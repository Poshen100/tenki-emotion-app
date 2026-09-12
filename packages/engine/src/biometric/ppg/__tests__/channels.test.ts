/**
 * Which channel the pulse is in — measured, not assumed.
 *
 * 🔴 This suite exists because of a real-device result, not a hypothesis. The
 * first iPhone capture with the torch on reported full contact, a rhythm score
 * of **8%** (raw periodicity ≈ 0.24 against 0.93 on synthetic data) and no
 * reading at all. Red saturates under a torch; the pipeline was reading the one
 * channel that had been flattened.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import { PPG_CHANNELS, analyseChannel, selectPulseChannel } from '../channels';
import type { PpgFrame } from '../types';

function frames(overrides: Parameters<typeof synthesizePpg>[0] = {}): PpgFrame[] {
  return synthesizePpg({ durationSec: 90, ...overrides }).frames;
}

describe('every channel is measured, whichever one wins', () => {
  it('reports a diagnostic for each channel', () => {
    const selection = selectPulseChannel(frames());
    expect(selection?.diagnostics.map((d) => d.channel)).toEqual([...PPG_CHANNELS]);
  });

  it('🔴 reports the losing channel too, because that is the diagnosis', () => {
    // "Why did this capture fail" is answerable from this and unanswerable
    // without it. A selection that only reported the winner would have left
    // the real-device failure looking like a mystery.
    const selection = selectPulseChannel(frames(PPG_FIXTURES.clipped));
    const red = selection?.diagnostics.find((d) => d.channel === 'red');
    expect(red).toBeDefined();
    expect(red?.dcMean).toBeGreaterThan(0);
  });

  it('carries the channel through to the analysis', () => {
    const outcome = analyzePpgScan(frames(), 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('rejected');
    expect(PPG_CHANNELS).toContain(outcome.analysis.channel);
    expect(outcome.analysis.channelDiagnostics).toHaveLength(PPG_CHANNELS.length);
  });
});

describe('the channel is chosen by which one actually has a pulse', () => {
  it('reads red on a normally exposed fingertip', () => {
    // The physiologically expected answer, and still the answer when the
    // exposure allows it — the fix is not "use green instead".
    expect(selectPulseChannel(frames())?.chosen.channel).toBe('red');
  });

  it('🔴 switches to green when red is saturated, and gets a reading out of it', () => {
    // The real-device failure, reproduced: with the red channel pushed into
    // the sensor ceiling, red's periodicity collapses and green still carries
    // the pulse. Before this, the capture was simply refused.
    const clipped = frames(PPG_FIXTURES.clipped);
    const selection = selectPulseChannel(clipped);
    const red = selection?.diagnostics.find((d) => d.channel === 'red');
    const green = selection?.diagnostics.find((d) => d.channel === 'green');

    expect(red?.dcMean).toBeGreaterThan(240);
    expect(green?.periodicity as number).toBeGreaterThan(red?.periodicity as number);
    expect(selection?.chosen.channel).toBe('green');

    const outcome = analyzePpgScan(clipped, 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('rejected');
    expect(outcome.analysis.heartRateBpm).not.toBeNull();
    expect(outcome.analysis.channel).toBe('green');
  });

  it('does not rescue a capture that has no pulse in any channel', () => {
    // ⚠️ The limit of this fix. Channel selection finds a pulse that was in
    // the wrong place; it cannot invent one that is not there.
    const outcome = analyzePpgScan(frames(PPG_FIXTURES.lowPerfusion), 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('rejected');
    expect(outcome.analysis.heartRateBpm).toBeNull();
  });

  it('breaks a tie toward red rather than toward floating-point noise', () => {
    // A flickering channel choice would show up later as day-to-day variation
    // that is really just arithmetic.
    const flat: PpgFrame[] = Array.from({ length: 300 }, (_, i) => ({
      timestampMs: i * 33,
      red: 120,
      green: 120,
      blue: 70,
      clippedFraction: 0,
      coverage: 1,
      motion: 0,
    }));
    expect(selectPulseChannel(flat)?.chosen.channel).toBe('red');
  });
});

describe('a single channel can be inspected on its own', () => {
  it('returns the signal and what it looked like', () => {
    const analysis = analyseChannel(frames(), 'green');
    expect(analysis?.channel).toBe('green');
    expect(analysis?.values.length).toBeGreaterThan(0);
    expect(analysis?.cardiac.length).toBe(analysis?.values.length);
  });

  it('returns null when the timebase cannot be resampled at all', () => {
    expect(analyseChannel([], 'red')).toBeNull();
  });
});
