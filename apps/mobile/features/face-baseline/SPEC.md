# TENKI — Face Baseline Onboarding · Production Design & Implementation Spec

> Source of truth: 4 reference frames (Intro / Environment / Capture / Processing).
> Goal: first-time **Face Baseline** calibration for daily users.
> Feel: Face ID precision · premium futuristic wellness · dark-first · cosmic stardust soul · high trust.
> Compliance: no medical / no "emotion recognition" / no dopamine claims. Public language = **baseline, privacy, precision, calibration, readiness, return to baseline**.

---

## 0. The one unifying decision (read this first)

The references live in **two color worlds**. We do not erase one — we assign each a *meaning* so the inconsistency becomes a system:

| World | Color | Means | Appears on |
|-------|-------|-------|-----------|
| **Cool** | electric blue → violet (`#4DA6FF → #7B61FF`) | "the system is preparing / aligning / confirming **you**" | Intro, Environment, Face-Lock, all CTAs, progress halos, success |
| **Warm** | aurora gold (`#FFB347 → #FFD27A`) | "**your living signal** is being read" | Capture mesh + Processing orb **only** |

Narrative: cool = the machine getting ready; the brief warm gold moment = your own essence being captured; then it resolves back to cool calm. This is the emotional spine — protect it.

**Fixes applied to the references:**
1. Environment screen (ref #2) is flat/light → pulled back into the **dark cosmic frame** with the same nebula, keeping its square corner-bracket reticle + status pills.
2. Two scan-frame shapes get distinct jobs: **square reticle = aligning/framing**, **circular halo = locked/capturing**.
3. One radius language, one glow language, one type ramp across all 8 screens.

---

## TASK 1 — Reverse-engineered visual grammar

### Color system
- **Background:** near-black deep space `#05060A`–`#0A0B12` with a violet/indigo nebula wash (`#1A1140` → `#0A0B12` radial) and fine star noise. Capture/Processing dim the nebula and add a warm vignette.
- **Cool accent ramp:** `#4DA6FF` (electric blue) → `#6E8BFF` → `#7B61FF` (violet). Used for CTA fills, focus strokes, locked reticle, halo sweep.
- **Warm accent ramp (capture only):** `#FFB347` → `#FFCB6B` → `#FFD27A`, glow `#FF9D2F`.
- **Status:** pass mint `#46E0B0`, caution amber `#FFC24B`, fail coral `#FF6B6B`.
- **Text:** primary `#F4F6FF` (near-white), secondary `#A6ADC8`, tertiary `#5A6178`.
- **Trust/lock cue:** desaturated cyan-white pill `rgba(180,210,255,0.14)` bg + `#BFD8FF` text + lock glyph.

### Typography hierarchy
- **Hero** — 34/40, weight 700, centered, tight tracking (`SF Pro Display`). ("Establish Your Baseline", "Hold steady for neutral capture")
- **Screen title** — 17, weight 600, centered in nav bar.
- **Body** — 15/22, weight 400, secondary color, max ~2–3 lines, centered.
- **Metric numeral** — 48–56, weight 300 (thin), tabular, accent-tinted ("67%").
- **Pill / label** — 13, weight 600.
- **Caption / disclaimer** — 11/15, tertiary, centered.

### Spacing rhythm
4-pt base. Screen gutter **24**. Section gaps **16 / 24 / 32**. Hero block sits on upper-third; CTA pinned to bottom safe-area with **24** inset and **16** above the disclaimer.

### Corner radius language
- CTA / pills: **full** (capsule).
- Cards / checklist rows / status pills: **16**.
- Scan reticle (square): **28** outer with **L-shaped corner brackets** (not full border).
- Capture halo: circle.

### Glow behavior
Glow = layered soft shadow + faint inner stroke, never a hard neon line.
- CTA: outer drop glow (accent @ 35% opacity, blur ~24, y+8) + 1px inner top highlight.
- Locked reticle / halo: outer bloom (blur 32–48) that **breathes** (opacity 0.5→0.9).
- Particle mesh + orb: additive-blend bloom only on the warm screens.

### Scan-frame treatment
- **Square reticle** (Environment, Face-detecting): 4 corner brackets, animated tracking, color = state (scanning blue → locked mint).
- **Circular halo** (Capture): concentric ring + rotating gradient arc + privacy pill anchored at bottom of ring.

### Button treatment
- **Primary** = capsule, blue→violet gradient fill, soft outer glow, 56 tall, label 17/600, subtle press-scale 0.97 + glow intensify. Disabled = 30% opacity, glow off (see ref #2 "Start Scan").
- **Secondary** = ghost capsule, 1px `rgba(255,255,255,0.18)` border, no fill.
- **Tertiary / text** = accent text only ("Cancel", "Learn more").

### Privacy / trust signaling
Three recurring devices: (1) **time-cost chip** `⏱ 60 Seconds` (sets expectation = trust), (2) **lock pill** `PRIVACY SECURED`, (3) **local-only footnote** under processing. Always cool/neutral, never salesy.

### Progress indicator style
- Linear **segmented bar** under the capture halo (thin, accent fill, faint track).
- Numeric **%** on processing.
- **ProgressHalo** sweep around the orb/face = the hero progress feel.

### Composition patterns
Vertical, centered, single-column. Upper third = subject (frame/orb), lower third = copy + CTA. Nav (back/cancel) top row. Everything breathes; one focal element per screen.

### Dark vs light
Dark-first everywhere. Ref #2's light look is rejected. The only "lightness" is the luminous subject and glow.

### Where cosmic/stardust appears
- Full nebula + stars: Intro, Confirmed, Retry.
- Dimmed nebula + **warm soul particles on the face**: Capture.
- Dimmed nebula + **gold orbital orb**: Processing.
- Restrained (nebula faint, UI-forward): Environment, Face-Lock prep.

### Where UI stays flat/restrained
Checklist rows, status pills, nav bar, disclaimers, secondary buttons — flat, no glow, high legibility. Glow is reserved for the focal subject + primary CTA only.

### Core to preserve
Dark cosmic atmosphere · bold centered hero type · glowing blue→violet capsule CTA · precision scan frame · privacy/lock cues · the gold capture+processing ritual.

### Inconsistent across refs (to unify)
Environment screen light vs dark · two frame shapes · gold vs blue accent with no rule · varying title placement/casing · two different progress idioms.

### Unify into one product system
One dark cosmic frame · cool-vs-warm meaning rule · square-vs-circle frame rule · single type ramp, radius set, glow set, token system (below).

---

## TASK 2 — Canonical flow (8 screens)

Shared chrome: `CosmicBackground` (mode per screen) · top nav (back left, Cancel right) · bottom safe-area CTA dock · inline disclaimer where scan-related.

### 1. EstablishBaselineIntroScreen
- **Purpose:** set intent + expectation + trust before any camera permission.
- **Layout:** nebula full · hero block upper-third ("Establish Your Baseline") · body (privacy + encrypted-local) · `⏱ 60 Seconds` chip · `PrivacyAssuranceRow` · primary CTA `Begin Calibration` · `Learn more` text link.
- **Hierarchy:** Hero > body > time chip > CTA.
- **Components:** CosmicBackground(`deepNebula`), BaselineHeroCopy, TimeCostChip, PrivacyAssuranceRow, GlowPrimaryButton.
- **Tone:** calm, awe, cool violet.
- **CTA:** glow primary, idle breathing pulse.
- **Transition:** fade+rise in (400ms); CTA → camera-permission sheet → Environment.
- **States:** loading=skeleton hero; blocked=if permission permanently denied, CTA becomes `Open Settings`.

### 2. EnvironmentCalibrationScreen
- **Purpose:** ensure lighting / distance / stability before committing.
- **Layout:** dimmed nebula · **square reticle** with live front-camera preview (or silhouette mock) · `EnvironmentChecklist` (3 rows: Lighting / Distance / Stability, each mint✓ or coral✗) · guidance line ("Find a quiet spot with good lighting") · primary CTA `Start Scan` (enabled only when all pass).
- **Hierarchy:** reticle+preview > checklist > guidance > CTA.
- **Components:** CosmicBackground(`dim`), FaceScanFrame(`square`), EnvironmentChecklist, ChecklistRow, GlowPrimaryButton(disabled-aware).
- **Tone:** clinical-calm, cool; restrained UI.
- **CTA:** disabled (30%, no glow) until all checks pass, then snaps to glow.
- **Transition:** rows flip pass/fail with micro-bounce; pass-all → CTA glow-in.
- **States:** permission denied → blocked panel; camera error → retry; any check failing keeps CTA disabled with the specific fix hint.

### 3. FaceLockPreparationScreen
- **Purpose:** acquire and **lock** the face — the Face-ID precision beat.
- **Layout:** dim nebula · live preview · **square reticle that tracks then snaps to a `FaceLockBadge`** · single instruction ("Center your face") · no CTA (auto-advances on lock).
- **Hierarchy:** reticle/face > instruction.
- **Components:** FaceScanFrame(`tracking→locked`), FaceLockBadge, CaptureInstruction.
- **Tone:** precise, anticipatory; reticle blue→mint on lock.
- **CTA:** none; auto-advance ~600ms after stable lock.
- **Transition:** lock = snap-in scale + haptic + bloom.
- **States:** no face / multiple faces / lost lock → instruction swaps, reticle returns to blue; timeout 15s → soft nudge.

### 4. BaselineCaptureNeutralScreen
- **Purpose:** capture the neutral/at-rest baseline — the gold soul moment.
- **Layout:** dim nebula + warm vignette · **circular halo** around face · `SoulParticleMesh` (gold stardust on face) · `ProgressHalo` sweeping the ring · segmented progress bar · `PRIVACY SECURED` pill · hero instruction ("Hold steady for neutral capture").
- **Hierarchy:** halo+mesh face > instruction > progress > privacy pill.
- **Components:** CosmicBackground(`captureWarm`), FaceScanFrame(`halo`), SoulParticleMesh, ProgressHalo, CaptureInstruction, QualityStatusPills, PrivacyLockPill, SegmentedProgress.
- **Tone:** intimate, warm gold over cool space, reverent.
- **CTA:** none; progress-driven.
- **Transition:** particles stabilize as quality holds; progress fills.
- **States:** quality drop (motion/lighting) → particles scatter, single status pill ("Hold still"), progress **pauses** (never resets); lock lost → fall back to Face-Lock without losing captured fraction.

### 5. BaselineCaptureMotionScreen
- **Purpose:** brief guided micro-motion sample (gentle head turn / blink) to enrich baseline robustness — framed as **calibration**, never "emotion."
- **Layout:** same warm capture frame · animated **guidance cue** (subtle arc/arrow) · instruction ("Slowly turn your head") · second segment of the same progress bar.
- **Hierarchy:** face+cue > instruction > progress.
- **Components:** reuse capture stack + MotionGuideCue.
- **Tone:** warm, playful-calm, still precise.
- **CTA:** none.
- **Transition:** continues the single progress bar from neutral (segment 2 of 2).
- **States:** too much/too little motion → cue re-hints; quality drop → pause; can retry **this phase only**.

### 6. ProcessingBaselineScreen
- **Purpose:** the ritual — "securing your unique baseline."
- **Layout:** dim nebula · centered **gold `ProcessingOrb`** (orbiting light rings) · status line ("Securing your unique baseline…") · large `%` numeral · local-only privacy footnote.
- **Hierarchy:** orb > status > % > footnote.
- **Components:** CosmicBackground(`processing`), ProcessingOrb, PercentCounter, PrivacyFootnote.
- **Tone:** warm, ceremonial, slow.
- **CTA:** none (cannot cancel mid-write; or `Cancel` returns to intro discarding partial).
- **Transition:** orb swirl accelerates near 100% → cross-fade to Confirmed.
- **States:** compute error → cross-fade to Retry with reason; min-display 1.8s even if fast (preserve ritual).

### 7. BaselineConfirmedScreen
- **Purpose:** confirm success, communicate maturity + future-value, hand off.
- **Layout:** nebula returns full · `BaselineSuccessPanel` (cool checkmark bloom) · headline ("Baseline established") · reassurance ("This is your reference, not a score") · `BaselineMaturityMeter` (confidence/"gets more precise over time") · primary CTA `Start your first scan` · secondary `Explore first`.
- **Hierarchy:** success bloom > headline > maturity > CTA.
- **Components:** BaselineSuccessPanel, BaselineMaturityMeter, GlowPrimaryButton, GhostButton.
- **Tone:** resolved calm, cool blue, quietly triumphant.
- **CTA:** glow primary + ghost secondary.
- **Transition:** checkmark pulse + haptic success; CTA → first scan.
- **States:** low-confidence baseline → maturity meter shows "initial — improves with use," still success.

### 8. RetryOrAdjustmentScreen
- **Purpose:** explain *why* it didn't complete and offer the **smallest** path back.
- **Layout:** nebula faint · diagnostic icon · headline ("Let's adjust one thing") · single human-readable reason (lighting / movement / face not detected) · primary `Try again` (resumes the failed phase) · secondary `Restart calibration`.
- **Hierarchy:** reason > primary fix > restart.
- **Components:** RetryReasonCard, GlowPrimaryButton, GhostButton.
- **Tone:** supportive, non-blaming, cool.
- **CTA:** primary resumes nearest phase; restart only if needed.
- **States:** maps each `RetryReason` to one sentence + one targeted action. Never dumps technical errors.

---

## TASK 3 — React Native screen tree

```
apps/mobile/features/face-baseline/
├─ index.ts                              # public barrel (screens + navigator)
├─ FaceBaselineNavigator.tsx             # stack wiring + transitions + guards
├─ SPEC.md                               # this document
├─ screens/
│  ├─ EstablishBaselineIntroScreen.tsx
│  ├─ EnvironmentCalibrationScreen.tsx
│  ├─ FaceLockPreparationScreen.tsx
│  ├─ BaselineCaptureNeutralScreen.tsx
│  ├─ BaselineCaptureMotionScreen.tsx
│  ├─ ProcessingBaselineScreen.tsx
│  ├─ BaselineConfirmedScreen.tsx
│  └─ RetryOrAdjustmentScreen.tsx
├─ components/
│  ├─ background/
│  │  ├─ CosmicBackground.tsx            # Skia nebula + stars, mode-driven
│  │  └─ StarfieldLayer.tsx
│  ├─ frame/
│  │  ├─ FaceScanFrame.tsx               # square | tracking | locked | halo
│  │  ├─ CornerBrackets.tsx
│  │  ├─ FaceLockBadge.tsx
│  │  └─ ProgressHalo.tsx                # Skia sweeping arc
│  ├─ capture/
│  │  ├─ SoulParticleMesh.tsx            # Skia gold stardust over face
│  │  ├─ MotionGuideCue.tsx
│  │  ├─ CaptureInstruction.tsx
│  │  ├─ QualityStatusPills.tsx
│  │  └─ SegmentedProgress.tsx
│  ├─ processing/
│  │  ├─ ProcessingOrb.tsx               # Skia orbiting gold rings
│  │  └─ PercentCounter.tsx              # Reanimated tabular counter
│  ├─ confirm/
│  │  ├─ BaselineSuccessPanel.tsx
│  │  └─ BaselineMaturityMeter.tsx
│  ├─ env/
│  │  ├─ EnvironmentChecklist.tsx
│  │  └─ ChecklistRow.tsx
│  ├─ retry/
│  │  └─ RetryReasonCard.tsx
│  └─ shared/
│     ├─ GlowPrimaryButton.tsx
│     ├─ GhostButton.tsx
│     ├─ BaselineHeroCopy.tsx
│     ├─ PrivacyAssuranceRow.tsx
│     ├─ PrivacyLockPill.tsx
│     ├─ TimeCostChip.tsx
│     ├─ PrivacyFootnote.tsx
│     └─ NavBar.tsx
├─ hooks/
│  ├─ useFaceBaselineMachine.ts          # XState/typed-FSM bridge → store
│  ├─ useCameraPermission.ts
│  ├─ useFaceDetector.ts                 # vision-camera frame processor wrapper
│  ├─ useEnvironmentChecks.ts            # lighting/distance/stability derivation
│  ├─ useQualityMetrics.ts               # SQI / motion / coverage stream
│  ├─ useReducedMotion.ts
│  └─ useBaselineHaptics.ts
├─ store/
│  ├─ faceBaselineStore.ts               # Zustand (Task 5)
│  └─ selectors.ts                       # derived selectors
├─ machine/
│  ├─ faceBaselineMachine.ts             # state machine (Task 6)
│  └─ transitions.ts                     # guards/conditions
├─ utils/
│  ├─ qualityThresholds.ts
│  ├─ retryReason.ts                     # metrics → RetryReason mapping
│  ├─ progress.ts                        # phase-weighted progress math
│  └─ confidence.ts                      # baseline confidence + maturity calc
├─ tokens/
│  └─ faceBaseline.tokens.ts             # Task 7 tokens (extends TENKI_THEME)
└─ types/
   ├─ faceBaseline.types.ts
   └─ index.ts
```

Reusable-UI (`components/shared`, `frame/ProgressHalo`, `capture/SoulParticleMesh`, `processing/ProcessingOrb`) is flow-agnostic and promoted to daily-scan later. Flow logic stays in `screens/`, `machine/`, `store/`, `hooks/`.

---

## TASK 4 — Component architecture

> Conventions: TS strict, no `any`. Skia for rings/particles/nebula. Reanimated 3 for motion. Tokens from `faceBaseline.tokens.ts`. All glow/particle components honor `useReducedMotion()`.

### CosmicBackground
- **Responsibility:** full-bleed Skia nebula + starfield; sets the world mood per screen.
- **Props:** `mode: 'deepNebula' | 'dim' | 'captureWarm' | 'processing' | 'faint'`, `intensity?: number`, `children?`.
- **Variants:** cool nebula / dimmed / warm-vignette / processing / faint.
- **Animation:** ultra-slow star drift + nebula parallax (EWMA-slow). Mode change cross-fades 600ms.
- **Reusable:** ✅ app-wide background primitive.

### BaselineHeroCopy
- **Responsibility:** centered hero title + body block.
- **Props:** `title: string`, `body?: string`, `align?: 'center'`, `emphasis?: 'cool' | 'warm'`.
- **Variants:** title-only / title+body.
- **Animation:** staggered fade+rise (title then body, 80ms offset).
- **Reusable:** ✅ any onboarding/empty state.

### GlowPrimaryButton
- **Responsibility:** the signature glowing capsule CTA.
- **Props:** `label`, `onPress`, `disabled?`, `loading?`, `glow?: boolean`, `accent?: 'cool' | 'warm'`, `testID?`.
- **Variants:** idle / pressed / disabled (30%, glow off) / loading (inline spinner).
- **Animation:** idle breathing glow (2.4s loop); press scale 0.97 + glow intensify; disabled→enabled glow-in 240ms.
- **Reusable:** ✅ primary CTA everywhere.

### GhostButton / TextLink
- **Responsibility:** secondary/tertiary actions.
- **Props:** `label`, `onPress`, `variant: 'ghost' | 'text'`, `tone?`.
- **Animation:** opacity press feedback only.
- **Reusable:** ✅.

### PrivacyAssuranceRow
- **Responsibility:** inline lock + "encrypted, stored only on your device" trust line.
- **Props:** `text?`, `icon?: 'lock' | 'shield'`.
- **Variants:** row / compact.
- **Animation:** none (restrained).
- **Reusable:** ✅ paywall, settings, scan.

### TimeCostChip
- **Responsibility:** `⏱ 60 Seconds` expectation chip.
- **Props:** `seconds: number`, `label?`.
- **Animation:** fade-in only.
- **Reusable:** ✅ any timed flow.

### EnvironmentChecklist + ChecklistRow
- **Responsibility:** live pass/fail of Lighting / Distance / Stability.
- **Props (list):** `checks: EnvCheck[]`. **(row):** `icon`, `label`, `status: 'pass' | 'fail' | 'pending'`, `hint?`.
- **Variants:** pass (mint✓) / fail (coral✗) / pending (spinner).
- **Animation:** status flip micro-bounce + color tween; fail = subtle shake once.
- **Reusable:** ✅ daily-scan readiness check.

### FaceScanFrame
- **Responsibility:** the precision frame; morphs across phases.
- **Props:** `shape: 'square' | 'halo'`, `state: 'idle' | 'tracking' | 'locked' | 'capturing'`, `quality?: number`, `children?` (camera preview).
- **Variants:** square-idle, square-tracking (blue), square-locked (mint), halo-capturing (gold).
- **Animation:** corner-bracket tracking follow; lock snap-in (scale 1.06→1.0 + bloom); halo ring rotate.
- **Reusable:** ✅ central to daily face scan.

### CornerBrackets / FaceLockBadge
- **CornerBrackets:** 4 L-brackets, color/length react to `state`. Reusable ✅.
- **FaceLockBadge:** the "locked" confirmation glyph (Face-ID-style). Snap-in + haptic. Reusable ✅.

### SoulParticleMesh
- **Responsibility:** gold stardust mesh mapped to face landmarks — "your living signal."
- **Props:** `landmarks?: FaceLandmarks`, `stability: number` (0–1), `phase: 'neutral' | 'motion'`, `paused?`.
- **Variants:** scattered (low stability) ↔ crystallized (high stability).
- **Animation:** particles converge to mesh as stability rises; scatter on drop; additive bloom. **Reduced-motion:** static low-density mesh, no churn.
- **Reusable:** ✅ premium daily-scan signature (keep the "feel" per CLAUDE.md v25.8.2).

### MotionGuideCue
- **Responsibility:** subtle directional cue for the micro-motion phase.
- **Props:** `direction: 'left' | 'right' | 'blink'`, `progress`.
- **Animation:** gentle arc sweep; loops until satisfied.
- **Reusable:** ⚠️ flow-specific.

### CaptureInstruction
- **Responsibility:** single dominant instruction line (one message at a time — UX rule).
- **Props:** `text`, `tone?: 'cool' | 'warm'`, `emphasis?`.
- **Animation:** cross-fade on text change (no stacking).
- **Reusable:** ✅.

### QualityStatusPills
- **Responsibility:** at most ONE active quality nudge ("Hold still", "More light").
- **Props:** `status: QualityStatus`, `visible`.
- **Variants:** good (hidden) / single-issue pill.
- **Animation:** slide-fade; never show multiple.
- **Reusable:** ✅.

### SegmentedProgress
- **Responsibility:** thin 2-segment bar (neutral → motion).
- **Props:** `progress: number` (0–1), `segments: number`, `paused?`.
- **Animation:** spring fill; pause = dim, no reset.
- **Reusable:** ✅.

### ProgressHalo
- **Responsibility:** Skia sweeping arc around frame/orb — hero progress.
- **Props:** `progress`, `radius`, `accent: 'cool' | 'warm'`, `breathing?`.
- **Animation:** arc sweep + breathing bloom.
- **Reusable:** ✅.

### ProcessingOrb
- **Responsibility:** gold orbiting-rings sphere — the ritual.
- **Props:** `progress`, `intensity?`.
- **Variants:** swirl-slow → swirl-accelerate (near 100%).
- **Animation:** continuous 3-axis ring orbit; accelerate + brighten at completion. **Reduced-motion:** slow single pulse.
- **Reusable:** ✅ any "computing locally" moment.

### PercentCounter
- **Responsibility:** large tabular animated `%`.
- **Props:** `value`, `accent`.
- **Animation:** count-up eased to value; tabular nums.
- **Reusable:** ✅.

### PrivacyLockPill / PrivacyFootnote
- Lock pill (`PRIVACY SECURED`) and processing footnote (`processed & stored locally`). Restrained, no glow. Reusable ✅.

### BaselineSuccessPanel
- **Responsibility:** cool checkmark bloom + confirmation.
- **Props:** `title`, `subtitle`, `onContinue`.
- **Animation:** checkmark draw + bloom pulse + success haptic.
- **Reusable:** ✅ any completion.

### BaselineMaturityMeter
- **Responsibility:** show baseline confidence + "improves with use" (maturity), no score framing.
- **Props:** `confidence: number` (0–1), `maturity: 'initial' | 'developing' | 'established'`.
- **Variants:** by maturity stage.
- **Animation:** fill-in once.
- **Reusable:** ✅ profile/baseline status.

### RetryReasonCard
- **Responsibility:** one human reason + the smallest corrective action.
- **Props:** `reason: RetryReason`, `onTryAgain`, `onRestart`.
- **Variants:** per reason (lighting / movement / no-face / lost-lock / timeout).
- **Reusable:** ⚠️ flow-specific.

---

## TASK 5 — Zustand store

```ts
// store/faceBaselineStore.ts
import { create } from 'zustand';

export type FlowStep =
  | 'intro' | 'environment' | 'faceLock'
  | 'captureNeutral' | 'captureMotion'
  | 'processing' | 'confirmed' | 'retry';

export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked';

export interface EnvironmentChecks {
  lighting: boolean;
  distance: boolean;
  stability: boolean;
}

export type FaceLockState = 'searching' | 'tracking' | 'locked' | 'lost';
export type CapturePhase = 'idle' | 'neutral' | 'motion' | 'done';
export type ProcessingStatus = 'idle' | 'running' | 'success' | 'error';
export type BaselineMaturity = 'none' | 'initial' | 'developing' | 'established';

export type RetryReason =
  | 'lowLight' | 'tooClose' | 'tooFar' | 'movement'
  | 'noFace' | 'multipleFaces' | 'lostLock' | 'timeout' | 'computeError';

export interface QualityMetrics {
  sqi: number;        // 0–1 signal quality index
  motion: number;     // 0–1 (lower better)
  coverage: number;   // 0–1 face-in-frame
  brightness: number; // 0–1
}

export interface FaceBaselineState {
  step: FlowStep;
  permission: PermissionState;
  env: EnvironmentChecks;
  envReady: boolean;
  faceLock: FaceLockState;
  capturePhase: CapturePhase;
  quality: QualityMetrics;
  neutralProgress: number;   // 0–1
  motionProgress: number;    // 0–1
  processingStatus: ProcessingStatus;
  processingProgress: number; // 0–1
  retryReason: RetryReason | null;
  baselineConfidence: number; // 0–1
  baselineMaturity: BaselineMaturity;
  completed: boolean;
  startedAt: number | null;
  reducedMotion: boolean;

  // actions
  goTo: (step: FlowStep) => void;
  setPermission: (p: PermissionState) => void;
  updateEnv: (patch: Partial<EnvironmentChecks>) => void;
  setFaceLock: (s: FaceLockState) => void;
  setCapturePhase: (p: CapturePhase) => void;
  updateQuality: (q: Partial<QualityMetrics>) => void;
  setNeutralProgress: (v: number) => void;
  setMotionProgress: (v: number) => void;
  setProcessing: (status: ProcessingStatus, progress?: number) => void;
  setRetry: (reason: RetryReason) => void;
  clearRetry: () => void;
  completeBaseline: (confidence: number, maturity: BaselineMaturity) => void;
  reset: () => void;
}

const QUALITY_OK = { sqi: 0.7, motion: 0.35, coverage: 0.8, brightness: 0.45 } as const;

const initialState = {
  step: 'intro' as FlowStep,
  permission: 'unknown' as PermissionState,
  env: { lighting: false, distance: false, stability: false },
  envReady: false,
  faceLock: 'searching' as FaceLockState,
  capturePhase: 'idle' as CapturePhase,
  quality: { sqi: 0, motion: 1, coverage: 0, brightness: 0 },
  neutralProgress: 0,
  motionProgress: 0,
  processingStatus: 'idle' as ProcessingStatus,
  processingProgress: 0,
  retryReason: null as RetryReason | null,
  baselineConfidence: 0,
  baselineMaturity: 'none' as BaselineMaturity,
  completed: false,
  startedAt: null as number | null,
  reducedMotion: false,
};

export const useFaceBaselineStore = create<FaceBaselineState>((set) => ({
  ...initialState,
  goTo: (step) => set((s) => ({ step, startedAt: s.startedAt ?? Date.now() })),
  setPermission: (permission) => set({ permission }),
  updateEnv: (patch) => set((s) => {
    const env = { ...s.env, ...patch };
    return { env, envReady: env.lighting && env.distance && env.stability };
  }),
  setFaceLock: (faceLock) => set({ faceLock }),
  setCapturePhase: (capturePhase) => set({ capturePhase }),
  updateQuality: (q) => set((s) => ({ quality: { ...s.quality, ...q } })),
  setNeutralProgress: (neutralProgress) => set({ neutralProgress }),
  setMotionProgress: (motionProgress) => set({ motionProgress }),
  setProcessing: (processingStatus, processingProgress) =>
    set((s) => ({ processingStatus, processingProgress: processingProgress ?? s.processingProgress })),
  setRetry: (retryReason) => set({ retryReason, step: 'retry' }),
  clearRetry: () => set({ retryReason: null }),
  completeBaseline: (baselineConfidence, baselineMaturity) =>
    set({ baselineConfidence, baselineMaturity, completed: true, step: 'confirmed', processingStatus: 'success' }),
  reset: () => set({ ...initialState }),
}));

// store/selectors.ts — derived
export const selectQualityOk = (s: FaceBaselineState): boolean =>
  s.quality.sqi >= QUALITY_OK.sqi &&
  s.quality.motion <= QUALITY_OK.motion &&
  s.quality.coverage >= QUALITY_OK.coverage &&
  s.quality.brightness >= QUALITY_OK.brightness;

export const selectTotalProgress = (s: FaceBaselineState): number =>
  s.step === 'processing' ? s.processingProgress
  : (s.neutralProgress * 0.6 + s.motionProgress * 0.4);

export const selectCanStartScan = (s: FaceBaselineState): boolean =>
  s.permission === 'granted' && s.envReady;

export const selectActiveQualityStatus = (s: FaceBaselineState):
  'good' | 'movement' | 'lowLight' | 'reframe' => {
  if (s.quality.motion > QUALITY_OK.motion) return 'movement';
  if (s.quality.brightness < QUALITY_OK.brightness) return 'lowLight';
  if (s.quality.coverage < QUALITY_OK.coverage) return 'reframe';
  return 'good';
};
```

---

## TASK 6 — State machine

States: `intro → permission_check → environment_check → face_detecting → face_locked → neutral_capture → motion_capture → processing → confirmed`, plus `retry_needed` and `exit`. Retry resumes the **nearest** phase, not a full restart.

```ts
// machine/faceBaselineMachine.ts (XState v5 shape, abbreviated)
export const faceBaselineMachine = createMachine({
  id: 'faceBaseline',
  initial: 'intro',
  states: {
    intro:            { on: { BEGIN: 'permission_check', EXIT: 'exit' } },
    permission_check: { on: { GRANTED: 'environment_check', DENIED: 'exit', BLOCKED: 'exit' } },
    environment_check:{ on: { ALL_PASS: 'face_detecting', CANCEL: 'exit' } },
    face_detecting:   { on: { LOCKED: 'face_locked', TIMEOUT: 'retry_needed', LOST: 'face_detecting', CANCEL: 'exit' } },
    face_locked:      { on: { STABLE: 'neutral_capture', LOST: 'face_detecting' } },
    neutral_capture:  { on: { NEUTRAL_DONE: 'motion_capture', QUALITY_FAIL: 'retry_needed', LOST: 'face_detecting', CANCEL: 'exit' } },
    motion_capture:   { on: { MOTION_DONE: 'processing', QUALITY_FAIL: 'retry_needed', LOST: 'face_detecting', CANCEL: 'exit' } },
    processing:       { on: { COMPUTED: 'confirmed', COMPUTE_ERROR: 'retry_needed' } },
    confirmed:        { type: 'final' },
    retry_needed:     { on: { RESUME: 'face_detecting', RESTART: 'intro', EXIT: 'exit' } },
    exit:             { type: 'final' },
  },
});
```

| State | Entry condition | Visible UI | Success | Failure | Timeout | Back-out | Partial retry |
|-------|-----------------|-----------|---------|---------|---------|----------|---------------|
| **intro** | flow opened | Intro screen | tap Begin | — | — | leave flow | — |
| **permission_check** | Begin tapped | OS prompt / sheet | granted | denied/blocked → exit w/ Settings | — | dismiss → intro | — |
| **environment_check** | permission granted | Environment screen | all 3 pass | stays until pass | — | Cancel → exit | re-check only failing item |
| **face_detecting** | env ready | Face-Lock prep (square reticle) | stable face → locked | no/many faces re-hint | 15s → retry(noFace/timeout) | back → environment | re-detect |
| **face_locked** | face locked | locked badge | hold ~600ms stable | lock lost → face_detecting | — | back → environment | re-lock |
| **neutral_capture** | lock stable | Capture-Neutral (gold) | progress=1 | quality fail → retry(movement/light) | progress pauses, not reset | back → confirm-discard sheet | resume neutral, **keep captured %** |
| **motion_capture** | neutral done | Capture-Motion | progress=1 | quality fail → retry | pause | back → discard sheet | resume **motion only**, neutral kept |
| **processing** | motion done | Processing orb | compute ok → confirmed | error → retry(computeError) | min 1.8s ritual | block back (or discard) | restart processing |
| **confirmed** | baseline written | Confirmed | hand-off to scan | — | — | done | — |
| **retry_needed** | any failure | Retry screen | Try again → resume nearest | — | — | Restart → intro | **resumes failed phase** |
| **exit** | cancel/deny | — | — | — | — | — | — |

Back-out rule: leaving mid-capture shows a **discard-confirmation sheet** ("Stop calibration? Your progress won't be saved."). Captured neutral data is held in store until processing succeeds, so motion-phase retries never re-capture neutral.

---

## TASK 7 — Design tokens

```ts
// tokens/faceBaseline.tokens.ts — extends packages/shared TENKI_THEME
export const faceBaselineTokens = {
  color: {
    bg: {
      deepSpace: '#05060A',
      nebulaTop: '#1A1140',
      nebulaBottom: '#0A0B12',
      dim: '#070811',
      processing: '#08060B',
    },
    glow: {
      electricBlue: '#4DA6FF',
      indigo: '#6E8BFF',
      violet: '#7B61FF',
      auroraGold: '#FFB347',
      auroraGoldSoft: '#FFD27A',
      goldBloom: '#FF9D2F',
    },
    status: { pass: '#46E0B0', caution: '#FFC24B', fail: '#FF6B6B' },
    text: { primary: '#F4F6FF', secondary: '#A6ADC8', tertiary: '#5A6178', onGlow: '#FFFFFF' },
    trust: { pillBg: 'rgba(180,210,255,0.14)', pillText: '#BFD8FF' },
    frame: { idle: 'rgba(180,200,255,0.35)', tracking: '#4DA6FF', locked: '#46E0B0', capture: '#FFCB6B' },
  },
  text: {
    hero:        { size: 34, lineHeight: 40, weight: '700', tracking: -0.4 },
    title:       { size: 17, lineHeight: 22, weight: '600' },
    body:        { size: 15, lineHeight: 22, weight: '400' },
    metric:      { size: 52, lineHeight: 56, weight: '300', variant: 'tabular-nums' },
    pill:        { size: 13, lineHeight: 16, weight: '600' },
    caption:     { size: 11, lineHeight: 15, weight: '400' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 24, ctaDock: 24 },
  radius: {
    pill: 9999, card: 16, scanFrame: { lg: 28 }, halo: 9999, badge: 14,
  },
  shadow: {
    cardElevation: { color: '#000000', opacity: 0.4, radius: 16, y: 8 },
    ctaRest:       { color: '#5A7CFF', opacity: 0.35, radius: 24, y: 8 },
    ctaPressed:    { color: '#5A7CFF', opacity: 0.55, radius: 32, y: 10 },
  },
  glow: {
    ctaBlue:   { color: '#5A7CFF', blur: 24, spread: 0.35 },
    lockMint:  { color: '#46E0B0', blur: 28, spread: 0.5 },
    haloBlue:  { color: '#4DA6FF', blur: 40, spread: 0.6 },
    soulGold:  { color: '#FFB347', blur: 36, spread: 0.7 },
    orbGold:   { color: '#FF9D2F', blur: 48, spread: 0.8 },
  },
  motion: {
    duration: {
      introFade: 400, ctaGlowIn: 240, lockPulse: 360, lockSnap: 320,
      haloSweep: 1200, particleStabilize: 900, orbSwirl: 2400,
      successPulse: 520, screenCrossfade: 600, percentTick: 800,
      ctaBreath: 2400, processingMin: 1800,
    },
    easing: {
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
      snap: 'cubic-bezier(0.2, 0.9, 0.1, 1.0)',
      breath: 'cubic-bezier(0.45, 0, 0.55, 1)',
      gentle: 'cubic-bezier(0.33, 0, 0.2, 1)',
    },
  },
  stroke: { hairline: 1, reticle: 2, halo: 4, progressBar: 3, ringArc: 6 },
  overlay: {
    nebulaDim: 0.55, captureVignette: 0.7, scrim: 0.4,
    disabledCta: 0.3, particleAdditive: 0.85,
  },
} as const;
```

---

## TASK 8 — Animation + haptics plan

| Moment | Trigger | Visual | Duration | Easing | Haptic | Reduced-motion |
|--------|---------|--------|----------|--------|--------|----------------|
| Intro fade-in | mount | nebula settle + hero rise + star drift | 400ms (stagger 80) | decelerate | none | instant fade, no drift |
| CTA glow pulse | CTA idle | breathing outer glow 0.35↔0.5 | 2400ms loop | breath | none | static glow |
| CTA press | press in/out | scale 1→0.97, glow intensify | 120ms | snap | `selection` | scale only |
| Env check pass | check true | row tween + mint✓ micro-bounce | 240ms | snap | `success`(light) | color change only |
| Env check fail | check false | coral✗ + one shake | 200ms | standard | `warning` | color change only |
| Start-scan enable | all pass | disabled→glow capsule | 240ms | decelerate | `impact-light` | opacity only |
| Face lock snap-in | stable face | reticle→badge scale 1.06→1.0 + mint bloom | 320ms | snap | `impact-medium` | badge appears, no scale |
| Lock lost | lock drop | reticle blue, badge fade | 200ms | standard | `selection` | fade only |
| Progress halo sweep | capturing | arc fills + breathing bloom | 1200ms/loop | gentle | none | static arc fill |
| Particle stabilization | quality high | gold particles converge to mesh | 900ms | decelerate | subtle `selection` at full | static mesh |
| Particle scatter | quality drop | particles disperse + status pill | 300ms | standard | `warning`(soft) | pill only |
| Motion cue | motion phase | directional arc sweep loop | 1000ms/loop | gentle | none | static arrow |
| Processing orb swirl | processing | 3-axis gold rings orbit | 2400ms/loop | linear | none | slow single pulse |
| Percent tick | progress update | count-up tabular | 800ms ease | decelerate | none | snap value |
| Orb completion | progress→1 | swirl accelerate + brighten | 600ms | snap | `impact-soft` ramp | brighten only |
| Success confirmation | baseline written | checkmark draw + bloom pulse | 520ms | snap | `notificationSuccess` | checkmark fade-in |
| Screen transitions | step change | cross-fade + 12px rise | 600ms | standard | none | cross-fade only |
| Retry appear | failure | reason card rise | 300ms | decelerate | `warning` | fade |

Haptics centralized in `useBaselineHaptics()` (expo-haptics), gated by a user setting + reduced-motion. Honor `AccessibilityInfo.isReduceMotionEnabled`.

---

## TASK 9 — Figma-ready structure

**Pages**
1. `00 · Cover & Index`
2. `01 · Tokens` (Colors, Type, Spacing, Radius, Shadow/Glow, Motion specs)
3. `02 · Components` (component sets below)
4. `03 · Face Baseline — Flow` (the 8 frames)
5. `04 · States & Edge Cases`
6. `05 · Prototype`
7. `06 · Annotations / Redlines`

**Flow frames (390×844, iPhone 14/15):**
`FB-01 Intro` · `FB-02 Environment` · `FB-03 FaceLock` · `FB-04 Capture-Neutral` · `FB-05 Capture-Motion` · `FB-06 Processing` · `FB-07 Confirmed` · `FB-08 Retry`

**Component sets + variants**
- `Button/Primary` — variants: `state={idle,pressed,disabled,loading}`, `accent={cool,warm}`
- `Button/Secondary` — `variant={ghost,text}`
- `Frame/FaceScan` — `shape={square,halo}` × `state={idle,tracking,locked,capturing}`
- `Pill/Status` — `status={pass,fail,pending}`
- `Pill/Privacy` — `type={secured,footnote}`
- `Checklist/Row` — `status={pass,fail,pending}`
- `Progress/Segmented` — `segments={1,2}` × `progress={0,25,50,75,100}`
- `Progress/Halo` — `accent={cool,warm}`
- `Orb/Processing` — `phase={swirl,accelerate}`
- `Mesh/SoulParticle` — `stability={scattered,partial,crystallized}`
- `Panel/Success` · `Meter/Maturity` (`stage={initial,developing,established}`)
- `Background/Cosmic` — `mode={deepNebula,dim,captureWarm,processing,faint}`
- `Card/RetryReason` — `reason={lowLight,movement,noFace,lostLock,timeout}`

**Token pages:** styles for every `color.*`, text style per `text.*`, effect styles per `glow.*`/`shadow.*`, plus a Motion spec board (duration/easing chips).

**Prototype links:** Intro→Permission(overlay)→Environment→FaceLock(auto)→Capture-Neutral(auto)→Capture-Motion(auto)→Processing(auto, delay)→Confirmed; failure branches → Retry → (Try again→FaceLock) / (Restart→Intro); Cancel → discard sheet → exit.

**Annotation layers:** redline spacing, token names per element, motion callouts (trigger/duration/easing), state notes, compliance-copy notes.

---

## TASK 10 — Implementation checklist

**Build order**
1. Tokens + `types/` + `CosmicBackground` + `NavBar`.
2. Shared UI: `GlowPrimaryButton`, `GhostButton`, `BaselineHeroCopy`, privacy/trust cues, `TimeCostChip`.
3. Zustand store + selectors + state machine + `useFaceBaselineMachine`.
4. Intro + Environment (mock checks) + Confirmed + Retry (no camera yet).
5. `FaceScanFrame` (all shapes/states) + `ProgressHalo`.
6. Capture screens with **mocked** quality/landmark streams.
7. `ProcessingOrb` + `PercentCounter` + processing screen (mock compute).
8. Wire real `useCameraPermission`, `useFaceDetector`, `useEnvironmentChecks`, `useQualityMetrics`.
9. `SoulParticleMesh` real landmark mapping; haptics; reduced-motion; analytics.

**Dependencies:** `react-native-vision-camera` + frame processor / MLKit face detection, `@shopify/react-native-skia`, `react-native-reanimated@3`, `expo-haptics`, `zustand`, `xstate`(optional), existing `packages/shared` tokens + `packages/engine` baseline (Welford bootstrap) + `compliance` copy layer.

**Mock first:** quality metrics stream, face landmarks, env checks, processing compute, baseline confidence.
**Must be real before ship:** camera permission, on-device face detection, baseline write to local store, local-only data handling, compliance copy, haptics, reduced-motion.

**QA**
- [ ] Every state's success/failure/timeout/back-out reachable.
- [ ] Progress pauses (never resets) on quality drop.
- [ ] Motion retry keeps neutral capture.
- [ ] Permission denied/blocked → Settings path.
- [ ] Processing honors min-ritual 1.8s.
- [ ] No crash on lost-lock mid-capture.

**Visual QA vs references**
- [ ] Intro matches nebula + hero + blue→violet capsule + 60s chip.
- [ ] Environment uses dark cosmic frame (not light), square brackets, 3 status pills, disabled→enabled Start Scan.
- [ ] Capture shows gold soul mesh inside circular halo + PRIVACY SECURED pill + segmented progress.
- [ ] Processing shows gold orbital orb + status + large % + local footnote.
- [ ] Glow reserved for focal subject + primary CTA only; UI chrome flat.

**Accessibility**
- [ ] Reduced-motion fallbacks for all animated components.
- [ ] All text ≥ WCAG AA on dark bg.
- [ ] VoiceOver labels for frame state, checks, progress %, CTA.
- [ ] Haptics toggleable; not sole feedback channel.
- [ ] Dynamic Type tolerant hero/body.

**Compliance**
- [ ] No medical/diagnosis wording; no "emotion recognition"; no dopamine/measurement claims.
- [ ] Copy = baseline / privacy / precision / calibration / readiness / return to baseline.
- [ ] Camera purpose string + on-device + local-only messaging.
- [ ] All user-facing strings routed through `packages/engine` compliance layer.
- [ ] Raw biometric never leaves device (CLAUDE.md hard rule).

---

## TASK 11 — Guardrails (must NOT happen)

- ❌ Flatten the cosmic look into generic dark UI — nebula + stardust are the brand.
- ❌ Replace the glowing blue→violet capsule CTA with a stock button.
- ❌ Remove or bury privacy/lock reassurance copy.
- ❌ Turn capture into a cluttered dashboard — one focal subject, one instruction.
- ❌ Show multiple quality nudges at once — exactly one active status.
- ❌ Over-explain — hero + ≤2 lines body, never paragraphs on capture screens.
- ❌ Reset progress on a transient quality dip — pause only.
- ❌ Use gold as a general accent — gold = capture + processing only.
- ❌ Keep the Environment screen light/flat — it joins the dark frame.
- ❌ Use SVG rings or legacy `Animated` — Skia + Reanimated 3 only.
- ❌ Use `any`, Redux, or batch multiple todos into one commit.
- ❌ Any medical/financial/emotion-recognition framing.
- ❌ Upload raw biometric data to cloud.
- ❌ Skip reduced-motion fallbacks.
- ❌ Break the Apple-like calm with bouncy/loud motion or hard neon.

---

## TASK 12 — Delivery summary

1. **Design language:** dark-first cosmic wellness; cool blue→violet = system/readiness, aurora gold = the brief living-capture ritual; bold centered hero type; glowing capsule CTA; precision Face-ID frame (square=align, circle=capture); restrained flat chrome; glow only on subject + CTA; relentless privacy/local trust cues.
2. **Canonical flow:** Intro → Environment → FaceLock → Capture-Neutral → Capture-Motion → Processing → Confirmed (+ Retry), each fully specified above.
3. **Folder structure:** `apps/mobile/features/face-baseline/` (screens/components/hooks/store/machine/utils/tokens/types) — Task 3.
4. **Component list:** 30+ components, reusable UI separated from flow logic — Task 4.
5. **Zustand store:** typed state + actions + selectors — Task 5.
6. **State machine:** 11 states with entry/success/failure/timeout/back-out/partial-retry — Task 6.
7. **Token system:** `faceBaseline.tokens.ts` (color/text/spacing/radius/shadow/glow/motion/stroke/overlay) — Task 7.
8. **Animation/haptics:** 19 motion+haptic moments with reduced-motion fallbacks — Task 8.
9. **Figma structure:** 7 pages, 8 flow frames, 14 component sets w/ variants — Task 9.
10. **Implementation checklist:** build order, deps, mock-vs-real, QA/visual/a11y/compliance — Task 10.
11. **Guardrails:** non-negotiables — Task 11.
```
