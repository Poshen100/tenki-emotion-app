import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProhibitedTerms } from '@tenki/engine';
import { findForbiddenAutonomicClaims } from '@tenki/domain';
import { FINGER_BASELINE_ROUTE } from '../../face-baseline/screens/routes';
import { FINGER_BASELINE_COPY } from '../copy';

const allCopy = Object.values(FINGER_BASELINE_COPY);

describe('the finger baseline route', () => {
  it('has a matching file-based route, so the push cannot silently 404', () => {
    const appDir = join(__dirname, '..', '..', '..', 'app');
    const routeFile = join(appDir, `${FINGER_BASELINE_ROUTE.replace(/^\//, '')}.tsx`);
    expect(existsSync(routeFile)).toBe(true);
  });
});

describe('finger baseline copy', () => {
  it('carries no prohibited vocabulary', () => {
    for (const line of allCopy) {
      expect(findProhibitedTerms(line)).toEqual([]);
    }
  });

  it('makes no medical or diagnostic claim', () => {
    for (const line of allCopy) {
      for (const banned of ['診斷', '治療', '疾病', '醫療級', '健康風險', '偵測情緒']) {
        expect(line).not.toContain(banned);
      }
    }
  });

  it('states the cost of skipping instead of hiding it', () => {
    // 🔴 The step is skippable by policy (`fingerSkippable`). Offering the door
    // without saying what is behind it is the dishonest version of a choice.
    //
    // ⚠️ The cost named here changed with the camera-HRV decision. Skipping
    // used to be said to cost "心律變異" — but a phone-only user has no HRV
    // either way, so that was charging the user for something the step never
    // supplied. What it actually costs is a reference for 心率穩定度
    // (`EDGE_WEIGHT_FROM_PULSE_REFERENCE`, 15 points).
    expect(FINGER_BASELINE_COPY.skipLabel.length).toBeGreaterThan(0);
    expect(FINGER_BASELINE_COPY.skipCost).toContain('心率穩定度');
    expect(FINGER_BASELINE_COPY.skipCost).toContain('隨時');
  });

  it('does not claim the capture layer works while it is unwired', () => {
    // ⚠️ When the VisionCamera frame processor lands, this assertion is the
    // thing to update — deliberately, and together with the copy. It must not
    // be quietly deleted to make a start button look available.
    expect(FINGER_BASELINE_COPY.unwiredNotice).toContain('還沒有');
  });

  it('asks for 90 seconds and says what one capture is', () => {
    expect(FINGER_BASELINE_COPY.duration).toContain('90');
    // 🔴 One capture is a reference value, not a baseline. The card used to
    // promise a measurement-noise floor instead; that mechanism is
    // HRV-specific and shelved (docs/PHONE-PPG.md §10).
    expect(FINGER_BASELINE_COPY.precisionNote).toContain('不是基線');
  });

  it('🔴 never calls a camera reading HRV', () => {
    // A camera produces pulse-rate variability. The only place the words 心律
    // 變異 may appear is a sentence saying the two are NOT the same thing —
    // which is what `limits` is.
    for (const [key, line] of Object.entries(FINGER_BASELINE_COPY)) {
      if (key === 'limits') continue;
      expect(line).not.toContain('心律變異');
    }
    expect(FINGER_BASELINE_COPY.limits).toContain('脈搏節律');
    expect(FINGER_BASELINE_COPY.limits).toContain('相機推導的靜息脈搏變化');
    expect(FINGER_BASELINE_COPY.limits).toContain('不能直接比');
  });

  it('🔴 says the camera does not report a respiratory rate in this version', () => {
    expect(FINGER_BASELINE_COPY.limits).toContain('呼吸率');
    expect(FINGER_BASELINE_COPY.limits).toContain('這個版本不報');
  });

  it('🔴 makes no autonomic claim of any kind', () => {
    // A phone cannot measure sympathetic or parasympathetic activity, and a
    // screen about fingertip pulse is exactly where that claim would get
    // written. The guard is the domain contract's own list.
    for (const line of allCopy) {
      expect(findForbiddenAutonomicClaims(line)).toEqual([]);
    }
    expect(FINGER_BASELINE_COPY.notADiagnosis).toContain('讀不到你的神經');
  });

  it('🔴 never calls one capture a baseline', () => {
    // `MIN_SECONDS_FOR_PULSE_ANCHOR` establishes an anchor, not a baseline.
    // A baseline is a distribution across days (`biometric/pulse-anchor.ts`).
    expect(FINGER_BASELINE_COPY.title).not.toContain('基線');
    expect(FINGER_BASELINE_COPY.why).not.toContain('基線');
  });

  it('promises about images only what the design actually enforces', () => {
    // Frames are reduced to scalars at the capture boundary — `PpgFrame` holds
    // no pixels, so this is a property of the type, not a policy to remember.
    expect(FINGER_BASELINE_COPY.privacy).toContain('本機');
  });
});
