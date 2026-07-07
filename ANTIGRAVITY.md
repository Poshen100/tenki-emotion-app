# 2026-07-03 CONTINUATION NOTE (READ THIS FIRST — supersedes 2026-06-30 note below)

This note is the current desktop hand-off. Older notes below are historical.

## 先讀制度（2026-07-02 新立，all AI collaborators）

1. 規則入口：`CLAUDE.md`（工程硬規則）→ `docs/PLAYBOOK.md`（任務路由 §1、已知陷阱、文件矛盾裁決 §0）→ `MEMORY.md` 最上條（最新斷點）。
   **動效任務加讀**：`docs/MOTION-DIRECTION.md`（動效語言 canonical + 驗收清單）＋ `.claude/skills/gsap-*/SKILL.md`（8 包官方 GSAP AI Skills 已入庫 — 這是一般資料夾，**手動打開對應包讀全文**，選包路由表在 MOTION-DIRECTION §6）。
2. 完成的定義 = `npm run verify` 綠燈（一鍵 merge gate；root 與 apps/mobile 都要 `npm ci` 過才跑得動）。
3. **絕不直推 main** — 一律 `feat/*` 分支 → PR。CI 有新 `guards` job：新增 `TEI`/`PR99` 或 preview JS 語法錯誤會直接紅燈。
4. squash-merge 後：`git fetch origin main && git reset --hard origin/main` 同步分支再開下一個 PR（PLAYBOOK §4）。

## 現況（與 2026-06-30 note 的差異）

- 5-step onboarding **已 merge 進 main**（PR #151）；`/story/` Hero 已是 front door（PR #152，locked asset — polish only）。固定網址 `/preview/` 已反映 5-step overlay。
- 雲端（Claude Code）已完成日常 Soul Scan 揭曉鏈（mobile，mock 階段）：Scan tab → maturity → ceremony → processing 分流 → **日常掃描直接進 `/scan/result` 揭曉（今日內在天氣）**，`recordScan` 更新 maturity/history、Today ring 同步。首次基線照舊走 established。分數是 mock（`features/face-baseline/utils/dailyScan.ts`，JSDoc 已標明），等原生相機接 `packages/engine` scoring。

## 桌機 Antigravity 的工作清單（需要真瀏覽器/實機/Mac，雲端做不了）

1. **`/preview/` onboarding→Soul Scan polish pass**（沿用 2026-06-30 note 的調參地圖，現在直接在 main 上開 `feat/*` 分支做）：真 CDN（GSAP/Three/MediaPipe/Inter）下逐 beat 走一遍、對齊 founder mockups、調 `AUTO` dwell / `orbTo()` eases / `HOLD_MS`、驗 `prefers-reduced-motion` 與 ~390px、真 iPhone Safari 相機 handoff。Optional high-value：把 CSS `.ob-orb` 換成真 `TENKI_STARDUST` 品牌球（需 GPU live preview）。改 preview 前**必讀 `docs/PLAYBOOK.md` §6**（iOS 陷阱全集）。
2. **Mobile 日常掃描揭曉 — 設計任務（2026-07-03 更新）**：founder 已否決兩個獨立結果頁（web `scan-result.html` 與 RN `app/scan/result.tsx`，均已刪）— **結果頁體驗一律以 `/preview/v6/` 星塵揭曉為準**。現況：日常 ceremony → processing → 直接回 Today，分數環即揭曉（過渡態）。桌機任務：與 founder 對齊後，把 v6 的揭曉儀式（星塵 takeover → 分數收斂 → zone 揭示）移植成 RN 版（Reanimated 3 + Skia，禁 SVG；mock 分數已由 `dailyScan.ts` 供給 scan-store）。先出 mockup 或以 `/preview/v6/?from=baseline` 實走對齊節奏，別自行發明新視覺。
3. **原生 lane（需 Mac）**：vision-camera 真臉部信號 → 餵 `updateQuality`（目前 mock 流程 quality 全 0）→ `estimateConfidence` 就會有真值 → `deriveDailyEdgeScore` 自動走真 confidence 分支；最終把 mock 換成 `packages/engine` scoring（screens 內有 `INTEGRATION (...)` 標記點）。
4. **手指「提升精度」層 — 2050 視覺動效 + 真訊號（founder 指派 2026-07-06，開工單：`docs/prompts/antigravity-finger-precision-kickoff.md`）**：雲端骨架已上（`c743bb4`：`#edgeConfidence` 入口 pill、獨立 `openPrecisionBaseline()`、`applyPrecision()`、`html.precision-calibrated` 視覺 hook、「手指 ✓」chip）。你的部分＝(A) 把 `.baseline-flow` 儀式打成 2050 生物儀器（熱感應手指熱場＋良好/歪掉/放開三態、生理正確 PPG 波形、金色星塵完成——規格全在開工單）；(B) 併 PR #148 真後鏡頭 PPG 接進 `'scan'`（取代 68 BPM mock）＋真 iPhone / iOS OOM 調參。接線契約 `docs/FINGER-PRECISION-WIRING.md` 動前必讀；手指是**可選校準層**、非主流程；入口分離、勿碰臉掃星塵 takeover；user-facing 用「手指」不用 PPG、禁「補強」。
5. 動任何 preview/品牌資產前查 locked 清單：`SYSTEM.md` §8（/story/ Hero + 星塵球）、本檔 §18（logo）、`brand/TAGLINE-SYSTEM.md`。

---

# 2026-06-30 CONTINUATION NOTE (superseded by 2026-07-03 note above)

This note is the current handoff. If any older setup text below conflicts with this section, this section wins.

## What was just built

A cinematic **5-step pre-camera onboarding** that plays *on top of* the Soul Scan at `/preview/`.
Files: `apps/preview/soul-enroll.html` (the `#onboarding` overlay + its inline CSS) and
`apps/preview/soul-onboarding.js` (the step engine). Branch `claude/gsap-ai-skills-install-p55uh0`,
commits `1bd01e8..b8b278b`. The scan FSM in `soul-enroll.js` is untouched — the overlay hands off via
`window.TENKI_ENROLL.begin()`.

## Deployment anchor — extend THIS surface, integrate into `main`

The final target is the live front door **https://tenki-emotion-app.vercel.app/preview/**, which serves
`apps/preview/soul-enroll.html` (see `docs/DEPLOYMENT_MAP.md`). Perfect the onboarding→Soul-Scan experience
*on this exact surface* — do **not** fork it to `/story/` or a new route. The overlay and the real scan are
one continuous flow; the end state is a flawless `/preview/`.

Reality right now: that fixed URL **only reflects `main`**, and `main` does **not** yet contain this work — the
5-step overlay lives only on branch `claude/gsap-ai-skills-install-p55uh0` (8 commits ahead). So the public
`/preview/` URL still shows the OLD 3-panel onboarding until this branch merges. Don't be confused if the live
site doesn't match these notes yet — you are working ahead of `main`.

How to see / ship it:
- **Locally:** serve repo root on the branch and open `apps/preview/soul-enroll.html` (allow the camera at step 5).
- **Branch preview:** once a PR exists, the Vercel bot comment on the PR has a branch-preview link reflecting the
  branch's `/preview/`.
- **"Perfectly integrated" = merged to `main`.** Per `docs/DEPLOYMENT_MAP.md` the flow is: Antigravity (desktop)
  polishes on the branch → Claude Code opens the PR, runs verification, merges → ~1–2 min later the fixed
  `/preview/` URL updates. Push your polish to the same branch; Claude Code handles the PR + merge.

