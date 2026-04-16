# MEMORY.md — AI Session Continuity

> AI 助手在 session 結束時更新此檔案。
> 人類可隨時修改或刪除任何條目。
> 產品規格 → 讀 `ANTIGRAVITY.md` / 開發上下文 → 讀 `CLAUDE.md`

---

## Last Session

- **Date**: 2026-04-16
- **Completed**:
  - `/push` custom skill 建立 (`.claude/skills/push/SKILL.md`)
  - Pre-commit type-check hook 加入 `PreToolUse` (git commit 前自動跑 `tsc --noEmit`)
  - CLAUDE.md + MEMORY.md 優化（與 ANTIGRAVITY.md 去重）
- **Previous session (2026-04-14)**:
  - Baseline Onboarding 4 交付全部完成
  - Signal Quality Gate, Bootstrap Engine, Domain contracts
  - 22 新測試案例, Web Preview UI 驗證通過

## Next Steps

1. 繼續 Phase B — Scan pipeline integration, Replay Engine, Insight Generator
2. 整合測試 (full pipeline)
3. Phase C — 5 Tab UI (Today/Scan/Session/Timeline/Lab)
4. 或依 Founder 指示

---

## Decision Log

| Date | Decision |
|------|----------|
| 2026-04-07 | v3.0 架構轉型：Edge Score 取代 TEI, 3 zone, 2 tier, local-first, scan 取代 fdcb |
| 2026-03-27 | 根目錄重整：Web prototype → apps/web/, Prompts → docs/prompts/ |
| 2026-02-25 | React Native + Swift Hybrid; Supabase → v3 改 local-first |
| 2026-02-25 | RevenueCat for subscription |
| 2026-03-01 | packages/engine/ 全模組完工 (v2 baseline) |
| 2026-03-02 | Phase 0 完工 — Engine 99.53% / FDCB 97.93% coverage |

---

## Known Mines (AI MUST avoid)

- 星塵動效的「感覺」不能改 — 重建時保持 v25.8.2 視覺體驗
- 不要用 SVG 畫環 → 用 Skia
- 不要用 Animated (legacy) → 只用 Reanimated 3
- Mac mini 尚未購買 — 目前只能做不需要 Mac 的任務

---

## AI Tool Roles

| Tool | Role | Status |
|------|------|--------|
| Antigravity (Claude Opus 4.6 / Gemini) | 主力代碼生成 + 架構 | ✅ Active |
| Claude (claude.ai) | 架構決策、代碼 review | ✅ Active |
| Claude Code | Terminal 任務、hooks、CI/CD | ✅ Active |

---

## New Files Created (Recent)

### 2026-04-16
- `.claude/skills/push/SKILL.md`
- `.claude/settings.json` (updated: added PreToolUse type-check hook)

### 2026-04-14 (Baseline Onboarding)
- `packages/engine/src/baseline/signal-quality-gate.ts`
- `packages/engine/src/baseline/bootstrap.ts`
- `packages/engine/src/baseline/__tests__/signal-quality-gate.test.ts` (12 tests)
- `packages/engine/src/baseline/__tests__/bootstrap.test.ts` (10 tests)
- `domain/src/contracts/baseline-contract.ts`
- `domain/src/policies/baseline-policy.ts`
- `packages/shared/src/copy/baseline-onboarding.ts`
- `apps/preview/index.html`, `apps/preview/styles.css`, `apps/preview/baseline-onboarding.js`
