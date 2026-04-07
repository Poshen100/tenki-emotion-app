# ANTIGRAVITY.md — TENKI CORE v3.0 Project Brief

> **Model**: Use Claude Opus 4.6 (`claude-opus-4-6`) for all tasks.
> **Repo**: https://github.com/Poshen100/tenki-emotion-app
> **Role**: You are a Silicon Valley senior full-stack engineer & CTO / co-founder.
> **Language**: Respond in **繁體中文** unless code/config. The founder is Taiwanese.
> **Version**: v3.0 — Privacy-first cognitive wellness app + App Store compliance

---

This file is the **single source of truth** for the TENKI CORE project.
Before writing ANY code, read this entire document.
When resuming a session, re-read Sections 1-4 to restore full context.

> **v3.0 breaks from v2.0**: TEI PR99 → Decision Edge Score (0-100).
> Legacy FDCB (Floating Decision Control Bar) → Session Governance (in engine).
> `packages/fdcb/` → `packages/scan/` (Finger Detection & Camera Biometrics).
> Supabase-first → Local-first encrypted SQLite + minimal cloud.
> Trading engine → Privacy-first cognitive wellness app.

**Superseded concepts (do NOT use)**:
- ~~TEI~~ → Decision Edge Score / Edge Score
- ~~PR99~~ → Edge Score 0-100
- ~~FDCB (Floating Decision Control Bar)~~ → Session Governance Layer
- ~~packages/fdcb/~~ → packages/scan/
- ~~trading signals / market edge~~ → readiness insights
- ~~WIN/LOSS/BREAKEVEN~~ → outcome_tag (stayed_disciplined, etc.)

---

- PowerShell 每次開啟先設定 Node.js 路徑：
```powershell
$env:Path = "C:\Users\reader\node-portable\node-v20.19.2-win-x64;$env:Path"
```
- Workspace 路徑：`C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Git 路徑：`C:\Users\patron\AppData\Local\Programs\Git`
- 需要瀏覽器操作時，請使用 **Antigravity Browser Control**。

---

### 0.2 Resume Snapshot嚗?026-04-07嚗?

- Current local clone path嚗`C:\Users\patron\Documents\Tenki Core\tenki-emotion-app-git`
- If this clone already exists嚗??`git pull` ?喳嚗?閬?敺?zip 蝥???
- Current local PowerShell bootstrap嚗?
```powershell
$env:Path = "C:\Users\patron\Documents\Tenki Core\tools\node-v22.14.0-win-x64;C:\Users\patron\AppData\Local\Programs\Git\cmd;$env:Path"
Set-Location "C:\Users\patron\Documents\Tenki Core\tenki-emotion-app-git"
```
- Current local Node path嚗`C:\Users\patron\Documents\Tenki Core\tools\node-v22.14.0-win-x64`
- Current local npm cache嚗`C:\Users\patron\Documents\Tenki Core\.npm-cache`
- 2026-04-07 撌脤?霅?`npm ci --cache "C:\Users\patron\Documents\Tenki Core\.npm-cache"` ?舀???
- 2026-04-07 撌脤?霅?root `npm test` ?舀???摰?`@tenki/engine` + `@tenki/fdcb`
- 皜祈岫蝯?嚗`8 suites / 89 tests`嚗ngine嚗? `7 suites / 111 tests`嚗dcb嚗?券?
- icon handoff 撌脣遣蝡 `docs/ICON-SYSTEM-BATCH1.md` + `docs/assets/icons/batch1/`

---

## 1. Product

**TENKI CORE** = privacy-first cognitive wellness app.

- **Core promise**: Help users understand when their mind is clear enough for important decisions.
- **Not**: medical diagnosis, financial advice, trading signals, market predictions.
- **Brand**: Decision readiness, focus, recovery, clarity, emotional balance.
- **Design language**: iPhone-grade minimal, seamless, stardust soul motion effects (form follows function).
- **Business model**: iOS / Android subscription (Free / Premium).
- **Architecture**: Local-first + cloud-minimal.

### 1.1 Core Metric: Decision Edge Score

- Edge Score is **0-100**, a weighted multi-factor readiness score.
- Normalized against **personal baseline**, not population average.
- 8 factors with defined weights:

| Factor | Weight | Source |
|--------|--------|--------|
| HRV vs personal baseline | 25 | HealthKit / Watch / Finger scan |
| Heart-rate stability | 15 | Same |
| Respiration stability | 10 | Same |
| Stress proxy vs baseline | 15 | Derived |
| Sleep recovery input | 15 | HealthKit / manual |
| Recent trend consistency | 10 | Local history |
| Baseline freshness | 5 | Baseline metadata |
| Current signal quality | 5 | SQI |

Formula: `EdgeScore = Σ(wᵢ × sᵢ)` where each sub-score is normalized to 0-100.

### 1.2 Zone Definitions

| Score Range | Zone | UI Color | Readiness State |
|-------------|------|----------|-----------------|
| **70-100** | Clear state ✅ | Teal `#00B4D8` | Stable, focused, recovered |
| **40-69** | Neutral / mixed ⏸️ | Light gray `#E5E5EA` | Mixed signals, proceed with awareness |
| **0-39** | Elevated strain 🔁 | Deep purple `#5E3A87` | High strain, consider reset |

