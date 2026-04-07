# Scan & Readiness Spec — TENKI CORE

> **最後更新**：2026-04-07  
> **版本**：v1.0  
> **狀態**：Active  
> **定位**：TENKI 最關鍵的產品/工程規格文件

---

## 1. 產品意圖

Scan 是 TENKI 的**核心價值動詞**。

使用者每次開啟 TENKI 的心理模型是：「我想知道我現在的狀態如何」。Scan 是這個意圖的直接回應。

---

## 2. 為什麼 Scan 是核心互動

| 理由 | 說明 |
|------|------|
| **價值起點** | 使用者從掃描獲得 Edge Score，這是所有後續流程的基礎 |
| **習慣錨點** | 每日掃描是留存機制的核心 |
| **閘門功能** | Scan 結果決定是否允許進入 Session |
| **數據輸入** | 所有引擎運算依賴 Scan 產生的生理數據 |
| **差異化體驗** | Finger Heat Zone 是 TENKI 最獨特的視覺/互動體驗 |

### 2.1 為什麼 Scan 在底部導航

```
┌──────┬──────┬──────┬──────┬──────┐
│Today │ Scan │Sessn │Tmlin │ Lab  │
└──────┴──────┴──────┴──────┴──────┘
```

Scan 佔據底部導航的**第二位**（核心位置），原因：

1. 它是 **主動動作** — 使用者主動發起，不是被動瀏覽
2. 它是 **高頻入口** — 使用者每天至少進入 1-3 次
3. 它是 **Session 的前置** — Scan → Gate → Session 是核心流程
4. 它是 **視覺焦點** — Finger Heat Zone 的獨特性值得突出

---

## 3. 為什麼 Finger Heat Zone 不是裝飾

Finger Heat Zone (FHZ) 是**功能性準備度閘門**，不是裝飾 UI 元件。

| 功能 | 說明 |
|------|------|
| **信號品質驗證** | 確認使用者手指正確貼合鏡頭 |
| **覆蓋率量測** | 確認感測區域被充分覆蓋 |
| **穩定度評估** | 確認信號足夠穩定可開始分析 |
| **即時回饋** | 引導使用者調整手指位置 |
| **掃描閘門** | 只有信號品質達標才允許開始正式掃描 |

如果 FHZ 只是裝飾動畫，使用者可能在信號品質不佳的情況下完成掃描，導致錯誤的 Edge Score。FHZ 確保每次掃描的**數據品質基線**。

---

## 4. 掃描入口類型

### 4.1 Baseline Scan

| 項目 | 值 |
|------|------|
| 時長 | 60 秒 |
| 目的 | 建立或更新個人基線 |
| 觸發 | 首次使用 / 手動 / 建議更新 |
| 輸出 | Baseline Profile 更新 |
| 閘門 | 不需要（任何狀態都可建立基線）|
| 信號品質要求 | Grade B 以上 |

### 4.2 Quick Scan

| 項目 | 值 |
|------|------|
| 時長 | 30 秒 |
| 目的 | 快速確認當前狀態 |
| 觸發 | 使用者主動 / Session 前自動 |
| 輸出 | Edge Score + Zone |
| 閘門 | 不需要 |
| 信號品質要求 | Grade C 以上 |

### 4.3 Deep Scan

| 項目 | 值 |
|------|------|
| 時長 | 60 秒 |
| 目的 | 完整分析 + 高信心 |
| 觸發 | 使用者主動 |
| 輸出 | Edge Score + Zone + Confidence + Drivers + 建議 |
| 閘門 | 不需要 |
| 信號品質要求 | Grade B 以上 |

### 4.4 Trader Check (Session Gate Scan)

| 項目 | 值 |
|------|------|
| 時長 | 30–60 秒（依模板）|
| 目的 | Session 前閘門掃描 |
| 觸發 | Session 啟動時自動 |
| 輸出 | Gate Result (clear_pass / soft_caution / red_gate / force_hold) |
| 閘門 | 此掃描**本身就是閘門** |
| 信號品質要求 | Grade B 以上 |
| 模式綁定 | 僅在 Trader Mode 下觸發 |

---

