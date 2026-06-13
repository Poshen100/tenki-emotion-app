# SOUL SCAN — North Star（founder 定調，2026-06-12）

> 📌 本文件是 **臉部基線（Face Baseline / Soul Scan）產品方向的最高依據**。
> 所有 AI 協作者（Antigravity / Claude / Claude Code）動掃描相關代碼前必讀。
> 與其他文件衝突時，以本文件 + founder 最新指示為準。

## 1. 定位宣言

- **日常使用者的主掃描入口 = Soul Scan（星塵靈魂臉部掃描）。**
- **手指 PPG 退為補強層 / 校準層**，不是日常第一入口。
- 第一次使用的任務不是「做一次掃描」，而是「**建立 Personal Face Baseline**」。
- 體驗基準 = iPhone 設定 Face ID：安靜、精準、可信、系統級。
- 要的是 **Apple 式精密感**，不是醫療儀器感：少字、強回饋、不堆 AI 術語，
  用流動光環、進度弧、鎖定提示、微動畫傳達「系統正在高精度建模」。

## 2. 鐵律（給所有 AI）

1. **不要把臉部流程塞進 `app/(tabs)/scan.tsx`** — 它的心智模型是手指後鏡頭掃描，
   引導語與 gating 都是為 finger 設計。臉部基線是 onboarding 內的獨立精密流程，
   住在 `apps/mobile/features/face-baseline/` + `app/face-baseline/`（已存在，沿用）。
2. **第一次基線比日常掃描更嚴格** — 寧可多 8 秒，不要鬆散 baseline。
3. **不合格就局部重掃**（例如只重做 neutral capture），不要整套重來
   （`machine/` 的 partial-retry helpers 已支援，必須沿用）。
4. **完成後標記 baseline maturity**：`new / building / ready / mature`（已實作，不可改名）。
5. 完成時刻不要彈窗式慶祝 — 星塵收束成穩定核心，`Baseline locked.` 然後才解釋。

## 3. 第一次基線建立 — 6 步驟（35–55 秒）

| # | 步驟 | 主文案基調 |
|---|------|-----------|
| 1 | Intro / Permission | `Create your Face Baseline.` 副文一句講精準度，不講 AI |
| 2 | Environment Check | 三個燈號：Lighting / Centering / Stillness，未通過不進主掃描 |
| 3 | Neutral Capture | 自然直視 3–5 秒 — 最重要的 baseline anchor |
| 4 | Guided Arc Capture | Face ID 式微幅轉頭（小角度、精準、慢速），取多角度 landmarks |
| 5 | Expression Stability Pass | 自然呼吸一次 / 放鬆下顎 — 情緒基線，不只幾何基線 |
| 6 | Baseline Confirmed | 先 `Baseline locked.`，下一行才講未來掃描以此為參考；不直接給分數 |

## 4. 介面語言

**內核 = 星塵靈魂（流體粒子 + 柔光 mesh），外框 = 系統級精密掃描框。**

- Scan Frame：圓角方形 / 柔和超橢圓（呼應 Face ID）
- Soul Mesh：星塵粒子 + 流線，不做寫實骨架
- Progress Halo：沿臉框逐段閉合的光弧，不用一般圓形 loading
- Precision Indicators：頂部只放 3 個微型狀態點（Lighting / Centering / Stillness）
- Copy：一次只顯示 1 個主指令（`Hold still` / `Turn slightly left` / `Return to center`）
- 視覺世界規則沿用：cyan = ACTIVE、gold = SECURED（見 face-baseline/SPEC.md）

## 5. 狀態機 — 現況對照（2026-06-12 盤點）

現有 `features/face-baseline/` 的 FSM 已覆蓋大部分；**只缺 2 個 state、6 個品質信號**。

| Founder 規格 | Repo 現況（`types/faceBaseline.types.ts`） | 狀態 |
|--------------|---------------------------------------------|------|
| intro | `intro` + `why_baseline` | ✅ |
| permission_check | `permission_rationale/prompt/denied`（更細） | ✅ |
| environment_check | `environment_check` | ✅ |
| face_detecting / face_locked | 同名 | ✅ |
| neutral_capture | `neutral_capture` | ✅ |
| **arc_left / arc_right** | 只有單段 `motion_capture` | 🔶 待拆分 |
| **stability_pass** | 不存在 | ❌ 待新增 |
| processing / baseline_confirmed | `processing` / `success` | ✅ |
| retry_needed | `retry_needed` + partial-retry | ✅ |
| baseline maturity | `new/building/ready/mature` | ✅ |

品質信號現有：`sqi / motion / coverage / brightness` + 環境燈號 `lighting / distance / stability`。
**待補（多數需要原生 face detection 才能真量測）**：landmark confidence、head pose range、
lighting uniformity、blink / eye visibility confidence、neutral-expression confidence、
total baseline confidence。每個 state 要有自己的 quality gate，不靠單一分數。

## 6. 落地順序

1. ✅ 已存在：Intro / Environment / Capture / Confirmed 等 11 屏 + FSM + 測試（49 tests）
2. ✅ 已做（邏輯，雲端）：FSM 拆 `arc_left/arc_right`、新增 `stability_pass`、
   擴充 QualityMetrics 型別與 gate 函式 + 測試
3. 🔶 進行中（產品定位）：
   - ✅ Preview 門面：`/preview/` 已切到 Soul Scan 臉部基線 ceremony（finger onboarding 降到 `/preview/finger/`）。
     `soul-enroll.js` 已從 time-script 改為 **真實前鏡頭 + live quality gates** 的事件驅動 FSM
     （brightness/uniformity/motion 真量測；FaceDetector 有就用、iOS Safari 退到誠實啟發式；
     pause-not-reset 進度 + retry 局部重掃）。這是原生到位前，founder 手機上能感受 Face ID 精準度的 proxy。
   - ✅ Preview 全程串接（Model B）：`/preview/` 臉部基線 → 質化「基線數據」快照 → `/preview/v6/?from=baseline`（星塵臉部掃描 + Today 揭曉 Edge Score）。finger PPG 走 `/preview/finger/` → 完成導入 `/preview/v6/`（校準層）。
   - ⬜ 待做：mobile `/face-baseline` 接成 onboarding 主入口；Scan tab 重定位為日常 Soul Scan。
4. 原生 session（需 Mac）：vision-camera face detection 餵真信號、Skia halo、實機 QA

## 7. 文件鏈

- 流程與畫面規格：`apps/mobile/features/face-baseline/SPEC.md`（11 屏 + tokens + copy）
- 品牌：`ANTIGRAVITY.md` §18（定案 logo）
- 隱私紅線：raw 臉部資料不落地不上雲（見 `docs/PRIVACY_ARCHITECTURE.md`）
- 合規：不用「情緒辨識 / 臉部分析」等措辭（App Store 4.2 / 隱私審查），
  copy 一律走 Compliance Layer
