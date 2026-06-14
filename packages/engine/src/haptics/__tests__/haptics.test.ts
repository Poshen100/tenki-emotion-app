/**
 * @module haptics/__tests__/haptics.test
 * @description Tests for the TENKI Pulse haptic engine (pure, deterministic).
 */
import {
  createPulseProfile,
  evolvePulseProfile,
  maturityForSessions,
  scanEventPulse,
  zonePulse,
  toWebVibration,
  PULSE_LIMITS,
  type PulseProfile,
  type PulseEvent,
  type HapticPattern,
} from '../haptics';
import type { EdgeZone } from '../../scoring/types';

const EVENTS: PulseEvent[] = ['face_locked', 'scan_tick', 'calibration_milestone', 'baseline_locked'];
const ZONES: EdgeZone[] = ['clear', 'neutral', 'strain'];

/** Run N scans of a fixed zone through the profile. */
function runScans(zone: EdgeZone, n: number, score = 84): PulseProfile {
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
    expect(Number.isFinite(s.intensity)).toBe(true);
  }
}

describe('maturityForSessions', () => {
  it('maps scan counts to maturity stages at the baseline thresholds', () => {
    expect(maturityForSessions(0)).toBe('new');
    expect(maturityForSessions(1)).toBe('building');
    expect(maturityForSessions(4)).toBe('building');
    expect(maturityForSessions(5)).toBe('ready');
    expect(maturityForSessions(14)).toBe('ready');
    expect(maturityForSessions(15)).toBe('mature');
    expect(maturityForSessions(99)).toBe('mature');
  });
});

describe('createPulseProfile', () => {
  it('returns generic defaults for a new user', () => {
    const p = createPulseProfile();
    expect(p.sessions).toBe(0);
    expect(p.maturity).toBe('new');
    expect(p.intensityScale).toBe(1);
    expect(p.tempoScale).toBe(1);
    expect(p.zoneBias.clear + p.zoneBias.neutral + p.zoneBias.strain).toBeCloseTo(1, 5);
  });

  it('clamps the signature seed to 0–1', () => {
    expect(createPulseProfile(9).signatureSeed).toBe(1);
    expect(createPulseProfile(-9).signatureSeed).toBe(0);
  });
});

describe('evolvePulseProfile', () => {
  it('is pure — does not mutate the input profile', () => {
    const p = createPulseProfile();
    const snapshot = JSON.stringify(p);
    evolvePulseProfile(p, { zone: 'clear', score: 90 });
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('increments sessions and advances maturity over time', () => {
    const p1 = runScans('neutral', 1);
    expect(p1.sessions).toBe(1);
    expect(p1.maturity).toBe('building');
    expect(runScans('neutral', 5).maturity).toBe('ready');
    expect(runScans('neutral', 15).maturity).toBe('mature');
  });

  it('keeps zoneBias normalized and learns the dominant zone', () => {
    const p = runScans('strain', 10);
    expect(p.zoneBias.clear + p.zoneBias.neutral + p.zoneBias.strain).toBeCloseTo(1, 5);
    expect(p.zoneBias.strain).toBeGreaterThan(p.zoneBias.clear);
    expect(p.zoneBias.strain).toBeGreaterThan(p.zoneBias.neutral);
  });

  it('grows refinement monotonically toward the maturity ceiling', () => {
    let p = createPulseProfile();
    let prev = p.refinement;
    for (let i = 0; i < 20; i++) {
      p = evolvePulseProfile(p, { zone: 'clear', score: 85 });
      expect(p.refinement).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p.refinement;
    }
    expect(p.refinement).toBeGreaterThan(0.8);
  });

  it('adapts intensity/tempo by zone and always stays within safe limits', () => {
    const clear = runScans('clear', 30);
    const strain = runScans('strain', 30);
    // Strain → softer + slower; Clear → crisper + quicker.
    expect(strain.intensityScale).toBeLessThan(clear.intensityScale);
    expect(strain.tempoScale).toBeGreaterThan(clear.tempoScale);
    for (const p of [clear, strain]) {
      expect(p.intensityScale).toBeGreaterThanOrEqual(PULSE_LIMITS.intensityScale.min);
      expect(p.intensityScale).toBeLessThanOrEqual(PULSE_LIMITS.intensityScale.max);
      expect(p.tempoScale).toBeGreaterThanOrEqual(PULSE_LIMITS.tempoScale.min);
      expect(p.tempoScale).toBeLessThanOrEqual(PULSE_LIMITS.tempoScale.max);
    }
  });

  it('is deterministic — same history yields identical profiles', () => {
    expect(JSON.stringify(runScans('clear', 7))).toBe(JSON.stringify(runScans('clear', 7)));
  });
});

describe('scanEventPulse', () => {
  it('returns a valid non-empty pattern for every event', () => {
    const p = createPulseProfile();
    for (const e of EVENTS) patternValid(scanEventPulse(e, p));
  });

  it('adds a personalized settle tail to the lock once refined', () => {
    const fresh = createPulseProfile();
    const mature = runScans('clear', 20);
    expect(scanEventPulse('baseline_locked', mature).length).toBeGreaterThan(
      scanEventPulse('baseline_locked', fresh).length,
    );
  });

  it('scales intensity with the learned profile', () => {
    const soft = runScans('strain', 30);
    const crisp = runScans('clear', 30);
    expect(scanEventPulse('face_locked', crisp)[0].intensity).toBeGreaterThan(
      scanEventPulse('face_locked', soft)[0].intensity,
    );
  });
});

describe('zonePulse', () => {
  it('returns a valid, distinct pattern per zone', () => {
    const p = createPulseProfile();
    const sigs = ZONES.map((z) => {
      const pat = zonePulse(z, p);
      patternValid(pat);
      return JSON.stringify(pat);
    });
    expect(new Set(sigs).size).toBe(3);
  });

  it('adds an alive after-glow step for a mature profile', () => {
    const mature = runScans('neutral', 20);
    const fresh = createPulseProfile();
    expect(zonePulse('clear', mature).length).toBeGreaterThan(zonePulse('clear', fresh).length);
  });
});

describe('toWebVibration', () => {
  it('flattens to a vibrate array and trims trailing zero gaps', () => {
    const v = toWebVibration([
      { intensity: 0.5, durationMs: 20, gapMs: 50 },
      { intensity: 0.8, durationMs: 26, gapMs: 0 },
    ]);
    expect(v).toEqual([20, 50, 26]);
    expect(v.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
  });

  it('never emits a zero buzz duration', () => {
    const v = toWebVibration([{ intensity: 0.1, durationMs: 0, gapMs: 0 }]);
    expect(v[0]).toBeGreaterThanOrEqual(1);
  });
});