## 5. End-to-End 掃描流程

### 5.1 Quick Scan 完整流程

```
使用者點擊 [Scan] tab
       │
       ▼
┌─────────────────┐
│ Scan Screen     │
│ 選擇掃描類型:   │
│ Quick / Deep    │
│ / Baseline      │
└────────┬────────┘
         │ 使用者選擇 Quick Scan
         ▼
┌─────────────────┐
│ FHZ: SEARCHING  │
│ 顯示引導文字    │◄─── 等待手指貼合
│ 「將手指輕放在  │
│   後置鏡頭上」  │
└────────┬────────┘
         │ 偵測到信號
         ▼
┌─────────────────┐
│ FHZ: DETECTING  │
│ 覆蓋率 meter    │◄─── 評估信號品質
│ 穩定度 meter    │
│ 品質 meter      │
└────────┬────────┘
         │ 品質 ≥ Grade C
         ▼
┌─────────────────┐
│ FHZ: LOCKED     │
│ 「信號已鎖定」  │◄─── 準備開始
│ [開始掃描]      │
└────────┬────────┘
         │ 使用者點擊開始
         ▼
┌─────────────────┐
│ SCANNING        │
│ 30 秒倒計時     │◄─── 即時數據擷取
│ 進度環          │
│ 即時波形        │
└────────┬────────┘
         │ 30 秒完成
         ▼
┌─────────────────┐
│ PROCESSING      │
│ Edge Score 計算  │◄─── 引擎計算
│ Zone 判定       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RESULTS         │
│ Edge Score 圓環 │
│ Zone 標籤       │
│ Coach 建議      │
│ Bento 指標卡    │
└─────────────────┘
```

### 5.2 Session Gate Scan 流程

```
使用者在 Session tab 選擇模板
       │
       ▼
┌─────────────────┐
│ Pre-check       │
│ 自動啟動掃描    │
│ 跳轉至 Scan     │
└────────┬────────┘
         │
         ▼
   [FHZ 流程同上]
         │
         ▼
┌─────────────────┐
│ Gate Evaluation  │
│ Score vs 模板    │
│ 門檻比較        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
clear_pass  soft_caution/red_gate
    │         │
    ▼         ▼
 Session    提醒/暫停
 active     選擇：重試/強制/放棄
```

---

## 6. Finger Heat Zone 元件架構

### 6.1 Component Tree

```
<ScanScreen>
  ├── <ScanTopBar>
  │     ├── <BackButton>
  │     └── <ScanTypeSwitcher>
  │           ├── [Quick] [Deep] [Baseline]
  │           └── (Trader Check 在 Session 流程中自動觸發)
  │
  ├── <ContextBar>
  │     ├── <CurrentMode>          // Health Reset / Focus / ...
  │     ├── <TemplateIndicator>    // FBD / CANSLIM (if Trader)
  │     └── <LastScanTimestamp>
  │
  ├── <FingerHeatZone>    ★ 核心元件
  │     ├── <CameraPreview>
  │     │     ├── <VideoFeed>
  │     │     └── <ROIOverlay>
  │     ├── <SignalHeatOverlay>
  │     ├── <QualityMeters>
  │     │     ├── <CoverageMeter>
  │     │     ├── <StabilityMeter>
  │     │     └── <SignalQualityMeter>
  │     ├── <StatusPill>
  │     │     └── SEARCHING | DETECTING | LOCKED | SCANNING
  │     └── <InstructionText>
  │
  ├── <ReadinessChecklist>
  │     ├── <CheckItem: Signal Quality>
  │     ├── <CheckItem: Coverage>
  │     ├── <CheckItem: Stability>
  │     ├── <CheckItem: Baseline Available>
  │     └── <CheckItem: Minimum Duration Met> (掃描中)
  │
  └── <BottomActionBar>
        ├── <StartScanButton>     // LOCKED 狀態才可按
        ├── <CancelButton>
        └── <ScanProgress>        // 掃描中顯示
```

### 6.2 FHZ Layout (文字 Low-fi Wireframe)

