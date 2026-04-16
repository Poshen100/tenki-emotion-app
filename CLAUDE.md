# TENKI CORE — Claude Code Context

> **Auto-loaded by Claude Code every session. Keep concise.**
> Deep context → read `ANTIGRAVITY.md` (canonical spec, 16 sections)
> Session history → read `MEMORY.md`

---

## Product Identity

**TENKI CORE** = Privacy-first cognitive wellness app
- Core metric: **Decision Edge Score (0-100)**
- 3 Zones: Clear (70-100) / Neutral (40-69) / Strain (0-39)
- 2 Tiers: Free / Premium
- Architecture: Local-first + Cloud-minimal

---

## Hard Rules (MUST follow)

| Rule | Detail |
|------|--------|
| No deprecated terms | TEI, PR99, PEAK, OPTIMAL are dead. Use **Edge Score**, **Zone** |
| No `any` in TypeScript | Strict mode only |
| No medical/financial advice | App Store compliance — wellness language only |
| No raw biometric upload | HR/HRV/RR data never leaves device |
| No touching `apps/web/` | Protected legacy prototype |
| No touching `apps/preview/` | Protected preview site (read-only reference) |
| Test before commit | `npx vitest run` must pass |
| Type-check before commit | `npx tsc --noEmit` must pass (zero errors) |

---

## Monorepo Structure

```
tenki-emotion-app/
├── packages/engine/src/     ← v3 TypeScript engine (core logic)
│   ├── biometric/           HRV, RR, Stress Proxy
│   ├── baseline/            Welford algorithm, time buckets, signal quality gate, bootstrap
│   ├── scoring/             Edge Score (8 dimensions), Edge Detector
│   ├── session/             10-state machine, gate, templates
│   ├── compliance/          Safe copy engine, notification guard
│   ├── analytics/           Analytics pipeline
│   ├── pipeline/            Scan pipeline integration
│   ├── common/              Types, EWMA, legacy adapter
│   └── legacy/              Deprecated TEI modules
├── packages/scan/src/       ← Finger Heat Zone scan pipeline
│   ├── scenario-mode/       4 scenario modes
│   ├── templates/           Trader templates (FBD, CANSLIM, Mode2)
│   └── timeline/            Timeline data
├── packages/shared/src/     ← Cross-platform shared
│   ├── copy/                Disclaimers, onboarding UX copy
│   ├── components/          ParticleSphere, ResultSummary
│   ├── feature-flags/       Dark launch system
│   ├── zone-config.ts       3-zone definition
│   ├── subscription-tiers.ts 2-tier model
│   └── design-tokens.ts     CSS tokens
├── domain/src/              ← Domain layer
│   ├── contracts/           Baseline contract, etc.
│   ├── policies/            Baseline policy, etc.
│   └── schemas/             Validation schemas
├── apps/web/                ← Web prototype (DO NOT MODIFY)
├── apps/preview/            ← Preview site (DO NOT MODIFY)
├── apps/mobile/             ← Expo/React Native (Phase C)
├── core/                    ← Legacy vanilla JS IIFEs (deprecated)
└── tests/                   ← Vitest test suites
```

---

## Dev Workflow

### Commands
```bash
npx vitest run                          # All tests
npx tsc --noEmit                        # TypeScript check (zero errors)
npx vite --port 5173                    # Dev server
npx vite build                          # Build
```

### Commit Convention (MANDATORY)

> **Every Todo = One Commit. No batching.**

```
<type>(<scope>): <description>

feat(engine): add edge detector threshold tuning
fix(scan): stabilize camera lifecycle on iOS
test(baseline): add bootstrap edge cases
refactor(session): extract gate evaluation logic
```

### TypeScript Standards
- Strict mode, no `any`
- Named exports for all constants
- All public functions need JSDoc
- engine/ and scan/ test coverage >= 90%

### Naming
| Category | Convention | Example |
|----------|-----------|---------|
| Files | kebab-case | `edge-score.ts` |
| Types | PascalCase | `EdgeScoreResult` |
| Functions | camelCase | `calculateEdgeScore` |
| Constants | SCREAMING_SNAKE | `EDGE_DETECTOR_THRESHOLDS` |

---

## Build Progress

- **Phase 0** — Governance foundation ✅
- **Phase A** — Engine core ✅
- **Phase B** — Infrastructure (domain layer done, scan pipeline + replay + insight TBD)
- **Phase C** — Mobile app (not started)
- **Phase D** — App Store release (not started)

---

## Founder Preferences

- Show architecture overview first, then details
- Communication: 繁體中文, code in English
- Prefers tables + clear conclusions over long explanations
- Values solo-founder time efficiency
- Dual-AI workflow: Antigravity writes code, Claude reviews
- CSS tokens: `--plasma-cyan`, `--void-purple`, `--matrix-green`
- Animation: Reanimated 3 (not legacy Animated), rings with Skia (not SVG)
- State management: Zustand (not Redux)
- EWMA alpha = 0.05 (very slow convergence)
