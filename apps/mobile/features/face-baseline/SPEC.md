# TENKI — Face Baseline System · Production Design & Implementation Spec (v2)

> Source of truth: **9 reference frames** — Intro · Processing · Environment · Capture · Maturity · Why-Baseline · Secure-Access · Recovery · Success.
> Scope: the **full** Face Baseline product — onboarding **and** ongoing baseline-maturity growth.
> Feel: Face ID precision · premium futuristic wellness · dark-first · cosmic stardust soul · high trust · Apple-calm but uniquely TENKI.
> Compliance: no medical/diagnosis · no "emotion recognition" · no dopamine claims. Public language = **baseline, calibration, privacy, precision, readiness, resonance, return to baseline, model refinement**.

---

## 0. The unifying law (read first)

The 9 references show **two adjacent visual sub-systems**. They are **one product**, governed by a single rule:

| Accent | Meaning | Used for |
|--------|---------|----------|
| **Cyan / electric blue** `#3DE0FF → #4DA6FF → #7B61FF` | **ACTIVE** — aligning, guiding, calibrating *right now* | scan reticle, environment checks, guidance, educational glyphs, **pre-baseline action CTAs** (Begin Calibration, Enable Camera, Try Again, Start Scan) |
| **Aurora gold** `#E8B45A → #FFD27A → #FFE9B0` | **SECURED** — your resonance formed, owned, trusted, maturing | capture mesh, processing/securing orb, trust shield, success card, maturity orb, insight cards, **post-secured CTAs** (Enter TENKI, Start Daily Scan) |

