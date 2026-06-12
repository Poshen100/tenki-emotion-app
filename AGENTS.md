# TENKI CORE — AI Agent Context

> **Last updated**: 2026-06-12  
> **Read this file first** before starting any task on this repository.
> For full product blueprint, read `ANTIGRAVITY.md`.

---

## What TENKI Core Is

TENKI Core is **not** a trading app.  
TENKI Core is **not** a meditation app.

It is a **state-regulation product** — a mobile app that helps users:
1. Identify their current physiological and emotional state
2. Regulate back to their personal baseline
3. Turn that return to baseline into a repeatable, trainable turning point

---

## Core Brand Lines (Locked — Do Not Modify)

```
Hero:     Turn volatility into turning points.
Subtitle: Return to baseline. Find your turning point.
```

---

## Product Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| Mobile App | `apps/mobile` | Primary product — Expo / React Native |
| Engine | `packages/engine` | Edge Score, HRV, Baseline, Session state machine |
| Shared | `packages/shared` | Design tokens, feature flags, copy, compliance |
| Domain | `domain/` | Policies, schemas, contracts |
| Web Prototype | `apps/web` | Legacy / reference only — do not modify |

---

## Dopamine Baseline Model

TENKI's core product insight is the **three-state dopamine model**:

| State | Description | TENKI's Role |
|-------|-------------|-------------|
| **Above Baseline** | Overstimulation, FOMO, impulse, reward-seeking | Breathing guidance, pause prompts, binaural beats |
| **At Baseline** | Clear, regulated, ready for decisions | Confirm state, log body signals, maintain flow |
| **Below Baseline** | Withdrawal, craving, fatigue, low motivation | Impulse regulation support, gradual recovery guidance |

**Key rule**: TENKI observes dopamine state **indirectly and relatively** via HRV, PPG, and behavioral signals.  
Never claim precise dopamine measurement. Never make clinical or diagnostic statements.

---

## Agent Rules

### Must Do

1. Read `ANTIGRAVITY.md` before starting any work
2. Read `task.md` for the current execution checklist
3. Follow the v3 semantic system: use `Edge Score` (not TEI), `Zone` (not PR99), `Session` (not Trading)
4. All user-facing copy must pass `packages/engine/src/compliance/safe-copy.ts`
5. All new modules must include tests
6. All sensitive data must stay on-device — never upload raw HR/HRV/RR to the cloud
7. Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
8. Update `task.md` after completing each work item

### Must Not Do

| Prohibited | Reason |
|------------|--------|
| Use TEI, PR99 vocabulary | v3 migration complete |
| Upload raw HR/HRV/RR | Privacy-first principle |
| Modify `apps/web/` without instruction | Protect existing prototype |
| Use TypeScript `any` | Type safety is non-negotiable |
| Generate financial advice copy | App Store compliance risk |
| Skip tests | All modules require coverage |
| Claim "precise dopamine measurement" | No scientific basis, compliance violation |
| Modify Hero / Subtitle brand lines | Brand consistency — Founder approval required |
| Redesign logo or icon system | Brand continuity — Founder approval required |

---

## Current Phase

See `ANTIGRAVITY.md` Section 15 (Build Order) for current phase status.

Active work: **Phase C — Mobile App** (`apps/mobile`)  
Shell: 5-tab Expo Router structure is in place and needs integration with engine/domain.

---

## Recommended Workflow

```
1. Read ANTIGRAVITY.md
2. Read task.md
3. Confirm current Phase and next unchecked item
4. Execute the task
5. Write tests
6. Update task.md
7. Commit with Conventional Commit format
8. Push
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `edge-score.ts` |
| Types | PascalCase | `EdgeScoreResult` |
| Functions | camelCase | `calculateEdgeScore` |
| Constants | SCREAMING_SNAKE | `EDGE_DETECTOR_THRESHOLDS` |
| Directories | kebab-case | `edge-detector/` |
| Commits | Conventional Commits | `feat: add dopamine journal schema` |

---

## Compliance Quick Reference

| Instead of | Use |
|------------|-----|
| 交易 / 買賣 / 加倉 | 決策 / 行動 / 計畫 |
| 診斷 / 治療 | 觀察 / 覺察 / 參考 |
| 保證 / 一定 | 建議 / 可能 / 傾向 |
| TEI / PR99 | Edge Score / Zone |
| 多巴胺濃度 / 多巴胺診斷 | 多巴胺狀態覺察 / 身體訊號模式 |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `ANTIGRAVITY.md` | Master blueprint — read first |
| `AGENTS.md` | This file — AI agent context |
| `BRAND.md` | Brand lines, tone, visual identity |
| `task.md` | Current execution checklist |
| `MEMORY.md` | Setup and machine notes |
| `docs/DEPLOYMENT_MAP.md` | Deployed routes and preview URLs |
| `docs/APP_STORE_COMPLIANCE.md` | App Store review guidelines |
| `docs/PRIVACY_ARCHITECTURE.md` | Privacy model details |

---

*For the full product spec, see `ANTIGRAVITY.md`.*
