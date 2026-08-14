/**
 * @module shared/detector-settings.test
 * @description Tests for detector settings copy. The honesty assertions matter
 * as much as the compliance ones: the foreground limitation is the string that
 * stops the app promising something iOS will not deliver.
 */

import {
  ALL_DETECTOR_SETTINGS_COPY,
  DETECTOR_FOREGROUND_LIMITATION,
  DETECTOR_RECAP_EXPLANATION,
  DETECTOR_SETTINGS_SECTIONS,
  QUIET_HOURS_EXPLANATION,
} from '../copy/detector-settings';
import { findProhibitedTerms } from '../../../engine/src/compliance/safe-copy';

describe('compliance', () => {
  it('emits no prohibited vocabulary anywhere', () => {
    for (const line of ALL_DETECTOR_SETTINGS_COPY) {
      expect(findProhibitedTerms(line)).toEqual([]);
    }
  });

  it('covers every string rendered in the sections', () => {
    for (const section of DETECTOR_SETTINGS_SECTIONS) {
      expect(ALL_DETECTOR_SETTINGS_COPY).toContain(section.title);
      for (const line of section.lines) {
        expect(ALL_DETECTOR_SETTINGS_COPY).toContain(line);
      }
    }
  });

  it('issues no directives', () => {
    for (const line of ALL_DETECTOR_SETTINGS_COPY) {
      const lower = line.toLowerCase();
      expect(lower).not.toContain('you should');
      expect(lower).not.toContain('you must');
    }
  });
});

describe('the foreground limitation', () => {
  it('says plainly that live alerts need the app open', () => {
    const lower = DETECTOR_FOREGROUND_LIMITATION.toLowerCase();
    expect(lower).toContain('only work while');
    expect(lower).toContain('open');
  });

  it('names the platform as the reason rather than a design choice', () => {
    expect(DETECTOR_FOREGROUND_LIMITATION.toLowerCase()).toContain('ios');
  });

  it('does not excuse the limit as battery saving', () => {
    const lower = DETECTOR_FOREGROUND_LIMITATION.toLowerCase();
    expect(lower).not.toContain('battery');
    expect(lower).not.toContain('save power');
  });

  it('tells the user what they still get instead', () => {
    expect(DETECTOR_FOREGROUND_LIMITATION.toLowerCase()).toContain('daily recap');
  });

  it('never promises background alerts', () => {
    for (const line of ALL_DETECTOR_SETTINGS_COPY) {
      const lower = line.toLowerCase();
      expect(lower).not.toContain('even when closed');
      expect(lower).not.toContain('always watching');
      expect(lower).not.toContain('24/7');
    }
  });
});

describe('section layout', () => {
  it('puts the limitation in the same section as the feature it limits', () => {
    const live = DETECTOR_SETTINGS_SECTIONS.find((s) => s.id === 'live_alerts');
    expect(live).toBeDefined();
    expect(live?.lines).toContain(DETECTOR_FOREGROUND_LIMITATION);
    expect(live?.isLimitation).toBe(true);
  });

  it('orders live alerts before the recap and quiet hours', () => {
    expect(DETECTOR_SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
      'live_alerts',
      'daily_recap',
      'quiet_hours',
    ]);
  });

  it('gives every section a title and at least one line', () => {
    for (const section of DETECTOR_SETTINGS_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.lines.length).toBeGreaterThan(0);
    }
  });
});

describe('other copy', () => {
  it('states that the recap is available on every plan', () => {
    expect(DETECTOR_RECAP_EXPLANATION.toLowerCase()).toContain('every plan');
  });

  it('anchors quiet hours to the user own local time', () => {
    expect(QUIET_HOURS_EXPLANATION.toLowerCase()).toContain('local time');
  });

  it('mentions no market session or timezone of a market', () => {
    for (const line of ALL_DETECTOR_SETTINGS_COPY) {
      const lower = line.toLowerCase();
      expect(lower).not.toContain('eastern');
      expect(lower).not.toContain('session');
    }
  });
});