```
┌─────────────────────────────────┐
│        ← Quick Scan             │  Top Bar
├─────────────────────────────────┤
│  Mode: Focus    Last: 2h ago    │  Context Bar
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │     ┌─────────────────┐     │ │
│ │     │   Camera Feed   │     │ │
│ │     │   ┌─────────┐   │     │ │
│ │     │   │  ROI     │   │     │ │  Finger Heat
│ │     │   │ Overlay  │   │     │ │  Zone Panel
│ │     │   └─────────┘   │     │ │
│ │     └─────────────────┘     │ │
│ │                             │ │
│ │    ● Coverage: ██████░░ 78% │ │
│ │    ● Stability: █████░░ 65% │ │
│ │    ● Quality:  ████████ 92% │ │
│ │                             │ │
│ │    ┌──────────────────┐     │ │
│ │    │   DETECTING...   │     │ │  Status Pill
│ │    └──────────────────┘     │ │
│ │                             │ │
│ │  將手指穩定地貼在鏡頭上     │ │  Instruction
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ☑ Signal Quality    ✓          │
│ ☑ Coverage          ✓          │  Readiness
│ ☐ Stability         ×          │  Checklist
│ ☑ Baseline          ✓          │
├─────────────────────────────────┤
│     [ 🔴 等待信號穩定... ]     │  Bottom
│     or                         │  Action Bar
│     [ 🟢 開始掃描 → ]         │
└─────────────────────────────────┘
```

---

## 7. UI State Model

### 7.1 掃描頁面狀態

| State | UI 表現 | 轉場條件 |
|-------|---------|----------|
| `idle` | Scan 選擇畫面，未啟動 FHZ | 使用者選擇掃描類型 |
| `searching` | Camera 開啟，等待手指 | 偵測到光變化 |
| `detecting` | QualityMeters 動態更新 | 品質 ≥ 門檻 |
| `locked` | StatusPill = LOCKED，開始按鈕亮起 | 使用者按下開始 |
| `scanning` | 倒計時 + 進度環 + 即時波形 | 時間到 |
| `processing` | 載入動畫 | 計算完成 |
| `results` | 結果頁 (Edge Score + Zone + Details) | — |
| `error` | 錯誤提示 + 重試按鈕 | — |

### 7.2 State Transition Table

```
idle ──[選擇類型]──→ searching
searching ──[偵測信號]──→ detecting
detecting ──[品質達標]──→ locked
detecting ──[信號消失]──→ searching
locked ──[按開始]──→ scanning
locked ──[信號消失]──→ detecting
scanning ──[完成]──→ processing
scanning ──[信號中斷 > 5s]──→ error
scanning ──[使用者取消]──→ idle
processing ──[計算完成]──→ results
processing ──[計算失敗]──→ error
error ──[重試]──→ searching
error ──[放棄]──→ idle
```

---

## 8. Signal Quality Gating

### 8.1 品質分級

| Grade | Score | Coverage | Stability | 允許掃描 | 信心標記 |
|-------|-------|----------|-----------|----------|----------|
| **A** | ≥ 85 | ≥ 90% | ≥ 85% | ✅ | High |
| **B** | 70–84 | ≥ 75% | ≥ 70% | ✅ | High |
| **C** | 55–69 | ≥ 60% | ≥ 55% | ✅ | Moderate |
| **D** | 40–54 | ≥ 40% | ≥ 40% | ⚠️ 附警告 | Low |
| **F** | < 40 | < 40% | < 40% | ❌ | — |

### 8.2 各掃描類型最低要求

| 掃描類型 | 最低 Grade | 原因 |
|----------|-----------|------|
| Quick Scan | C | 快速參考即可 |
| Deep Scan | B | 需要高信心結果 |
| Baseline | B | 基線品質影響所有後續計算 |
| Trader Check | B | Session gate 需要可靠數據 |

### 8.3 品質不足時的 UX

| Grade | 行為 |
|-------|------|
| D | 顯示黃色警告：「信號品質不佳，結果僅供粗略參考」。允許繼續但標記為 Low confidence |
| F | 顯示紅色提示：「無法取得有效信號。請調整手指位置後重試」。禁止開始掃描 |

---

## 9. Readiness Checklist

掃描開始前，所有項目必須通過：

