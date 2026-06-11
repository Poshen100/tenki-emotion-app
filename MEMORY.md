# 2026-06-11 Session Update #2 (main CI 紅燈修復 + 9 屏視覺對齊 pass)

## What was done（同分支續用，PR #79）

1. **修復 main CI 紅燈**：Antigravity 桌機把 Phase 1 視覺、Phase 2A（Skia+haptics）、2B（live camera）直推 main，8 個 commits CI 全紅。修復內容：
   - `BlurMask` 沒有 `sigma` prop → `blur`（兩個 `*Skia.native.tsx` 共 12 處）
   - 平台分檔 `*Skia.native/.web.tsx` 缺 tsc 解析目標 → 補 `.d.ts` shim（Metro 選平台檔、tsc 讀宣告）
   - vision-camera **v5** 沒有 `Camera.requestCameraPermission()` → `VisionCamera.requestCameraPermission()`（回傳 boolean）
   - hooks barrel 還在 export 已刪除的 `setHapticsImplementation`/`HapticsImpl`
   - hook 改為直接 import react-native 後破壞「無 RN 的 jest harness」→ `shouldFireHaptic` 純邏輯移回 `utils/haptics.ts`，hook re-export
   - 11 個 lint errors（forEach return + index keys）
   - `BrandWordmark` 的 favicon require 多一層 `../` → **web bundling 直接失敗**（dist 被 expo export 清空才發現）
2. **9 屏視覺對齊 pass**（founder 給 9 張 canonical 參考圖 + 嚴格任務書「收斂不創新」）：
   - 安裝 `expo-linear-gradient@~15.0.7` + `expo-blur@~15.0.7`（Expo Go + Web 相容）
   - 真 LinearGradient / BlurView 全面取代硬切色塊假漸層假毛玻璃；14 個 style commits（tokens → shared 元件 → 逐屏）
   - 逐屏自評 7.5–8.5/10，誠實差距與被原生卡住項目都寫在 PR #79 描述裡
3. Expo Web bundle 重建（`dist/` 是 gitignored，要 `git add -f`，沿用 Antigravity 的 force-add 慣例）。

## 結果
- **PR #79 已 merge**（founder 審過 preview）→ main CI 回綠，`/face-baseline/` 固定網址已是視覺對齊版。

### Notes / gotchas（給下個 session）
- **不要直推 main**：CI 只能擋 PR，直推會把紅燈帶進 main。Antigravity 桌機請改走 `feat/*` → PR。
- vision-camera v5 的 permission API 在 `VisionCamera` factory 上，不在 `Camera` 元件上。
- `expo export` 失敗時會先清空 output dir — dist 消失即 build 失敗的訊號。
- jest contract harness 依賴「`utils/` 永遠不 import react-native」這個約定，動 hooks 時要保持純邏輯在 utils。

## Next session
1. PR #79 merge 後：視覺第二輪（吃 founder 看 preview 的回饋）。
2. 原生 session（需 Mac）：Skia orb shader（消除同心圓色帶）、相機實拍、實機 haptics、Reanimated 轉場。
3. P2 backlog 不變：encrypted SQLite 持久化、Today tab 接 engine、domain policies 測試、Maestro E2E。

---

# 2026-06-11 Session Update (P0 基礎建設：CI + Biome + 文件糾正)

## What was done（branch `claude/fable5-opus48-specs-xaoghq`，Commit-Per-Todo 共 9 commits）