The five beats (one living orb + dashed baseline travel through the scene, cool→warm):

1. **Welcome** — "Calibrate Your Emotional Radar" + "Return to baseline. Find your turning point." → `Begin` tap.
2. **Emotional Radar** *(auto-advance ~3.6s)* — Expansion/Contraction axis, orb sits below the dashed baseline.
3. **Reframe** *(auto-advance ~4.2s)* — "You're not the problem. / Your state is." + a full-bleed bent-line
   turning-point mark (sharp narrow peak, left of centre).
4. **Calibration** — warm wash; **hold-to-calibrate** pulls the orb back up to baseline, then advances.
5. **Secure Access** — privacy points → `Enable Camera` (real user-gesture) → hands off to the scan.

Steps 2 & 3 are buttonless "waiting transitions": auto-advance on a timer, tap-anywhere to skip, the active
progress dot fills like a timer, and `prefers-reduced-motion` disables the timer (tap to advance).

## Why this needs your hands, not just mine

Same hard sandbox limit as the `/story/` handoff: my cloud sandbox blocks outbound CDN traffic, so I cannot
load **GSAP / Three.js / MediaPipe / the Inter web font** in a real browser. Every screenshot I took uses a
system-font fallback and the GSAP orb choreography was only verified structurally (Playwright: step state,
no-console-error, no-overflow), never *watched*. Pixel-level alignment to the founder's mockups, real type
metrics/wrapping, the orb's feel, the hold interaction, and real mobile Safari (`dvh`, safe-area, the camera
permission gesture) all need a real desktop/phone — your lane.

## What to do (polish pass, not a rebuild)

1. `git fetch origin claude/gsap-ai-skills-install-p55uh0 && git checkout claude/gsap-ai-skills-install-p55uh0`
2. Serve repo root (`python -m http.server` / `npx serve .`) and open `apps/preview/soul-enroll.html`
   (this is what `/preview/` serves). It requests the camera at step 5 — allow it to see the full handoff.
3. Walk all 5 steps with **real Inter** loaded and pixel-align to the founder's three mockups
   (Radar, Reframe, Calibration). Founder will hand you the mockups; my committed screenshots are
   system-font approximations, not the target.
4. Tune feel directly (this is polish — do not restructure the HTML/FSM):
   - Auto-advance dwell: `AUTO = { 2: 3600, 3: 4200 }` in `soul-onboarding.js`.
   - Orb travel + eases: `orbTo()`, `ORB_REST/ORB_RADAR/ORB_CAL_START`, `HOLD_MS = 1700`, `armCalibration()`.
   - Scene CSS in `soul-enroll.html`: `#ob-warm` (warm gradient), `.ob-orb`, `.ob-baseline`/`.ob-axis`,
     `.ob-turning svg path` (the bent-line mark), `#ob-progress`/`#ob-hint`.
   - **Optional upgrade (high value):** swap the CSS placeholder `.ob-orb` for the real brand
     `TENKI_STARDUST` orb (`apps/preview/v6/stardust.js`) so onboarding and the rest of the app share the
     same signature orb — worth doing with live GPU preview.
5. Verify `prefers-reduced-motion: reduce` (DevTools → Rendering): no auto-advance, tap advances, scene snaps.
6. Verify ~390px mobile width: no horizontal overflow, the full-bleed turning line still reaches both edges.
7. Commit on the same branch, one commit per meaningful change; screenshot each beat and report back — founder
   wants to see screenshots before merge to `main`.

## Constraints (same hard rules)

- Do **not** restructure the scan FSM in `apps/preview/soul-enroll.js`, and keep `Enable Camera` (step 5) as a
  real user tap that calls `window.TENKI_ENROLL.begin()` inside the gesture — camera permission depends on it.
- Do not touch `apps/web/` (frozen). No `any` in any TS you touch; no medical/financial copy; no raw biometric upload.
- **Locked — do not redesign:** the `/story/` Hero (`apps/preview/story.html` `#hero` + the scrolling stardust orb).
  Founder-loved; headline "Read your edge before it reads you." and the orb stay. Polish/perf OK, redesign is not.
  See `SYSTEM.md` § 8 "Preserved design assets". (This `/preview/` onboarding task is separate from `/story/`.)
- New user-facing copy must stay compliance-safe (it currently passes `packages/engine/src/compliance/safe-copy`'s
  vocabulary) — keep the Radar / Baseline / Calibration / Turning Point language per `SYSTEM.md` / `docs/brand.md`.
- Commit-Per-Todo per `CLAUDE.md`; stay on `claude/gsap-ai-skills-install-p55uh0`.

---

# 2026-06-28 CONTINUATION NOTE (supersedes 2026-06-18 note below)

This note is a prior handoff (the `/story/` landing page). If any older setup text below conflicts with this section, this section wins.

## What was just built

A new cinematic scroll-narrative landing page at `apps/preview/story.html` + `apps/preview/story.js`
(branch `claude/gsap-ai-skills-install-p55uh0`, commits `55e8800..8ff9d04`, will route to `/story/` once merged to `main`).

It replaces the "generic AI SaaS template" feel with: creative-developer-portfolio × AI-dashboard × digital-magazine
pacing — Hero entrance (TENKI_STARDUST orb), 3 ScrollTrigger-pinned product-story panels, a stylized
Login→Dashboard "unlock" transition, a Dashboard preview section (animated phone frame embedding the real `/v3/`
dashboard via iframe), and a footer CTA reveal. All animation is GSAP 3.12.5 + ScrollTrigger, transform/opacity-only,
wrapped in `gsap.matchMedia()` for `prefers-reduced-motion`, following the `.claude/skills/gsap-*` conventions.

## Why this needs your hands, not just mine

Claude Code's cloud sandbox blocks outbound CDN traffic (`cdnjs.cloudflare.com`, etc.) at the network-policy level —
confirmed via the proxy status check, this is a hard sandbox restriction, not a code bug. That means I could write
and syntax-check every animation timeline, but I could never actually load the page in a real browser and watch
GSAP/ScrollTrigger/Three.js execute. All my verification was static (layout, no-console-error, no-horizontal-overflow)
via Playwright against a local server with CDN scripts failing to load.

You have a real desktop browser with full internet access. This is exactly the missing step: open the page for real,
watch each beat actually play, and tune timing/easing until it has genuine Mobbin/Dribbble-grade cinematic feel —
the thing that can't be verified from static code review.

## What to do

1. `git fetch origin claude/gsap-ai-skills-install-p55uh0 && git checkout claude/gsap-ai-skills-install-p55uh0`
   (or pull if already checked out)
2. Serve the repo root locally (e.g. `npx serve .` or `python -m http.server`) and open
   `apps/preview/story.html` directly in Chrome/Edge.
3. Scroll through the whole page and visually check each of the 5 `story.js` sections:
   - `initHero` — stardust orb entrance + headline word-stagger
   - `initStoryPanels` — 3 pinned scroll-scrubbed story panels
   - `initTransition` — unlock-ring/core "breathing" + dissolve into dashboard
   - `initDashboard` — phone-frame tilt-in entrance + scroll parallax, confirm the `/v3/` iframe loads inside it
   - `initFooter` — CTA reveal
4. Tune durations/eases/stagger values directly in `apps/preview/story.js` for pacing/feel — do not restructure the
   HTML or rewrite the page; this is a polish pass, not a rebuild.
