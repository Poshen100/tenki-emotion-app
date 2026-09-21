/**
 * What the regulation contract refuses to be able to say.
 *
 * 🔴 A phone cannot measure sympathetic or parasympathetic activity. Most of
 * this suite is therefore about ABSENCE: the fields that do not exist, and the
 * phrases that may not be written. A contract that merely documented the rule
 * would be a comment; these are what make it checkable.
 */
import {
  FORBIDDEN_AUTONOMIC_CLAIMS,
  findForbiddenAutonomicClaims,
  type RegulationEvidence,
} from '../contracts/regulation-evidence';

function evidence(): RegulationEvidence {
  return {
    measuredAt: 1_757_000_000_000,
    pulse: { bpm: 64, quality: 'high', provenance: 'camera_fingertip_ppg', prvRmssdMs: 38 },
    breath: { rateBpm: null, rhythmStability: null, quality: 'low', provenance: 'camera_ppg_derived' },
    coupling: { status: 'unavailable', confidence: 'low' },
    interpretation: { mode: 'measured', baselineDeviation: null, sampleCount: 3, confidence: 'low' },
  };
}

describe('the shape cannot express a nervous-system measurement', () => {
  it('has no sympathetic, parasympathetic or balance field anywhere in it', () => {
    // 🔴 The structural claim. A field named `balance` would be filled in
    // eventually by someone who needed a number, and LF/HF is not
    // sympathovagal balance — which is exactly why there is nowhere to put it.
    const json = JSON.stringify(evidence());
    for (const forbidden of ['sympathetic', 'parasympathetic', 'balance', 'lf', 'hf', 'vagal']) {
      expect(json.toLowerCase()).not.toContain(`"${forbidden}`);
    }
  });

  it('has no single overall regulation score', () => {
    // One number would be read as a measurement of the nervous system.
    expect(Object.keys(evidence())).toEqual([
      'measuredAt',
      'pulse',
      'breath',
      'coupling',
      'interpretation',
    ]);
  });

  it('keeps pulse variability named PRV on the pulse side', () => {
    const json = JSON.stringify(evidence());
    expect(json).toContain('prvRmssdMs');
    expect(json.toLowerCase()).not.toContain('hrv');
  });

  it('carries provenance on every measured quantity', () => {
    // The property that lets a wearable raise coverage later without
    // invalidating the phone-only history before it.
    const e = evidence();
    expect(e.pulse.provenance).toBeTruthy();
    expect(e.breath.provenance).toBeTruthy();
  });

  it('says "not enough yet" as null rather than as zero', () => {
    // 🔴 A zero deviation asserts the user is exactly at their baseline. Null
    // asserts nothing, which is the true state for most users for weeks.
    expect(evidence().interpretation.baselineDeviation).toBeNull();
  });
});

describe('the copy guard catches the phrasings that are known to be wrong', () => {
  it('flags the autonomic scores a phone cannot support', () => {
    expect(findForbiddenAutonomicClaims('你的交感神經值是 78')).toContain('交感神經值');
    expect(findForbiddenAutonomicClaims('Parasympathetic score: 32')).toContain(
      'parasympathetic score',
    );
    expect(findForbiddenAutonomicClaims('LF/HF balance 2.4')).toContain('lf/hf');
  });

  it('flags "camera HRV", which is the same error about a different quantity', () => {
    expect(findForbiddenAutonomicClaims('Camera HRV: 42 ms')).toContain('camera hrv');
  });

  it('passes the language the product is actually allowed to use', () => {
    for (const line of [
      '相機指尖 PPG · 品質 99/100',
      '這次的脈搏參考值',
      '相機推導的靜息脈搏變化，這不是心律變異',
      'Your rhythm became steadier during the reset.',
      'camera-derived respiratory rate',
    ]) {
      expect(findForbiddenAutonomicClaims(line)).toEqual([]);
    }
  });

  it('is case-insensitive, because copy is not written in one case', () => {
    expect(findForbiddenAutonomicClaims('VAGAL SCORE')).toContain('vagal score');
  });

  it('lists every phrase in lower case, so the check cannot silently miss one', () => {
    // A phrase stored with a capital letter would never match the lowercased
    // input — the guard would pass while the claim shipped.
    for (const phrase of FORBIDDEN_AUTONOMIC_CLAIMS) {
      expect(phrase).toBe(phrase.toLowerCase());
    }
  });
});