1. **CI 上線**：`.github/workflows/ci.yml` — 兩個 job（workspaces：lint + 4 套件 tsc + root npm test；mobile：tsc + jest）。在此之前 repo 完全沒有自動化檢查。
2. **Biome linter 上線**：root `biome.json` 只掃 packages/domain/apps-mobile（apps/web、core/、apps/preview 排除）；formatter 關閉避免大 diff。`npm run lint` / `npm run lint:fix`。`noExplicitAny` = error；`noNonNullAssertion`、`useExhaustiveDependencies` 降為 warn（hook deps 修正需實機 QA，留給 native 整合階段）。
3. **修了 4 個被掩蓋的真 bug**：
   - `packages/shared` 沒有 test script → 3 個測試套件（56 tests）從未被 root `npm test` 跑過；補上後曝露 `flags.ts` 的 import 路徑少一層 `../`（已修）。
   - `tsconfig.base.json` 的 `ignoreDeprecations: "6.0"` 在 TS 5.9 是非法值 → 所有 `tsc -p` 都跑不起來（已移除）。
   - `app/(tabs)/session.tsx` 的 `<ScrollView>` 沒關閉 → 該檔無法編譯（已修）。
   - `apps/mobile/package-lock.json` 與 package.json 不同步 → `npm ci` 失敗（已同步）。
4. **Lint 清理（104 檔）**：import type 轉換、移除 unused imports、7 個 `any` 換成正確型別、list key 改用內容 key（純計數渲染用 biome-ignore 註明）、`mock-scan.ts` 排程 helper 改為內部累加 timeline。
5. **文件糾正**：CLAUDE.md 工作流指令改為 Jest 實況（vitest 是寫錯的）+ 加 lint/CI 說明；root `vite.config.js` 移除從未生效的 vitest test 區塊。

## 驗證狀態
- root `npm test`：engine 259 + scan 111 + shared 56 + domain 9 = **435 tests 全綠**
- `cd apps/mobile && npm test`：**40 tests 全綠**；`tsc --noEmit` 零錯誤（4 個 packages 也零錯誤）
- `npm run lint`：**0 errors**（51 warnings 是刻意保留的已知項目）

### Notes / gotchas
- `biome.json` **不能寫註解**（會整份設定失效、退回全 repo 預設掃描）；要註解得改用 `biome.jsonc`。
- biome-ignore 註解只覆蓋「下一行」；JSX 多行屬性時要把註解放在 `key={i}` 的正上方（開標籤內可以放 `//` 註解）。
- `apps/mobile` 的 `(tabs)/scan.tsx` 仍在用 legacy `Animated`（違反 Reanimated 3 規範）— 是 mock 階段的權宜，P1 裝 Reanimated 時要一併改掉。

## Next session（P1 — Face Baseline 原生整合，原 plan 不變）
1. `apps/mobile` 安裝 `@shopify/react-native-skia`、`react-native-reanimated@3`、`react-native-vision-camera`(+face detection)、`expo-haptics`、`expo-blur`。
2. 按 SPEC Task 5 順序升級 14 個 Skia / 8 個 Reanimated `INTEGRATION` 標記點。
3. 實機 QA（需要 Mac / 裝置）。
4. P2 候選：encrypted SQLite 持久化（privacy-first 核心承諾，目前 0%）、Today tab 接 engine 真資料、domain policies 補測試、Maestro E2E。

---

# 2026-06-10 Session Update (Face Baseline System — Spec + Logic Foundation)

## What was done

1. **9-reference design unification**: Reverse-engineered all 9 Face Baseline reference frames into one production spec at `apps/mobile/features/face-baseline/SPEC.md`.
   - **Unifying law**: `cyan/blue = ACTIVE` (scan, setup, guidance, pre-baseline CTAs) · `gold = SECURED` (resonance, success, trust, maturity CTAs). CTA accent encodes which world the user acts from. Do NOT split these into two products.
   - 11 screens, full state machine, copy system, tokens, animation/haptics, Figma structure, guardrails.
2. **Camera-free logic foundation built + verified** (4 feat commits, Commit-Per-Todo):
   - `tokens/faceBaseline.tokens.ts` — design tokens
   - `types/` + `utils/` — domain types + pure logic (quality gate, maturity stages, capture progress weighting 0.6/0.4, retry-reason classification, confidence bands)
   - `store/` — Zustand store + selectors (maturity-aware)
   - `machine/` — typed dependency-free state machine + partial-retry/resume helpers
   - `index.ts` barrel.
   - Verified: `tsc --strict` clean on all `.ts`; runtime sanity checks pass (happy path + recovery + denied + maturity + retry classification).

