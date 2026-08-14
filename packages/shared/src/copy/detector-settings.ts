/**
 * @module shared/copy/detector-settings
 * @description Settings copy for the Edge Detector.
 *
 * The load-bearing string here is the foreground limitation. iOS background
 * delivery sets its own cadence — often tens of minutes — so it cannot observe
 * the continuous three-minute window a detection requires. Live alerts
 * therefore only work while the app is open, and the settings screen has to say
 * so plainly. Selling a Pro feature on a promise the platform cannot keep is
 * how you earn a refund and a one-star review in the same afternoon.
 *
 * Copy follows PRIVACY_ARCHITECTURE §19.1: concrete over reassuring, describes
 * what the user controls, never frightening. Every string in this module is
 * checked against the compliance vocabulary by its test.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §2.2
 */

// ─────────────────────────────────────────────
// Live alerts
// ─────────────────────────────────────────────

/** Section title for live detector alerts. */
export const DETECTOR_ALERTS_TITLE = 'Live readiness alerts';

/** What live alerts do. */
export const DETECTOR_ALERTS_EXPLANATION =
  'Tenki watches your signals while the app is open and tells you when they ' +
  'have held a steady, focused state for a few minutes.';

/**
 * The honest limitation, stated first and without an excuse wrapped around it.
 *
 * Deliberately not phrased as a battery-saving choice: it is a platform
 * constraint, and dressing it up as a considered trade-off would be a smaller
 * lie than promising background alerts but still a lie.
 */
export const DETECTOR_FOREGROUND_LIMITATION =
  'Live alerts only work while Tenki is open. iOS decides how often a closed ' +
  'app receives health data, and the gaps are far too long to recognise a ' +
  'window as it happens. Windows that occur while the app is closed still ' +
  'show up in your daily recap.';

// ─────────────────────────────────────────────
// Daily recap
// ─────────────────────────────────────────────

/** Section title for the end-of-day recap. */
export const DETECTOR_RECAP_TITLE = 'Daily recap';

/** What the recap does, and that everyone gets it. */
export const DETECTOR_RECAP_EXPLANATION =
  'At the end of each day Tenki shows the windows it observed, including ones ' +
  'from while the app was closed. Everyone gets the recap on every plan.';

// ─────────────────────────────────────────────
// Quiet hours
// ─────────────────────────────────────────────

/** Section title for quiet hours. */
export const QUIET_HOURS_TITLE = 'Quiet hours';

/** How quiet hours work, and whose clock they follow. */
export const QUIET_HOURS_EXPLANATION =
  'No alerts during your quiet hours. These follow your own local time, and ' +
  'default to 10pm until 7am. You can change them at any time.';

/** Cap on how many alerts a day, stated so it is not a surprise. */
export const DETECTOR_FREQUENCY_EXPLANATION =
  'At most three alerts a day, with at least half an hour between them.';

// ─────────────────────────────────────────────
// Assembled sections
// ─────────────────────────────────────────────

/** One settings section. */
export interface DetectorSettingsSection {
  readonly id: string;
  readonly title: string;
  /** Body lines, rendered in order. */
  readonly lines: readonly string[];
  /** True when the section describes a limitation rather than a capability. */
  readonly isLimitation: boolean;
}

/**
 * The detector settings screen, in display order.
 *
 * The limitation sits directly under the feature it limits rather than in a
 * footnote — someone deciding whether to pay for live alerts should read the
 * constraint in the same glance as the promise.
 */
export const DETECTOR_SETTINGS_SECTIONS: readonly DetectorSettingsSection[] = [
  {
    id: 'live_alerts',
    title: DETECTOR_ALERTS_TITLE,
    lines: [DETECTOR_ALERTS_EXPLANATION, DETECTOR_FOREGROUND_LIMITATION],
    isLimitation: true,
  },
  {
    id: 'daily_recap',
    title: DETECTOR_RECAP_TITLE,
    lines: [DETECTOR_RECAP_EXPLANATION],
    isLimitation: false,
  },
  {
    id: 'quiet_hours',
    title: QUIET_HOURS_TITLE,
    lines: [QUIET_HOURS_EXPLANATION, DETECTOR_FREQUENCY_EXPLANATION],
    isLimitation: false,
  },
];

/**
 * Every user-facing string in this module, for compliance checking.
 *
 * Enumerated explicitly rather than derived, so a new string has to be added
 * here on purpose and cannot slip past the test by being forgotten.
 */
export const ALL_DETECTOR_SETTINGS_COPY: readonly string[] = [
  DETECTOR_ALERTS_TITLE,
  DETECTOR_ALERTS_EXPLANATION,
  DETECTOR_FOREGROUND_LIMITATION,
  DETECTOR_RECAP_TITLE,
  DETECTOR_RECAP_EXPLANATION,
  QUIET_HOURS_TITLE,
  QUIET_HOURS_EXPLANATION,
  DETECTOR_FREQUENCY_EXPLANATION,
];
