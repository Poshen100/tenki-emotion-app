/**
 * @module finger-precision
 * @description Barrel export for the Finger PPG Precision Flow feature.
 *
 * @version 1.0
 */

export * from './types';
export * from './store/fingerPrecisionStore';
export * from './store/selectors';
export * from './machine/fingerPrecisionMachine';
export * from './machine/transitions';
export * from './utils/qualityGates';
export * from './utils/precisionProgress';
export * from './utils/recoveryClassifier';
export * from './utils/confidence';
export * from './tokens/fingerPrecision.tokens';
export * from './copy/finger-precision.copy';

// Components
export * from './components/FingerContactCore';
export * from './components/PulseRing';
export * from './components/QualityDots';
export * from './components/PrecisionArc';
export * from './components/CoachCopy';
export * from './components/PrecisionTierBadge';
export * from './components/RecoveryOverlay';
export * from './components/BlendResultCard';