| # | 項目 | 通過條件 | 可跳過 |
|---|------|----------|--------|
| 1 | Signal Quality | ≥ 最低 Grade | ❌ |
| 2 | Coverage | ≥ 最低覆蓋率 | ❌ |
| 3 | Stability | ≥ 最低穩定度 | ⚠️ 附警告可跳 |
| 4 | Baseline Available | 有至少 1 次基線記錄 | ✅ (首次使用) |
| 5 | Camera Permission | 已授權 | ❌ |

### 9.1 全部通過

→ `開始掃描` 按鈕變為**綠色可按狀態**

### 9.2 部分未通過

→ 按鈕灰色，顯示**哪些項目需要處理**

### 9.3 首次使用（無 Baseline）

→ 自動建議進行 Baseline Scan

---

## 10. Error States & Recovery

| Error | 原因 | 使用者看到 | 恢復方式 |
|-------|------|-----------|----------|
| `signal_lost` | 手指離開鏡頭 | 「偵測不到信號 — 請重新將手指貼在鏡頭上」 | 自動轉回 searching |
| `signal_interrupted` | 掃描中信號中斷 > 5s | 「掃描中斷 — 信號不穩定。要重新開始嗎？」 | [重試] [放棄] |
| `calculation_failed` | 引擎計算失敗 | 「無法計算結果。請重新掃描」 | [重試] |
| `camera_denied` | 相機權限被拒 | 「TENKI 需要相機來偵測你的脈搏。請在設定中開啟」 | [開啟設定] |
| `camera_unavailable` | 相機硬體問題 | 「無法啟用相機。請確認沒有其他 app 正在使用」 | [重試] |
| `timeout` | 超過 3x 預設時長仍未完成 | 「掃描時間過長。請重試」 | [重試] |

---

## 11. Mode Integration

### 11.1 Mode 對掃描的影響

| Mode | 掃描開始前文案 | 結果頁語氣 | 自動建議 |
|------|--------------|-----------|----------|
| Health Reset | 「確認你的壓力和恢復狀態」 | 恢復/穩定導向 | 建議呼吸練習 |
| Focus | 「確認你的專注準備度」 | 專注/清晰導向 | 建議深度工作 |
| Performance | 「確認你的身體就緒度」 | 就緒/能量導向 | 建議暖身/訓練 |
| Trader | 「確認你的決策準備度」 | 清明/紀律導向 | 建議進入 Session |

### 11.2 Mode 不影響的部分

- 引擎計算邏輯（所有 Mode 使用相同 Edge Score 引擎）
- 信號品質門檻
- FHZ 元件結構

---

## 12. Template Integration

### 12.1 Trader Template 對掃描的影響

| Template | 掃描類型 | 時長 | 最低 Score | 入口 |
|----------|----------|------|-----------|------|
| FBD | Trader Check | 60s | 65 | Session → Pre-check |
| CANSLIM GS | Trader Check | 60s | 70 | Session → Pre-check |
| Mode 2 | Quick Scan | 30s | 60 | Session → Quick gate |

### 12.2 Template Context Bar

掃描中顯示 Template context：

```
┌──────────────────────────────────┐
│ 決策模式 · FBD    上次: 4h 前    │
└──────────────────────────────────┘
```

---

## 13. Session Gate Handoff

### 13.1 掃描 → 閘門 流程

```
Scan 完成 (Trader Check)
       │
       ▼
┌─────────────────────┐
│ Gate Evaluation      │
│                      │
│ Input:               │
│  - Edge Score        │
│  - Confidence Band   │
│  - Template Threshold│
│  - 當日 red_gate 次數│
│                      │
│ Output:              │
│  - clear_pass        │
│  - soft_caution      │
│  - red_gate          │
│  - force_hold        │
└─────────┬───────────┘
          │
   ┌──────┴──────┐
   ▼              ▼
clear_pass    not-pass
   │              │
   ▼              ▼
Session       Gate Screen
active        ┌──────────────┐
              │ 你的準備度    │
              │ 目前不在最佳  │
              │ 狀態          │
              │               │
              │ [重新掃描]    │
              │ [仍要開始]    │
              │ [暫停休息]    │
              └──────────────┘
```