5. Test `prefers-reduced-motion: reduce` (DevTools → Rendering → emulate CSS media) — every section should
   snap to its final state with no animation.
6. Test mobile width (~390px) for no horizontal overflow and graceful stacking.
7. Commit any tuning changes on the same branch, one commit per meaningful change, and push. Take screenshots
   of the key beats (hero, a story panel mid-scroll, the unlock transition, the dashboard reveal) and report back —
   founder wants to see screenshots before this gets merged to `main`.

## Constraints (same hard rules as always)

- Do not touch `apps/web/` (frozen).
- Do not restructure `apps/preview/soul-enroll.html` or `apps/preview/v6/` — `story.html` only embeds `/v3/` via
  iframe, it doesn't modify it.
- No `any` in any TypeScript you touch elsewhere in the repo; no medical/financial copy; no raw biometric upload.
- Keep Commit-Per-Todo discipline per `CLAUDE.md`.

---

# 2026-06-18 CONTINUATION NOTE (READ THIS FIRST)

This note is the current handoff. If any older setup text below conflicts with this section, this section wins.

## Product & Developer Persona Context
- **Role**: World-class Silicon Valley product architect, privacy-first AI systems designer, App Store compliance strategist, and senior full-stack mobile engineer.
- **Mission**: Develop **Tenki Core** (iOS/Android subscription app) with our partner (Founder).
- **Core Principles**: Privacy-first (local biometric processing), compliance-safe messaging (no financial/medical claims), premium UX.

## Environment status

- Repo freshly cloned on 2026-06-18 into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Portable Node.js (LTS v22.22.3) installed at `C:\Users\patron\.gemini\antigravity\scratch\tools\node`
- Portable Git (MinGit v2.45.1) installed at `C:\Users\patron\.gemini\antigravity\scratch\tools\git`
- `start_env.bat` and env scripts in repo root are wired to these portable paths.
- User PATH environment variables have been persistently configured to include these tool paths.
- Workspace root dependencies installed (`npm install` completed).
- Mobile app (`apps/mobile`) dependencies installed (`npm install` completed).
- Verified on this machine:
  - Node.js `v22.22.3` (satisfies Vite 7 and React Native requirements)
  - npm `10.9.8`
  - Git `2.45.1.windows.1`

## PATH configurations

On this machine, Node.js and Git/MinGit paths are persistently added to the User `PATH` environment variable.

You can also run one of these to double check or force path initialization:
1. Launch the shell via `start_env.bat`
2. Or in PowerShell: `$env:PATH = "C:\Users\patron\.gemini\antigravity\scratch\tools\node;C:\Users\patron\.gemini\antigravity\scratch\tools\git\cmd;$env:PATH"`


## Active app entry point

The active mobile app is `apps/mobile`, not the root package.

Use this flow:

```powershell
cd apps\mobile
npm start
```

Other valid commands:

```powershell
npm run web
npm run android
npm run ios
```

`README.md` has been updated to point collaborators to `apps/mobile` and `docs/DEPLOYMENT_MAP.md`. Treat the deployment map as the canonical route/source reference.

## Current product/code status

- The active product direction is still the v3 privacy-first, App Store-safe TENKI blueprint below
- `apps/mobile` already contains an Expo Router 5-tab shell:
  - `app/(tabs)/index.tsx` -> Today
  - `app/(tabs)/scan.tsx` -> Scan
  - `app/(tabs)/session.tsx` -> Session
  - `app/(tabs)/timeline.tsx` -> Timeline
  - `app/(tabs)/lab.tsx` -> Lab
- Earlier engine/domain/shared work already exists and should be reused, not rebuilt from scratch
- The next real execution focus is Phase C integration and polish inside `apps/mobile`

## Recommended next order

1. Run `apps/mobile` locally and verify the 5-tab shell renders correctly
2. Audit mobile stores/components against `packages/engine`, `domain`, and `packages/shared`
3. Replace mock scan/session flows with real engine/domain contracts where ready
4. Clean up any remaining stale docs that still imply the repo root is the primary app entry point
5. Continue to preserve compliance-safe copy and privacy-first architecture from this blueprint

## Working tree note

- As of 2026-05-14, `apps/mobile/package-lock.json` changed because dependencies were freshly installed on this new machine
- Keep that file unless intentionally regenerating mobile dependencies

## Companion files

- `task.md` contains the immediate execution checklist for the next session
- `MEMORY.md` contains the matching 2026-05-14 machine/setup note
- `docs/DEPLOYMENT_MAP.md` is the URL/source-of-truth map for deployed routes, previews, and what each one actually means

---

# TENKI CORE — ANTIGRAVITY MASTER BLUEPRINT v4.1

> **最後更新**：2026-06-12
> **版本**：v4.1
> **狀態**：Active — Canonical Source of Truth
> **維護者**：Founder + Autonomous Agents

---

## 0. Executive Definition

**TENKI CORE** 是一款 **privacy-first cognitive wellness** 行動應用程式。

### TENKI 是什麼

| 維度 | 定義 |
|------|------|
| 產品定位 | 幫助使用者理解自己在高壓情境下的**生理與情緒準備度**，並協助回到多巴胺基準線 |
| App Store 分類 | Health & Fitness |
| 核心指標 | Decision Edge Score (0–100) |
| 隱私模型 | Local-first + Cloud-minimal |
| 商業模式 | Free + Premium 訂閱制 |
| 平台 | iOS + Android |

### TENKI 不是什麼

| 禁止定位 | 原因 |
|----------|------|
| 交易工具 / 金融建議 app | 觸發 App Store 金融類審查，需額外合規 |
| 醫療診斷 / 臨床工具 | 需要 FDA/CE 認證，Apple 會要求醫療 claim 驗證 |
| 績效預測 / 市場時機工具 | 暗示可預測財務結果，違反 App Store 4.2 |
| 情緒辨識 / 臉部分析 app | 觸發 Apple 隱私政策審查，GDPR 特殊類別 |

### 核心身份聲明

```
TENKI 幫助你在做重要決策前，先了解自己的身心準備度。
它不提供醫療診斷，也不提供任何金融建議。
你的生理數據永遠留在你的裝置上。
```

---

## 0.1 Brand Taglines (Canonical — 2026-06-12)

這是 TENKI 的品牌語言定義。所有 AI agent、文案撰寫、行銷素材都應優先參考此節。

### Hero Line

```
Turn volatility into turning points.
```

### Subtitle (Preferred)

```
Return to baseline. Find your turning point.
```

這兩句合起來完整描述 TENKI 的價值：

| 層面 | 意涵 |
|------|------|
| 外在（市場 / 情緒波動） | Turn volatility |
| 內在（多巴胺 / 呼吸 / HRV） | Return to baseline |
| 結果（人生 / 情緒轉機） | Find your turning point |

### 品牌語調方向

TENKI 的視覺與文字語調必須符合：

- 冷靜（Calm）
- 科學感（Scientific）
- 具有轉折力量（Grounded, pivotal）

**避免**：過度療癒系（Too gentle / spa-like）  
**避免**：過度交易宅（Too niche / trader-only）

### 中文品牌句

```
在你做決定之前，先了解你自己。
```

副句：

```
回到基準線。找到你的轉機。
```

---

## 0.2 Dopamine Baseline Model (v1.0 — 2026-06-12)

TENKI 的核心洞察之一：**把「轉機」變成可訓練、可量化的能力。**

