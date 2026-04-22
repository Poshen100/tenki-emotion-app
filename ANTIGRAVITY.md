# TENKI CORE — ANTIGRAVITY MASTER BLUEPRINT v4.0

> **最後更新**：2026-04-07  
> **版本**：v4.0  
> **狀態**：Active — Canonical Source of Truth  
> **維護者**：Founder + Autonomous Agents

---

## 0A. Resume Fast (2026-04-22)

如果你是下一次登入後的新 session，先看這一段，不要先重建整個 mental model。

### Canonical Resume Snapshot

- Canonical branch: `main`
- Verified fresh-clone commit: `c5c1def` (`docs: record library session progress to MEMORY.md`)
- Snapshot verified on: `2026-04-22`
- Verification result: repo 可正常 fetch/checkout；工作樹內容與 `origin/main` 對齊

### Reality Check: What Already Exists

- `packages/engine/src/pipeline/scan-pipeline.ts` 已存在，且有 `packages/engine/src/pipeline/__tests__/scan-pipeline.test.ts`
- `packages/engine/src/analytics/replay.ts` 已存在
- `packages/engine/src/analytics/insight-generator.ts` 已存在
- 所以 **Phase B 不是從零開始**；真正要做的是強化整合、補測試、對齊 v3 compliance copy、再決定是否進 Phase C

### Fresh Clone / Pull Resume Protocol

1. `git clone https://github.com/Poshen100/tenki-emotion-app.git`，或在既有 repo 內 `git pull`
2. 先讀本段，再讀 `MEMORY.md`
3. 切到 `main` 並確認最新 remote commit
4. 安裝依賴後再跑測試
   - `start_env.bat` 只在 repo 同層存在 `../node-v24.15.0-win-x64` 時可直接使用
   - 如果 fresh clone 沒有那個 portable Node，改用系統 Node 20+/24+，或 Codex desktop 內建 Node：
     `C:\Users\patron\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
   - 接著執行 `npm install`、`npm test`
5. 測試綠燈後，優先順序如下
   1. harden full pipeline integration（signal quality -> scoring -> gate -> baseline mutation）
   2. 補強 Replay / Insight Generator 的測試與 user-facing copy 合規檢查
   3. 再進 Phase C mobile shell / 5-tab polish

### Do Not Waste Time Rebuilding

- 不要重做 `apps/web/`
- 不要把 v3 語彙改回 TEI / PR99
- 不要把 Replay / Insight / Scan Pipeline 當成不存在；先補強，再擴寫

---

## 0. Executive Definition

**TENKI CORE** 是一款 **privacy-first cognitive wellness** 行動應用程式。

### TENKI 是什麼

| 維度 | 定義 |
|------|------|
| 產品定位 | 幫助使用者理解自己在高壓情境下的**生理與情緒準備度** |
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

### 1.3 允許討論的主題

✅ 專注 (Focus)  
✅ 壓力 (Stress)  
✅ 恢復 (Recovery)  
✅ 情緒平衡 (Emotional Balance)  
✅ 清晰度 (Clarity)  
✅ 決策準備度 (Decision Readiness)  
✅ 自我覺察 (Self-awareness)  
✅ 呼吸與身體節律 (Breathing & Body Rhythm)

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

#### 安全文案規則

1. 永遠使用「**建議**」而非「應該」
2. 永遠附加「**僅供參考**」免責聲明
3. 永遠使用「**你的身體顯示**」而非「你應該」
4. 永遠使用「**決策準備度**」而非「交易準備度」
5. 永遠使用「**Edge Score**」而非「TEI」或「PR99」

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
| Health Reset | 所有人 | 壓力管理、恢復追蹤 | ✅ |
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
|------|------|-----------------|
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
|------|------|---------|
| 呼吸練習 | 4-7-8、方框呼吸 | — |
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
| **Lab** | 呼吸練習、Pattern 分析、進階功能 | 成長工具 |

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
| **Premium** | TBD / 月 | 無限掃描, 全部 Modes, 全部 Templates, 完整歷史, Lab 進階, Pattern 分析, Benchmark |

### 12.2 不得付費牆的功能

| 功能 | 原因 |
|------|------|
| 基本掃描能力 | 核心互動不能被鎖住 |
| Edge Score 計算 | 基本價值必須免費體驗 |
| 數據刪除 / 匯出 | 隱私權利永不付費 |
| 基本歷史 (7 天) | 最低限度的自我追蹤 |

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

---

## 14. Repo Structure

```
tenki-emotion-app/
├── ANTIGRAVITY.md            ← 你在這裡
├── RULES.md                  ← 開發規則
├── apps/
│   ├── web/                  ← 現有 web prototype (v51.1)
│   └── mobile/               ← 未來 Expo/RN app
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

- [x] ANTIGRAVITY.md v4.0
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

> 2026-04-22 reality check：上述三個模組已經有初版實作檔案；這一階段的重點已經從 greenfield implementation 轉成 hardening、測試補強、與 compliance-safe UX 對齊。

### Phase C — Mobile App

- [ ] Expo / React Native 初始化
- [ ] 底部導航 (5 tabs)
- [ ] Today 頁面
- [ ] Scan 頁面 + Finger Heat Zone
- [ ] Session 頁面
- [ ] Timeline 頁面
- [ ] Lab 頁面
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
| Scan | Finger Heat Zone 可正常擷取信號並產生 Score |
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

---

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

### A.3 Disclaimer

```
TENKI 提供的所有指標和建議僅供個人健康參考，不構成醫療診斷或金融建議。
如有健康疑慮，請諮詢專業醫療人員。
你的生理數據只儲存在你的裝置上，TENKI 絕不會讀取或上傳你的原始數據。
```

---

## Appendix B — Core Brand Line

### 英文

```
Know yourself before you decide.
```

### 中文

```
在你做決定之前，先了解你自己。
```

---

*— END OF ANTIGRAVITY MASTER BLUEPRINT v4.0 —*
