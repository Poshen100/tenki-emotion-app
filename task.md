# TASK.md

Last updated: 2026-06-09

## Current Objective

Implement and polish the premium TENKI Core onboarding and daily scan/result experience in `apps/mobile`.

## Completed Tasks

- [x] **Premium Onboarding Flow**: Implemented and refactored the 5 onboarding steps:
  - Welcome screen: Emotional entry with abstract ECG waveform glass medallion (No medical/face icons).
  - Baseline Explainer: Explains "normal state" concept with a 60s face scan kicker.
  - Get Ready screen: Provides 3 tip cards (sun, face camera, breath wave) and camera permission note.
  - Face Baseline Scanning: Stardust soul centerpiece, countdown (00:60), pulse wave, and orbiting specks.
  - Baseline Complete: Shows rest HR, HRV, respiratory metrics, and optional finger scan calibration info card.
- [x] **Finger Smart Reminder**: Verified the optional and non-nagging smart bottom sheet reminder for fingers scans, shown after onboarding.
- [x] **Smart Trigger Logic**:
  - Implemented the three smart triggers defined in the architectural blueprint:
    1. **Low Baseline**: `faceBaselineCount < 3` (onboarding initializes this to 1; increments on successful face scans).
    2. **High Stress**: `stressScore > 75` (calculated as `100 - stability`).
    3. **Elapsed Cooldown**: `daysSinceCalibration > 14` (calculated from `lastFingerCalibrationTime`).
  - Automatically updates `lastFingerCalibrationTime = Date.now()` and sets `faceBaselineCount = 3` upon completing a finger calibration scan.
- [x] **Daily Scan Result**: Improved Traditional Chinese copy for clarity drivers:
  - Translated "壓力度" -> "壓力"
  - Translated "恢復力" -> "恢復"
  - Wording conforms to safe readiness/wellness language (Clear, Neutral, Strain zones).
- [x] **Background Visual Polish**:
  - Wrapped all core tab screens (Today, Scan, Session, Timeline, Lab) in `BackgroundContainer` to render the premium deep navy gradient (`#0A1628` to `#060E1C`), subtle teal/amber glows, and stardust specks.
  - Set `safeArea` backgrounds to `transparent` for overlay visual consistency.
- [x] **Bug Fix**:
  - Fixed a syntax bug in `apps/mobile/app/(tabs)/scan.tsx` styles where `justify('center') as any` was used, preventing runtime `ReferenceError`.
- [x] **Verification**:
  - Ran `npx tsc --noEmit` inside `apps/mobile` and verified zero TypeScript compilation errors.

## Next Steps

1. **Native Integration**:
   - Transition simulated biometric scanning in `apps/mobile/lib/mock-scan.ts` to real camera-rPPG frameworks when native wrappers are available.
   - Migrate basic View borders (e.g., `EdgeScoreRing`) to React Native Canvas or `@shopify/react-native-skia` for premium gradient drawing.
2. **Device Connectors**:
   - Implement real Garmin and Apple Watch integrations inside Lab settings to calibrate and enrich personal baselines.