這不只是交易工具，也不只是冥想工具。TENKI 是一個幫助使用者觀察、調節、並記錄自己多巴胺狀態的系統。

### 多巴胺三狀態模型

| 狀態 | 描述 | 對應行為 | TENKI 介入方式 |
|------|------|----------|----------------|
| **Above Baseline（過高）** | 過度興奮、FOMO、衝動、獎勵追逐、多巴胺過載 | 衝動交易、過度滑手機、過度消費 | 呼吸引導、暫停提醒、雙耳節拍 |
| **At Baseline（基準線）** | 穩定、清晰、可覺察、適合做決策 | 理性決策、深度專注、清醒判斷 | 確認狀態、記錄身體訊號、保持流程 |
| **Below Baseline（過低）** | 戒斷反應、空虛、疲勞、衝動反撲 | 癮頭發作、FOMO 壓力、無力感 | 忍耐衝動引導、戒斷支持、漸進回穩 |

### 技術可行性背景

> 以下為技術方向說明，供 AI agent 理解產品邏輯背景。不構成醫療聲明。

目前尚無任何 App 或裝置能給出精確的「多巴胺 mg/dL 數值」，但透過多模態數據融合，TENKI 可以實現對多巴胺狀態的**間接、相對性監測**：

| 感測來源 | 指標 | 與多巴胺狀態的關聯 |
|----------|------|-------------------|
| Apple Watch（腕部 PPG + 加速規） | HRV | 醫學研究證實 HRV 與大腦紋狀體多巴胺耗損量高度相關 |
| 手機主鏡頭（指尖 PPG / rPPG） | 血壓波形模擬 (APW) | 高採樣率信號，可分析血管彈性與壓力指數 |
| Apple Watch 長期趨勢 | HRV + 活動量 | 建立個人多巴胺「基準線」，評估倦怠或多巴胺耐受期 |
| rPPG + 行為模式 | 心率突增 + 反應速度 | 反映大腦面對「獎勵刺激」時的即時多巴胺噴發強度 |

**可行性定位：**

- 醫學診斷級別：不行，無法取代 PET 掃描或專業血液檢查。
- 生活型態管理：高度可行。透過多維度數據融合 + AI 模型，可實現相對性的多巴胺狀態觀察。

### 回到基準線的功能工具

| 工具 | 說明 | 狀態 |
|------|------|------|
| 4-7-8 呼吸法 | 激活副交感神經，降低過度興奮狀態 | Lab 已有 |
| 方框呼吸 (Box Breathing) | 穩定 HRV，適合 Trader Mode | Lab 已有 |
| 雙耳節拍（Binaural Beats） | 腦波引導，協助進入 Alpha/Theta 狀態 | 待開發 |
| 多巴胺狀態日誌 | 使用者自評當下狀態（過高 / 基準 / 過低） | 待開發 |
| 身體訊號記錄 | 記錄呼吸、心率、HRV、壓力感 + 主觀感受 | 部分完成 |

---

## 1. Product Positioning

### 1.1 一句話定位

> **在你做最重要的決定之前，先確認你的身體準備好了沒有。**

### 1.2 Product Pillars

| Pillar | 說明 |
|--------|------|
| **Decision Readiness** | 核心價值：你的身心狀態是否適合做出清晰判斷 |
| **Self-awareness** | 透過生理數據理解自己的壓力、恢復、專注模式 |
| **Process Discipline** | 建立可重複的決策前準備流程 |
| **Privacy-first** | 所有敏感數據留在裝置端，零遙測原始生理數據 |
| **Baseline Return** | 提供工具幫助使用者回到多巴胺基準線 |

### 1.3 允許討論的主題

✅ 專注 (Focus)
✅ 壓力 (Stress)
✅ 恢復 (Recovery)
✅ 情緒平衡 (Emotional Balance)
✅ 清晰度 (Clarity)
✅ 決策準備度 (Decision Readiness)
✅ 自我覺察 (Self-awareness)
✅ 呼吸與身體節律 (Breathing & Body Rhythm)
✅ 多巴胺狀態覺察（Dopamine State Awareness）— 相對性、非診斷性
✅ 基準線回歸（Baseline Return）
✅ 衝動控制 / 戒斷支持（Impulse Regulation）

### 1.4 絕對禁止的主題

🚫 金融建議 / 投資建議
🚫 交易信號 / 買賣建議
🚫 市場時機指引
🚫 醫療診斷 / 治療建議
🚫 臨床確定性語言
🚫 績效預測 / 結果保證

### 1.5 Trader Mode 的安全框架

即使產品包含 Trader Mode，它的定義必須是：

| 安全框架 | 說明 |
|----------|------|
| 流程治理 (Process Governance) | 幫助使用者在進入高壓場景前完成準備流程 |
| 準備度閘門 (Readiness Gating) | 在使用者狀態不佳時提供提醒 |
| 情緒調節 (Emotional Regulation) | 協助使用者覺察並管理決策前的情緒狀態 |
| 紀律維持 (Session Discipline) | 建立可重複的決策準備 SOP |

**絕對不能是**：金融建議、交易信號、市場預測。

---

## 2. Compliance Guardrails

### 2.1 語言合規引擎

所有面向使用者的文案必須通過 `packages/engine/src/compliance/safe-copy.ts` 驗證。

#### 禁用詞彙表

| 類別 | 禁用詞 | 安全替代 |
|------|--------|----------|
| 金融 | 交易、買賣、加倉、停損、套利 | 決策、行動、計畫、策略 |
| 醫療 | 診斷、治療、處方、病症 | 觀察、覺察、參考、指標 |
| 確定性 | 保證、一定、必然、肯定 | 建議、可能、傾向、參考 |
| 預測 | 預測、預報、保證獲利 | 觀察、趨勢、模式 |
| TEI 遺留 | TEI、PR99、Trading Edge | Edge Score、Decision Edge |
| 多巴胺醫療聲稱 | 多巴胺濃度、多巴胺診斷、多巴胺治療 | 多巴胺狀態覺察、身體訊號模式 |

#### 安全文案規則

1. 永遠使用「**建議**」而非「應該」
2. 永遠附加「**僅供參考**」免責聲明
3. 永遠使用「**你的身體顯示**」而非「你應該」
4. 永遠使用「**決策準備度**」而非「交易準備度」
5. 永遠使用「**Edge Score**」而非「TEI」或「PR99」
6. 多巴胺相關語言：永遠使用「**相對性觀察**」，絕不聲稱「精確測量多巴胺」

### 2.2 推播通知合規

所有推播通知必須通過 `packages/engine/src/compliance/notification-guard.ts` 驗證。

**禁止出現在推播中的詞彙**：
- 任何金融相關詞彙
- 任何醫療確定性語言
- 「趕快」「立刻」等催促性語言
- 具體數值（如「你的壓力是 85」）

**安全推播模板**：
- `你的身體準備好了 — 現在是保持專注的好時機`
- `建議暫停一下 — 做幾次深呼吸再繼續`
- `今天的恢復表現不錯 — 來看看你的進展`
- `你的身體訊號顯示有回到基準線的跡象 — 記錄一下這個狀態`

### 2.3 App Store Review Guardrails

詳見 `/docs/APP_STORE_COMPLIANCE.md`

---

## 3. Privacy Architecture

### 3.1 核心原則

```
你的身體數據，永遠是你的。
```

