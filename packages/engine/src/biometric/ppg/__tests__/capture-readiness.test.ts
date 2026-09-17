/**
 * Whether the finger is in position — asked BEFORE the 90-second clock starts.
 *
 * 🔴 The load-bearing test in here is the one that proves the gate does NOT
 * block on exposure. Blocking on it was my first design, and the fixtures
 * refuted it: the torch-saturated capture produces a reading off the green
 * channel, so a gate that stopped it would have re-broken `channels.ts`.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import {
  ABSENT_COVERAGE,
  INITIAL_READINESS,
  MIN_READINESS_FRAMES,
  READINESS_HOLD_WINDOWS,
  READINESS_WINDOW_SEC,
  assessCaptureReadiness,
} from '../capture-readiness';
import type { PpgFrame } from '../types';

function frames(overrides: Parameters<typeof synthesizePpg>[0] = {}): PpgFrame[] {
  return synthesizePpg({ durationSec: 30, ...overrides }).frames;
}

/** The first `READINESS_WINDOW_SEC` of a capture — what the gate actually sees. */
function firstWindow(all: readonly PpgFrame[]): PpgFrame[] {
  const cutoff = all[0].timestampMs + READINESS_WINDOW_SEC * 1000;
  return all.filter((f) => f.timestampMs <= cutoff);
}

/** Feeds successive windows through the gate the way the surface does. */
function replayGate(all: readonly PpgFrame[], windows: number) {
  const results = [];
  let held = 0;
  for (let i = 0; i < windows; i++) {
    const from = all[0].timestampMs + i * READINESS_WINDOW_SEC * 1000;
    const window = all.filter(
      (f) => f.timestampMs >= from && f.timestampMs <= from + READINESS_WINDOW_SEC * 1000,
    );
    const readiness = assessCaptureReadiness(window, held);
    held = readiness.held;
    results.push(readiness);
  }
  return results;
}

describe('the gate answers from frames alone, in about a second', () => {
  it('claims nothing before it has frames', () => {
    expect(assessCaptureReadiness([], 0)).toEqual(INITIAL_READINESS);
    expect(assessCaptureReadiness(frames().slice(0, MIN_READINESS_FRAMES - 1), 0).stage).toBe(
      'approach',
    );
  });

  it('lets a well-placed finger through after the hold, and not before', () => {
    const run = replayGate(frames(), READINESS_HOLD_WINDOWS + 1);
    for (const step of run.slice(0, READINESS_HOLD_WINDOWS - 1)) {
      expect(step.ready).toBe(false);
      expect(step.blocker).toBeNull();
      expect(step.stage).toBe('hold');
    }
    expect(run[READINESS_HOLD_WINDOWS - 1].ready).toBe(true);
    expect(run[READINESS_HOLD_WINDOWS - 1].stage).toBe('ready');
  });

  it('names the blocker within one window, instead of at second ninety', () => {
    // The whole point of the pre-roll: the frames already knew, 88.5 seconds
    // earlier, and nobody was told.
    const off = assessCaptureReadiness(firstWindow(frames({ coverage: 0.1 })), 0);
    expect(off.stage).toBe('approach');
    expect(off.blocker).toBe('no_contact');

    const half = assessCaptureReadiness(firstWindow(frames({ coverage: 0.45 })), 0);
    expect(half.stage).toBe('cover');
    expect(half.blocker).toBe('partial_contact');
    // The two are distinguished by coverage, and the boundary is named.
    expect(0.45).toBeGreaterThan(ABSENT_COVERAGE);
  });

  it('loses the hold the moment the finger does', () => {
    // ⚠️ Not sticky, same reason as the Pulse Lock: credit kept for a position
    // the finger has left is a claim about the past shown as the present.
    const good = replayGate(frames(), READINESS_HOLD_WINDOWS - 1);
    const held = good[good.length - 1].held;
    expect(held).toBe(READINESS_HOLD_WINDOWS - 1);
    const slipped = assessCaptureReadiness(firstWindow(frames({ coverage: 0.1 })), held);
    expect(slipped.held).toBe(0);
    expect(slipped.ready).toBe(false);
  });
});

describe('the gate blocks on contact and nothing else', () => {
  /**
   * 🔴 Both of these captures have a component pinned at 0.00 in the first
   * window, and both end in a reading — off the green channel, because
   * `channels.ts` measures which channel the pulse is in rather than assuming
   * red. Blocking on either component would refuse to start a capture that
   * works, and in the `clipped` case would reinstate the exact torch failure
   * that module was built to survive.
   */
  it.each([
    ['clipped', PPG_FIXTURES.clipped, 'light' as const, 'over_exposed' as const],
    ['motion', PPG_FIXTURES.motion, 'stillness' as const, 'moving' as const],
  ])('%s: component floored, advisory raised, still allowed to start', (
    _name,
    fixture,
    component,
    advisory,
  ) => {
    const all = synthesizePpg({ durationSec: 90, ...fixture }).frames;

    const first = assessCaptureReadiness(firstWindow(all), 0);
    expect(first[component]).toBeLessThan(0.5);
    expect(first.advisories).toContain(advisory);
    expect(first.blocker).toBeNull();

    const run = replayGate(all, READINESS_HOLD_WINDOWS);
    expect(run[READINESS_HOLD_WINDOWS - 1].ready).toBe(true);

    // And the reason the gate must let it through: it produces a reading.
    const outcome = analyzePpgScan(all, 'full_scan');
    expect(outcome.status).toBe('analysed');
    if (outcome.status === 'analysed') expect(outcome.analysis.channel).toBe('green');
  });

  it('never carries a score, a rate, or a rhythm claim', () => {
    // Readiness has no duration behind it, so it may not hold any quantity
    // that needs one. Structural: the keys simply do not exist.
    expect(Object.keys(assessCaptureReadiness(firstWindow(frames()), 0)).sort()).toEqual(
      ['advisories', 'blocker', 'contact', 'held', 'light', 'ready', 'stage', 'stillness'].sort(),
    );
  });
});