### 1.3 Subscription Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 1 daily scan, basic Edge Score, limited history, guest mode |
| Premium Monthly | TBD | Unlimited scans, Edge Graph, Detector alerts, Timeline, Replay, Benchmarks |
| Premium Yearly | TBD | Same as monthly, annual discount |

### 1.4 Confidence System

| Band | Range | Behavior |
|------|-------|----------|
| High | 0.80-1.00 | Full confidence language |
| Moderate | 0.55-0.79 | Softer language, note uncertainty |
| Low | <0.55 | Very soft language, recommend more data |

---

## 2. App Store-Safe Language

### Allowed Vocabulary
- Clear state, Focused state, Stable state, Recovered state, Balanced state
- Elevated strain, Decision readiness, Cognitive readiness, Emotional balance

### Prohibited Vocabulary
- ~~Best time to trade~~, ~~High conviction setup~~, ~~Market edge~~
- ~~Buy / Sell / Exit now~~, ~~Diagnose anxiety~~, ~~Detect illness~~
- ~~Medical-grade measurement~~, ~~Predict profit~~

### Trader Mode Framing
Trader mode = **decision discipline only**. It governs emotional readiness and process adherence. It does NOT provide market advice, trading signals, or execution guidance.

### Safe Notification Language
✅ "You may be in a more stable state for a quick check-in."
✅ "Time for your daily readiness scan."
❌ "You have an edge now."
❌ "Good time to trade."
❌ "Your body says buy."

---

## 3. Privacy Model

### Data Classification
| Data Type | Storage | Cloud Allowed |
|-----------|---------|---------------|
| HRV / HR / respiration raw | Local encrypted SQLite | **No** |
| Finger scan frames | Memory only (ephemeral) | **No** |
| Stress / readiness scores | Local encrypted SQLite | Optional anonymous aggregate only |
| Reflection text / tags | Local encrypted SQLite | **No** |
| Personal Edge Graph / baseline | Local encrypted SQLite | **No** |
| Subscription state | Secure store + cloud | Yes |
| Anonymous telemetry | Local queue + cloud | Yes (opt-in) |
| Benchmark distributions | Cloud aggregate + local cache | Yes |

### Privacy Principles
1. Raw biometrics never leave the device.
2. Reflections never leave the device.
3. Personal baseline models never leave the device.
4. Analytics are anonymous and opt-in.
5. Benchmarks use only aggregated, anonymized data with minimum cohort thresholds.
6. Privacy controls are never paywalled.
7. Export and deletion are always available, regardless of subscription.

### Encryption
- Local DB: SQLCipher or platform file protection.
- Secrets: iOS Keychain / Android Keystore.
- Transport: TLS only.

---

## 4. Core Engines (Layers A-H)

| Layer | Name | Responsibility |
|-------|------|---------------|
| A | Biometric Layer | Read/normalize HRV, HR, respiration, sleep, stress proxy, camera scan |
| B | Baseline Layer | Build/update personal baseline, signal quality gating, confidence |
| C | Edge Scoring Layer | Produce 0-100 Edge Score + zone + explanation |
| D | Session Governance Layer | Mode/template, pre-check, gate, timer, violations |
| E | Replay Layer | Session replay, micro timeline, reflection logging |
| F | Intelligence Layer | Edge Graph, prediction, timeline, insights |
| G | Growth Layer | Habit loop, share card, anonymous benchmark, premium triggers |
| H | Compliance Layer | Safe wording, prompt timing, notification guardrails |