| 原則 | 規則 |
|------|------|
| Local-first | 生理訊號、掃描歷史、個人 baseline、反思內容、個人 pattern → 全留裝置端 |
| Cloud-minimal | 僅訂閱狀態、匿名 benchmark → 允許上雲 |
| Zero raw telemetry | 絕不上傳原始 HR/HRV/RR 數據 |
| Encrypted at rest | 裝置端使用加密 SQLite |
| Secrets in Keychain | Token、API key → Keychain / Secure Enclave |
| Consent-separated | 每個數據類別獨立同意 |
| Right to delete | 使用者可隨時完整刪除所有本地數據 |
| Right to export | 使用者可匯出自己的數據 |

### 3.2 數據分類矩陣

| 數據類別 | 儲存位置 | 加密 | 可上傳 |
|----------|----------|------|--------|
| HR / HRV / RR 原始數據 | 裝置端 | ✅ | ❌ |
| Edge Score 歷史 | 裝置端 | ✅ | ❌ |
| Baseline profile | 裝置端 | ✅ | ❌ |
| 反思 / 日誌內容 | 裝置端 | ✅ | ❌ |
| 掃描歷史 | 裝置端 | ✅ | ❌ |
| 多巴胺狀態日誌 | 裝置端 | ✅ | ❌ |
| 訂閱狀態 | 雲端 | ✅ | ✅ |
| 匿名 benchmark | 雲端 | ✅ | ✅ (opt-in) |
| Feature flags | 雲端 | — | ✅ |
| Crash reports | 雲端 | — | ✅ (opt-in) |

詳見 `/docs/PRIVACY_ARCHITECTURE.md`

---

## 4. System Architecture

### 4.1 架構總覽

```
┌─────────────────────────────────────────────────────┐
│                    apps/mobile                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Today    │ │  Scan    │ │ Session  │ Timeline Lab│
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │             │            │                   │
├───────┴─────────────┴────────────┴───────────────────┤
│              packages/engine (v3)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ biometric│ │ baseline │ │ scoring  │ │session │ │
│  │ hrv/rr/  │ │ Welford  │ │EdgeScore │ │state-  │ │
│  │ stress   │ │ timebkt  │ │Detector  │ │machine │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │compliance│ │ common   │ │ legacy/  │            │
│  │safe-copy │ │ ewma     │ │ adapter  │            │
│  │notif-grd │ │ types    │ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
├──────────────────────────────────────────────────────┤
│              packages/shared                         │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────────┐  │
│  │zone-cfg │ │subscript │ │design │ │feature-   │  │
│  │3-zone   │ │2-tier    │ │tokens │ │flags      │  │
│  └─────────┘ └──────────┘ └───────┘ └───────────┘  │
│  ┌─────────────┐ ┌────────────────┐                 │
│  │copy/         │ │components/     │                 │
│  │disclaimers   │ │ParticleSphere  │                 │
│  │onboarding    │ │ResultSummary   │                 │
│  └─────────────┘ └────────────────┘                 │
├──────────────────────────────────────────────────────┤
│              Local Storage Layer                     │
│  ┌──────────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Encrypted    │ │Keychain │ │HealthKit│          │
│  │ SQLite       │ │/Secure  │ │/Health  │          │
│  │              │ │Storage  │ │Connect  │          │
│  └──────────────┘ └─────────┘ └─────────┘          │
└──────────────────────────────────────────────────────┘
```

### 4.2 引擎層模組

| 模組 | 路徑 | 職責 |
|------|------|------|
| Biometric | `engine/src/biometric/` | HRV 處理、RR 估測、Stress Proxy |
| Baseline | `engine/src/baseline/` | Welford 在線演算法、時段分桶、成熟度評估 |
| Scoring | `engine/src/scoring/` | Edge Score 引擎（8 維度）、Edge Detector |
| Session | `engine/src/session/` | 10 狀態機、閘門、模板 |
| Compliance | `engine/src/compliance/` | 安全文案引擎、推播守衛 |
| Common | `engine/src/common/` | 型別系統、EWMA、Legacy Adapter |

---

## 5. Core Engines

### 5.1 Edge Score Engine

**取代舊版 TEI/PR99 系統。**

| 維度 | 權重 | 說明 |
|------|------|------|
| HRV vs Baseline | 0.22 | HRV 偏離個人基線的程度 |
| HR Stability | 0.12 | 心率穩定度 |
| Respiration Stability | 0.10 | 呼吸穩定度 |
| Stress Proxy vs Baseline | 0.15 | 壓力指標偏離基線程度 |
| Sleep Recovery | 0.13 | 睡眠恢復品質 |
| Recent Trend | 0.10 | 近期分數趨勢 |
| Baseline Freshness | 0.08 | 基線數據新鮮度 |
| Signal Quality | 0.10 | 量測信號品質 |

#### Zone 分類

| Zone | 分數範圍 | 意義 |
|------|---------|------|
| Clear | 70–100 | 身心狀態清晰，適合做重要決策 |
| Neutral | 40–69 | 狀態平穩，建議留意 |
| Strain | 0–39 | 壓力偏高，建議暫緩重要決策 |

#### Confidence Band

| Band | 範圍 | 說明 |
|------|------|------|
| High | ≥ 0.80 | 數據充足，可信度高 |
| Moderate | 0.55–0.79 | 數據尚可，參考使用 |
| Low | < 0.55 | 數據不足，僅供初步參考 |

### 5.2 Edge Detector

即時穩定偵測器，用於偵測持續性的 clear/focused 狀態視窗。

| 參數 | 值 | 說明 |
|------|------|------|
| Soft 門檻 | Score ≥ 68, Confidence ≥ 0.70 | 軟偵測 |
| Strong 門檻 | Score ≥ 78, Confidence ≥ 0.82 | 強偵測 |
| 最少連續視窗 | 2 | 確認偵測需連續 2 個視窗 |
| 持續時間門檻 | 180 秒 | 觸發提醒前需持續 3 分鐘 |
| 每日提醒上限 | 3 次 | 避免過度打擾 |

### 5.3 Baseline Engine

使用 Welford's Online Algorithm 建立個人化基線。

| 特性 | 說明 |
|------|------|
| 時段分桶 | Morning (05–12), Midday (12–18), Evening (18–05) |
| 衰減機制 | 超過 100 個樣本時套用 0.95 衰減 |
| 成熟度分級 | new (0) → building (1+) → ready (5+) → mature (15+ & 3+ days) |

### 5.4 Stress Proxy

| 組成 | 權重 | 說明 |
|------|------|------|
| HRV 成分 | 0.60 | HRV 下降 = 壓力上升 |
| HR 成分 | 0.40 | HR 上升 = 壓力上升 |

| Level | 分數 |
|-------|------|
| REST | 0–25 |
| LOW | 26–50 |
| MEDIUM | 51–75 |
| HIGH | 76–100 |

---

## 6. Scenario Modes

TENKI 支援 4 種情境模式，每種模式調整 UI 語氣與焦點，但**核心引擎邏輯相同**。

| Mode | 目標使用者 | 焦點 | 預設 |
|------|-----------|------|------|
| Health Reset | 所有人 | 壓力管理、恢復追蹤、基準線回歸 | ✅ |
| Focus | 知識工作者 | 專注力、深度工作準備 | — |
| Performance | 運動員 | 身體準備度、訓練就緒 | — |
| Trader | 交易者 | 決策紀律、情緒調節 | — (需手動啟用) |