### 13.2 Handoff 數據

Scan 傳遞至 Session 的數據：

```typescript
interface ScanHandoff {
  edgeScore: number;          // 0-100
  zone: 'clear' | 'neutral' | 'strain';
  confidence: number;         // 0-1
  confidenceBand: 'high' | 'moderate' | 'low';
  gateResult: 'clear_pass' | 'soft_caution' | 'red_gate' | 'force_hold';
  scanDuration: number;       // seconds
  signalGrade: 'A' | 'B' | 'C' | 'D';
  timestamp: number;
  drivers: {                  // 8 factor breakdown
    hrv: number;
    hrStability: number;
    respiration: number;
    stressProxy: number;
    sleepRecovery: number;
    recentTrend: number;
    baselineFreshness: number;
    signalQuality: number;
  };
}
```

---

## 14. 掃描產出的數據

| 數據 | 類型 | 用途 | 儲存 |
|------|------|------|------|
| Edge Score | number (0–100) | 核心決策指標 | Encrypted SQLite |
| Zone | enum (3 值) | 快速狀態判讀 | Encrypted SQLite |
| Confidence | number (0–1) | 結果可信度 | Encrypted SQLite |
| Confidence Band | enum (3 值) | 可信度分級 | Encrypted SQLite |
| 8 Factor Drivers | 8 numbers | 細項分析 | Encrypted SQLite |
| Signal Grade | enum (5 值) | 信號品質記錄 | Encrypted SQLite |
| Raw HR samples | number[] | 引擎輸入 | In-memory only (不持久化) |
| Raw HRV samples | number[] | 引擎輸入 | In-memory only (不持久化) |
| Scan Duration | number | 記錄 | Encrypted SQLite |
| Timestamp | ISO 8601 | 歷史排序 | Encrypted SQLite |
| Gate Result | enum (4 值) | Session 閘門 | Encrypted SQLite |

---

## 15. Confidence Scoring

### 15.1 Confidence 計算因子

| 因子 | 權重 | 說明 |
|------|------|------|
| Signal Quality | 0.30 | Grade A–F 映射 |
| Baseline Maturity | 0.25 | 基線成熟度 |
| Scan Duration | 0.15 | 較長掃描 = 較高信心 |
| Data Completeness | 0.15 | HealthKit + rPPG = 更高 |
| Recent Scan History | 0.15 | 近期有掃描 = 趨勢更可靠 |

### 15.2 UI 呈現

| Band | 顯示 | 色彩 |
|------|------|------|
| High (≥ 0.80) | 「信心度：高」 | 🟢 |
| Moderate (0.55–0.79) | 「信心度：中等 · 僅供參考」 | 🟡 |
| Low (< 0.55) | 「信心度：初步 · 建議重新掃描」 | 🟠 |

---

## 16. Retry Logic

### 16.1 自動重試

| 事件 | 行為 |
|------|------|
| 信號消失 < 3s | 自動嘗試重新鎖定 |
| 品質下降至 Grade D | 顯示黃色警告，繼續掃描 |
| 計算失敗 (非信號問題) | 再試一次引擎計算 |

### 16.2 使用者觸發重試

| 事件 | 提供選項 |
|------|----------|
| 信號中斷 > 5s | [重新開始] [放棄] |
| Grade F 信號 | [重新調整] [切換來源] |
| 結果不可靠 (Low confidence) | [重新掃描] [接受結果] |

### 16.3 重試上限

- 單次 session 最多 **3 次自動重試**
- 超過 3 次 → 提示使用者檢查環境（光線、手指位置）

---

## 17. UX Copy Rules

### 17.1 掃描引導文案

| State | 文案 | 語氣 |
|-------|------|------|
| searching | 「將手指輕放在後置鏡頭上」 | 平靜引導 |
| detecting | 「偵測中，請保持穩定」 | 肯定確認 |
| locked | 「信號已鎖定，準備就緒」 | 正面鼓勵 |
| scanning | 「正在分析你的身體狀態...」 | 安靜等待 |
| processing | 「計算中，請稍候」 | 簡短 |