---

## 5. Modes & Templates

### Mode Definitions
| Mode | Purpose |
|------|---------|
| Health Reset | Post-strain recovery, grounding |
| Focus | Pre-deep-work, study, creation |
| Performance | Pre-speech, meeting, competition |
| Trader | Decision discipline only (not financial advice) |

### Trader Templates
| Template | Description |
|----------|-------------|
| FBD | Follow-By-Discipline: emphasis on checklist, calmness, discipline |
| CANSLIM | Personal process template with user-defined checklist + reflection |
| Mode 2 | High-sensitivity control template for volatile scenarios |

> Templates govern **process**, not financial decisions.

### Session State Machine
```
draft → configured → precheck → scanning → gated → active → paused → completed → reflection_pending → archived
```

### Gate Thresholds
- Clear pass: score ≥ 70 AND confidence ≥ 0.70
- Soft caution: score 40-69 OR confidence < 0.70
- Red gate: score < 40
- Force hold: 2 consecutive red gates → suggest Health Reset

---

## 6. Scan & Readiness (Finger Heat Zone)

Finger Heat Zone = signal-quality gate before scan acceptance.

### UX Flow
1. Education card → Camera opens → ROI overlay
2. Coverage meter + Stability meter + Signal quality meter
3. All pass → Start Scan CTA
4. Scan runs → Result sheet

### Visual States
`idle → searching → partial_coverage → unstable → low_signal → ready → scanning → accepted → rejected`

### Compliance
- Camera pre-permission education required.
- Frames are NOT uploaded.
- Defined as "on-device readiness scan for signal quality," NOT medical measurement.

---

## 7. Edge Intelligence

### Personal Edge Graph
- X: time-of-day / weekday / mode
- Y: Edge Score / confidence / reflection clarity
- Overlays: sessions, violations, best windows, strain clusters

### Edge Detector
- Rolling 3-5 minute stability window
- Score ≥ 72, confidence ≥ 0.75, no instability flags
- Requires two consecutive accepted windows
- Daily alert cap, user-configurable sensitivity
- Premium only for background alerts; free for manual check

### Edge Prediction
Pattern forecast only, NOT outcome forecast.

---

## 8. Growth Architecture

### Flywheel
Biometric → Edge Score → AI Insight → Reflection → Personal Edge Learning → Daily Habit → More Data

### Retention Loop
- Morning readiness ritual
- Pre-decision session ritual
- End-of-day reflection
- Weekly Lab review
- Monthly benchmark check

---

## 9. Repo Structure

```
tenki-emotion-app/
├── packages/
│   ├── engine/                    # Core engines (TypeScript)
│   │   ├── src/
│   │   │   ├── legacy/            # Deprecated v2 modules
│   │   │   ├── biometric/         # Layer A: HRV, HR, RR, stress proxy
│   │   │   ├── baseline/          # Layer B: Baseline + time buckets
│   │   │   ├── scoring/           # Layer C: Edge Score + Detector
│   │   │   ├── session/           # Layer D: Modes, templates, timer, gate
│   │   │   ├── replay/            # Layer E: Replay + reflection
│   │   │   ├── insights/          # Layer F: Edge Graph + analytics
│   │   │   ├── compliance/        # Layer H: Safe wording + guardrails
│   │   │   ├── signal-quality/    # SQI + quality gating
│   │   │   ├── common/            # EWMA, shared types, utils
│   │   │   └── index.ts           # Only exports v3 modules
│   │   └── __tests__/
│   ├── scan/                      # Finger Detection & Camera Biometrics
│   │   ├── src/
│   │   │   ├── camera-bridge.ts
│   │   │   ├── ppg-signal.ts
│   │   │   ├── roi-detection.ts
│   │   │   ├── quality-gating.ts
│   │   │   ├── scan-state-machine.ts
│   │   │   └── types.ts
│   │   └── __tests__/
│   └── shared/                    # Cross-platform shared
│       ├── src/
│       │   ├── design-tokens.ts
│       │   ├── subscription-tiers.ts
│       │   ├── zone-config.ts
│       │   ├── copy/              # Safe vocabulary, disclaimers, onboarding
│       │   ├── feature-flags/     # Feature flag definitions
│       │   └── validation/        # Runtime schema validators
│       └── __tests__/
├── domain/                        # Domain layer (NEW)
│   ├── models/
│   ├── policies/
│   ├── schemas/
│   └── contracts/
├── apps/
│   ├── web/                       # Existing prototype (DO NOT TOUCH)
│   └── mobile/                    # React Native Expo App (future)
├── docs/
│   ├── archive/                   # Archived specs (ANTIGRAVITY-v2.md, etc.)
│   ├── product/
│   ├── compliance/
│   ├── privacy/
│   └── architecture/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── ANTIGRAVITY.md                 # ← This file (v3 active)
├── RULES.md                       # Development rules
├── MEMORY.md                      # AI session memory
└── package.json
```