### Mode 差異

| 面向 | Health Reset | Focus | Performance | Trader |
|------|-------------|-------|-------------|--------|
| Zone 文案 | 恢復 / 穩定 / 疲勞 | 專注 / 平穩 / 分散 | 就緒 / 休息中 / 過度 | 清晰 / 觀察 / 暫停 |
| 主要指標 | Stress + Recovery | Focus Score | Readiness | Edge Score |
| Session 模板 | — | Deep Work | Training | FBD/CANSLIM/Mode2 |
| 閘門嚴格度 | 寬鬆 | 中等 | 中等 | 嚴格 |
| Disclaimer | 健康類 | 通用 | 運動類 | 決策類 (強調非金融) |

---

## 7. Trader Templates

Trader Mode 提供 3 種**決策紀律模板**。

> ⚠️ 模板是「流程治理工具」而非「交易策略」。

### 7.1 FBD (Fundamental Based Decision)

| 階段 | 項目 | 時間 |
|------|------|------|
| Pre-check | Edge Score ≥ 65, Confidence ≥ Moderate | — |
| Breathing | 4-7-8 呼吸法 | 2 min |
| Checklist | 5 項自我檢查 | — |
| Session | 專注計時 | 25 min |
| Reflection | 決策品質自評 | — |

### 7.2 CANSLIM GS (Growth Strategy Discipline)

| 階段 | 項目 | 時間 |
|------|------|------|
| Pre-check | Edge Score ≥ 70, Confidence ≥ Moderate | — |
| Breathing | 方框呼吸 | 3 min |
| Checklist | 7 項策略紀律檢查 | — |
| Session | 專注計時 | 45 min |
| Reflection | 紀律遵守度自評 | — |

### 7.3 Mode 2 (Quick Decision Gate)

| 階段 | 項目 | 時間 |
|------|------|------|
| Pre-check | Edge Score ≥ 60 | — |
| Quick scan | 30 秒快速掃描 | 0.5 min |
| Gate | 通過/暫停 二元決策 | — |

---

## 8. Scan & Readiness

### 8.1 掃描是 TENKI 的核心互動

掃描不是附屬功能。它是使用者與 TENKI 互動的**起點**。

### 8.2 掃描類型

| 類型 | 時長 | 用途 | 輸出 |
|------|------|------|------|
| Baseline | 60s | 建立/更新個人基線 | Baseline Profile 更新 |
| Quick Scan | 30s | 快速確認當前狀態 | Edge Score + Zone |
| Deep Scan | 60s | 完整分析 + 信心分數 | Edge Score + Drivers + Confidence |
| Trader Check | 30–60s | Session 前閘門掃描 | Gate Result (pass/caution/hold) |

### 8.3 Finger Heat Zone

> ♻️ **重新定位（2026-07-05）** — 臉部掃描是唯一主流程；手指 PPG **退為「可選補強層」**（看到臉掃結果後才出現的 opt-in「提升精度」），**不是**獨立主入口。本節的舊「準備閘門」框架已過時，現行接法（重用 `/preview/v6/` `.baseline-flow` + PR #148 真訊號）以 **`docs/FINGER-PRECISION-WIRING.md`** 為準，方向錨見 `MEMORY.md` #12。下方表格僅作 UI 元件歷史參考。註：`packages/scan/`（FHZ 訊號 pipeline）是底層基礎建設，保留。

Finger Heat Zone 是**功能性準備閘門**，不是裝飾 UI。

| 功能 | 說明 |
|------|------|
| Camera Preview | 即時手指貼鏡頭預覽 |
| ROI Overlay | 感測區域標示 |
| Signal Quality Meter | 即時信號品質回饋 |
| Coverage Meter | 手指覆蓋率 |
| Stability Meter | 信號穩定度 |
| Status Pill | SEARCHING → DETECTING → LOCKED → SCANNING |
| Instruction Text | 即時引導文字 |

### 8.4 信號品質閘門

| Grade | Score | 說明 | 允許繼續 |
|-------|-------|------|----------|
| A | ≥ 85 | 優秀 | ✅ |
| B | 70–84 | 良好 | ✅ |
| C | 55–69 | 可接受 | ✅ (低信心) |
| D | 40–54 | 不穩定 | ⚠️ (提醒) |
| F | < 40 | 太差 | ❌ (重試) |

詳見 `/docs/SCAN_READINESS_SPEC.md`

---

## 9. Session Governance

### 9.1 狀態機 (10 States)

```
draft → configured → precheck → scanning → gated
  → active → paused → completed → reflection_pending → archived
```

| State | 說明 | 使用者動作 |
|-------|------|-----------|
| `draft` | 初始空白 | 選擇模板/模式 |
| `configured` | 已設定參數 | 開始 pre-check |
| `precheck` | 準備檢查中 | 自動進行 |
| `scanning` | 掃描量測中 | 保持靜止 |
| `gated` | 閘門評估結果 | 確認/重試/放棄 |
| `active` | Session 進行中 | 專注/暫停 |
| `paused` | 暫停中 | 恢復/結束 |
| `completed` | 已完成 | 填寫反思(可選) |
| `reflection_pending` | 等待反思 | 填寫/跳過 |
| `archived` | 已歸檔 | — |

### 9.2 閘門邏輯

| 結果 | 條件 | 允許進入 Session |
|------|------|----|
| `clear_pass` | Score ≥ 70 & Confidence ≥ 0.70 | ✅ |
| `soft_caution` | Score 40–69 或 Confidence < 0.70 | ✅ (附提醒) |
| `red_gate` | Score < 40 | ❌ |
| `force_hold` | 連續 2+ 次 red_gate | ❌ (建議休息) |

### 9.3 Universal Reset

任何狀態都可以透過 `reset` 動作回到 `draft`。

---

## 10. Replay, Timeline, and Lab

### 10.1 Timeline

| 功能 | 說明 |
|------|------|
| 日/週/月視圖 | Edge Score 趨勢圖 |
| 掃描歷史 | 每次掃描的 Score + Zone + Confidence |
| Session 歷史 | 每次 Session 的結果 + 反思 |
| 模式篩選 | 依 Scenario Mode 篩選 |

### 10.2 Lab

| 功能 | 說明 | Premium |
|------|------|----|
| 呼吸練習 | 4-7-8、方框呼吸 | — |
| 雙耳節拍 (Binaural Beats) | 腦波引導，Alpha/Theta 狀態 | ✅ |
| 多巴胺狀態日誌 | 記錄身體狀態 + 自評多巴胺感受 | — |
| 個人 Pattern 分析 | 時段/星期 pattern | ✅ |
| 基線趨勢 | 基線成長追蹤 | ✅ |
| 匿名 Benchmark | 與匿名族群比較 (opt-in) | ✅ |

### 10.3 Replay Engine

| 功能 | 說明 |
|------|------|
| Session 回放 | 逐分鐘 Edge Score 變化回顧 |
| 關鍵時刻標記 | 自動標記高/低點 |
| 學習洞察 | Pattern-based 觀察 (非建議) |

---

## 11. Mobile Information Architecture

### 11.1 底部導航 (5 Tabs)

```
┌──────┬──────┬──────┬──────┬──────┐
│Today │ Scan │Sessn │Tmlin │ Lab  │
└──────┴──────┴──────┴──────┴──────┘
```

