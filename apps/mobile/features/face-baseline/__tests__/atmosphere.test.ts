/**
 * @module face-baseline/__tests__/atmosphere
 * @description Holds the adaptive sky inside its bounds.
 *
 * The interesting assertions here are not aesthetic. Strain must warm the sky
 * without ever reading as an alarm, and an un-scanned user must see exactly
 * today's background — both are properties a screenshot cannot prove and a
 * test can.
 */
import {
  CALM_ATMOSPHERE,
  CIRCUIT_ONSET,
  MAX_COOL_AURORA_GAIN,
  MAX_FLOW_RATE,
  MAX_STRAIN_WARMTH,
  MAX_WARM_OVERLAY_PEAK,
  WARM_MODE_PEAK,
  circuitPresence,
  composeAtmosphere,
  coolAuroraGain,
  warmOverlayPeak,
} from '../utils/atmosphere';
import type { Atmosphere, AtmosphereZone } from '../utils/atmosphere';

const ZONES: AtmosphereZone[] = ['clear', 'neutral', 'strain', 'unknown'];

/** Every zone, at rest, with motion enabled. */
function atRest(zone: AtmosphereZone): Atmosphere {
  return composeAtmosphere(zone, 0, false);
}

describe('composeAtmosphere — bounds', () => {
  it('keeps every field in range for every zone and maturity', () => {
    for (const zone of ZONES) {
      for (const maturity of [-5, 0, 0.2, CIRCUIT_ONSET, 0.7, 1, 4, Number.NaN]) {
        for (const reduced of [false, true]) {
          const a = composeAtmosphere(zone, maturity, reduced);

          expect(a.temperature).toBeGreaterThanOrEqual(-1);
          expect(a.temperature).toBeLessThanOrEqual(MAX_STRAIN_WARMTH);
          expect(a.starDensity).toBeGreaterThanOrEqual(0);
          expect(a.starDensity).toBeLessThanOrEqual(1);
          expect(a.flowRate).toBeGreaterThanOrEqual(0);
          expect(a.flowRate).toBeLessThanOrEqual(MAX_FLOW_RATE);
          expect(a.nebulaIntensity).toBeGreaterThanOrEqual(0);
          expect(a.nebulaIntensity).toBeLessThanOrEqual(1);
          expect(a.circuitPresence).toBeGreaterThanOrEqual(0);
          expect(a.circuitPresence).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('never returns NaN, even when handed one', () => {
    const a = composeAtmosphere('strain', Number.NaN, false);
    for (const value of Object.values(a)) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });
});

describe('composeAtmosphere — Strain must not read as an alarm', () => {
  it('stays under the warmth ceiling', () => {
    expect(atRest('strain').temperature).toBeLessThan(MAX_STRAIN_WARMTH);
  });

  it('paints far less gold than the deliberate warm modes', () => {
    const strainPeak = warmOverlayPeak(atRest('strain').temperature);

    expect(strainPeak).toBeLessThanOrEqual(MAX_WARM_OVERLAY_PEAK);
    // The gap is the point: a strained sky is tinted, captureWarm is gold.
    expect(strainPeak).toBeLessThan(WARM_MODE_PEAK / 2);
  });

  it('paints no gold at all when the zone is cold', () => {
    expect(warmOverlayPeak(atRest('clear').temperature)).toBe(0);
    expect(warmOverlayPeak(atRest('neutral').temperature)).toBe(0);
  });
});

describe('composeAtmosphere — zone ordering', () => {
  it('warms from clear through neutral to strain', () => {
    expect(atRest('clear').temperature).toBeLessThan(atRest('neutral').temperature);
    expect(atRest('neutral').temperature).toBeLessThan(atRest('strain').temperature);
    expect(atRest('clear').temperature).toBeLessThan(0);
  });

  it('quickens from clear through neutral to strain', () => {
    expect(atRest('clear').flowRate).toBeLessThan(atRest('neutral').flowRate);
    expect(atRest('neutral').flowRate).toBeLessThan(atRest('strain').flowRate);
  });

  it('thins the starfield when the user is clear', () => {
    expect(atRest('clear').starDensity).toBeLessThan(atRest('neutral').starDensity);
  });
});

describe('composeAtmosphere — reduced motion', () => {
  it('stops the motion', () => {
    for (const zone of ZONES) {
      expect(composeAtmosphere(zone, 0.8, true).flowRate).toBe(0);
    }
  });

  it('removes the movement without removing the information', () => {
    for (const zone of ZONES) {
      const moving = composeAtmosphere(zone, 0.8, false);
      const still = composeAtmosphere(zone, 0.8, true);

      expect(still.temperature).toBe(moving.temperature);
      expect(still.starDensity).toBe(moving.starDensity);
      expect(still.nebulaIntensity).toBe(moving.nebulaIntensity);
      expect(still.circuitPresence).toBe(moving.circuitPresence);
    }
  });
});

describe('composeAtmosphere — no score yet', () => {
  it("shows exactly today's sky", () => {
    expect(atRest('unknown')).toEqual(CALM_ATMOSPHERE);
  });

  it('leaves every multiplier neutral, so existing screens are untouched', () => {
    expect(CALM_ATMOSPHERE.starDensity).toBe(1);
    expect(CALM_ATMOSPHERE.flowRate).toBe(1);
    expect(CALM_ATMOSPHERE.nebulaIntensity).toBe(1);
    expect(CALM_ATMOSPHERE.temperature).toBe(0);
    expect(CALM_ATMOSPHERE.circuitPresence).toBe(0);
  });
});

describe('coolAuroraGain', () => {
  it('deepens the existing cyan accent when the zone is clear', () => {
    const gain = coolAuroraGain(atRest('clear').temperature);
    expect(gain).toBeGreaterThan(1);
    expect(gain).toBeLessThanOrEqual(1 + MAX_COOL_AURORA_GAIN);
  });

  it('leaves warm and neutral zones alone', () => {
    expect(coolAuroraGain(atRest('neutral').temperature)).toBe(1);
    expect(coolAuroraGain(atRest('strain').temperature)).toBe(1);
    expect(coolAuroraGain(atRest('unknown').temperature)).toBe(1);
  });
});

describe('circuitPresence', () => {
  it('stays absent until the onset, then reaches full at maturity', () => {
    expect(circuitPresence(0)).toBe(0);
    expect(circuitPresence(CIRCUIT_ONSET)).toBe(0);
    expect(circuitPresence(1)).toBeCloseTo(1, 10);
  });

  it('only ever fades in', () => {
    let previous = -1;
    for (let m = 0; m <= 1.0001; m += 0.02) {
      const value = circuitPresence(m);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('ignores the zone entirely', () => {
    const presences = ZONES.map((z) => composeAtmosphere(z, 0.9, false).circuitPresence);
    expect(new Set(presences).size).toBe(1);
  });
});