---

## 10. Roadmap

### Phase 1: Compliance-safe MVP
- Guest mode, local encrypted storage, onboarding + disclosures
- Health permission education, basic quick scan
- Edge Score v1, Today / Scan / Session tabs
- StoreKit / Play Billing skeleton, reviewer demo mode

### Phase 2: Baseline + Governance
- Finger Heat Zone, baseline bootstrapping, confidence scoring
- Mode system, Trader templates as discipline templates
- Timer state machine, reflection logging

### Phase 3: Replay + Timeline
- Replay event model, Timeline UI, violations
- Post-session reflections, local insight cards
- Export / deletion flows

### Phase 4: Lab Intelligence
- Personal Edge Graph, Edge Timeline, pattern clustering
- Prediction cards, baseline health diagnostics

### Phase 5: Cloud Minimal Layer
- Entitlements backend, anonymous analytics
- Benchmark aggregation, remote config, guest → account upgrade

### Phase 6: Premium Growth
- Detector alerts, weekly insight digest
- Benchmark comparisons, Edge Snapshot sharing, paywall optimization

### Phase 7: Review Hardening
- Metadata audit, copy audit, notification audit
- Privacy label audit, SDK traffic audit
- Demo mode polish, reviewer packet finalization

---

## 11. Non-Negotiables

1. ❌ No medical diagnosis
2. ❌ No financial advice
3. ❌ No raw biometric cloud storage
4. ❌ No unsafe notification language
5. ❌ No hidden App Review-only functionality
6. ❌ No `any` type — use `unknown` + type guard
7. ✅ TypeScript strict mode
8. ✅ JSDoc on every function
9. ✅ Engine + Session test coverage ≥ 90%
10. ✅ Compliance layer validates all user-facing copy
11. ✅ Privacy controls never paywalled
12. ✅ Feature flags for all v3 dark-launch features

---

## 12. Coding Standards

1. TypeScript strict mode — no `any`
2. JSDoc on every function in engine/, scan/, shared/
3. Test coverage: engine/ ≥ 90%, scan/ ≥ 90%, UI ≥ 70%
4. Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`
5. Components: `PascalCase.tsx`, Hooks: `camelCase.ts`, Tests: `*.test.ts`
6. Constants: `SCREAMING_SNAKE`
7. Zustand for state management (not Redux)
8. Reanimated 3 for animations (not legacy Animated)
9. Skia for ring charts (not SVG)
10. EWMA α=0.05 for score smoothing

---

## 13. Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `edge_score_v3` | Enable new Edge Score engine | true |
| `session_governance_v3` | Enable new session system | true |
| `scan_pipeline_v1` | Enable Finger Heat Zone | false |
| `lab_prediction` | Enable Lab prediction cards | false |
| `benchmark_opt_in` | Enable anonymous benchmarks | false |
| `reviewer_demo_mode` | Enable demo mode for App Store review | false |

---

## 14. Don't Touch

- `apps/web/` — preserve existing prototype
- Stardust soul motion "feel" — maintain v25.8.2 experience
- Edge Score zone boundaries — validated in v3 spec

---

> **當你讀到這裡，請立即執行：**

1. 確認已讀完 ANTIGRAVITY.md v3.0
2. 檢查 `packages/engine/src/` 是否已有 v3 子目錄結構
3. 檢查 Phase checklist 進度
4. 向 founder 報告狀態 & 建議下一步
5. **永遠先問：「我接下來要做什麼？」**

---

*Last updated: 2026-04-07*
*Version: v3.0 — Privacy-first Cognitive Wellness*
*Supersedes: ANTIGRAVITY v2.0 (archived at docs/archive/ANTIGRAVITY-v2.md)*
*Maintained by: Poshen (Founder) + AI CTO (Claude Opus 4.6)*