## Recommended continuation

1. **Decide native dependency stack** before building components: `@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` (+ face detection), `expo-haptics`, `expo-blur`. None are installed yet; the app can't be run headlessly here, so this needs a deliberate install + a Mac/device to verify rendering.
2. Then build components in SPEC Task 5 order: `CosmicBackground` → `GlassInfoCard` → `GlowPrimaryButton` (cyan/gold) → `FaceScanFrame` → orbs/mesh.
3. Wire screens via `FaceBaselineNavigator` (expo-router) consuming the store + machine.

### Notes / gotchas
- `apps/mobile` is NOT in the root npm `workspaces` (only `packages/*` + `domain`) and has no vitest config — foundation was verified via standalone `tsc` + a throwaway compiled node script, not committed tests. If/when `apps/mobile` gets a test runner, port the sanity checks into real specs.
- No `node_modules` present on fresh container; installed `typescript` + `zustand` `--no-save` only for typechecking.

### Update — Static screens layer (same session)
Built the **onboarding-quality UI flow** on top of the verified logic foundation, using **core RN only** (no Skia/Reanimated/camera yet); every richer-visual point is marked `INTEGRATION (...)` in-file.
- `copy/face-baseline.copy.ts` — canonical English copy, all 11 screens, compliance-safe lexicon.
- `components/` — core-RN library faithful to the references: `CosmicBackground` (mode-driven), `GlowPrimaryButton` (cyan/gold accent law), glass card, resonance glyph, trust shield, privacy list, env checklist, `FaceScanFrame` (square/halo), soul mesh placeholder, processing orb, resonance orb, maturity bar, scan-history, insight card, recovery checklist, success card.
- `screens/` — 11 screens wired to the store + flow with **mocked** signals (env auto-readies, face auto-locks, capture/processing auto-progress with the 1.8s processing ritual honored).
- `app/face-baseline/` — **dedicated expo-router Stack** (`_layout.tsx` + 11 route files re-exporting feature screens). Reachable at route **`/face-baseline`**. Deliberately separate from `(tabs)/scan.tsx` — the generic scan tab was NOT touched.
- Verified: `tsc --strict` clean across all `.ts`/`.tsx` (RN+expo+zustand types installed `--no-save` for checking only; lockfile/package.json untouched). No runtime/device verification possible in this headless container.

### Next session continuation
1. Install the native stack (`@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` + face detection, `expo-haptics`, `expo-blur`) and upgrade each `INTEGRATION`-marked spot.
2. Replace mocked hooks with real `useCameraPermission` / `useFaceDetector` / `useEnvironmentChecks` / `useQualityMetrics`.
3. Wire a real entry point into `/face-baseline` (e.g. from first-run onboarding) and persist baseline + maturity to secure local storage.
4. Visual QA on device against the 9 references.