| Tab | 功能 | 入口 |
|-----|------|------|
| **Today** | 今日摘要、Edge Score、Zone、快速動作 | 首頁 |
| **Scan** | 掃描入口、Finger Heat Zone、準備度檢核 | 核心互動 |
| **Session** | Session 控制、計時器、閘門、反思 | 流程治理 |
| **Timeline** | 歷史紀錄、趨勢圖、Session 回顧 | 回顧分析 |
| **Lab** | 呼吸練習、雙耳節拍、Pattern 分析、進階功能 | 成長工具 |

### 11.2 拒絕的 IA 方案

以下 IA 方案被明確拒絕：

❌ `Today / Metrics / Profile / More` — 過於通用，無法傳達 TENKI 的互動核心
❌ `Home / Dashboard / Settings` — 被動展示型，不符合主動掃描互動
❌ `Insights / Charts / Analytics` — 過度強調數據，偏離 wellness 體驗

### 11.3 為什麼 Scan 在底部導航

Scan 是 TENKI 的**核心互動動詞**。使用者每次使用 TENKI 的起點，通常是「我想知道我現在的狀態如何」。這個動作必須在底部導航中佔有一席之地，而且應該是**視覺上最突出的 tab**。

---

## 12. Subscription Model

### 12.1 二級制

| Tier | 價格 | 功能 |
|------|------|------|
| **Free** | $0 | 每日 3 次掃描, 基本 Edge Score, 7 天歷史, Health Reset mode |
| **Premium** | TBD / 月 | 無限掃描, 全部 Modes, 全部 Templates, 完整歷史, Lab 進階, Pattern 分析, Benchmark, 雙耳節拍 |

### 12.2 不得付費牆的功能

| 功能 | 原因 |
|------|------|
| 基本掃描能力 | 核心互動不能被鎖住 |
| Edge Score 計算 | 基本價值必須免費體驗 |
| 數據刪除 / 匯出 | 隱私權利永不付費 |
| 基本歷史 (7 天) | 最低限度的自我追蹤 |
| 多巴胺狀態日誌 | 自我覺察是基本功能 |

---

## 13. Growth Architecture

### 13.1 免費→付費漏斗

```
下載 → Onboarding (12 步) → 首次掃描
     → 7 天免費體驗 → 達到掃描上限
     → Premium 轉換
```

### 13.2 留存機制

| 機制 | 說明 |
|------|------|
| 每日掃描習慣 | 通知提醒 + 連續天數追蹤 |
| Baseline 成長 | 隨時間累積的個人基線讓使用者不想放棄 |
| Session 紀錄 | 決策品質追蹤產生回顧價值 |
| Pattern 洞察 | Premium 提供的個人模式分析 |
| 多巴胺日誌 | 記錄自己的情緒狀態轉折點 |

---

## 14. Repo Structure

```
tenki-emotion-app/
├── ANTIGRAVITY.md            ← 你在這裡
├── RULES.md                  ← 開發規則
├── apps/
│   ├── web/                  ← 現有 web prototype (v51.1)
│   └── mobile/               ← 主動開發 Expo/RN app
├── packages/
│   ├── engine/               ← v3 引擎 (TypeScript)
│   │   └── src/
│   │       ├── biometric/    ← hrv, rr, stress-proxy
│   │       ├── baseline/     ← Welford + time buckets
│   │       ├── scoring/      ← Edge Score, Edge Detector
│   │       ├── session/      ← State machine, gate, templates
│   │       ├── compliance/   ← Safe copy, notification guard
│   │       ├── common/       ← Types, EWMA, legacy adapter
│   │       └── legacy/       ← 舊版 TEI 模組 (deprecated)
│   └── shared/               ← 跨平台共用
│       └── src/
│           ├── copy/         ← Disclaimers, onboarding
│           ├── feature-flags/← Feature flag system
│           ├── components/   ← ParticleSphere, ResultSummary
│           ├── zone-config.ts
│           ├── subscription-tiers.ts
│           └── design-tokens.ts
├── core/                     ← 舊版 vanilla JS (legacy)
├── ui/                       ← 舊版 UI components (legacy)
├── docs/                     ← 架構文件
├── tests/                    ← 測試
├── domain/                   ← Domain layer (建設中)
├── templates/                ← Session templates
└── scripts/                  ← Build/deploy scripts
```

---

## 15. Build Order

### Phase 0 — 治理基礎 ✅

- [x] ANTIGRAVITY.md v4.1
- [x] RULES.md / RULES-v3.md
- [x] 型別系統 (common/types.ts)
- [x] 合規引擎 (safe-copy, notification-guard)
- [x] Feature flags
- [x] Zone config (3-zone)
- [x] Subscription tiers (2-tier)
- [x] Design tokens
- [x] Legacy adapter

### Phase A — 引擎核心 ✅

- [x] Edge Score engine (8 維度)
- [x] Session state machine (10 狀態)
- [x] Gate evaluation
- [x] Trader templates (FBD, CANSLIM, Mode 2)
- [x] Biometric modules (HRV, RR, Stress Proxy)
- [x] Baseline engine (Welford + time buckets)
- [x] Edge Detector
- [x] EWMA smoother
- [x] 11 test suites

### Phase B — 基礎建設

- [x] Domain layer (policies, schemas, contracts)
- [ ] Scan pipeline integration (biometric → baseline → scoring)
- [ ] Replay Engine
- [ ] Insight Generator
- [ ] 整合測試 (full pipeline)
- [ ] Dopamine State Journal schema + storage

### Phase C — Mobile App

- [ ] Expo / React Native 初始化 (shell 已建立，需驗證)
- [ ] 底部導航 (5 tabs) — shell 已有
- [ ] Today 頁面
- [ ] Scan 頁面（臉部 Soul Scan）
- [ ] Session 頁面
- [ ] Timeline 頁面
- [ ] Lab 頁面（含雙耳節拍 + 多巴胺日誌）
- [ ] 設定 / Profile

### Phase D — 發布準備

- [ ] App Store 準備 (metadata, screenshots, description)
- [ ] Privacy Policy 頁面
- [ ] Terms of Service 頁面
- [ ] TestFlight 測試
- [ ] App Store 提交

---

## 16. Done = Go

TENKI CORE 的完成標準：

| 項目 | 標準 |
|------|------|
| Edge Score | 8 維度正確計算，3 Zone 正確分類 |
| Scan | 臉部 Soul Scan 可正常擷取信號並產生 Score |
| Session | 10 狀態完整流轉，閘門正確運作 |
| Privacy | 所有敏感數據留在裝置端，加密儲存 |
| Compliance | 所有面向使用者文案通過 safe-copy 驗證 |
| Tests | 所有 test suites 通過 |
| UX | 5 個 Tab 全部可導航，核心流程可操作 |
| App Store | Metadata 準備完成，Reviewer Notes 撰寫完成 |

---

## 17. Agent Instructions

### 17.1 通用規則

1. **先讀本文件**：任何 agent 開始工作前，必須先完整讀取本文件。
2. **語意合規**：所有新增程式碼和文案必須遵守 Section 2 的合規規則。
3. **不動 `apps/web/`**：除非 Founder 明確指示，不修改現有 web prototype。
4. **不用 `any`**：TypeScript 程式碼禁止使用 `any` 型別。
5. **不上傳原始數據**：任何新功能都不得將原始生理數據上傳雲端。
6. **先測試後 commit**：所有新模組必須附帶測試。
7. **遵循 v3 語意**：使用 Edge Score (非 TEI)、Zone (非 PR99)、Session (非 Trading)。
8. **品牌語言**：Hero line = "Turn volatility into turning points." / Subtitle = "Return to baseline. Find your turning point." — 不得修改。

