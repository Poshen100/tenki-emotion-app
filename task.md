# TASK.md

Last updated: 2026-06-12

## Current Objective

Align `apps/web` preview (https://tenki-emotion-app.vercel.app/preview/) with the canonical visual design language defined by the three reference screenshots (IMG_8434, IMG_8435, IMG_8436). These screenshots define the **target visual identity** for all scan and calibration screens.

---

## Visual Design Reference (Canonical — 2026-06-12)

Three reference screenshots define the accepted TENKI visual language. Do not deviate without Founder approval.

### Screen A — Environment Calibration (IMG_8436)
- White/light background, iOS-native feel
- Rounded camera preview with grid overlay
- Three pill-shaped status badges: `Lighting ✅ / Distance ✅ / Stability ❌`
  - Badge style: dark semi-transparent background `rgba(40,30,20,0.75)`, emoji icon + label + status circle
  - Green circle = pass, Red circle = fail
- Instruction text below camera: gray, centered, `"Find a quiet spot with good lighting."`
- CTA: large rounded pill button, disabled/gray when not all checks pass

### Screen B — Establish Your Baseline (IMG_8434)
- Deep navy → deep purple gradient background `#080b1a → #1a1035`
- Stardust particle field (matches existing `stardust.js`)
- Bold white centered headline, small gray subtitle text
- Bottom: `⏱ 60 Seconds` label + large gradient CTA button
  - Button: `linear-gradient(135deg, #4f6ef0, #8b5cf6)` with soft purple glow (`box-shadow: 0 0 24px rgba(139,92,246,0.5)`)

### Screen C — Baseline Capture Phase (IMG_8435)
- Deep navy background `#080b1a`
- Face centered inside:
  - **Outer ring**: circular progress arc in `#4f9ef0` blue (animated rotation)
  - **Inner frame**: rounded-square with gold/amber glow border `#c97b2f` + corner accent marks
  - **Stardust particles** overlaid on face (white + blue + gold, opacity 0.3–1.0)
- Below face frame:
  - Ruler/scale tick marks
  - Progress bar (dark track + blue fill)
  - `🔒 PRIVACY SECURED` small label
- Large white instruction text at bottom: bold, 2-line, e.g. `"Hold steady for neutral capture"`

### Design Tokens (Extracted from References)

```
--tenki-bg-deep:        #080b1a
--tenki-bg-mid:         #1a1035
--tenki-accent-blue:    #4f9ef0
--tenki-accent-gold:    #c97b2f
--tenki-accent-purple:  #8b5cf6
--tenki-badge-bg:       rgba(40, 30, 20, 0.75)
--tenki-text-primary:   #ffffff
--tenki-text-secondary: rgba(255, 255, 255, 0.6)
--tenki-btn-gradient:   linear-gradient(135deg, #4f6ef0, #8b5cf6)
--tenki-btn-glow:       0 0 24px rgba(139, 92, 246, 0.5)
```

---

## Active Sprint: Visual Alignment

### Priority 1 — Calibration / Scan screens in `apps/web`

- [ ] **Environment Calibration screen**: Implement 3-badge status pills (Lighting / Distance / Stability) with pass/fail states. Badge style per Screen A above. CTA unlocks only when all 3 pass.
- [x] **Baseline intro screen**: Match Screen B — deep navy+purple starfield bg, bold white headline, subtitle, `⏱ 60 Seconds` + gradient glow CTA button.
- [ ] **Baseline capture screen**: Match Screen C — circular progress ring (blue), gold rounded-square frame with corner accents, stardust particle overlay, progress bar + `🔒 PRIVACY SECURED`, large instruction text at bottom.

### Priority 2 — Global visual consistency

- [x] All scan-flow screens must use `--tenki-bg-deep` / `--tenki-bg-mid` gradient background (not white or gray).
- [x] Stardust particle field (`stardust.js`) must be active on all deep-bg screens.
- [x] All CTA primary buttons must use `--tenki-btn-gradient` + `--tenki-btn-glow`.
- [x] Replace any flat gray disabled buttons with the correct dimmed pill style (opacity 0.4, same shape).

### Priority 3 — Copy alignment

- [ ] "Environment Calibration" → keep English as-is (matches App Store screenshot language)
- [ ] "Establish Your Baseline" → keep English as-is
- [ ] "Baseline Capture Phase" → keep English as-is
- [ ] All instruction text must use compliance-safe language (see ANTIGRAVITY.md Section 2)

---

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
    1. **Low Baseline**: `faceBaselineCount < 3`
    2. **High Stress**: `stressScore > 75`
    3. **Elapsed Cooldown**: `daysSinceCalibration > 14`
  - Automatically updates `lastFingerCalibrationTime = Date.now()` and sets `faceBaselineCount = 3` upon completing a finger calibration scan.
- [x] **Daily Scan Result**: Improved Traditional Chinese copy for clarity drivers.
- [x] **Background Visual Polish**: Wrapped all core tab screens in `BackgroundContainer`.
- [x] **Bug Fix**: Fixed syntax bug in `apps/mobile/app/(tabs)/scan.tsx`.
- [x] **Verification**: Zero TypeScript compilation errors confirmed.
- [x] **Brand Taglines**: Canonicalized Hero + Subtitle in ANTIGRAVITY.md v4.1 (2026-06-12).
- [x] **Dopamine Baseline Model**: Documented three-state model (Above / At / Below) in ANTIGRAVITY.md.
- [x] **Dopamine Journal**: Added `dopamine-journal-store.ts` + `DopamineJournalSheet.tsx` + Lab tab entry.

---

## Next Steps (Post Visual Alignment)

1. **Native Integration**:
   - Transition `apps/mobile/lib/mock-scan.ts` to real camera-rPPG frameworks when native wrappers are available.
   - Migrate `EdgeScoreRing` to `@shopify/react-native-skia` for premium gradient drawing.
2. **Device Connectors**:
   - Implement real Garmin and Apple Watch integrations in Lab settings.
3. **Binaural Beats**:
   - Lab tab: implement audio playback (Alpha 10Hz / Theta 6Hz).
4. **Timeline**:
   - Add dopamine journal entries to history view.

---

## How to Start This Session (Claude Code)

```
1. Read ANTIGRAVITY.md (canonical product blueprint)
2. Read this file (task.md) — active sprint is "Visual Alignment" above
3. Open https://tenki-emotion-app.vercel.app/preview/ in browser to see current state
4. Work through Priority 1 → 2 → 3 in order
5. Only modify apps/web/ — do not touch apps/mobile/ unless explicitly instructed
6. After each screen is complete, mark the checkbox and commit
```