### Update — Logic tests (same session)
Converted the earlier throwaway sanity-checks into a committed **jest + ts-jest** harness (mirrors `packages/engine`; project uses jest, not vitest despite CLAUDE.md wording).
- `apps/mobile/package.json` — added `test` script, jest devDeps, and a jest block that transforms via a standalone `features/face-baseline/jest.tsconfig.json` (no expo extend, so tests don't need the RN/expo type tree).
- `features/face-baseline/__tests__/` — `machine.test.ts`, `utils.test.ts`, `store.test.ts` → **33 tests, all green** (state-machine happy path/recovery/denied/invariants, quality+maturity+progress+retry+confidence utils, store actions + selectors).
- Run with `cd apps/mobile && npm test`. apps/mobile is NOT a root workspace member, so root `npm test` won't pick these up — run them from the app dir.
- Verified green in-container; lockfile/`package-lock.json` untouched (test deps installed `--no-save` for the run only, but ARE declared in apps/mobile devDependencies for real installs).

*Last updated: 2026-06-10 (Claude Code — Face Baseline foundation + static screens + logic tests)*

---

# 2026-06-09 Session Update (New Computer Setup - 4th Migration)

## What was done

1. **New Machine Clone**: Cloned the repository into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`.
2. **Tools Configuration**: Set up Portable Node.js v22.22.3 (LTS Jod) and MinGit v2.45.1 (Portable Git) under `C:\Users\patron\.gemini\antigravity\scratch\tools\node` and `C:\Users\patron\.gemini\antigravity\scratch\tools\git` respectively.
3. **Environment Integration**:
   - Added paths persistently to the User `PATH` environment variable.
   - Updated and wired all environment wrapper scripts in the repo root: `env.bat`, `env.cmd`, `env.ps1`, and `start_env.bat` to refer to the new `tools/node` and `tools/git/cmd` locations.
4. **Dependencies Resolved**: Completed `npm install` successfully without engine conflicts (Node v22.22.3 fully satisfies Vite 7 requirements).
5. **Handoff Documentation**: Updated `ANTIGRAVITY.md` and `MEMORY.md` with the new machine environment status for seamless future handoffs.

## Recommended continuation

1. Run `npm test` inside the project to verify that all 19 suites and 259 tests pass under Node v22.22.3.
2. Launch the dev servers or Expo shell under `apps/mobile` or `apps/preview` to check runtime environments.
3. Resume the Phase B/C implementation (Replay Engine, Insight Generator, and mobile view integrations).

---

# 2026-05-14 Session Update (iOS Safari OOM Fixes - Preview Flow)

## What was done

1. Conducted an end-to-end review of the `apps/preview/` Finger Baseline onboarding flow.
2. Verified 11 existing OOM fixes previously implemented by the team.
3. Identified and fixed the root cause of the remaining iPhone 13 Safari crashes:
   - **OOM Fix #12 & #13**: Removed `mix-blend-mode: screen` from `.scan-flash` and `.finger-silhouette` in `styles.css`. iOS WebKit forces full stacking-context per-pixel compositing when mix-blend is active, which triggered the crash. Replaced with safe opacity/alpha fallbacks.
   - Reduced `backdrop-filter: blur(32px)` on `ceremony-dialog` to `4px` during the `gather` phase to prevent overlapping with particles and camera layers.
4. E2E tested the full 6-step flow in Vite dev server on desktop — successful completion, 60-second timer runs correctly, and transitions are clean.

## Recommended continuation

1. Start the **Delight Upgrade (爽感升級)**:
   - `stardust.js`: Spring/damping sync, dual-layer halo particles, pointer events for ripple/attractor, score-driven palette.
   - `haptics.js`: Breath-haptic sync during scanning.
   - `scan-ux.js`, `audio-engine.js`: Integrate breath syncing and audio pulses.
   - `results-renderer.js` / `results-page.css`: Atmosphere tint and ring glow.

---

# 2026-05-14 Session Update (New Windows Machine — 3rd Migration)

1. Cloned the repo on the new machine into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
2. Initially installed portable Node.js v20.12.2, then **upgraded to v20.19.2** (LTS Iron) to satisfy React Native 0.81 / Metro 0.83 engine requirements (`>= 20.19.4`)
3. Updated `start_env.bat` to point to the new portable Node.js path
4. Installed dependencies at repo root, `packages/engine`, and `apps/mobile`
5. Verified:
   - Node.js `v20.19.2`
   - npm `10.8.2`
   - Engine tests: **19 suites, 259 tests — ALL PASSING**
6. Updated `ANTIGRAVITY.md` continuation note with new machine paths

## Important machine-specific notes

- Repo path: `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Portable Node.js: `C:\Users\patron\.gemini\antigravity\scratch\nodejs\node-v20.19.2-win-x64`
- Always set PATH before running npm/expo commands (use `start_env.bat` or set `$env:PATH` in PowerShell)

## Recommended continuation

1. Launch the Expo app from `apps/mobile` and verify the 5-tab shell
2. Continue Phase C integration — wire mobile screens to engine/domain/shared
3. First slice candidates: Today screen data wiring, Scan flow engine integration, or Session gate/state integration

---

# 2026-04-28 Session Update (New Windows Machine / Continuation Handoff)

## What was done

1. Cloned the repo again on the new machine into `C:\Users\patron\Documents\Codex\2026-04-28\clone-https-github-com-poshen100-tenki`
2. Installed portable Node.js at `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64`
3. Verified `start_env.bat` already targets that portable Node.js path
4. Installed dependencies at repo root and at `apps/mobile`
5. Rebuilt npm dependencies successfully after correcting PATH to portable Node.js
6. Verified:
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes

## Important machine-specific warning

On this machine, the default `node.exe` may resolve to a WindowsApps / Codex stub. When npm spawns child processes through that path, commands can fail with `Access is denied`.

Safe rule for future sessions:

- Always open the shell with `start_env.bat`
- Or prepend `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64` to `PATH` before using npm/expo

## Active app reality check

- The real active mobile app is `apps/mobile`
- `README.md` now points collaborators to `apps/mobile` and `docs/DEPLOYMENT_MAP.md`
- The correct next-session dev path is:

```powershell
cd apps\mobile
npm start
```

## Recommended continuation

1. Launch the Expo app from `apps/mobile`
2. Verify the existing 5-tab shell renders on this machine
3. Continue Phase C integration/polish by wiring mobile screens to existing engine/domain/shared layers
4. Clean up stale root-level docs after confirming runtime flow

## Deployment map note

- Deployment URL meaning is now documented in `docs/DEPLOYMENT_MAP.md`
- Public Vercel root currently maps to `apps/web`
- `/preview/` routes map to `apps/preview`
- `apps/mobile` is the active implementation path but has no confirmed public deployment URL recorded in repo yet

# MEMORY.md — TENKI CORE AI Session Memory

> 此檔案由 AI 助手在每次 session 結束時更新。
> 人類不需要手動維護，但可以隨時修改或刪除任何條目。
> 每個 AI 工具（Antigravity / Claude / Claude Code）都應該讀取並更新此檔案。

---

## ⚠️ v3.0 架構轉型宣告 (2026-04-07)

**已廢棄概念（deprecated — 不要在新代碼中使用）**
- TEI / TEI PR99 → 改用 **Decision Edge Score (0-100)**
- FDCB (Floating Decision Control Bar) → 舊語意已廢棄
  - 計時/模板/事件邏輯 → 搬到 `packages/engine/src/session/`
  - `packages/fdcb/` → 改名為 `packages/scan/`（Finger Detection & Camera Biometrics）
- 4 zone (PEAK/OPTIMAL/NEUTRAL/DEGRADED) → 改為 **3 zone (Clear/Neutral/Strain)**
- 3 tier 訂閱 (free/retail/pro) → 改為 **2 tier (free/premium)**
- Supabase-first 架構 → 改為 **local-first + cloud-minimal**
- Trading 導向語言 → 改為 **wellness/readiness 語言**
- WIN/LOSS/BREAKEVEN → 改為 **outcome_tag**

**生效概念（active）**
- Decision Edge Score 0-100（8 維度加權）
- Session Governance Layer（modes + templates + timer + gate + violations）
- packages/scan/（Finger Heat Zone 掃描 pipeline）
- 3 zone：Clear (70-100) / Neutral (40-69) / Strain (0-39)
- 2 tier：Free / Premium
- Local-first encrypted SQLite
- Compliance Guardrail Engine
- Feature flags for dark launch

---

## 專案決策紀錄
- [2026-04-07] **v3.0 架構轉型啟動** — Founder 提供完整 16-section App Store-safe 規格書
  - 10 項決策全部確認：同目錄並行遷移、2 tier、scan 取代 fdcb、session governance、domain/ 取代 core 概念、ANTIGRAVITY v3 重寫、RULES-v3 建立、Phase A→B→C 順序、legacy adapter、feature flags
  - ANTIGRAVITY-v2.md 歸檔至 docs/archive/
  - ANTIGRAVITY.md v3.0 重寫完成
  - RULES-v3.md 建立（待 Founder 確認後覆蓋 RULES.md）
- [2026-03-27] 根目錄重整 — Web prototype 移入 apps/web/，Prompt 文件移入 docs/prompts/
- [2026-02-25] 架構決策：選擇 React Native + Swift Hybrid
- [2026-02-25] 後端選擇 Supabase → ⚠️ v3 改為 local-first
- [2026-02-25] 訂閱計費選擇 RevenueCat
- [2026-02-26] FDCB v2.0 spec → ⚠️ v3 已重新定義
- [2026-03-01] packages/engine/ 全模組完工（v2 — 現歸入 legacy）
- [2026-03-01] packages/fdcb/ 完整實作（v2 — 現歸入 legacy）
- [2026-03-02] **Phase 0 完工** — Engine 99.53% / FDCB 97.93% coverage（v2 baseline）

## Founder 偏好（AI 應記住）
- Poshen 偏好先看架構全貌再進細節
- 溝通語言：繁體中文，代碼用英文
- 不喜歡過長的解釋，喜歡表格比較 + 明確結論
- 每次決策要考慮 solo founder 時間效率
- 重視 Garmin 數據對齊（用戶信任感）
- 習慣雙 AI 工作流（Antigravity 寫代碼、Claude 做 review）
- Mac mini 尚未購買，目前只能做不需要 Mac 的任務
- **v3 新增**：重視 App Store compliance、privacy-first、安全語言

## 已知地雷（AI 應避免）
- 不要動 apps/web/ 裡的任何檔案
- 不要使用 prohibited vocabulary（見 ANTIGRAVITY.md v3 Section 2）
- 不要在 user-facing copy 中使用醫療或金融建議語言
- 不要把 raw biometric data 設計為上傳到雲端
- 星塵動效的「感覺」不能改，重建時保持 v25.8.2 的視覺體驗
- 不要用 SVG 畫環，用 Skia
- 不要用 Animated (legacy)，只用 Reanimated 3
- **v3 新增**：不要使用 TEI、PR99、舊 FDCB 語意
- **v3 新增**：不要設計 4 zone 或 3 tier subscription
- **v3 新增**：不要把隱私控制放在付費牆後

## 技術偏好與標準
- TypeScript strict mode，不允許 any
- 測試用 Jest + ts-jest
- 狀態管理用 Zustand（不用 Redux）
- 常數要導出且具名
- Edge Score 用加權正規化（不再是 PR99 百分位）
- 每個 function 必須有 JSDoc
- engine/ 和 scan/ 測試覆蓋率 ≥ 90%
- 動畫用 Reanimated 3（不用 legacy Animated）
- 環形圖用 Skia（不用 SVG）
- EWMA α=0.05 極慢收斂
- **v3 新增**：Feature flags 控制所有未成熟功能
- **v3 新增**：Compliance Layer 驗證所有 user-facing copy
- **v3 新增**：Local-first — 使用 encrypted SQLite

## 上次 Session 結束點
- **日期**: 2026-04-14
- **最後完成**:
  - ✅ Baseline Onboarding 4 交付全部完成
  - ✅ Signal Quality Gate (coverage/brightness/stability/SQI 四維度閘門)
  - ✅ Baseline Bootstrap Engine (30-60s 掃描 → 初始基線)
  - ✅ Domain contracts + policies (6 步狀態機、重試邏輯、失敗分類)
  - ✅ 6-step UX copy (5 個 UX 標準全部滿足)
  - ✅ Web Preview UI (`apps/preview/`) — 瀏覽器驗證全部通過
  - ✅ 22 個新測試案例 (signal-quality-gate: 12, bootstrap: 10)
- **下一步**:
  1. 跑 vitest 確認 engine 測試通過（需安裝 Node.js）
  2. git commit + push 所有 baseline onboarding 程式碼
  3. 繼續 Phase C — 5 Tab UI (Today/Scan/Session/Timeline/Lab)
  4. 或依 Founder 指示做下一個功能

## 各 AI 工具的角色分工
| 工具 | 角色 | 目前使用狀態 |
|------|------|-------------|
| Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro) | 主力代碼生成 + 架構 | ✅ 使用中 |
| Claude (claude.ai) | 架構決策、代碼 review、文件制定 | ✅ 使用中 |
| Claude Code | Terminal 任務、Expo init、Native Module | ❌ 等 Mac 到手 |

