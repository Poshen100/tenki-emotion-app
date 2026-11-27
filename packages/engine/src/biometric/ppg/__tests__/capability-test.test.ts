/**
 * The five-second capability check (founder 2026-11-24, spec §1.5).
 *
 * 🔴 The load-bearing property: no synthetic signal, however bad, produces
 * "incompatible". Five seconds of a bad grip is not a verdict on the phone.
 */
import {
  CAPABILITY_TEST_SEC,
  type CapabilityContext,
  MIN_CAPABILITY_FPS,
  assessCapability,
} from '../capability-test';
import { MAX_MOTION, assessFrameComponents } from '../quality';
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import type { PpgFrame } from '../types';

const withTorch: CapabilityContext = { camera: 'available', torch: true };
const fiveSec = (fixture: object = {}) =>
  synthesizePpg({ ...fixture, durationSec: CAPABILITY_TEST_SEC }).frames;

describe('assessCapability', () => {
  it('a clean fingertip → signal_path_ok, nothing failed, nothing advised', () => {
    const t = assessCapability(fiveSec(), withTorch);
    expect(t).toMatchObject({ result: 'signal_path_ok', reasons: [], advisories: [] });
    expect(t.measured.pulsatileLight).toBe(true);
    expect(t.measured.framesPerSecond).toBeGreaterThanOrEqual(MIN_CAPABILITY_FPS);
  });

  it.each([
    ['lowPerfusion', 'no_pulsatile_light'],
    ['clipped', 'over_exposed'],
    ['poorCoverage', 'no_contact'],
  ] as const)('%s → not_yet_confirmed, naming %s', (fixture, reason) => {
    const t = assessCapability(fiveSec(PPG_FIXTURES[fixture]), withTorch);
    expect(t.result).toBe('not_yet_confirmed');
    expect(t.reasons).toContain(reason);
  });

  it('🔴 pure sensor noise is never signal_path_ok (green noise alone clears MIN_PERFUSION)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const noise = synthesizePpg({ perfusion: 0, seed: seed * 97, durationSec: CAPABILITY_TEST_SEC }).frames;
      const t = assessCapability(noise, withTorch);
      expect(t.result).toBe('not_yet_confirmed');
      expect(t.reasons).toContain('no_pulsatile_light');
    }
  });

  it('a finger moving more than the full capture allows never confirms the path (same bar, MAX_MOTION)', () => {
    let moving = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const frames = synthesizePpg({ ...PPG_FIXTURES.motion, seed: seed * 97, durationSec: CAPABILITY_TEST_SEC }).frames;
      if (assessFrameComponents(frames).motion <= MAX_MOTION) continue;
      moving++;
      const t = assessCapability(frames, withTorch);
      expect(t.result).toBe('not_yet_confirmed');
      expect(t.reasons).toContain('moving');
    }
    expect(moving).toBeGreaterThan(20); // the sweep actually exercised the case
  });

  it('🔴 no synthetic fixture ever yields hardware_limit (or anything like "incompatible")', () => {
    for (const fixture of Object.values(PPG_FIXTURES)) {
      expect(assessCapability(fiveSec(fixture), withTorch).result).not.toBe('hardware_limit');
    }
  });

  it('🔴 no torch is an advisory, never a change of outcome', () => {
    const frames = fiveSec();
    const lit = assessCapability(frames, withTorch);
    const dark = assessCapability(frames, { camera: 'available', torch: null });
    expect(dark.result).toBe(lit.result);
    expect(dark.reasons).toEqual(lit.reasons);
    expect(dark.advisories).toEqual(['no_torch']);
  });

  it('a short window is too_short — not evidence against the phone, and nothing is measured', () => {
    const t = assessCapability(synthesizePpg({ durationSec: 2 }).frames, withTorch);
    expect(t).toMatchObject({ result: 'not_yet_confirmed', reasons: ['too_short'] });
    expect(t.measured.framesPerSecond).toBeNull();
  });

  it('only hardware facts give hardware_limit', () => {
    expect(assessCapability([], { camera: 'permission_denied', torch: null })).toMatchObject({
      result: 'hardware_limit',
      reasons: ['permission_denied'],
    });
    expect(assessCapability([], { camera: 'unavailable', torch: null }).reasons).toEqual([
      'camera_unavailable',
    ]);
    const slow = assessCapability(synthesizePpg({ durationSec: 5, sampleRateHz: 12 }).frames, withTorch);
    expect(slow.result).toBe('hardware_limit');
    expect(slow.reasons).toContain('frame_rate_too_low');
  });

  it('one stall is transient → not_yet_confirmed, not hardware', () => {
    const frames = fiveSec();
    const stalled = frames.map((f, i) => (i >= 60 ? { ...f, timestampMs: f.timestampMs + 400 } : f));
    const t = assessCapability(stalled, withTorch);
    expect(t.result).toBe('not_yet_confirmed');
    expect(t.reasons).toEqual(['frame_stall']);
  });

  it('🔴 the camera re-deciding its gain blocks the good outcome even though AC/DC looks strong', () => {
    // A 30% step every second — the device's own 2026-09-17 signature, compressed.
    const frames: PpgFrame[] = fiveSec().map((f, i) => {
      const k = Math.floor(i / 30) % 2 === 0 ? 1 : 1.3;
      return { ...f, red: f.red * k, green: f.green * k };
    });
    const t = assessCapability(frames, withTorch);
    expect(t.result).toBe('not_yet_confirmed');
    expect(t.reasons).toContain('exposure_hunting');
  });

  it('🔴 never reports a physiological number', () => {
    const keys = Object.keys(assessCapability(fiveSec(), withTorch).measured).join(' ');
    expect(keys).not.toMatch(/bpm|rate(?!.*frames)|rmssd|prv|periodicity|rhythm/i);
  });
});
