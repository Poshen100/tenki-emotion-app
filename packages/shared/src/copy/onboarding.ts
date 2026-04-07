/**
 * @module shared/copy/onboarding
 * @description Onboarding screen copy for TENKI CORE.
 * 12-step onboarding flow with exact copy per screen.
 *
 * @version 3.0
 * @see Spec Section 8 — Onboarding step map
 */

/** Single onboarding step definition. */
export interface OnboardingStep {
  /** Step number (1-indexed). */
  step: number;
  /** Step identifier. */
  id: string;
  /** Headline text. */
  headline: string;
  /** Body text. */
  body: string;
  /** Whether this step can be skipped. */
  skippable: boolean;
  /** Whether this step triggers a system permission. */
  triggersPermission: boolean;
  /** Permission type if applicable. */
  permissionType?: 'health' | 'camera' | 'notifications' | 'analytics';
}

/** Complete onboarding flow (12 steps). */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    step: 1, id: 'welcome',
    headline: 'Find your clearer state',
    body: 'TENKI helps you understand your readiness before important decisions.',
    skippable: false, triggersPermission: false,
  },
  {
    step: 2, id: 'guest_or_account',
    headline: 'Choose how to start',
    body: '',
    skippable: false, triggersPermission: false,
  },
  {
    step: 3, id: 'privacy_first',
    headline: 'Your data stays with you',
    body: 'Your sensitive biometric history stays on your device. We do not upload raw biometric readings to the cloud.',
    skippable: false, triggersPermission: false,
  },
  {
    step: 4, id: 'data_usage',
    headline: 'What data is used',
    body: 'Optional health data, local scans, and your own reflections help personalize insights.',
    skippable: false, triggersPermission: false,
  },
  {
    step: 5, id: 'never_shared',
    headline: 'What is never shared',
    body: 'Raw biometric sessions, personal reflections, and personal edge patterns are never uploaded.',
    skippable: false, triggersPermission: false,
  },
  {
    step: 6, id: 'disclosure',
    headline: 'Wellness insights only',
    body: 'TENKI provides wellness insights only. It does not provide medical advice or financial advice.',
    skippable: false, triggersPermission: false,
  },
  {
    step: 7, id: 'health_education',
    headline: 'Connect health data',
    body: 'Connect health data to improve baseline quality and reduce blind spots.',
    skippable: true, triggersPermission: true, permissionType: 'health',
  },
  {
    step: 8, id: 'camera_education',
    headline: 'On-device finger scan',
    body: 'Your camera is used for an on-device finger readiness scan. Frames are not uploaded.',
    skippable: true, triggersPermission: true, permissionType: 'camera',
  },
  {
    step: 9, id: 'analytics_consent',
    headline: 'Help improve TENKI',
    body: 'Share anonymous product analytics to improve app quality.',
    skippable: true, triggersPermission: true, permissionType: 'analytics',
  },
  {
    step: 10, id: 'notifications',
    headline: 'Gentle reminders',
    body: 'Get gentle reminders for scans, focus windows, and routines.',
    skippable: true, triggersPermission: true, permissionType: 'notifications',
  },
  {
    step: 11, id: 'premium_intro',
    headline: 'Unlock deeper patterns',
    body: 'Unlock deeper patterns, timeline intelligence, and readiness alerts.',
    skippable: true, triggersPermission: false,
  },
  {
    step: 12, id: 'first_scan',
    headline: 'Set your baseline',
    body: "Let's set your baseline.",
    skippable: false, triggersPermission: false,
  },
] as const;

/** Guest mode option for step 2. */
export const GUEST_MODE_OPTION = {
  label: 'Guest',
  description: 'Keep everything on this device',
} as const;

/** Account mode option for step 2. */
export const ACCOUNT_MODE_OPTION = {
  label: 'Account',
  description: 'Sync subscription and manage entitlements',
} as const;