---

## 2026-04-14 Session Update (Baseline Onboarding Complete)

### 4 Deliverables Completed:
1. **Baseline Onboarding Flow** — 6-step guided flow (Intro → Sensor Choice → Readiness Check → Calibration Scan → Baseline Result → Next Action)
2. **Signal Quality Gate** — Multi-dimensional readiness check (coverage, brightness, stability, SQI) with human-readable messages per failure type
3. **Baseline Bootstrap Engine** — Converts 30-60s scan into initial BaselineProfile via Welford's algorithm. Classifiable error codes: NO_READINGS, ALL_REJECTED, INSUFFICIENT_QUALITY, INSUFFICIENT_DURATION
4. **Completion UX** — "不是好壞分數" messaging, confidence badge, metric cards, next action routing

### New Files Created:
- `packages/engine/src/baseline/signal-quality-gate.ts`
- `packages/engine/src/baseline/bootstrap.ts`
- `packages/engine/src/baseline/__tests__/signal-quality-gate.test.ts` (12 test cases)
- `packages/engine/src/baseline/__tests__/bootstrap.test.ts` (10 test cases)
- `domain/src/contracts/baseline-contract.ts`
- `domain/src/policies/baseline-policy.ts`
- `packages/shared/src/copy/baseline-onboarding.ts`
- `apps/preview/index.html`
- `apps/preview/styles.css`
- `apps/preview/baseline-onboarding.js`

