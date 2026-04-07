/**
 * @module shared/copy/disclaimers
 * @description All disclaimer copy for TENKI CORE.
 * Used in onboarding, settings, and in-app disclosures.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 3 — App Store compliance
 */

// ─────────────────────────────────────────────
// Primary Disclaimers
// ─────────────────────────────────────────────

/** Primary app disclaimer. */
export const PRIMARY_DISCLAIMER =
  'TENKI CORE provides wellness and self-awareness insights only. ' +
  'It does not provide medical diagnosis, medical treatment advice, ' +
  'financial advice, investment recommendations, or trading signals.';

/** Health disclaimer. */
export const HEALTH_DISCLAIMER =
  'If you have concerns about your health, symptoms, or stress response, ' +
  'consult a qualified healthcare professional.';

/** Trader mode disclaimer. */
export const TRADER_MODE_DISCLAIMER =
  'Trader mode supports emotional readiness and process discipline only. ' +
  'It does not advise whether to enter, exit, or manage any financial position.';

// ─────────────────────────────────────────────
// In-App Disclosures
// ─────────────────────────────────────────────

/** In-app disclosure statements. */
export const IN_APP_DISCLOSURES = [
  'Your health data is optional.',
  'Raw biometric data stays on this device unless you explicitly export it.',
  'TENKI CORE offers wellness insights, not medical advice.',
  'TENKI CORE supports decision readiness, not financial decisions.',
  'You can use guest mode and keep your private history local.',
  'Anonymous analytics are optional and can be disabled anytime.',
] as const;

// ─────────────────────────────────────────────
// Permission Prompts
// ─────────────────────────────────────────────

/** Pre-permission education text. */
export const PERMISSION_PROMPTS = {
  /** Health data education (shown before system permission). */
  HEALTH_EDUCATION:
    'We use optional health data like heart rate, HRV, respiration, ' +
    'and sleep-related inputs to personalize your readiness insights. ' +
    'Your raw biometric data stays on your device.',

  /** iOS HealthKit purpose string. */
  HEALTHKIT_PURPOSE:
    'TENKI CORE reads heart rate, HRV, respiratory rate, and sleep-related data ' +
    'to generate private wellness readiness insights.',

  /** Camera / finger scan pre-prompt. */
  CAMERA_EDUCATION:
    'Use your camera for an on-device finger readiness scan. ' +
    'Video is processed locally for signal quality and is not uploaded.',

  /** iOS camera purpose string. */
  CAMERA_PURPOSE:
    'TENKI CORE uses the camera for an on-device finger scan ' +
    'to assess signal quality and session readiness.',

  /** Notifications pre-prompt. */
  NOTIFICATION_EDUCATION:
    'Enable gentle reminders for daily check-ins and readiness windows. ' +
    'Notifications never provide medical or financial advice.',

  /** Analytics consent. */
  ANALYTICS_CONSENT:
    'Help improve TENKI CORE by sharing anonymous usage analytics. ' +
    'No raw biometric readings or personal reflections are uploaded.',
} as const;

// ─────────────────────────────────────────────
// App Store Copy
// ─────────────────────────────────────────────

/** App Store subtitle options. */
export const APP_STORE_SUBTITLES = [
  'Readiness for clearer decisions',
  'Private wellness scans for focus',
  'Know your clear state',
  'Focus, recovery, and clarity',
  'Readiness insights, kept on device',
] as const;

/** App Store description. */
export const APP_STORE_DESCRIPTION =
  'TENKI CORE helps you understand your physiological and emotional readiness ' +
  'before important decisions.\n\n' +
  'Use quick readiness scans, guided focus sessions, and private reflections ' +
  'to see when you feel more clear, balanced, and stable. ' +
  'TENKI CORE is designed for wellness and self-awareness, ' +
  'with local-first data handling and clear controls over permissions.\n\n' +
  'Features:\n' +
  '- Daily readiness score\n' +
  '- Focus, stress, and recovery insights\n' +
  '- Guided decision sessions\n' +
  '- Session replay and reflection\n' +
  '- Personal Edge Graph\n' +
  '- Optional anonymous benchmarks\n\n' +
  'TENKI CORE does not provide financial advice, investment recommendations, ' +
  'trading signals, market predictions, medical diagnoses, ' +
  'or medical treatment advice.';

// ─────────────────────────────────────────────
// Reviewer Notes
// ─────────────────────────────────────────────

/** App Store reviewer notes template. */
export const REVIEWER_NOTES = [
  '1. TENKI CORE is a Health & Fitness wellness app focused on cognitive readiness, ' +
    'stress awareness, focus, recovery, and self-reflection.',
  '2. The app does not provide medical diagnosis, treatment, financial advice, ' +
    'investment recommendations, or trading signals.',
  '3. Health data access is optional and permission-based. ' +
    'Readiness insights are generated for wellness/self-awareness only.',
  '4. Sensitive biometric and reflection data are stored on device. ' +
    'Cloud services are limited to subscription state, anonymous analytics, ' +
    'and anonymous benchmark distributions.',
  '5. "Trader" mode is a structured discipline mode for decision process governance only. ' +
    'It does not provide market predictions, trading recommendations, or execution guidance.',
  '6. Demo mode is available with sample data and simulated sessions; ' +
    'no external wearable is required for review.',
] as const;
