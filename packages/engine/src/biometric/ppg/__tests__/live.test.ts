/**
 * What a running capture may say about itself.
 *
 * 🔴 The claim under test is that the lock and the final verdict agree in the
 * direction that matters: a capture the pipeline will refuse must not have
 * shown a lock on the way there. The reverse mismatch (no lock on a capture
 * that is ultimately accepted) is allowed — a conservative instrument is
 * honest; an optimistic one is not.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import {
  INITIAL_PULSE_LOCK,
  LIVE_WINDOW_SEC,
  LOCK_CONSECUTIVE_WINDOWS,
  MIN_LIVE_WINDOW_SEC,
  advancePulseLock,
  assessLiveWindow,
  recentFrames,
} from '../live';
import type { PpgFrame } from '../types';

const DURATION_SEC = 90;

function frames(overrides: Parameters<typeof synthesizePpg>[0] = {}): PpgFrame[] {
  return synthesizePpg({ durationSec: DURATION_SEC, ...overrides }).frames;
}

/** Replays a capture as the surface sees it: a live reading every two seconds. */
function replayLive(all: PpgFrame[]) {
  const readings = [];
  let lock = INITIAL_PULSE_LOCK;
  let everLocked = false;
  for (let end = 2; end <= DURATION_SEC; end += 2) {
    const upTo = all.filter((f) => f.timestampMs <= all[0].timestampMs + end * 1000);
    const reading = assessLiveWindow(recentFrames(upTo, LIVE_WINDOW_SEC), 'full_scan');
    lock = advancePulseLock(lock, reading);
    everLocked = everLocked || lock.locked;
    readings.push({ endSec: end, reading, locked: lock.locked });
  }
  return { readings, lock, everLocked };
}

function finalBpm(all: PpgFrame[]): number | null {
  const outcome = analyzePpgScan(all, 'full_scan');
  return outcome.status === 'analysed' ? outcome.analysis.heartRateBpm : null;
}

describe('a live reading says only what the window supports', () => {
  it('reports contact and light from the very first frames', () => {
    // The three frame-level dimensions need no duration at all, and they are
    // the ones the user can act on immediately.
    const early = frames().filter((f, i) => i < 20);
    const reading = assessLiveWindow(early, 'full_scan');
    expect(reading.contactCoverage).toBeGreaterThan(0.5);
    expect(reading.lightStability).toBeGreaterThan(0.5);
    expect(reading.motionArtifact).toBeLessThan(0.5);
  });

  it('claims nothing about rhythm before the window is long enough', () => {
    // 🔴 null, not zero. Zero would read as "your rhythm is bad" when the
    // truth is that nothing has been measured yet.
    const short = frames().filter(
      (f, _i, all) => f.timestampMs - all[0].timestampMs < (MIN_LIVE_WINDOW_SEC - 3) * 1000,
    );
    const reading = assessLiveWindow(short, 'full_scan');
    expect(reading.rhythmicCoherence).toBeNull();
    expect(reading.score).toBeNull();
    expect(reading.meetsReadingGate).toBe(false);
  });

  it('assesses rhythm once there is enough window for one', () => {
    const reading = assessLiveWindow(recentFrames(frames(), LIVE_WINDOW_SEC), 'full_scan');
    expect(reading.rhythmicCoherence).not.toBeNull();
    expect(reading.rhythmicCoherence as number).toBeGreaterThan(0.8);
    expect(reading.score as number).toBeGreaterThan(80);
  });

  it('does not floor a live window for being shorter than the whole capture', () => {
    // ⚠️ The regression this guards: scoring a 20-second window against
    // `full_scan`'s 45-second minimum floors it at 20 and reports
    // `insufficient_duration` — so every live readout of a perfect capture
    // would have said the capture was too short.
    const reading = assessLiveWindow(recentFrames(frames(), LIVE_WINDOW_SEC), 'full_scan');
    expect(reading.reasons).not.toContain('insufficient_duration');
    expect(reading.score as number).toBeGreaterThan(20);
  });

  it('takes its window by time, so dropped frames cannot stretch it', () => {
    const dropped = frames(PPG_FIXTURES.frameDrops);
    const window = recentFrames(dropped, LIVE_WINDOW_SEC);
    const spanSec =
      (window[window.length - 1].timestampMs - window[0].timestampMs) / 1000;
    expect(spanSec).toBeLessThanOrEqual(LIVE_WINDOW_SEC + 0.5);
  });
});

describe('the lock holds only while the signal does', () => {
  it('locks on a clean capture, and only after the gate has held', () => {
    const { readings, everLocked } = replayLive(frames());
    expect(everLocked).toBe(true);
    const firstLock = readings.find((r) => r.locked);
    const firstGate = readings.find((r) => r.reading.meetsReadingGate);
    expect(firstLock).toBeDefined();
    // Not on the first passing window — the gate has to hold.
    expect(firstLock?.endSec).toBeGreaterThan(firstGate?.endSec as number);
  });

  it('drops the lock when the signal stops meeting the gate', () => {
    // 🔴 Not sticky. A lock that survives the condition it describes is a
    // claim about the past presented as the present.
    const locked = { consecutive: LOCK_CONSECUTIVE_WINDOWS + 2, locked: true };
    const failing = assessLiveWindow(
      recentFrames(frames(PPG_FIXTURES.lowPerfusion), LIVE_WINDOW_SEC),
      'full_scan',
    );
    expect(failing.meetsReadingGate).toBe(false);
    const next = advancePulseLock(locked, failing);
    expect(next.locked).toBe(false);
    expect(next.consecutive).toBe(0);
  });

  it('never shows a lock on a capture the pipeline then refuses', () => {
    // 🔴 The whole point. A user must not watch "signal holding" for forty
    // seconds and then be told there is no reading.
    // ⚠️ `clipped` used to belong in this list and no longer does. Once the
    // pipeline picks its channel by measurement, an over-exposed capture is
    // rescued by green — which is the whole point of `channels.ts`, and the
    // reason a real iPhone with the torch on was failing. It is now a
    // channel-switch case, covered in channels.test.ts.
    for (const fixture of [PPG_FIXTURES.lowPerfusion]) {
      const all = frames(fixture);
      expect(finalBpm(all)).toBeNull();
      expect(replayLive(all).everLocked).toBe(false);
    }
  });

  it('does not lock on heavy motion', () => {
    expect(replayLive(frames({ motionAmplitude: 1.2 })).everLocked).toBe(false);
  });

  it('locks on a weak-but-readable capture, because that one does yield a reading', () => {
    // The other direction: the lock must not be so strict that a capture the
    // pipeline accepts never shows one.
    const all = frames({ perfusion: 0.35 });
    expect(finalBpm(all)).not.toBeNull();
    expect(replayLive(all).everLocked).toBe(true);
  });
});
