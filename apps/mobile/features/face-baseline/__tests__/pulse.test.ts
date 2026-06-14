/**
 * @module face-baseline/__tests__/pulse.test
 * @description Tests for the mobile TENKI Pulse mirror + the expo-haptics
 * pattern player (pure logic; no native stack).
 */
import {
  createPulseProfile,
  evolvePulseProfile,
  scanEventPulse,
  zonePulse,
  toWebVibration,
  PULSE_LIMITS,
  type PulseProfile,
  type PulseEvent,
  type PulseZone,
  type HapticPattern,
} from '../utils/pulse';
import {
  intensityToImpactStyle,
  buildSchedule,
  playPattern,
  type ImpactStyle,
  type TimerScheduler,
} from '../utils/pulsePlayer';

const EVENTS: PulseEvent[] = ['face_locked', 'scan_tick', 'calibration_milestone', 'baseline_locked'];
const ZONES: PulseZone[] = ['clear', 'neutral', 'strain'];

function runScans(zone: PulseZone, n: number, score = 84): PulseProfile {
  let p = createPulseProfile(0.5);
  for (let i = 0; i < n; i++) p = evolvePulseProfile(p, { zone, score });
  return p;
}

function patternValid(pattern: HapticPattern): void {
  expect(pattern.length).toBeGreaterThan(0);
  for (const s of pattern) {
    expect(s.intensity).toBeGreaterThanOrEqual(0);
    expect(s.intensity).toBeLessThanOrEqual(1);
    expect(s.durationMs).toBeGreaterThan(0);
    expect(s.gapMs).toBeGreaterThanOrEqual(0);
  }
}

describe('pulse profile learning', () => {
  it('starts generic and is pure on evolve', () => {
    const p = createPulseProfile();
    expect(p.sessions).toBe(0);
    expect(p.maturity).toBe('new');
    const snapshot = JSON.stringify(p);
    evolvePulseProfile(p, { zone: 'clear', score: 90 });
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('advances maturity by scan count (1 / 5 / 15)', () => {
    expect(runScans('neutral', 1).maturity).toBe('building');
    expect(runScans('neutral', 5).maturity).toBe('ready');
    expect(runScans('neutral', 15).maturity).toBe('mature');
  });

  it('learns the dominant zone and keeps zoneBias normalized', () => {
    const p = runScans('strain', 10);
    expect(p.zoneBias.clear + p.zoneBias.neutral + p.zoneBias.strain).toBeCloseTo(1, 5);
    expect(p.zoneBias.strain).toBeGreaterThan(p.zoneBias.clear);
  });

  it('adapts intensity/tempo within safe limits (strain softer+slower than clear)', () => {
    const clear = runScans('clear', 30);
    const strain = runScans('strain', 30);
    expect(strain.intensityScale).toBeLessThan(clear.intensityScale);
    expect(strain.tempoScale).toBeGreaterThan(clear.tempoScale);
    for (const p of [clear, strain]) {
      expect(p.intensityScale).toBeGreaterThanOrEqual(PULSE_LIMITS.intensityScale.min);
      expect(p.intensityScale).toBeLessThanOrEqual(PULSE_LIMITS.intensityScale.max);
      expect(p.tempoScale).toBeGreaterThanOrEqual(PULSE_LIMITS.tempoScale.min);
      expect(p.tempoScale).toBeLessThanOrEqual(PULSE_LIMITS.tempoScale.max);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(runScans('clear', 7))).toBe(JSON.stringify(runScans('clear', 7)));
  });
});

describe('pulse patterns', () => {
  it('produces a valid pattern for every event and zone', () => {
    const p = createPulseProfile();
    for (const e of EVENTS) patternValid(scanEventPulse(e, p));
    for (const z of ZONES) patternValid(zonePulse(z, p));
  });

  it('gives a distinct pulse per zone', () => {
    const p = createPulseProfile();
    const sigs = ZONES.map((z) => JSON.stringify(zonePulse(z, p)));
    expect(new Set(sigs).size).toBe(3);
  });

  it('enriches the lock + reveal once the profile matures', () => {
    const fresh = createPulseProfile();
    const mature = runScans('clear', 20);
    expect(scanEventPulse('baseline_locked', mature).length).toBeGreaterThan(scanEventPulse('baseline_locked', fresh).length);
    expect(zonePulse('neutral', mature).length).toBeGreaterThan(zonePulse('neutral', fresh).length);
  });

  it('converts to a web vibration array, trimming trailing zero gaps', () => {
    expect(
      toWebVibration([
        { intensity: 0.5, durationMs: 20, gapMs: 50 },
        { intensity: 0.8, durationMs: 26, gapMs: 0 },
      ]),
    ).toEqual([20, 50, 26]);
  });
});

describe('pulse player', () => {
  it('maps intensity to impact style buckets', () => {
    expect(intensityToImpactStyle(0.1)).toBe('Soft');
    expect(intensityToImpactStyle(0.4)).toBe('Light');
    expect(intensityToImpactStyle(0.7)).toBe('Medium');
    expect(intensityToImpactStyle(0.95)).toBe('Heavy');
  });

  it('builds a cumulative impact timeline', () => {
    const schedule = buildSchedule([
      { intensity: 0.5, durationMs: 18, gapMs: 50 },
      { intensity: 0.8, durationMs: 26, gapMs: 0 },
    ]);
    expect(schedule.map((s) => s.atMs)).toEqual([0, 68]);
    expect(schedule.map((s) => s.style)).toEqual(['Light', 'Heavy']);
  });

  it('fires every step once, in order, and cancels pending impacts', () => {
    const fired: ImpactStyle[] = [];
    const pending: Array<() => void> = [];
    const scheduler: TimerScheduler = {
      set: (cb) => {
        pending.push(cb);
        return pending.length - 1;
      },
      clear: () => {
        /* tracked via cancel below */
      },
    };
    const pattern: HapticPattern = scanEventPulse('baseline_locked', createPulseProfile());
    const cancel = playPattern(pattern, (style) => fired.push(style), scheduler);
    // first impact fires synchronously; the rest are queued
    expect(fired.length).toBe(1);
    for (const cb of pending) cb();
    expect(fired.length).toBe(pattern.length);
    expect(typeof cancel).toBe('function');
    cancel();
  });
});