### 17.2 工作流程

```
1. 讀取 ANTIGRAVITY.md
2. 讀取 task.md (如果存在)
3. 確認當前 Phase 進度
4. 執行下一個未完成項目
5. 撰寫測試
6. 更新 task.md
7. Commit + Push
```

### 17.3 命名規則

| 類別 | 規則 | 範例 |
|------|------|------|
| 檔案 | kebab-case | `edge-score.ts` |
| 型別 | PascalCase | `EdgeScoreResult` |
| 函式 | camelCase | `calculateEdgeScore` |
| 常數 | SCREAMING_SNAKE | `EDGE_DETECTOR_THRESHOLDS` |
| 目錄 | kebab-case | `edge-detector/` |
| Commit | Conventional Commits | `feat: add edge detector` |

### 17.4 禁止事項

| 禁止 | 原因 |
|------|------|
| 使用 TEI、PR99 語彙 | v3 語意遷移完成，禁止回退 |
| 上傳原始 HR/HRV/RR | 違反 privacy-first 原則 |
| 修改 `apps/web/` (無指示) | 保護現有 prototype 穩定 |
| 使用 `any` 型別 | 型別安全是核心品質 |
| 產生金融建議文案 | App Store 合規風險 |
| 跳過測試 | 所有模組必須有覆蓋 |
| 聲稱「精確測量多巴胺」 | 違反合規，無科學依據 |
| 修改 Hero / Subtitle 品牌句 | 品牌一致性，需 Founder 明確指示 |

---

## 18. TENKI Brand & Logo System（定案 canonical，2026-06-12）

TENKI brand visuals are not open-ended. **The logo is FINALIZED by the founder — do not redesign it.**

> 品牌「語言」（taglines / voice / 文案規則）的 canonical 在 `docs/BRAND.md`；本節管「視覺」（mark / lockup / 資產）。
>
> 歷史註記：2026-06-12 之前 `apps/mobile/assets/` 的 PNG 是 Expo 範本佔位符；
> 同日曾有一個「Resonance Ensō」圓形 mark 探索版，已被 founder 的定案 logo 取代並移除。
> 定案 mark 的原始出處是 production v6 splash（`apps/preview/v6/index.html`，`/v3/` 路由）。

### 18.1 The Mark — 風掃過的浪（Wind-Swept Wave）

一道被風掃過的浪：實心浪頭 + 向後流動的訊號線。TENKI（天気）= 內在天氣，浪就是內在天氣的形狀。
單一 path 實心 glyph（1024×1024 viewBox），**白色 on 深海軍藍為 canonical**。

### 18.2 Canonical source（master → 衍生）

| 檔案 | 角色 |
|------|------|
| `apps/preview/v6/index.html`（splash 區塊） | **原始定案出處**（含動畫規格） |
| `docs/assets/brand/tenki-mark.svg` | SVG master（currentColor，從 v6 splash 抽出） |
| `apps/mobile/assets/icon.png` | App icon：白 mark on 海軍藍漸層 `#0A1628→#050A14`（1024²） |
| `apps/mobile/assets/adaptive-icon.png` | Android adaptive：白 mark on transparent |
| `apps/mobile/assets/favicon.png` | 白 mark on transparent（48²） |
| `apps/mobile/assets/splash-icon.png` | 白 mark on transparent（開場用） |
| `apps/preview/brand/index.html` | 品牌預覽頁 → `/preview/brand/` |
| `docs/ICON-SYSTEM-BATCH1.md` + `docs/assets/icons/` | UI icon 系統（20 顆功能 icon，獨立於 logo） |

衍生資產一律從 SVG master 重新輸出，不要手改 PNG。

### 18.3 Lockup（三段式，規格不可改）

```
        [mark]                ← 白，breathing 動畫
        TENKI                 ← SF Pro Display・weight 200・letter-spacing 0.32em・#FFFFFF
        CORE                  ← weight 600・letter-spacing 0.4em・#00B4D8 + cyan glow
                                 text-shadow: 0 0 16px rgba(0,180,216,0.4)
  Return to baseline.
  Find your turning point.    ← tagline・rgba(255,255,255,0.65)・letter-spacing 0.05em
```

### 18.4 色彩與動態

- Canonical：白 mark on `linear-gradient(180deg, #0A1628, #050A14)`（v6 splash 背景）。
- Cyan `#00B4D8` 僅用於 CORE 字與 ACTIVE 語境點綴；gold 僅用於 SECURED 語境點綴。
- 動態（v6 splash 既定）：入場 900ms `cubic-bezier(0.2,0.7,0.3,1)` scale 0.94→1；
  待機 6s 呼吸 scale 1↔1.015；wordmark 750ms 延遲入場、CORE 950ms。
- Clear space = mark 高度 25%；淺底用 Navy `#0A1628` 單色版。

### 18.5 Rules（給所有 AI 協作者）

- **Logo 已定案** — do not redesign, redraw, restyle, outline-ify, or reinterpret the mark,
  wordmark, CORE sub-brand, or tagline unless the founder explicitly asks for a brand refresh.
- 衍生新資產（行銷圖、icon、splash）一律從 `docs/assets/brand/tenki-mark.svg` 出發。
- 不加 3D、漸層填色、外發光（CORE 字的既定 glow 除外）、不改浪形。
- Do not create a second competing logo system; 探索版/佔位符不得復用。
- 若不確定 → 先用現有資產，並先問 founder。

## Appendix A — Safe Copy Examples

### A.1 Zone 文案

| Zone | ✅ Safe | 🚫 Unsafe |
|------|--------|-----------|
| Clear | 「你的身體顯示清晰穩定的狀態」 | 「適合交易」 |
| Neutral | 「目前狀態平穩，建議留意自身感受」 | 「小心操作」 |
| Strain | 「身體正在發出休息訊號，建議暫緩重要決策」 | 「不要交易」 |

### A.2 推播文案

| ✅ Safe | 🚫 Unsafe |
|--------|-----------|
| 「你的身體準備好了 — 現在是保持專注的好時機」 | 「市場開盤了，你的 TEI 很高！」 |
| 「建議暫停一下 — 做幾次深呼吸再繼續」 | 「你的壓力太高了，不要交易！」 |
| 「今天的恢復表現不錯 — 來看看你的進展」 | 「你的 PR99 是 85，趕快加倉！」 |
| 「你的身體訊號顯示有回到基準線的跡象」 | 「你的多巴胺恢復正常了」 |

### A.3 Disclaimer

```
TENKI 提供的所有指標和建議僅供個人健康參考，不構成醫療診斷或金融建議。
TENKI 對多巴胺狀態的觀察為間接性、相對性指標，不代表精確的生化數值。
如有健康疑慮，請諮詢專業醫療人員。
你的生理數據只儲存在你的裝置上，TENKI 絕不會讀取或上傳你的原始數據。
```

---

## Appendix B — Core Brand Lines

### 英文 Hero

```
Turn volatility into turning points.
```

### 英文 Subtitle

```
Return to baseline. Find your turning point.
```

### 中文品牌句

```
在你做決定之前，先了解你自己。
```

### 中文副句

```
回到基準線。找到你的轉機。
```

---

*— END OF ANTIGRAVITY MASTER BLUEPRINT v4.1 —*
