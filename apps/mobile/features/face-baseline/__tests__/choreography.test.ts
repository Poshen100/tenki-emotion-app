/**
 * @module face-baseline/__tests__/choreography
 * @description Tests for the perception engine.
 *
 * The edge-trigger tests are the ones that matter. Quality updates every
 * frame, and the whole reason haptics are separated from the visual frame is
 * so that a continuously-changing reading cannot turn into continuous
 * vibration — which is the difference between feeling like an instrument and
 * feeling like a fault.
 */
import {
  MAX_SCATTER,
  composeSensoryFrame,
  isRecoveryMoment,
  resolveHapticTrigger,
  type RitualPhase,
  type RitualSignals,
} from '../utils/choreography';
import { createPulseProfile } from '../utils/pulse';

const PHASES: RitualPhase[] = [
  'idle', 'searching', 'locking', 'capturing', 'stabilizing', 'locked', 'lost',
];

const profile = createPulseProfile(0.5);

function signals(overrides: Partial<RitualSignals> = {}): RitualSignals {
  return { quality: 0.8, stability: 0.8, progress: 0.5, ...overrides };
}

describe('sensory frame ranges', () => {
  it('keeps every value inside 0–1 for every phase', () => {
    for (const phase of PHASES) {
      for (const q of [0, 0.5, 1]) {
        for (const s of [0, 0.5, 1]) {
          const frame = composeSensoryFrame(phase, signals({ quality: q, stability: s, progress: 1 }), false);
          for (const key of ['convergence', 'scatter', 'brightness', 'glow'] as const) {
            expect(frame[key]).toBeGreaterThanOrEqual(0);
            expect(frame[key]).toBeLessThanOrEqual(1);
          }
          expect(frame.transitionMs).toBeGreaterThan(0);
        }
      }
    }
  });

  it('survives out-of-range and non-finite input without producing NaN', () => {
    const frame = composeSensoryFrame(
      'capturing',
      { quality: Number.NaN, stability: 5, progress: -3 },
      false,
    );
    for (const key of ['convergence', 'scatter', 'brightness', 'glow'] as const) {
      expect(Number.isFinite(frame[key])).toBe(true);
      expect(frame[key]).toBeGreaterThanOrEqual(0);
      expect(frame[key]).toBeLessThanOrEqual(1);
    }
  });
});

describe('quality drives scatter', () => {
  it('rises monotonically as quality falls', () => {
    const qualities = [1, 0.8, 0.6, 0.4, 0.2, 0];
    const scatters = qualities.map(
      (q) => composeSensoryFrame('capturing', signals({ quality: q }), false).scatter,
    );
    for (let i = 1; i < scatters.length; i++) {
      expect(scatters[i]).toBeGreaterThan(scatters[i - 1]);
    }
  });

  it('reaches the ceiling at zero quality and vanishes at full quality', () => {
    expect(composeSensoryFrame('capturing', signals({ quality: 0 }), false).scatter).toBe(MAX_SCATTER);
    expect(composeSensoryFrame('capturing', signals({ quality: 1 }), false).scatter).toBe(0);
  });

  it('does not scatter while idle or locked', () => {
    for (const phase of ['idle', 'locked', 'lost'] as RitualPhase[]) {
      expect(composeSensoryFrame(phase, signals({ quality: 0 }), false).scatter).toBe(0);
    }
  });
});

describe('stability and convergence', () => {
  it('tightens the mesh as stability rises', () => {
    const loose = composeSensoryFrame('capturing', signals({ stability: 0 }), false);
    const steady = composeSensoryFrame('capturing', signals({ stability: 1 }), false);
    expect(steady.convergence).toBeGreaterThan(loose.convergence);
  });

  it('fully converges once locked', () => {
    expect(composeSensoryFrame('locked', signals({ stability: 1 }), false).convergence).toBe(1);
  });
});

describe('reduced motion', () => {
  it('removes scatter entirely', () => {
    expect(composeSensoryFrame('capturing', signals({ quality: 0 }), true).scatter).toBe(0);
  });

  it('still carries state through brightness and convergence', () => {
    const low = composeSensoryFrame('capturing', signals({ quality: 0.1, stability: 0.1 }), true);
    const high = composeSensoryFrame('capturing', signals({ quality: 1, stability: 1 }), true);
    expect(high.brightness).toBeGreaterThan(low.brightness);
    expect(high.convergence).toBeGreaterThan(low.convergence);
  });

  it('silences haptics', () => {
    expect(resolveHapticTrigger('capturing', 'locked', profile, true)).toBeNull();
  });

  it('slows transitions rather than snapping', () => {
    const normal = composeSensoryFrame('capturing', signals(), false);
    const reduced = composeSensoryFrame('capturing', signals(), true);
    expect(reduced.transitionMs).toBeGreaterThan(normal.transitionMs);
  });
});

describe('haptics are edge triggered', () => {
  it('stays silent when the phase has not changed', () => {
    for (const phase of PHASES) {
      expect(resolveHapticTrigger(phase, phase, profile, false)).toBeNull();
    }
  });

  it('fires exactly once across many frames in the same phase', () => {
    let previous: RitualPhase = 'capturing';
    let fired = 0;

    // Sixty frames of a changing quality reading, with one real transition.
    for (let frame = 0; frame < 60; frame++) {
      const next: RitualPhase = frame === 30 ? 'locked' : previous;
      if (resolveHapticTrigger(previous, next, profile, false) !== null) fired++;
      previous = next;
    }

    expect(fired).toBe(1);
  });

  it('emits the face_locked pulse on lock', () => {
    const trigger = resolveHapticTrigger('stabilizing', 'locked', profile, false);
    expect(trigger).not.toBeNull();
    expect(trigger?.event).toBe('face_locked');
    expect(trigger?.pattern.length).toBeGreaterThan(0);
  });

  it('marks reaching stabilizing as a milestone', () => {
    expect(resolveHapticTrigger('capturing', 'stabilizing', profile, false)?.event).toBe(
      'calibration_milestone',
    );
  });

  it('never buzzes on losing the lock', () => {
    expect(resolveHapticTrigger('capturing', 'lost', profile, false)).toBeNull();
    expect(resolveHapticTrigger('locked', 'lost', profile, false)).toBeNull();
  });

  it('does not fire on transitions with no assigned event', () => {
    expect(resolveHapticTrigger('lost', 'idle', profile, false)).toBeNull();
    expect(resolveHapticTrigger('idle', 'searching', profile, false)).toBeNull();
  });
});

describe('recovery moment', () => {
  it('signals once on entering lost', () => {
    expect(isRecoveryMoment('capturing', 'lost')).toBe(true);
  });

  it('does not repeat while still lost', () => {
    expect(isRecoveryMoment('lost', 'lost')).toBe(false);
  });

  it('is not raised for any other phase', () => {
    for (const phase of PHASES.filter((p) => p !== 'lost')) {
      expect(isRecoveryMoment('capturing', phase)).toBe(false);
    }
  });
});
