/**
 * @module face-baseline/__tests__/pulseEngineParity
 * @description Guards the pulse mirror against drift.
 *
 * `features/face-baseline/utils/pulse.ts` duplicates
 * `packages/engine/src/haptics/haptics.ts` line for line. That is not
 * carelessness: `apps/mobile` is outside the npm workspace (the root only
 * lists `packages/*` and `domain`), so it cannot import the engine at all.
 *
 * A mirror is fine right up until the two disagree, and the one shipping in
 * the app is the copy. This test runs both against the same inputs and fails
 * the moment they diverge, so whichever one gets edited, the other has to
 * follow.
 *
 * Both modules are free of React Native imports, which is why they can be
 * exercised in a plain node test environment.
 */
import {
  PULSE_LIMITS as MOBILE_LIMITS,
  createPulseProfile as mobileCreate,
  evolvePulseProfile as mobileEvolve,
  scanEventPulse as mobileScanPulse,
  zonePulse as mobileZonePulse,
  toWebVibration as mobileToWeb,
  type PulseProfile as MobileProfile,
  type PulseZone,
  type PulseEvent,
} from '../utils/pulse';

import {
  PULSE_LIMITS as ENGINE_LIMITS,
  createPulseProfile as engineCreate,
  evolvePulseProfile as engineEvolve,
  scanEventPulse as engineScanPulse,
  zonePulse as engineZonePulse,
  toWebVibration as engineToWeb,
  type PulseProfile as EngineProfile,
} from '../../../../../packages/engine/src/haptics/haptics';

const ZONES: PulseZone[] = ['clear', 'neutral', 'strain'];
const EVENTS: PulseEvent[] = [
  'face_locked',
  'scan_tick',
  'calibration_milestone',
  'baseline_locked',
];

/** Rounds every number in a structure so float formatting cannot cause noise. */
function normalize(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toFixed(9));
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

describe('pulse mirror parity', () => {
  it('shares the same clamping limits', () => {
    expect(normalize(MOBILE_LIMITS)).toEqual(normalize(ENGINE_LIMITS));
  });

  it('creates identical profiles across seeds', () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 1, -1, 2]) {
      expect(normalize(mobileCreate(seed))).toEqual(normalize(engineCreate(seed)));
    }
  });

  it('evolves identically over a long observation sequence', () => {
    let mobile: MobileProfile = mobileCreate(0.42);
    let engine: EngineProfile = engineCreate(0.42);

    // Twenty sessions is past every maturity boundary, so the maturity mapping
    // is compared at each stage rather than only at the start.
    for (let i = 0; i < 20; i++) {
      const zone = ZONES[i % ZONES.length];
      const score = 40 + ((i * 7) % 60);
      mobile = mobileEvolve(mobile, { zone, score });
      engine = engineEvolve(engine, { zone, score });
      expect(normalize(mobile)).toEqual(normalize(engine));
    }
  });

  it('produces identical scan-event patterns at every maturity', () => {
    let mobile: MobileProfile = mobileCreate(0.3);
    let engine: EngineProfile = engineCreate(0.3);

    for (let i = 0; i < 20; i++) {
      for (const event of EVENTS) {
        expect(normalize(mobileScanPulse(event, mobile))).toEqual(
          normalize(engineScanPulse(event, engine)),
        );
      }
      mobile = mobileEvolve(mobile, { zone: 'clear', score: 80 });
      engine = engineEvolve(engine, { zone: 'clear', score: 80 });
    }
  });

  it('produces identical zone patterns', () => {
    const mobile = mobileCreate(0.6);
    const engine = engineCreate(0.6);
    for (const zone of ZONES) {
      expect(normalize(mobileZonePulse(zone, mobile))).toEqual(
        normalize(engineZonePulse(zone, engine)),
      );
    }
  });

  it('maps to identical web vibration arrays', () => {
    const mobile = mobileCreate(0.5);
    const engine = engineCreate(0.5);
    for (const event of EVENTS) {
      expect(mobileToWeb(mobileScanPulse(event, mobile))).toEqual(
        engineToWeb(engineScanPulse(event, engine)),
      );
    }
  });
});
