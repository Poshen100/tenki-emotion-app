/**
 * @module face-baseline/copy
 * @description Canonical English UI copy for all 11 Face Baseline screens.
 * Tone: calm, premium, minimal, scientific-not-clinical, high trust.
 *
 * Compliance: no diagnosis, no medical certainty, no emotion-recognition or
 * dopamine claims, no overpromising. Lexicon = baseline · calibration · privacy
 * · precision · readiness · resonance · return to baseline · model refinement.
 * Production copy should still be routed through the engine compliance layer.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md (Task 10)
 */

export const FACE_BASELINE_COPY = {
  intro: {
    title: 'Create your Face Baseline.',
    subtitle: 'This helps TENKI recognize your natural steady state with higher precision. Your data is encrypted and stored only on your device.',
    body: '',
    timeSeconds: 60,
    cta: 'Begin Calibration',
    ctaHoldHint: 'Press and hold to begin.',
    whyLink: 'Why does this matter?',
  },
  why: {
    title: 'Why Baseline Matters',
    pages: [
      {
        heading: 'Personal Resonance',
        body: 'Your baseline is a personal reference point. It lets TENKI notice subtle shifts in your patterns over time — accurately, and privately.',
      },
      {
        heading: 'Calibrated to You',
        body: 'Every reading is compared to your own baseline, not a population average. That is what makes it meaningful.',
      },
      {
        heading: 'Yours Alone',
        body: 'Your baseline lives on this device, encrypted. You can reset or delete it anytime.',
      },
    ],
    next: 'Next',
    finish: 'Get started',
  },
  secure: {
    title: 'Secure Access Required',
    assurances: [
      { label: 'On-Device Processing', detail: 'Your face data never leaves this phone.' },
      { label: 'Baseline Calibration', detail: 'Used only to calculate your personal resonance.' },
      { label: 'Privacy First', detail: 'No photos or videos are ever saved.' },
    ],
    cta: 'Enable Camera',
    privacyLink: 'Learn more about our privacy',
  },
  permissionDenied: {
    title: 'Camera access is off',
    body: 'TENKI needs the camera only to calibrate your baseline on-device. You can enable it in Settings.',
    cta: 'Open Settings',
    secondary: 'Not now',
  },
  environment: {
    title: 'Let’s set the scene',
    body: 'Find a quiet spot with even lighting.',
    checks: { lighting: 'Lighting', distance: 'Centering', stability: 'Stillness' },
    cta: 'Start Scan',
    disabledHint: 'Adjust the items above to continue',
  },
  faceLock: {
    aligning: 'Hold still — aligning…',
    centered: 'Center your face',
    locked: 'Locked',
  },
  captureNeutral: {
    instruction: 'Hold steady for neutral capture',
    privacyPill: 'PRIVACY SECURED',
    nudges: {
      good: '',
      movement: 'Hold still',
      lowLight: 'A little more light',
      reframe: 'Center your face',
    },
  },
  captureArc: {
    left: 'Turn slightly left',
    right: 'Turn slightly right',
    recenter: 'Return to center',
    subtitle: 'Slow and gentle — small angles sharpen your calibration.',
  },
  captureStability: {
    instruction: 'Breathe naturally',
    subtitle: 'Relax your jaw and let your eyes settle.',
  },
  processing: {
    title: 'Securing your unique baseline…',
    footnote: 'All data is processed and stored locally for maximum privacy.',
  },
  recovery: {
    title: 'Finding your rhythm',
    subtitle: 'Make sure your face is clearly visible and centered in the frame.',
    checklist: ['Check your lighting', 'Remove glasses or masks', 'Stay centered'],
    cta: 'Try Again',
    helpLink: 'Need help?',
  },
  established: {
    title: 'Baseline Established',
    body: 'Your personal reference is secured and encrypted on-device. Future scans will now be calibrated to your unique resonance.',
    cta: 'Enter TENKI',
  },
  maturity: {
    title: 'Baseline Maturity',
    orbLabel: 'Resonance Orb',
    stages: { new: 'New', building: 'Building', ready: 'Ready', mature: 'Mature' },
    counter: (done: number, total: number): string => `${done}/${total} scans completed`,
    insight:
      'Each scan refines your precision model. More data means a more personalized, high-fidelity baseline.',
    historyTitle: 'Daily Scan History',
    historyLabels: { updated: 'Baseline updated', refined: 'Model refined' },
    cta: 'Start Daily Scan',
  },
  /** Required on scan-related screens. */
  disclaimer:
    'TENKI provides personal wellness signals only. It is not a medical or financial diagnosis. Your data stays on your device.',
} as const;

export type FaceBaselineCopy = typeof FACE_BASELINE_COPY;