### UX Standards Met:
1. ✅ 掃描前就讓使用者知道成功條件
2. ✅ 掃描中只顯示 1 個主狀態
3. ✅ 任何失敗都可解釋
4. ✅ 結果頁講人話（「不是好壞分數」）
5. ✅ 成功後感受到之後每次評估都會更準

### Browser Verification:
- All 6 steps rendered and transitioned correctly
- Readiness meters animated properly
- Scan timer + progress ring worked
- Baseline result displayed realistic metric values
- No console errors

## 2026-04-21 Session Update (Library Session)

### 達成進度：
1. **環境設定與維護**：在免安裝 Node.js (v24.15.0) 環境中修復 `vitest` 到 `jest` 的兼容性錯誤，`packages/engine` 的 19 個測試套件 (259 個測試) 現已全數通過。
2. **Phase B 基礎建設 (Step 2)**：
   - 透過 GitHub 介面手動部署了 145KB 的 `apps/preview/v6/index.html`，成功規避了大檔案寫入造成的 Timeout 錯誤。
   - 完成 `.tei` 到 `.tl-tei` 的 CSS Class 重新命名任務（包含 3300 多行程式碼）。
   - 實作 **v3 語意合規**：全面替換不符合 v3 架構的專有名詞，例如將 `TEI` 替換為 `Edge Score`，將 `PR99` 替換為 `Decision Edge`。

### 下一步 (Next Session)：
1. 實作 Replay Engine 與 Insight Generator。
2. 完成完整的整合測試 (Full Pipeline)。

*Last updated: 2026-04-21 11:46*
*Updated by: Antigravity (Library Session End)*
