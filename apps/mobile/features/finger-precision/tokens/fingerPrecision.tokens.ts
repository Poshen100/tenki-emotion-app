/**
 * @module finger-precision/tokens/fingerPrecision.tokens
 * @description Design tokens for the TENKI Finger PPG Precision Flow.
 * Extends the face-baseline style guidelines with a dedicated warmth pulse palette.
 *
 * @version 1.0
 */

export const fingerPrecisionTokens = {
  colors: {
    // Warm pulse core color scheme (not cold/clinical scan)
    pulseCore: '#FF6B6B',
    pulseCoreGlow: 'rgba(255, 107, 107, 0.4)',
    pulseRing: '#FF8E8E',
    pulseRingDim: 'rgba(255, 142, 142, 0.15)',
    
    // Precision arc gradient color system (representing precision levels)
    precisionLow: '#00B4D8',   // cyan (initial/quick)
    precisionMid: '#00D4AA',   // teal (stable/strong)
    precisionHigh: '#F3A92A',  // gold (best precision, matches SECURED world)
    
    // Space backgrounds
    background: '#030407',
    surface: 'rgba(8, 11, 24, 0.72)',
    borderHairline: 'rgba(255, 255, 255, 0.06)',
    
    // Status dots (Cover, Still, Pressure)
    dotRed: '#FF4A4A',
    dotYellow: '#FFB81C',
    dotGreen: '#00E699',
  },
  
  motion: {
    pulseInterval: 850,        // Default pulse interval (~70bpm)
    pulseScale: { min: 0.95, max: 1.08 },
    ringExpand: 1200,          // Expanding ripple wave animation duration
    arcFill: 300,              // Progress arc update animation
    coreFadeIn: 600,           // Contact core fade-in
    dotTransition: 400,        // Dot color transition
    coachFade: 350,            // Coach copy fading duration
    recoveryOverlay: 250,      // Recovery screen overlay fade-in
  },
  
  easings: {
    pulse: 'cubic-bezier(0.4, 0, 0.2, 1)',
    snap: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
    breath: 'cubic-bezier(0.45, 0, 0.55, 1)',
  },
} as const;

export type FingerPrecisionTokens = typeof fingerPrecisionTokens;
