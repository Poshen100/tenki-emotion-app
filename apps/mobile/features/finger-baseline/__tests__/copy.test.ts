import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProhibitedTerms } from '@tenki/engine';
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
    expect(FINGER_BASELINE_COPY.skipLabel.length).toBeGreaterThan(0);
    expect(FINGER_BASELINE_COPY.skipCost).toContain('心律變異');
    expect(FINGER_BASELINE_COPY.skipCost).toContain('隨時');
  });

  it('does not claim the capture layer works while it is unwired', () => {
    // ⚠️ When the VisionCamera frame processor lands, this assertion is the
    // thing to update — deliberately, and together with the copy. It must not
    // be quietly deleted to make a start button look available.
    expect(FINGER_BASELINE_COPY.unwiredNotice).toContain('還沒有');
  });

  it('says the 90 seconds also measures the instrument, not just the user', () => {
    expect(FINGER_BASELINE_COPY.duration).toContain('90');
    expect(FINGER_BASELINE_COPY.precisionNote).toContain('量測誤差');
  });

  it('promises about images only what the design actually enforces', () => {
    // Frames are reduced to scalars at the capture boundary — `PpgFrame` holds
    // no pixels, so this is a property of the type, not a policy to remember.
    expect(FINGER_BASELINE_COPY.privacy).toContain('本機');
  });
});