**The narrative:** cyan is the machine *helping you align*; gold is *your resonance being formed, secured, and grown*. The CTA's color tells the user which world they're acting from — **before** a baseline exists you act in cyan (you're calibrating); **after** it's secured you act in gold (you own it). This is the spine — protect it.

**Both worlds share one frame:** deep-space `#05060A` + violet nebula, one type ramp, one radius set, one glass language, one glow language.

### What is non-negotiable to preserve
Dark cosmic atmosphere + stardust · resonance-waveform brand glyph · the cyan↔gold meaning split · glass cards (cyan-edge educational / gold-edge trust) · glowing capsule CTAs · Face-ID-precision scan frame · relentless privacy/local-only cues · the gold resonance orb (processing & maturity).

### What must be normalized into one system
Environment screen (was light in early refs) → dark cosmic · one type ramp/radius/glow/glass token set across onboarding **and** post-baseline · ProcessingOrb vs ResonanceOrb share one geometry family · two CTA accents follow the active/secured law (not arbitrary) · consistent card padding/border/blur.

### What to improve for production
Single-instruction capture (one status at a time) · progress that pauses never resets · partial recapture (motion-only) · reduced-motion fallbacks · compliance-routed copy · maturity that reads as a living ritual, not a dashboard.

---

## TASK 1 — Reverse-engineered grammar (all 9)

- **Color:** bg `#05060A`–`#0A0B12` deep space + violet nebula `#1A1140` + starfield; circuit-trace overlay on Maturity. Cyan ramp for active, gold ramp for secured. Status: mint `#46E0B0`, amber `#FFC24B`, coral `#FF6B6B`. Text `#F4F6FF` / `#A6ADC8` / `#5A6178`.
- **Glow logic:** layered soft bloom + faint inner stroke, never hard neon. Reserved for the focal subject (glyph / orb / frame / shield) + the primary CTA. Chrome stays flat.
- **Typography:** wordmark `TENKI` (letterspaced, 13/600, top-center). Hero 28–34/700 centered. Card title 20/600. Body 15/22/400 secondary. Metric 48–52/300 tabular. Pill/label 13/600. Caption 11/15.
- **Card treatment (GlassInfoCard):** frosted dark glass, radius 24, 1px border (cyan `rgba(120,200,255,.35)` educational / gold `rgba(232,180,90,.45)` trust), inner top highlight, soft drop shadow, 20–24 padding.
- **Buttons:** primary = capsule 56h, gradient fill (**cyan→violet** active / **gold** secured), soft outer glow, press-scale 0.97; disabled 30% no glow; secondary = ghost/text (cyan link).
- **Scan frame:** cyan corner-bracket reticle + face outline over (blurred) preview = aligning; circular halo = capturing.
- **Processing viz:** gold sphere with orbiting light rings (Processing) and a geometric-core resonance sphere (Maturity) — same orb family, different core.
- **Trust/privacy signaling:** gold shield emblem · numbered privacy list (On-Device / Calibration-only / No photos saved) · `PRIVACY SECURED` pill · "processed & stored locally" footnote · "Learn more about our privacy" link.
- **Educational page:** wordmark + title + glass card holding a glyph + heading + paragraph + page dots + `Next`. Calm, one idea per page.
- **Success page:** gold-edge glass card + checkmark + reassurance + gold `Enter TENKI`, full gold vignette.
- **Maturity page:** circuit bg + ResonanceOrb + 4-stage bar (New/Building/Ready/Mature) + `x/5 scans` + gold Technical-Insight card + Daily Scan History rows + gold `Start Daily Scan`.
- **Error/retry page:** NOT an error wall — cyan scan frame + supportive "Finding your rhythm" + fix checklist + cyan `Try Again` + `Need help?`.
- **Gold appears:** shield, success, maturity orb/bar, insight cards, secured CTAs, capture mesh, processing orb. **Cyan appears:** reticle, env checks, resonance glyph, recovery frame, pre-baseline CTAs, privacy links.
- **Consistent:** centered single-column · glass cards · capsule CTAs · wordmark · privacy cues · glow-on-subject. **Inconsistent (to unify):** light vs dark env · gold vs cyan with no rule · two orb styles · title placement/casing · two progress idioms.

---

## TASK 2 — Canonical system (11 screens)

Shared chrome: `CosmicBackground(mode)` · optional `TENKI` wordmark · top nav (Back left / Cancel right) · bottom safe-area CTA dock · inline disclaimer on scan screens.

1. **EstablishBaselineIntroScreen** — *entry.* Nebula, hero "Establish Your Baseline", privacy body, `⏱ 60 Seconds` chip, **cyan** CTA `Begin Calibration`, `Why does this matter?` link → Why carousel. Blocked-permission → CTA `Open Settings`.
2. **WhyBaselineMattersCarouselScreen** — *education, optional/skippable.* Wordmark + "Why Baseline Matters" + `GlassInfoCard` (cyan resonance glyph + "Personal Resonance" + paragraph) + page dots (3) + ghost `Next`/`Get started`. Swipe or Next. One idea/page; never crowd.
3. **SecureAccessRequiredScreen** — *permission rationale, before OS prompt.* Wordmark + **gold shield** + "Secure Access Required" + `PrivacyAssuranceList` (1 On-Device · 2 Calibration-only · 3 No photos saved) + **cyan** CTA `Enable Camera` + cyan `Learn more about our privacy`. Denied → rationale persists w/ `Open Settings`.
4. **EnvironmentCalibrationScreen** — *readiness.* Dim nebula + **square cyan reticle** + preview + `EnvironmentChecklist` (Lighting/Distance/Stability mint✓/coral✗) + guidance + **cyan** `Start Scan` (disabled until all pass).
5. **FaceLockPreparationScreen** — *acquire & lock.* Tracking reticle → `FaceLockBadge` snap; single instruction; no CTA, auto-advance on stable lock. Handles no/multiple/lost face + 15s timeout → Recovery.
6. **BaselineCaptureNeutralScreen** — *neutral capture (gold).* Circular halo + `SoulParticleMesh` (gold) + `ProgressHalo` + segmented bar + `PRIVACY SECURED` pill + "Hold steady for neutral capture". Quality drop → scatter + one status pill + progress **pauses**.
7. **BaselineCaptureMotionScreen** — *micro-motion calibration (gold).* Same warm frame + `MotionGuideCue` (gentle head-turn) + segment 2/2. Framed as calibration, never emotion. Retry **this phase only**.
8. **ProcessingBaselineScreen** — *securing ritual (gold).* `ProcessingOrb` swirl + "Securing your unique baseline…" + large `%` + local-only footnote. Min 1.8s ritual; error → Recovery/Retry.
9. **FaceDetectionRecoveryScreen** — *graceful recovery (cyan).* Cyan scan frame over preview + "Finding your rhythm" + fix checklist (lighting / glasses-masks / centered) + **cyan** `Try Again` (resumes nearest phase) + `Need help?`. Supportive, never blaming.
10. **BaselineEstablishedScreen** — *success (gold).* Gold vignette + gold-edge `BaselineSuccessCard` (checkmark + "Baseline Established" + secured/encrypted/resonance copy) + **gold** `Enter TENKI`. Success haptic + checkmark bloom.
11. **BaselineMaturityProgressScreen** — *ongoing growth (cyan+gold).* Circuit bg + `ResonanceOrb` + `MaturityProgressBar` (New/Building/Ready/Mature) + `x/5 scans` + gold `TechnicalInsightCard` + `ScanHistoryRow` list + **gold** `Start Daily Scan`. The reusable post-baseline home for the feature.

Each screen's empty/loading/error states are tabulated in the state machine (Task 6).

---

## TASK 3 — User journey

| Step | User goal | System goal | Trust mechanism | Friction risk | Emotional state |
|------|-----------|-------------|-----------------|---------------|-----------------|
| Intro | Understand what's about to happen | Set expectation, get buy-in | 60s time-cost chip, "encrypted, on-device" | "another setup" fatigue | curious, cautious |
| Why-Baseline | Understand *why* it matters | Justify the ask | resonance metaphor, privacy line | too much reading | reassured, intrigued |
| Secure-Access | Decide to grant camera | Earn permission *before* OS prompt | gold shield, 3 privacy guarantees | permission anxiety | guarded → willing |
| Environment | Get conditions right | Maximize capture quality | live checks = transparency | failing a check feels like blame | focused |
| Face-Lock | Be recognized | Acquire stable lock | Face-ID-style snap + haptic | lock not catching | anticipation |
| Capture (neutral/motion) | Hold still / follow cue | Collect clean signal | one calm instruction, privacy pill | boredom, motion anxiety | calm, immersed |
| Processing | Wait, trust it's safe | Compute + write locally | "securing… stored locally" | impatience | reverent wait |
| Recovery | Fix and continue | Re-acquire without restart | supportive copy, partial retry | feeling of failure | recover, not defeated |
| Success | Feel it worked | Confirm + hand off | gold secured card, encrypted copy | anticlimax | accomplished, proud |
| Maturity | See it improving | Drive daily return | resonance orb growth, insights | dashboard fatigue | invested, returning |

Trust arc: **expectation → rationale → guarantee → transparency → precision → care → celebration → growth.**

---

## TASK 4 — React Native / Expo screen tree

```
apps/mobile/features/face-baseline/
├─ FaceBaselineNavigator.tsx          # stack + transitions + guards
├─ index.ts · SPEC.md
├─ screens/
│  ├─ onboarding/                     # one-time
│  │  ├─ EstablishBaselineIntroScreen.tsx
│  │  ├─ WhyBaselineMattersCarouselScreen.tsx
│  │  ├─ SecureAccessRequiredScreen.tsx
│  │  ├─ EnvironmentCalibrationScreen.tsx
│  │  ├─ FaceLockPreparationScreen.tsx
│  │  ├─ BaselineCaptureNeutralScreen.tsx
│  │  ├─ BaselineCaptureMotionScreen.tsx
│  │  ├─ ProcessingBaselineScreen.tsx
│  │  ├─ FaceDetectionRecoveryScreen.tsx
│  │  └─ BaselineEstablishedScreen.tsx
│  └─ ongoing/                        # reusable post-baseline
│     └─ BaselineMaturityProgressScreen.tsx
├─ components/
│  ├─ background/  CosmicBackground · StarfieldLayer · CircuitTraceLayer
│  ├─ glass/       GlassInfoCard · GlassCardBorder
│  ├─ frame/       FaceScanFrame · CornerBrackets · FaceLockBadge · ProgressHalo
│  ├─ capture/     SoulParticleMesh · MotionGuideCue · CaptureInstruction · QualityStatusPills · SegmentedProgress
│  ├─ processing/  ProcessingOrb · PercentCounter
│  ├─ resonance/   ResonanceWaveGlyph · ResonanceOrb
│  ├─ education/   WhyBaselineCarousel · CarouselDots
│  ├─ permission/  TrustShield · PrivacyAssuranceList
│  ├─ env/         EnvironmentChecklist · ChecklistRow
│  ├─ recovery/    RecoveryHelpPanel · RecoveryChecklist
│  ├─ success/     BaselineSuccessCard
│  ├─ maturity/    MaturityProgressBar · ScanHistoryRow · TechnicalInsightCard
│  └─ shared/      GlowPrimaryButton · GhostButton · BaselineHeroCopy · BrandWordmark · PrivacyLockPill · TimeCostChip · PrivacyFootnote · NavBar
├─ hooks/   useFaceBaselineMachine · useCameraPermission · useFaceDetector · useEnvironmentChecks · useQualityMetrics · useBaselineMaturity · useReducedMotion · useBaselineHaptics
├─ store/   faceBaselineStore.ts · maturityStore.ts · selectors.ts
├─ machine/ faceBaselineMachine.ts · transitions.ts
├─ animations/ glowPulse.ts · lockSnap.ts · particleStabilize.ts · orbSwirl.ts · haloSweep.ts · carouselSpring.ts · maturityFill.ts
├─ tokens/  faceBaseline.tokens.ts
├─ utils/   qualityThresholds · retryReason · progress · confidence · maturityStage
└─ types/   faceBaseline.types.ts · index.ts
```
`screens/onboarding/` runs once; `screens/ongoing/` + `components/maturity` + `components/resonance` are the durable post-baseline surface reused by daily scan.

---

## TASK 5 — Component architecture

> TS strict, no `any`. Skia (nebula, glyphs, orbs, particles, halos). Reanimated 3. Tokens from `faceBaseline.tokens.ts`. All animated comps honor `useReducedMotion()`.

| Component | Responsibility | Key props | Variants/States | Animation | Reuse |
|-----------|----------------|-----------|-----------------|-----------|-------|
| **CosmicBackground** | world mood per screen | `mode: deepNebula\|dim\|captureWarm\|processing\|circuit\|success\|faint` | per mode | slow star drift, 600ms cross-fade | ✅ app-wide |
| **CircuitTraceLayer** | maturity-page tech traces | `intensity` | static/animated | faint trace shimmer | ✅ tech surfaces |
| **GlassInfoCard** | frosted content card | `edge: cyan\|gold`, `title`, `children` | educational / trust / insight | mount fade+rise | ✅ everywhere |
| **GlowPrimaryButton** | signature capsule CTA | `label`, `accent: cyan\|gold`, `disabled`, `loading`, `glow` | idle/pressed/disabled/loading | breathing glow, press 0.97 | ✅ all CTAs |
| **GhostButton** | secondary/text | `variant: ghost\|text`, `tone` | — | opacity press | ✅ |
| **BrandWordmark** | `TENKI` top wordmark | `align` | — | fade-in | ✅ |
| **BaselineHeroCopy** | hero title + body | `title`, `body`, `emphasis` | title-only/with-body | staggered rise | ✅ |
| **ResonanceWaveGlyph** | cyan interlaced-wave brand motif | `size`, `animated` | static/animated | slow phase oscillation | ✅ brand |
| **WhyBaselineCarousel** + **CarouselDots** | swipeable educational pages | `pages[]`, `index` | per page | spring page slide, dot morph | ⚠️ onboarding |
| **TrustShield** | gold permission emblem | `state: idle\|granted` | idle/granted | glow breath, grant pulse | ✅ trust moments |
| **PrivacyAssuranceList** | numbered privacy guarantees | `items[]` | — | stagger in | ✅ paywall/settings |
| **EnvironmentChecklist** + **ChecklistRow** | live pass/fail checks | `checks[]` / `status` | pass/fail/pending | flip micro-bounce, fail shake | ✅ daily readiness |
| **FaceScanFrame** + **CornerBrackets** + **FaceLockBadge** | precision frame morph | `shape: square\|halo`, `state: idle\|tracking\|locked\|capturing` | 4 states | bracket track, lock snap+bloom | ✅ daily scan |
| **SoulParticleMesh** | gold stardust on face | `landmarks`, `stability`, `phase`, `paused` | scattered↔crystallized | converge/scatter, additive bloom | ✅ daily scan signature |
| **MotionGuideCue** | head-turn cue | `direction`, `progress` | left/right/blink | arc sweep loop | ⚠️ flow |
| **CaptureInstruction** | single dominant instruction | `text`, `tone` | — | cross-fade on change | ✅ |
| **QualityStatusPills** | exactly ONE active nudge | `status`, `visible` | good/movement/lowLight/reframe | slide-fade | ✅ |
| **SegmentedProgress** | 2-segment capture bar | `progress`, `segments`, `paused` | filling/paused | spring fill | ✅ |
| **ProgressHalo** | sweeping arc around subject | `progress`, `accent`, `breathing` | cyan/gold | arc sweep + bloom | ✅ |
| **ProcessingOrb** + **PercentCounter** | securing ritual | `progress`, `intensity` | swirl→accelerate | 3-axis orbit, count-up | ✅ |
| **RecoveryHelpPanel** + **RecoveryChecklist** | supportive retry | `reason`, `onTryAgain`, `onHelp` | per reason | gentle rise, emphasis pulse | ⚠️ flow |
| **BaselineSuccessCard** | gold secured confirmation | `title`, `body`, `onEnter` | — | checkmark draw + bloom | ✅ completion |
| **ResonanceOrb** | maturity living-orb | `stage`, `progress` | New/Building/Ready/Mature | core spin, gold accrual per stage | ✅ daily home |
| **MaturityProgressBar** | 4-stage segmented | `stage`, `scansCompleted`, `scansRequired` | per stage | stage-fill spring | ✅ |
| **ScanHistoryRow** | history line | `time`, `label`, `type: updated\|refined` | — | row fade-in | ✅ |
| **TechnicalInsightCard** | gold insight card | `text` | — | mount rise | ✅ |
| **PrivacyLockPill / PrivacyFootnote / TimeCostChip** | trust cues | text/seconds | — | fade | ✅ |

---

## TASK 6 — State machine

States: `intro · why_baseline · permission_rationale · permission_prompt · permission_denied · environment_check · face_detecting · face_locked · neutral_capture · motion_capture · processing · success · retry_needed · maturity_progress · exit`.

```ts
// machine/faceBaselineMachine.ts (XState v5 shape, abbreviated)
createMachine({
  id: 'faceBaseline', initial: 'intro',
  states: {
    intro:               { on: { BEGIN: 'permission_rationale', WHY: 'why_baseline', EXIT: 'exit' } },
    why_baseline:        { on: { DONE: 'permission_rationale', BACK: 'intro' } },
    permission_rationale:{ on: { ENABLE: 'permission_prompt', LEARN: 'why_baseline', BACK: 'intro' } },
    permission_prompt:   { on: { GRANTED: 'environment_check', DENIED: 'permission_denied' } },
    permission_denied:   { on: { RETRY: 'permission_prompt', SETTINGS: 'permission_denied', EXIT: 'exit' } },
    environment_check:   { on: { ALL_PASS: 'face_detecting', CANCEL: 'exit' } },
    face_detecting:      { on: { LOCKED: 'face_locked', TIMEOUT: 'retry_needed', CANCEL: 'exit' } },
    face_locked:         { on: { STABLE: 'neutral_capture', LOST: 'face_detecting' } },
    neutral_capture:     { on: { NEUTRAL_DONE: 'motion_capture', QUALITY_FAIL: 'retry_needed', LOST: 'face_detecting', CANCEL: 'exit' } },
    motion_capture:      { on: { MOTION_DONE: 'processing', QUALITY_FAIL: 'retry_needed', LOST: 'face_detecting', CANCEL: 'exit' } },
    processing:          { on: { COMPUTED: 'success', COMPUTE_ERROR: 'retry_needed' } },
    success:             { on: { ENTER: 'maturity_progress' } },
    retry_needed:        { on: { RESUME: 'face_detecting', RESTART: 'intro', HELP: 'retry_needed', EXIT: 'exit' } },
    maturity_progress:   { on: { START_SCAN: 'face_detecting', LEAVE: 'exit' } }, // re-entrant daily home
    exit:                { type: 'final' },
  },
});
```

| State | Entry | UI mode | Success → | Failure → | Retry | Timeout | Back |
|-------|-------|---------|-----------|-----------|-------|---------|------|
| intro | flow opened | Intro | BEGIN | — | — | — | exit |
| why_baseline | Why tapped | Carousel | last page DONE | — | — | — | intro |
| permission_rationale | BEGIN/ENABLE | Secure-Access | ENABLE | — | — | — | intro |
| permission_prompt | Enable | OS sheet | GRANTED | DENIED | re-prompt | — | rationale |
| permission_denied | denied | rationale + Settings | re-grant | — | RETRY/SETTINGS | — | exit |
| environment_check | granted | Environment | all pass | hold until pass | recheck failing only | — | exit (Cancel) |
| face_detecting | env ready | Face-Lock prep | LOCKED | re-hint | re-detect | 15s → retry(noFace) | environment |
| face_locked | locked | lock badge | STABLE ~600ms | LOST → detecting | re-lock | — | environment |
| neutral_capture | stable | Capture-Neutral | progress=1 | quality fail → retry | resume **keep %** | pause (no reset) | discard sheet |
| motion_capture | neutral done | Capture-Motion | progress=1 | quality fail → retry | resume **motion only** | pause | discard sheet |
| processing | motion done | Processing orb | COMPUTED | error → retry | restart processing | min 1.8s ritual | block (or discard) |
| success | baseline written | Success card | ENTER | — | — | — | done |
| retry_needed | any failure | Recovery | RESUME nearest | — | partial recapture | — | RESTART → intro |
| maturity_progress | success/daily | Maturity | START_SCAN | — | — | — | leave |
| exit | cancel/deny | — | — | — | — | — | — |

**Partial recapture:** neutral data held in store until processing succeeds → motion retries never re-capture neutral; Recovery `Try Again` resumes the **nearest failed phase**, not the whole flow.
**After failed lock:** → `face_detecting` (re-hint), or after timeout → `retry_needed` with supportive Recovery (never a hard error).
**After success:** baseline written locally → `maturity_progress` becomes the re-entrant home.
**Maturity evolution:** `scansCompleted` increments per daily scan → `maturityStage` advances New→Building→Ready→Mature via thresholds (Task 7 `maturityStage()`), `baselineConfidence` rises asymptotically (Welford in `packages/engine`).

---

## TASK 7 — Zustand store

```ts
// store/faceBaselineStore.ts
import { create } from 'zustand';

export type FlowStep =
  | 'intro' | 'why_baseline' | 'permission_rationale' | 'permission_prompt' | 'permission_denied'
  | 'environment_check' | 'face_detecting' | 'face_locked'
  | 'neutral_capture' | 'motion_capture' | 'processing'
  | 'success' | 'retry_needed' | 'maturity_progress' | 'exit';

export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked';
export type FaceLockState = 'searching' | 'tracking' | 'locked' | 'lost';
export type CapturePhase = 'idle' | 'neutral' | 'motion' | 'done';
export type ProcessingStatus = 'idle' | 'running' | 'success' | 'error';
export type MaturityStage = 'new' | 'building' | 'ready' | 'mature';
export type RetryReason =
  | 'lowLight' | 'tooClose' | 'tooFar' | 'movement'
  | 'noFace' | 'multipleFaces' | 'glasses' | 'lostLock' | 'timeout' | 'computeError';

export interface EnvironmentChecks { lighting: boolean; distance: boolean; stability: boolean; }
export interface QualityMetrics { sqi: number; motion: number; coverage: number; brightness: number; }
export interface RefinementEntry { at: number; label: string; type: 'updated' | 'refined'; }

export interface FaceBaselineState {
  step: FlowStep;
  permission: PermissionState;
  env: EnvironmentChecks; envReady: boolean;
  faceLock: FaceLockState;
  capturePhase: CapturePhase;
  quality: QualityMetrics;
  neutralProgress: number; motionProgress: number;
  processingStatus: ProcessingStatus; processingProgress: number;
  retryReason: RetryReason | null;
  baselineConfidence: number;          // 0–1
  baselineEstablished: boolean;
  baselineMaturity: MaturityStage;
  scanCount: number;                   // scans completed toward maturity
  scansRequired: number;               // per current stage (e.g. 5)
  refinementHistory: RefinementEntry[];
  startedAt: number | null;
  reducedMotion: boolean;

  // actions
  goTo: (s: FlowStep) => void;
  setPermission: (p: PermissionState) => void;
  updateEnv: (patch: Partial<EnvironmentChecks>) => void;
  setFaceLock: (s: FaceLockState) => void;
  setCapturePhase: (p: CapturePhase) => void;
  updateQuality: (q: Partial<QualityMetrics>) => void;
  setNeutralProgress: (v: number) => void;
  setMotionProgress: (v: number) => void;
  setProcessing: (status: ProcessingStatus, progress?: number) => void;
  setRetry: (r: RetryReason) => void; clearRetry: () => void;
  establishBaseline: (confidence: number) => void;
  recordScan: (entry: RefinementEntry) => void;
  reset: () => void;
}

const QUALITY_OK = { sqi: 0.7, motion: 0.35, coverage: 0.8, brightness: 0.45 } as const;
const STAGE_THRESHOLDS = { new: 0, building: 1, ready: 5, mature: 15 } as const;

export const maturityStage = (scans: number): MaturityStage =>
  scans >= STAGE_THRESHOLDS.mature ? 'mature'
  : scans >= STAGE_THRESHOLDS.ready ? 'ready'
  : scans >= STAGE_THRESHOLDS.building ? 'building' : 'new';

const initialState = {
  step: 'intro' as FlowStep, permission: 'unknown' as PermissionState,
  env: { lighting: false, distance: false, stability: false }, envReady: false,
  faceLock: 'searching' as FaceLockState, capturePhase: 'idle' as CapturePhase,
  quality: { sqi: 0, motion: 1, coverage: 0, brightness: 0 },
  neutralProgress: 0, motionProgress: 0,
  processingStatus: 'idle' as ProcessingStatus, processingProgress: 0,
  retryReason: null as RetryReason | null,
  baselineConfidence: 0, baselineEstablished: false,
  baselineMaturity: 'new' as MaturityStage, scanCount: 0, scansRequired: 5,
  refinementHistory: [] as RefinementEntry[],
  startedAt: null as number | null, reducedMotion: false,
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
  setRetry: (retryReason) => set({ retryReason, step: 'retry_needed' }),
  clearRetry: () => set({ retryReason: null }),
  establishBaseline: (baselineConfidence) =>
    set({ baselineConfidence, baselineEstablished: true, processingStatus: 'success', step: 'success' }),
  recordScan: (entry) => set((s) => {
    const scanCount = s.scanCount + 1;
    return { scanCount, baselineMaturity: maturityStage(scanCount),
      refinementHistory: [entry, ...s.refinementHistory].slice(0, 20) };
  }),
  reset: () => set({ ...initialState }),
}));

// selectors.ts
export const selectQualityOk = (s: FaceBaselineState) =>
  s.quality.sqi >= QUALITY_OK.sqi && s.quality.motion <= QUALITY_OK.motion &&
  s.quality.coverage >= QUALITY_OK.coverage && s.quality.brightness >= QUALITY_OK.brightness;
export const selectTotalProgress = (s: FaceBaselineState) =>
  s.step === 'processing' ? s.processingProgress : s.neutralProgress * 0.6 + s.motionProgress * 0.4;
export const selectCanStartScan = (s: FaceBaselineState) => s.permission === 'granted' && s.envReady;
export const selectActiveQualityStatus = (s: FaceBaselineState):
  'good' | 'movement' | 'lowLight' | 'reframe' =>
  s.quality.motion > QUALITY_OK.motion ? 'movement'
  : s.quality.brightness < QUALITY_OK.brightness ? 'lowLight'
  : s.quality.coverage < QUALITY_OK.coverage ? 'reframe' : 'good';
export const selectMaturityRatio = (s: FaceBaselineState) =>
  Math.min(1, s.scanCount / Math.max(1, s.scansRequired));
```

---

## TASK 8 — Design tokens

```ts
// tokens/faceBaseline.tokens.ts — extends packages/shared TENKI_THEME
export const faceBaselineTokens = {
  color: {
    bg: { deepSpace: '#05060A', nebulaTop: '#1A1140', nebulaBottom: '#0A0B12',
          dim: '#070811', processing: '#08060B', successVignette: '#100A04' },
    surface: { glass: 'rgba(16,20,34,0.62)', glassBlue: 'rgba(20,40,70,0.55)',
               glassGold: 'rgba(40,30,10,0.5)' },
    accent: { cyanGlow: '#3DE0FF', electricBlue: '#4DA6FF', indigo: '#6E8BFF', violet: '#7B61FF',
              goldResonance: '#E8B45A', goldSoft: '#FFD27A', goldHi: '#FFE9B0', goldBloom: '#FF9D2F' },
    status: { pass: '#46E0B0', caution: '#FFC24B', fail: '#FF6B6B' },
    text: { primary: '#F4F6FF', secondary: '#A6ADC8', tertiary: '#5A6178', onGlow: '#0A0B12' },
    trust: { pillBg: 'rgba(180,210,255,0.14)', pillText: '#BFD8FF' },
    frame: { idle: 'rgba(180,200,255,0.35)', tracking: '#3DE0FF', locked: '#46E0B0', capture: '#FFD27A' },
    border: { glassCyan: 'rgba(120,200,255,0.35)', glassGold: 'rgba(232,180,90,0.45)',
              hairline: 'rgba(255,255,255,0.08)' },
  },
  text: {
    wordmark: { size: 13, weight: '600', tracking: 3 },
    hero:     { size: 30, lineHeight: 36, weight: '700', tracking: -0.4 },
    cardTitle:{ size: 20, lineHeight: 26, weight: '600' },
    title:    { size: 17, lineHeight: 22, weight: '600' },
    body:     { size: 15, lineHeight: 22, weight: '400' },
    metric:   { size: 50, lineHeight: 54, weight: '300', variant: 'tabular-nums' },
    pill:     { size: 13, lineHeight: 16, weight: '600' },
    caption:  { size: 11, lineHeight: 15, weight: '400' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 24, cardPad: 22, ctaDock: 24 },
  radius: { pill: 9999, card: { md: 16, xl: 24 }, scanFrame: { lg: 28 }, halo: 9999, badge: 14 },
  stroke: { hairline: 1, reticle: 2, halo: 4, progressBar: 3, ringArc: 6, glassBorder: 1 },
  shadow: {
    card:       { color: '#000000', opacity: 0.45, radius: 18, y: 10 },
    ctaCyan:    { color: '#3DE0FF', opacity: 0.32, radius: 24, y: 8 },
    ctaGold:    { color: '#E8B45A', opacity: 0.34, radius: 24, y: 8 },
  },
  glow: {
    cta: { primaryCyan: { color: '#4DA6FF', blur: 24, spread: 0.35 },
           primaryGold: { color: '#E8B45A', blur: 24, spread: 0.35 } },
    glassCyan: { color: '#3DE0FF', blur: 18, spread: 0.25 },
    glassGold: { color: '#E8B45A', blur: 18, spread: 0.28 },
    lockMint:  { color: '#46E0B0', blur: 28, spread: 0.5 },
    haloCyan:  { color: '#3DE0FF', blur: 40, spread: 0.6 },
    soulGold:  { color: '#FFD27A', blur: 36, spread: 0.7 },
    orbGold:   { color: '#FF9D2F', blur: 48, spread: 0.8 },
    shieldGold:{ color: '#E8B45A', blur: 32, spread: 0.6 },
    resonance: { color: '#7FE9D0', blur: 44, spread: 0.7 }, // cyan+gold blend orb
  },
  glass: { blur: 24, bgOpacity: 0.62, borderOpacity: 0.35, innerHighlight: 0.06 },
  progress: { trackOpacity: 0.18, barHeight: 6, segmentGap: 4,
              stageColors: { new: '#5A6178', building: '#3DE0FF', ready: '#7FE9D0', mature: '#E8B45A' } },
  motion: {
    duration: { introFade: 400, ctaGlowIn: 240, ctaBreath: 2400, lockSnap: 320, lockPulse: 360,
                haloSweep: 1200, particleStabilize: 900, processingOrb: 2400, processingMin: 1800,
                carouselPage: 380, percentTick: 800, successPulse: 520, maturityFill: 700,
                screenCrossfade: 600 },
    easing: { standard: 'cubic-bezier(0.4,0,0.2,1)', decelerate: 'cubic-bezier(0,0,0.2,1)',
              snap: 'cubic-bezier(0.2,0.9,0.1,1)', breath: 'cubic-bezier(0.45,0,0.55,1)',
              gentle: 'cubic-bezier(0.33,0,0.2,1)' },
  },
  overlay: { nebulaDim: 0.55, captureVignette: 0.7, scrim: 0.4, disabledCta: 0.3, particleAdditive: 0.85 },
} as const;
```

---

## TASK 9 — Animation + haptics

| Moment | Trigger | Duration | Easing | Haptic | Reduced-motion |
|--------|---------|----------|--------|--------|----------------|
| Hero intro fade | mount | 400 (stagger 80) | decelerate | none | instant fade |
| CTA glow pulse | idle | 2400 loop | breath | none | static glow |
| CTA press | press | 120 | snap | `selection` | scale only |
| Carousel page | swipe/Next | 380 | standard | `selection` on settle | cross-fade, no slide |
| Carousel dot morph | page change | 240 | standard | none | instant |
| Permission accept | granted | 360 | snap | `notificationSuccess` | shield brighten |
| Checklist pass | check true | 240 | snap | `impact-light` | color only |
| Checklist fail | check false | 200 | standard | `warning` | color + one shake |
| Start-scan enable | all pass | 240 | decelerate | `impact-light` | opacity only |
| Face lock snap | stable face | 320 | snap | `impact-medium` | badge appears |
| Scan halo sweep | capturing | 1200 loop | gentle | none | static arc |
| Particle stabilize | quality high | 900 | decelerate | `selection` at full | static mesh |
| Particle scatter | quality drop | 300 | standard | `warning`(soft) | pill only |
| Processing orb swirl | processing | 2400 loop | linear | none | slow pulse |
| Percent tick | progress | 800 | decelerate | none | snap value |
| Orb completion | →100% | 600 | snap | `impact-soft` ramp | brighten |
| Success card reveal | written | 520 | snap | `notificationSuccess` | fade-in |
| Maturity progress fill | scan recorded | 700 | decelerate | `impact-light` | snap fill |
| Resonance orb grow | stage advance | 700 | gentle | `notificationSuccess` | static stage |
| Retry guidance emphasis | recovery shown | 300 | decelerate | `warning` | fade |
| Screen transitions | step change | 600 | standard | none | cross-fade |

Centralized in `useBaselineHaptics()` (expo-haptics), gated by setting + `AccessibilityInfo.isReduceMotionEnabled`.

---

## TASK 10 — Copy system (English, compliance-safe)

**Intro** — Title `Establish Your Baseline` · Sub `A 60-second calibration so TENKI can read you against you — not anyone else.` · Body `Your facial signal is processed on-device and never leaves your phone.` · CTA `Begin Calibration` · Link `Why does this matter?`

**Why Baseline Matters (carousel)**
1. *Personal Resonance* — `Your baseline is a personal reference point. It lets TENKI notice subtle shifts in your patterns over time — accurately, and privately.`
2. *Calibrated to You* — `Every reading is compared to your own baseline, not a population average. That's what makes it meaningful.`
3. *Yours Alone* — `Your baseline lives on this device, encrypted. You can reset or delete it anytime.` · CTA `Get started`

**Secure Access Required** — Title `Secure Access Required` · List: `1. On-Device Processing — Your face data never leaves this phone.` · `2. Baseline Calibration — Used only to calculate your personal resonance.` · `3. Privacy First — No photos or videos are ever saved.` · CTA `Enable Camera` · Link `Learn more about our privacy`

**Permission denied** — `Camera access is off` · `TENKI needs the camera only to calibrate your baseline on-device. You can enable it in Settings.` · CTA `Open Settings` · Link `Not now`

**Environment Calibration** — Title `Let's set the scene` · Body `Find a quiet spot with even lighting.` · Checks `Lighting` / `Distance` / `Stability` · CTA `Start Scan` (disabled hint: `Adjust the items above to continue`)

**Face Lock Preparation** — `Center your face` · `Hold still — aligning…` (→ on lock) `Locked`

**Baseline Capture · Neutral** — `Hold steady for neutral capture` · pill `PRIVACY SECURED` · nudges `Hold still` / `A little more light` / `Center your face`

**Baseline Capture · Motion** — `Slowly turn your head` · sub `Keep it gentle — this sharpens your calibration.`

**Processing** — `Securing your unique baseline…` · footnote `All data is processed and stored locally for maximum privacy.`

**Face Detection Recovery** — Title `Finding your rhythm` · Sub `Make sure your face is clearly visible and centered in the frame.` · Checklist `Check your lighting` / `Remove glasses or masks` / `Stay centered` · CTA `Try Again` · Link `Need help?`

**Baseline Established** — Title `Baseline Established` · Body `Your personal reference is secured and encrypted on-device. Future scans will now be calibrated to your unique resonance.` · CTA `Enter TENKI`

**Baseline Maturity Progress** — Title `Baseline Maturity` · Orb label `Resonance Orb` · Stages `New · Building · Ready · Mature` · Counter `{n}/{required} scans completed` · Insight `Each scan refines your precision model. More data means a more personalized, high-fidelity baseline.` · History `Baseline updated` / `Model refined` · CTA `Start Daily Scan`

Compliance: no diagnosis, no certainty, no emotion-recognition, no dopamine; lexicon = baseline · calibration · privacy · precision · readiness · resonance · return to baseline · model refinement. Route all strings through `packages/engine` compliance layer.

---

## TASK 11 — Figma-ready structure

**Pages:** `00 Cover & Index` · `01 Tokens` · `02 Components` · `03 Onboarding Flow` · `04 Ongoing / Maturity` · `05 States & Edge Cases` · `06 Prototype` · `07 Annotations / Redlines`.

**Frames (390×844):** `FB-01 Intro` · `FB-02 Why-Carousel (×3 pages)` · `FB-03 Secure-Access` · `FB-04 Environment` · `FB-05 FaceLock` · `FB-06 Capture-Neutral` · `FB-07 Capture-Motion` · `FB-08 Processing` · `FB-09 Recovery` · `FB-10 Established` · `FB-11 Maturity`. State variants: `*/denied`, `*/loading`, `*/quality-fail`, `*/disabled-cta`.

**Component sets + variants:** `Button/Primary state×{idle,pressed,disabled,loading} × accent×{cyan,gold}` · `Button/Secondary variant×{ghost,text}` · `Card/Glass edge×{cyan,gold}` · `Frame/FaceScan shape×{square,halo} × state×{idle,tracking,locked,capturing}` · `Glyph/Resonance` · `Orb/Processing phase×{swirl,accelerate}` · `Orb/Resonance stage×{new,building,ready,mature}` · `Mesh/SoulParticle stability×{scattered,partial,crystallized}` · `Checklist/Row status×{pass,fail,pending}` · `Progress/Segmented` · `Progress/Maturity stage×{...}` · `Pill/{Privacy,Status}` · `Shield/Trust state×{idle,granted}` · `Row/ScanHistory type×{updated,refined}` · `Card/Insight` · `Background/Cosmic mode×{deepNebula,dim,captureWarm,processing,circuit,success,faint}`.

**Token pages:** color styles (`color.*`), text styles (`text.*`), effect styles (`glow.*`,`shadow.*`,`glass.*`), motion spec board (duration/easing chips).

**Prototype links:** Intro→(Why→)Secure-Access→OS-prompt(overlay)→Environment→FaceLock(auto)→Capture-Neutral(auto)→Capture-Motion(auto)→Processing(auto delay)→Established→Maturity; failure branches → Recovery → (Try Again→FaceLock)/(Restart→Intro); denied → permission_denied overlay; Cancel → discard sheet.

**Annotation layers:** spacing redlines · token-name callouts · motion notes (trigger/duration/easing) · state notes · compliance-copy notes.

---

## TASK 12 — Implementation checklist

**Build order:** tokens+`CosmicBackground`+`BrandWordmark`+`NavBar` → shared UI (`GlowPrimaryButton` cyan/gold, `GlassInfoCard`, hero, privacy cues) → store+maturityStore+machine → static screens (Intro/Why/Secure/Established/Maturity, mocked) → `FaceScanFrame`+`ProgressHalo`+`ResonanceWaveGlyph` → Environment+Recovery (mock checks) → capture screens (mock streams) → `ProcessingOrb`/`ResonanceOrb`/`PercentCounter` → wire real permission/detector/quality/env → `SoulParticleMesh` real landmarks → haptics/reduced-motion/analytics → maturity persistence.

**Dependencies:** `react-native-vision-camera` (+ MLKit/frame-processor face detection), `@shopify/react-native-skia`, `react-native-reanimated@3`, `expo-haptics`, `expo-blur` (glass), `zustand`, `xstate`(optional), `packages/shared` tokens, `packages/engine` baseline (Welford) + compliance copy, local secure storage (MMKV/Keychain) for baseline + maturity.

**Mock first:** quality stream, landmarks, env checks, processing compute, confidence, maturity history. **Must be real before ship:** camera permission, on-device detection, local baseline + maturity persistence, local-only data handling, compliance copy, haptics, reduced-motion.

**QA:** every state's success/failure/timeout/back reachable · progress pauses never resets · motion retry keeps neutral · denied→Settings path · processing min-ritual 1.8s · maturity stage advances correctly · no crash on lost-lock.
**Visual QA vs refs:** Intro nebula+cyan CTA+60s chip · Why glass card+cyan resonance glyph+dots · Secure gold shield+numbered list+cyan CTA · Environment dark cosmic+square reticle · Capture gold mesh+halo+privacy pill · Processing gold orb+%+footnote · Recovery cyan frame+supportive copy (not error wall) · Established gold card+gold CTA · Maturity circuit bg+resonance orb+4-stage bar+gold insight+history+gold CTA · glow only on subject+CTA · cyan=active / gold=secured everywhere.
**Accessibility:** reduced-motion fallbacks all · text ≥ WCAG AA on dark · VoiceOver labels (frame state, checks, %, stage, CTAs) · haptics toggleable, not sole channel · Dynamic Type tolerant.
**Compliance:** no medical/diagnosis/emotion/dopamine · lexicon enforced · camera purpose string + on-device + local-only · all strings via compliance layer · raw biometric never leaves device.

---

## TASK 13 — Non-negotiable guardrails

- ❌ Flatten the cosmic look into generic dark UI.
- ❌ Split cyan and gold into two products — they are **one** system (cyan=active, gold=secured).
- ❌ Use the wrong CTA accent (action CTA must be cyan; secured CTA must be gold).
- ❌ Replace glow capsule CTAs with default buttons.
- ❌ Remove/bury privacy, trust shield, or local-only signals.
- ❌ Make the Maturity page a generic dashboard — it's a living resonance ritual.
- ❌ Overcrowd educational pages — one idea per carousel card.
- ❌ Let Recovery feel like an error wall — supportive, partial-retry, never blame.
- ❌ Show multiple quality nudges at once — exactly one.
- ❌ Reset progress on a transient quality dip — pause only.
- ❌ Create visual drift between onboarding and post-baseline (same tokens/cards/orbs).
- ❌ Keep Environment light/flat — dark cosmic frame.
- ❌ Use SVG rings or legacy `Animated` — Skia + Reanimated 3.
- ❌ Use `any`, Redux, or batch multiple todos per commit.
- ❌ Any medical/financial/emotion-recognition/dopamine framing.
- ❌ Upload raw biometric to cloud.
- ❌ Skip reduced-motion fallbacks or break the Apple-like calm.

---

## TASK 14 — Delivery summary
1. **Design language:** one dark cosmic system; **cyan=active (scan/setup/guidance) · gold=secured (resonance/success/trust/maturity)**, CTA accent encodes the world; glass cards (cyan-edge educational/gold-edge trust); resonance-wave brand glyph; glow only on subject+CTA; relentless local-privacy trust.
2. **Screen flow:** 11 screens (Intro→Why→Secure→Environment→FaceLock→Capture-Neutral→Capture-Motion→Processing→Recovery↺→Established→Maturity).
3. **User journey:** expectation→rationale→guarantee→transparency→precision→care→celebration→growth (Task 3 table).
4. **Folder structure:** `apps/mobile/features/face-baseline/` split into `screens/onboarding` (one-time) + `screens/ongoing` (durable) + components/hooks/store/machine/animations/tokens/utils/types.
5. **Component list:** ~35 components with props/variants/animation/reuse (Task 5).
6. **Zustand store:** typed state + maturity + actions + selectors (Task 7).
7. **State machine:** 15 states incl. permission_denied, recovery, re-entrant maturity, partial recapture (Task 6).
8. **Token system:** `faceBaseline.tokens.ts` — color/surface/accent(cyan+gold)/text/spacing/radius/stroke/shadow/glow/glass/progress/motion/overlay (Task 8).
9. **Animation/haptics:** 21 moments + reduced-motion (Task 9).
10. **Copy system:** full English copy for all 11 screens, compliance-safe (Task 10).
11. **Figma structure:** 8 pages, 11 frames (+variants), 18 component sets (Task 11).
12. **Implementation checklist:** build order/deps/mock-vs-real/QA/visual/a11y/compliance (Task 12).
13. **Guardrails:** non-negotiables (Task 13).
```