### 17.2 禁用文案

| 🚫 禁用 | 原因 |
|---------|------|
| 「正在診斷...」 | 醫療用語 |
| 「分析你的交易準備度...」 | 金融用語 |
| 「測量你的健康...」 | 過度確定 |
| 「偵測到異常」 | 醫療警示風格 |

### 17.3 安全使用

| ✅ 安全 |
|--------|
| 「觀察你的身體節律」 |
| 「了解你的當前狀態」 |
| 「確認你的準備度」 |
| 「你的身體正在告訴你...」 |

---

## 18. Accessibility Rules

| 規則 | 實作 |
|------|------|
| VoiceOver 支援 | 所有 meter 提供語音描述 |
| 色盲安全 | Zone 不僅用色彩區分，同時附加文字標籤 |
| Dynamic Type | 所有文字支援系統字體大小 |
| 觸覺回饋 | 信號鎖定、掃描完成提供 Haptic feedback |
| 減少動態 | 尊重 `prefers-reduced-motion` 系統設定 |
| 高對比模式 | 支援 `accessibilityContrast` |
| 自動化測試 | 所有互動元素有 `accessibilityIdentifier` |

---

## 19. Telemetry / Analytics Events

> 所有事件遵循 Analytics Opt-in 模型 (`/docs/PRIVACY_ARCHITECTURE.md` Section 9)。
> 任何生理數值**不包含在事件中**。

| 事件 | 觸發 | 包含 | 不包含 |
|------|------|------|--------|
| `scan_screen_opened` | 進入 Scan tab | mode | — |
| `scan_type_selected` | 選擇掃描類型 | type (quick/deep/baseline) | — |
| `fhz_signal_locked` | 信號鎖定 | signal_grade | raw values |
| `scan_started` | 使用者按下開始 | type, mode, template_id | — |
| `scan_completed` | 掃描結束 | duration, signal_grade, zone | Edge Score |
| `scan_interrupted` | 掃描中斷 | reason | — |
| `scan_error` | 發生錯誤 | error_type | — |
| `scan_retry` | 使用者重試 | retry_count | — |
| `gate_result` | 閘門判定完成 | result_type | Score |

---

## 20. Implementation Notes

### 20.1 rPPG 實作注意

| 項目 | 建議 |
|------|------|
| Camera API | 使用原生 `AVCaptureSession` (iOS) / `Camera2` (Android) |
| Frame Rate | 30 fps 足夠 rPPG 分析 |
| ROI Size | 50x50 到 80x80 pixel 區域 |
| Color Channel | 主要使用 **Red channel** + Green channel 輔助 |
| Window | 使用 **10 秒**滑動視窗進行 HR 估測 |
| Filter | Butterworth bandpass 0.7–3.5 Hz |
| Battery | 限制相機使用時間，掃描完成後立即關閉 |
| 背景光 | 偵測環境光線，過亮/過暗提示使用者調整 |

### 20.2 HealthKit 整合

| 項目 | 建議 |
|------|------|
| 讀取時機 | Scan 開始時讀取最近 5 分鐘 HealthKit 數據 |
| Merge 策略 | HealthKit 數據優先，rPPG 數據補充 |
| 不可用時 | 純 rPPG 模式，降低 Confidence |

### 20.3 Performance Budget

| 指標 | 目標 |
|------|------|
| FHZ → LOCKED 時間 | < 5 秒 (良好手指貼合) |
| Scan → Results 時間 | < 2 秒 (計算) |
| Camera 啟動時間 | < 1 秒 |
| 記憶體使用 | < 50 MB during scan |
| 電池衝擊 | < 3% per scan (60s) |

### 20.4 測試策略

| 層級 | 測試 |
|------|------|
| Unit | Edge Score 計算邏輯、Gate 邏輯、Signal Quality 分級 |
| Integration | Scan pipeline: rPPG → Biometric → Baseline → Scoring |
| E2E | 完整 Scan → Results flow |
| UI | FHZ 狀態轉換、Readiness Checklist 更新 |
| Performance | 掃描期間 FPS、記憶體、電池 |

---

*— END OF SCAN & READINESS SPEC v1.0 —*
