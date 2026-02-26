# ANTIGRAVITY.md — Tenki Core Project Brief

> **Model**: Use Claude Opus 4.6 (`claude-opus-4-6`) for all tasks.
> **Repo**: https://github.com/Poshen100/tenki-emotion-app
> **Role**: You are a Silicon Valley senior full-stack engineer & CTO / co-founder.
> **Language**: Respond in **繁體中文** unless code/config. The founder is Taiwanese.
> **Version**: v2.0 — includes FDCB (Floating Decision Control Bar) system spec

---

## 0. READ THIS FIRST

This file is the **single source of truth** for the Tenki Core project.
Before writing ANY code, read this entire document.
When resuming a session, re-read Sections 0-3 to restore full context.

**v2.0 核心升級**：TENKI 從「情緒偵測工具」升級為「決策操作系統層 (OS Layer)」。
關鍵新增：**Floating Decision Control Bar (FDCB)** — 永遠浮動在底部的自律紀律引擎。

---

## 1. PRODUCT VISION

**Tenki Core** = 世界最精準、最專業、最普及的「情緒 + 健康風險指數」即時偵測 App。

- **消費者層面**：每日情緒與壓力自我管理工具
- **專業層面**：金融交易員、運動員、健康場景的生理風控引擎
- **品牌定位**：Decision Infrastructure for Traders — 多裝置、多模態的「生理 + 紀律引擎」
- **設計語言**：iPhone 級極簡、無縫感、星塵靈魂動效（形隨機能）
- **商業模式**：iOS / Android 訂閱制 App
- **OS Layer 概念**：FDCB 讓 TENKI 成為貼在螢幕底部的「自我紀律引擎」，決策 → 數據 → 自我覺察全閉環

### 1.1 Core Metric: TEI (Total Energy Index)

- TEI 是 **PR99 (1-99)**，不是絕對分數
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻
- 採用 PR 語言，避免跨裝置指標定義差異（RMSSD vs SDNN）

### 1.2 TEI 狀態區間

| PR 區間 | 狀態 | UI 色彩 | 交易建議 |
|---------|------|---------|---------|
| **80-99** | Peak Zone ⚠️ 高能警戒 | 琥珀金 `#F5A623` + 脈衝震動 | 可交易，但需雙重確認（過度自信風險） |
| **55-79** | Optimal Zone ✅ 最佳交易帶 | 青藍 `#00B4D8` | 理想執行區，全功能解鎖 |
| **35-54** | Neutral Zone ⏸️ 中性區 | 淺灰 `#E5E5EA` + 輕微震動 | 僅執行 A+ Setup，倉位 50% |
| **01-34** | Degraded Zone 🔁 低能區 | 深紫 `#5E3A87` + 呼吸引導震動 | 暫停交易，啟動呼吸校準 |

### 1.3 訂閱方案

| Tier | 價格 | 掃描次數 | 功能 |
|------|------|---------|------|
| Free | $0 | 1次/天 | 基礎 TEI、7 天歷史、靜態建議 |
| Retail | $9/月 | 3次/天 | 完整 TEI、21 天歷史、Bento 儀表板 |
| Pro | $22/月 | 無限 | 藍牙整合、**FDCB 完整功能**、Action Dock、行為時間軸、CSV 匯出 |

> **FDCB Tier Gating**: Free = 無 FDCB; Retail = 基礎計時（無模板/無事件）; Pro = 完整 FDCB

---

## 2. TECHNICAL ARCHITECTURE

### 2.1 Tech Stack Decision: Hybrid (React Native + Swift Modules)

```
┌──────────────────────────────────────────┐
│          React Native + Expo (SDK 52+)    │
│                                          │
│  ✅ UI / Navigation / State Management    │
│  ✅ tenki-engine.ts (TEI PR99 計算)       │
│  ✅ FDCB 決策計時系統 (全 TypeScript)      │
│  ✅ 訂閱計費 (RevenueCat)                 │
│  ✅ 雲端同步 (Supabase)                   │
│  ✅ 教練提示 / Hints                      │
│  ✅ 數據圖表 / Snapshot 區                │
│  ✅ 星塵靈魂動效 (react-native-skia)      │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │     Swift Native Modules (iOS)   │    │
│  │  🔧 rPPG Camera Frame Processing │    │
│  │     (AVFoundation + Metal)       │    │
│  │  🔧 ARKit 表情追蹤               │    │
│  │  🔧 Apple Watch (WatchKit)       │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │    Kotlin Native Modules (Android)│    │
│  │  🔧 CameraX Frame Processing     │    │
│  │  🔧 ML Kit 表情追蹤              │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Why Hybrid, not pure Swift:**
1. 現有 `tenki-engine.js` 是 JS — 直接在 RN 中零改動運行
2. Solo founder，一套 codebase = iOS + Android
3. 效能敏感模組（rPPG / ARKit）用 Native Module 保證原生級效能
4. RevenueCat 一次搞定 Apple + Google 訂閱
5. **FDCB 是純 UI + 邏輯層**，完全用 TypeScript + Reanimated，不需 Native

### 2.2 Monorepo Structure

```
tenki-core/
├── packages/
│   ├── engine/                    # 核心演算法 (TypeScript)
│   │   ├── src/
│   │   │   ├── tei.ts             # TEI PR99 計算
│   │   │   ├── hrv.ts             # HRV harmonization (RMSSD ↔ SDNN)
│   │   │   ├── baseline.ts        # 7/21 天滾動基線
│   │   │   ├── fusion.ts          # 多模態融合決策 (Tier 選擇)
│   │   │   ├── rr.ts              # 呼吸率 BrPM 計算
│   │   │   ├── sqi.ts             # Signal Quality Index
│   │   │   └── types.ts           # 所有型別定義
│   │   └── __tests__/
│   │       ├── tei.test.ts
│   │       ├── hrv.test.ts
│   │       ├── baseline.test.ts
│   │       └── fusion.test.ts
│   ├── fdcb/                      # ★ Floating Decision Control Bar
│   │   ├── src/
│   │   │   ├── types.ts           # FDCB 所有型別
│   │   │   ├── templates.ts       # 情境模板定義 & 規則引擎
│   │   │   ├── timer.ts           # 計時器狀態機 (IDLE/RUNNING/COMPLETE)
│   │   │   ├── events.ts          # 事件紀錄系統 (Micro Events)
│   │   │   ├── analytics.ts       # TEI Bucket 統計 & 決策洞察
│   │   │   └── constants.ts       # 模板常數、時間閾值
│   │   └── __tests__/
│   │       ├── timer.test.ts      # 狀態機轉換測試
│   │       ├── templates.test.ts  # 模板規則驗證
│   │       └── events.test.ts     # 事件紀錄邊界測試
│   ├── rppg/                      # rPPG 訊號處理
│   │   ├── src/
│   │   │   ├── pipeline.ts
│   │   │   ├── roi.ts
│   │   │   └── filters.ts
│   │   └── __tests__/
│   └── shared/                    # 共用常數/工具
│       ├── design-tokens.ts
│       ├── subscription-tiers.ts
│       └── zone-config.ts
├── apps/
│   ├── mobile/                    # React Native Expo App
│   │   ├── app/                   # Expo Router pages
│   │   ├── components/
│   │   │   ├── TeiRing.tsx        # 雙環 TEI 分數顯示
│   │   │   ├── StardustSoul.tsx   # 星塵靈魂動效 (Skia)
│   │   │   ├── BiometricDash.tsx  # Snapshot 區 (HR/HRV/RR)
│   │   │   ├── AnsBalance.tsx     # 交感/副交感波動圖
│   │   │   ├── ScanButton.tsx     # 掃描按鈕
│   │   │   ├── Paywall.tsx        # 訂閱牆
│   │   │   └── fdcb/              # ★ FDCB 元件群
│   │   │       ├── FloatingBar.tsx        # 主浮動條容器
│   │   │       ├── TemplateSelector.tsx   # 左側：模板選擇器
│   │   │       ├── TimerCore.tsx          # 中央：計時核心
│   │   │       ├── EventDots.tsx          # 右側：事件圓點
│   │   │       ├── MiniTimeline.tsx       # 展開：迷你時間軸
│   │   │       ├── EventCheckmark.tsx     # ✔ 勾選互動
│   │   │       └── TemplateSheet.tsx      # 模板展開面板
│   │   ├── native-modules/
│   │   │   ├── ios/
│   │   │   └── android/
│   │   ├── hooks/
│   │   │   ├── useScan.ts
│   │   │   ├── useBluetooth.ts
│   │   │   ├── useHealthKit.ts
│   │   │   ├── useFdcbTimer.ts    # ★ FDCB 計時器 hook
│   │   │   └── useFdcbEvents.ts   # ★ FDCB 事件紀錄 hook
│   │   ├── stores/
│   │   │   ├── scanStore.ts
│   │   │   ├── userStore.ts
│   │   │   └── fdcbStore.ts       # ★ FDCB Zustand store
│   │   └── services/
│   │       ├── supabase.ts
│   │       └── revenuecat.ts
│   └── web/                       # 現有 prototype (保留)
│       ├── index.html
│       ├── app.js
│       ├── tenki-engine.js
│       ├── rpgg.js
│       ├── rpgg-worker.js
│       ├── expression.js
│       ├── hints.js
│       └── engine.js
├── docs/
│   ├── ANTIGRAVITY.md             # ← 你正在讀的這份文件
│   ├── PRD.md
│   ├── TEI-SPEC.md
│   ├── FDCB-SPEC.md              # ★ FDCB 獨立規格文件
│   └── ARCHITECTURE.md
├── package.json
├── tsconfig.json
└── turbo.json
```

### 2.3 Backend: Supabase

```sql
-- Core Tables
users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ,
  subscription_tier TEXT,        -- 'free' | 'retail' | 'pro'
  onboarding_complete BOOLEAN
)

scans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  timestamp TIMESTAMPTZ,
  source_tier TEXT,              -- 'ble_chest' | 'watch' | 'rppg'
  sqi_score FLOAT,
  hr_bpm FLOAT,
  hrv_rmssd_ms FLOAT,
  rr_brpm FLOAT,
  tei_raw FLOAT,
  tei_pr INTEGER,               -- 1-99
  duration_sec INTEGER,
  fusion_log JSONB
)

baselines (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  window_days INTEGER,          -- 7 or 21
  hr_mean FLOAT, hr_std FLOAT,
  hrv_mean FLOAT, hrv_std FLOAT,
  rr_mean FLOAT, rr_std FLOAT,
  sample_count INTEGER,
  updated_at TIMESTAMPTZ
)

subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  tier TEXT,
  rc_customer_id TEXT,          -- RevenueCat
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)

-- ★ FDCB Tables
decision_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  template_id TEXT NOT NULL,     -- 'CANSLIM_GS' | 'MANCINI_FBD' | etc.
  tei_at_start INTEGER,
  tei_at_end INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,
  result TEXT,                   -- 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE' | null
  completed BOOLEAN DEFAULT FALSE
)

decision_events (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES decision_sessions,
  user_id UUID REFERENCES users,
  event_type TEXT NOT NULL,      -- 'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE'
  elapsed_sec INTEGER,
  tei_at_event INTEGER,
  timestamp TIMESTAMPTZ
)

-- ★ TEI Bucket 統計 (materialized view or edge function)
-- 用途："在 TEI 70-75 時，你通常在 90-150 秒內進場"
tei_decision_stats (
  user_id UUID,
  tei_bucket TEXT,               -- '70-75' | '75-80' | etc.
  template_id TEXT,
  avg_entry_sec FLOAT,
  avg_events_per_session FLOAT,
  win_rate FLOAT,
  sample_count INTEGER,
  updated_at TIMESTAMPTZ
)
```

- Row Level Security: 每個用戶只能存取自己的數據
- PR99 百分位計算用 Postgres window function
- `tei_decision_stats` 可用 Supabase Edge Function 定期計算

### 2.4 Sensor Fusion: Hybrid Sync 策略

```
數據信任度排序:
  Tier 1 (最高): BLE 胸帶 RR-interval → 直算 RMSSD
  Tier 2:        Apple Watch / Garmin HealthKit
  Tier 3:        手機 rPPG (眉心ROI → 前額fallback → 臉頰)

每次掃描 fusion_log 必須記錄:
  - source: 'ble_chest' | 'watch_healthkit' | 'rppg_glabella' | 'rppg_forehead' | 'rppg_cheek'
  - confidence: 0-1
  - sqi_score: 0-100
  - fallback_reason: string | null
  - degraded: boolean
```

### 2.5 HRV Harmonization (參照 Garmin 算法)

- **短期基線 (7 天滾動)**：用於當日 PR 排名計算
- **長期基線 (21 天滾動)**：用於健康趨勢警示
- 各來源（Garmin RMSSD / Apple SDNN / rPPG）獨立建立基線
- TEI 中只看 PR，不看 ms 絕對值 → 消除跨生態差異
- 新用戶：7 天建立初始基線，21 天達穩定精度
- 若有穿戴裝置數據 → 瞬間建立 PR99 基線（不用等 7 天）

---

## 3. CURRENT STATE (as of repo)

### 3.1 What Exists

| File | Description | Reusable? |
|------|-------------|-----------|
| `tenki-engine.js` | TEI/ANS 計算引擎 | ✅ 轉 TS 後直接用 |
| `rpgg.js` + `rpgg-worker.js` | rPPG pipeline (Web Worker) | ⚠️ 邏輯可參考，需改 Native |
| `expression.js` | 表情分析 (MediaPipe) | ⚠️ 改 ARKit/ML Kit |
| `hints.js` | 教練提示系統 | ✅ 直接搬 |
| `engine.js` | 舊版引擎 (相容) | 🗑️ 可棄用 |
| `app.js` | Web app 核心邏輯 | ⚠️ 參考 UX 流程 |
| `index.html` | UI + 星塵靈魂動效 (v25.8.2) | ⚠️ 動效需用 Skia 重建 |

### 3.2 What's Missing (for native App)

- ❌ React Native / Expo project
- ❌ TypeScript
- ❌ 測試 (unit / integration / e2e)
- ❌ Backend / Auth / Database
- ❌ 訂閱計費 (StoreKit / Google Billing)
- ❌ HealthKit / Bluetooth 整合
- ❌ Apple Watch / Garmin 整合
- ❌ **FDCB 決策計時系統（全新功能）**
- ❌ CI/CD pipeline
- ❌ .gitignore, ESLint, Prettier

---

## 4. SCAN UX FLOW (核心體驗)

```
[用戶點擊掃描按鈕]
     │
     ▼ (0-2 秒) ── 暖機期，平靜引導語
     │              星塵動效開始流動
     │              表情同步（張嘴/張眼/閉眼 → 粒子回饋）
     │
     ▼ (2 秒) ──── 出現初步 TEI 數字（粗略精度）
     │              ⚡ 有助於快速決策
     │              UI 標示 "Glimpse · 初步"
     │
     ▼ (15 秒) ─── QUICK 快速檢測 (15 組心率)
     │              TEI 精度提升，無縫過渡
     │              EWMA α=0.05 極慢分數變化
     │
     ▼ (30 秒) ─── STANDARD 標準分析 (30 組心率)
     │              TEI 精度再提升
     │
     ▼ (60 秒) ─── DEEP 深度分析 (60 組心率)
     │              自動鎖定，最高精度
     │              or 累積有效 HRV 60-90 個 RR interval
     │
     ▼ ─────────── 結果頁 (FDCB 浮動條始終可見於底部)
```

### 4.1 關鍵 UX 規則

- 分數過渡用 EWMA α=0.05（極慢，不跳動）
- 訊息更新間隔 3 秒
- 暖機期 8 秒
- 品質差時**明確降級提示**，不輸出看似合理但錯的數字
- 星塵動效：形隨機能，表情同步（張嘴/張眼/閉眼都會回饋）
- 參考 **Go Club App** 的結果頁設計元素與風格
- **FDCB 在所有頁面底部永遠可見**（掃描頁、結果頁、歷史頁）

---

## 5. FDCB — FLOATING DECISION CONTROL BAR ★

> **核心定位**：一條永遠浮動在螢幕底部的「自我紀律引擎」
> **元件名稱**：Floating Decision Control Bar (FDCB)
> **設計哲學**：決策 → 數據 → 自我覺察，全閉環
> **這不只是計時器。這是一個貼在螢幕底部的「自我紀律引擎」。**

### 5.1 為什麼需要 FDCB

| 舊版問題 | FDCB 解法 |
|---------|----------|
| 計時器只在交易中出現 | 永遠在底部，不用切頁 |
| 情境模板是分離入口 | 模板切換即時，一鍵啟動 |
| 事件紀錄分散在 Timeline | 事件紀錄極簡，一個 ✔ 搞定 |
| 沒有決策數據閉環 | 決策 → TEI 統計 → 自我覺察全閉環 |

### 5.2 位置與層級規格

```
position: fixed bottom
height: 72px (collapsed), ~200px (expanded)
iOS safe area: 自適應 (useSafeAreaInsets)
z-index: 高於內容層，低於 modal
背景: 半透明模糊 (BlurView) + 暗色
渲染位置: Expo Router root layout 層（不被頁面切換影響）
```

### 5.3 三區塊結構

```
┌────────────────────────────────────────────────┐
│  [A. 模板選擇]   [B. 計時核心]    [C. 事件紀錄]  │
└────────────────────────────────────────────────┘
```

---

### 5.4 區塊 A：左側 — 情境模板入口

**收合狀態**: `[ Canslim GS ▾ ]`

**點擊展開模板列表** (Bottom Sheet):
```
┌─────────────────────────────┐
│ ▼ Select Template            │
│                              │
│  📊 Canslim GS        5min  │
│  🚀 Canslim High RS   4min  │
│  🎯 Mancini FBD       3min  │
│  ─────── 生活模式 ───────   │
│  💼 工作專注模式             │
│  🧘 健康壓力模式             │
│  🏃 運動模式                 │
└─────────────────────────────┘
```

**選擇行為**: 選模板 → 不立即開始 → 進入 READY 狀態 → 中央計時區亮起

**TypeScript 型別與模板定義**:

```typescript
// packages/fdcb/src/types.ts

export type TemplateId =
  | 'CANSLIM_GS' | 'CANSLIM_HIGH_RS' | 'MANCINI_FBD'
  | 'WORK_FOCUS' | 'HEALTH_STRESS' | 'EXERCISE';

export interface DecisionTemplate {
  id: TemplateId;
  name: string;
  nameZh: string;
  icon: string;
  durationSec: number;
  category: 'trading' | 'lifestyle';
  rules: TemplateRules;
}

export interface TemplateRules {
  segments: Array<{ startSec: number; endSec: number; color: string; label: string }>;
  sweetZone?: { startSec: number; endSec: number };
  preventEarlyComplete: boolean;
  lockEntrySec?: number;          // 鎖定 Entry 的前 N 秒
  timeoutAction?: 'log_patience' | 'log_timeout' | 'none';
  breathTriggerSec?: number;      // 觸發呼吸引導的秒數
  barColor: string;               // FDCB 條的主色
}

export type EventType = 'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE';
export type SessionResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE' | null;
export type FdcbState = 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETE';

export interface DecisionEvent {
  id: string;
  type: EventType;
  elapsedSec: number;
  teiAtEvent: number;
  timestamp: number;
}

export interface DecisionSession {
  id: string;
  templateId: TemplateId;
  teiAtStart: number;
  teiAtEnd: number | null;
  events: DecisionEvent[];
  startedAt: number;
  endedAt: number | null;
  durationSec: number;
  result: SessionResult;
  completed: boolean;
}
```

**6 個預設模板**:

```typescript
// packages/fdcb/src/templates.ts

export const TEMPLATES: Record<TemplateId, DecisionTemplate> = {
  CANSLIM_GS: {
    id: 'CANSLIM_GS', name: 'Canslim GS', nameZh: 'Canslim 一般設定', icon: '📊',
    durationSec: 300, category: 'trading',
    rules: {
      segments: [
        { startSec: 0, endSec: 60, color: '#FF6B35', label: 'Observe' },
        { startSec: 60, endSec: 180, color: '#00B4D8', label: 'Sweet Zone' },
        { startSec: 180, endSec: 300, color: '#8E8E93', label: 'Extended' },
      ],
      sweetZone: { startSec: 60, endSec: 180 },
      preventEarlyComplete: false, barColor: '#00B4D8',
    },
  },
  CANSLIM_HIGH_RS: {
    id: 'CANSLIM_HIGH_RS', name: 'Canslim High RS', nameZh: 'Canslim 高RS', icon: '🚀',
    durationSec: 240, category: 'trading',
    rules: {
      segments: [
        { startSec: 0, endSec: 45, color: '#FF6B35', label: 'Quick Read' },
        { startSec: 45, endSec: 150, color: '#00B4D8', label: 'Sweet Zone' },
        { startSec: 150, endSec: 240, color: '#8E8E93', label: 'Patience' },
      ],
      sweetZone: { startSec: 45, endSec: 150 },
      preventEarlyComplete: false, barColor: '#00B4D8',
    },
  },
  MANCINI_FBD: {
    id: 'MANCINI_FBD', name: 'Mancini FBD', nameZh: 'Mancini 失敗突破', icon: '🎯',
    durationSec: 180, category: 'trading',
    rules: {
      segments: [
        { startSec: 0, endSec: 60, color: '#5E3A87', label: 'Lock' },
        { startSec: 60, endSec: 120, color: '#00B4D8', label: 'Execute' },
        { startSec: 120, endSec: 180, color: '#F5A623', label: 'Confirm' },
      ],
      sweetZone: { startSec: 60, endSec: 120 },
      preventEarlyComplete: true,
      lockEntrySec: 60,
      timeoutAction: 'log_patience',
      barColor: '#5E3A87',
    },
  },
  WORK_FOCUS: {
    id: 'WORK_FOCUS', name: 'Work Focus', nameZh: '工作專注模式', icon: '💼',
    durationSec: 1500, category: 'lifestyle',
    rules: {
      segments: [{ startSec: 0, endSec: 1500, color: '#00B4D8', label: 'Focus' }],
      preventEarlyComplete: false, barColor: '#00B4D8',
    },
  },
  HEALTH_STRESS: {
    id: 'HEALTH_STRESS', name: 'Health Stress', nameZh: '健康壓力模式', icon: '🧘',
    durationSec: 180, category: 'lifestyle',
    rules: {
      segments: [{ startSec: 0, endSec: 180, color: '#34C759', label: 'Breathe' }],
      preventEarlyComplete: false, breathTriggerSec: 0, barColor: '#34C759',
    },
  },
  EXERCISE: {
    id: 'EXERCISE', name: 'Exercise', nameZh: '運動模式', icon: '🏃',
    durationSec: 600, category: 'lifestyle',
    rules: {
      segments: [
        { startSec: 0, endSec: 120, color: '#34C759', label: 'Warm Up' },
        { startSec: 120, endSec: 480, color: '#FF6B35', label: 'Active' },
        { startSec: 480, endSec: 600, color: '#00B4D8', label: 'Cool Down' },
      ],
      preventEarlyComplete: false, barColor: '#FF6B35',
    },
  },
};
```

---

### 5.5 區塊 B：中央 — 決策計時核心

**狀態機**: `IDLE → (選模板) → READY → (按 Start) → RUNNING → (結束) → COMPLETE → (0.8s) → IDLE`

```
1️⃣ IDLE:     [ Start Decision ]  TEI 72
2️⃣ READY:    [ ▶ Canslim GS · 5:00 ]  Tap to Start
3️⃣ RUNNING:  [ 02:18 ]  Sweet Zone  ▓▓▓▓▓▓░░░░░░  (進度條 + 段落色)
4️⃣ COMPLETE: [ ✔ Decision Logged ]  → 0.8s 後回 IDLE
```

---

### 5.6 區塊 C：右側 — 事件紀錄 + 勾選節點

**收合**: `[ ● ● ✔ ● ]` (每個點 = Micro Event, ✔ = 主動標記)

**勾選互動**:
- 點擊 ✔ → 記錄決策動作 (預設 ENTRY)
- 長按 ✔ → 選擇: Entry / Add / Reduce / Exit / Cancel / No Trade

**Mini Timeline 展開** (點擊右側區域):
```
02:14   ✔ Entry
04:32   ✔ Add
07:10   ✘ Cancel
← 可左右滑動 →
```

---

### 5.7 模板深度連動流程

```
選擇模板 → 載入 TemplateRules → READY → Start →
套用: 分段顏色 / Sweet Zone / Entry Lock / 呼吸觸發 / barColor
→ 用戶 ✔ 記錄事件 (snapshot TEI) → 完成 → 寫入 Supabase → 更新統計
```

**Mancini FBD 範例**:
1. 浮動條變紫 (`barColor: '#5E3A87'`)
2. 前 60 秒鎖定 ✔ Entry（按了沒反應 + tooltip）
3. 60-120 秒 Execute 段，允許 ✔
4. Timeout 自動紀錄「耐心完成」

### 5.8 TEI 歷史統計互動

✔ Entry 時系統紀錄: TEI PR + 模板 + 時間段 → 寫入 TEI Bucket

**READY 狀態顯示決策洞察**:
```
📊 在 TEI 70-75 時，你通常在 90-150 秒內進場，勝率 62%
```

### 5.9 FDCB Zustand Store

```typescript
// apps/mobile/stores/fdcbStore.ts
interface FdcbStore {
  state: FdcbState;
  selectedTemplate: TemplateId | null;
  currentSession: DecisionSession | null;
  events: DecisionEvent[];
  elapsedSec: number;
  isExpanded: boolean;
  isTemplateSheetOpen: boolean;

  selectTemplate: (id: TemplateId) => void;
  startTimer: () => void;
  stopTimer: () => void;
  addEvent: (type: EventType) => void;
  toggleExpand: () => void;
  toggleTemplateSheet: () => void;
  reset: () => void;

  // Derived
  currentSegment: () => TemplateSegment | null;
  isInSweetZone: () => boolean;
  isEntryLocked: () => boolean;
}
```

### 5.10 FDCB 訂閱 Tier Gating

| 功能 | Free | Retail | Pro |
|------|------|--------|-----|
| FDCB 可見 | ❌ | ✅ | ✅ |
| 基礎計時 | ❌ | ✅ | ✅ |
| 情境模板 | ❌ | 1 個免費 | ✅ 全部 |
| 事件 ✔ 紀錄 | ❌ | ❌ | ✅ |
| Mini Timeline | ❌ | ❌ | ✅ |
| TEI Bucket 統計 | ❌ | ❌ | ✅ |
| 決策洞察 | ❌ | ❌ | ✅ |

---

## 6. rPPG ACCURACY STRATEGY

### 6.1 ROI 優先級

```
Primary:   眉心 (glabella) — Nature 2024 證實最穩定
Fallback1: 前額 (forehead)
Fallback2: 臉頰 (cheek)
```

### 6.2 SQI Gating

- 單一 SQI 指標 + 門檻（不堆 heuristic）
- SQI < threshold → 立即降級 + UI 提示
- 眉心被遮擋 → 提示用戶調整

### 6.3 iPhone 13+ 特定優化

- 利用 TrueDepth 相機 + Face ID depth data 提升 ROI 精度
- 利用 LiDAR（Pro 機型）做環境光補償

---

## 7. DONE = GO CRITERIA

| 指標 | Pass 條件 | 驗證方法 |
|------|-----------|---------|
| TEI PR99 一致性 | 同組數據跑 100 次，PR 偏差 < ±1 | Unit test |
| HRV 跨裝置對齊 | Garmin vs Apple，同用戶 PR 差 < ±5 | 模擬數據測試 |
| rPPG HR 準確度 | vs 胸帶，MAE < 3 BPM (靜態) | 真人測試 |
| SQI gating | 低品質 100% 降級提示 | 遮臉/晃動測試 |
| Fusion 可解釋性 | 每次 log 含 source/confidence/fallback | Log schema |
| 冷啟動體驗 | 2 秒內看到數字 | UX 測試 |
| 訂閱轉換 | Paywall 正確限制 | E2E 測試 |
| **FDCB 狀態機** | IDLE→READY→RUNNING→COMPLETE 全路徑 | State machine test |
| **FDCB 模板規則** | 6 模板 segment/lock/timeout 正確 | Template rule test |
| **FDCB 事件紀錄** | 事件 + TEI snapshot 寫入 Supabase | Integration test |
| **FDCB Entry Lock** | lockEntrySec 內 ✔ 無反應 + tooltip | UX test |

---

## 8. DEVELOPMENT PHASES

### Phase 0: Foundation (Pre-Mac — NOW)

- [ ] 建立 monorepo scaffold (Turborepo + TypeScript)
- [ ] `tenki-engine.js` → TypeScript (`packages/engine/`)
- [ ] TEI PR99 unit tests
- [ ] HRV harmonization unit tests
- [ ] Fusion 降級邏輯 unit tests
- [ ] ★ 建立 `packages/fdcb/` — types, templates, timer, events, analytics
- [ ] ★ FDCB timer 狀態機 unit tests
- [ ] ★ FDCB 6 模板規則 unit tests
- [ ] ★ FDCB 事件紀錄 unit tests
- [ ] Design Tokens + Supabase schema + subscription config
- [ ] PRD.md, TEI-SPEC.md, FDCB-SPEC.md

### Phase 1: Sprint 1-2 (Week 1-2, Mac 到手)

- [ ] Expo init + Router + 相機掃描 MVP
- [ ] 2 秒出粗略 TEI → 漸進精化
- [ ] 基礎 TEI 雙環 UI

### Phase 2: Sprint 3-4 (Week 3-4)

- [ ] 星塵靈魂動效 + 表情同步
- [ ] Snapshot 區 (HR/HRV/RR 波動圖 + ANS 平衡圖)
- [ ] 結果頁 (Go Club 風格)
- [ ] ★ FDCB 全部 UI 元件 (FloatingBar / TemplateSelector / TimerCore / EventDots / MiniTimeline)
- [ ] ★ FDCB ↔ TEI 即時連動

### Phase 3: Sprint 5-6 (Week 5-6)

- [ ] Supabase Auth + 雲端同步 + 基線系統
- [ ] ★ decision_sessions + decision_events 寫入
- [ ] ★ TEI Bucket 統計 Edge Function
- [ ] ★ 決策洞察查詢 API

### Phase 4: Sprint 7-8 (Week 7-8)

- [ ] HealthKit + BLE 胸帶 + Garmin
- [ ] Hybrid Sync

### Phase 5: Sprint 9-10 (Week 9-10)

- [ ] RevenueCat + Paywall + ★ FDCB tier gating
- [ ] TestFlight

### Phase 6: Sprint 11-12 (Week 11-12)

- [ ] App Store + Google Play 上架

---

## 9. DESIGN REFERENCE

### 9.1 Design Tokens

```typescript
export const TENKI_THEME = {
  zones: {
    peak:     { bg: '#F5A623', text: '#FFFFFF', range: [80, 99] },
    optimal:  { bg: '#00B4D8', text: '#FFFFFF', range: [55, 79] },
    neutral:  { bg: '#E5E5EA', text: '#1C1C1E', range: [35, 54] },
    degraded: { bg: '#5E3A87', text: '#FFFFFF', range: [1, 34] },
  },
  fdcb: {
    height: 72,
    expandedHeight: 200,
    background: 'rgba(28, 28, 30, 0.92)',
    blur: 20,
    completeFlash: '#34C759',
    dotActive: '#FFFFFF',
    dotInactive: '#48484A',
    dotCheckmark: '#34C759',
  },
  typography: {
    teiScore:  { fontSize: 72, fontWeight: '200', fontFamily: 'SF Pro Display' },
    fdcbTimer: { fontSize: 28, fontWeight: '600', fontFamily: 'SF Pro Display', fontVariant: ['tabular-nums'] },
    fdcbLabel: { fontSize: 11, fontWeight: '500' },
    bodyText:  { fontSize: 15, fontWeight: '400', fontFamily: 'SF Pro Text' },
    caption:   { fontSize: 11, fontWeight: '400', color: '#8E8E93' },
  },
  animation: {
    scoreTransition: { type: 'ewma', alpha: 0.05 },
    messageInterval: 3000,
    warmUp: 8000,
    fdcbComplete: 800,
  },
  colors: {
    background: '#000000', surface: '#1C1C1E', card: '#2C2C2E',
    border: '#38383A', primary: '#00B4D8',
    textPrimary: '#FFFFFF', textSecondary: '#8E8E93',
  },
} as const;
```

### 9.2 Full Screen Layout (with FDCB)

```
┌────────────────────────────────┐
│     星塵靈魂動效區域             │
│       ┌──────────┐             │
│       │ 外環: TEI │             │
│       │ 內環: HRV │             │
│       │   72      │             │
│       └──────────┘             │
│   Optimal Zone ✅               │
│   ──── 掃描進度列 ────          │
├────────────────────────────────┤
│   SNAPSHOT 區                   │
│   ❤️ HR    68 BPM  ~~~~~~~~   │
│   💚 HRV   52 ms   ~~~~~~~~   │
│   🫁 RR    14 BrPM ~~~~~~~~   │
│   ⚡ Stress  Low    ████░░░   │
│   ┌─ ANS Balance ────────────┐ │
│   │ SNS ████░░░░░░░░░░ PNS   │ │
│   │      38%          62%     │ │
│   └──────────────────────────┘ │
├════════════════════════════════┤
│ 📊 Canslim GS ▾  02:18  ● ✔ ● │ ← ★ FDCB
│ ▓▓▓▓▓▓▓▓░░░░░  Sweet Zone     │
└────────────────────────────────┘
     ↕ iOS Safe Area ↕
```

---

## 10. KEY LIBRARIES

```json
{
  "dependencies": {
    "expo": "~52.x", "expo-camera": "latest", "expo-sensors": "latest",
    "expo-router": "latest", "expo-haptics": "latest", "expo-blur": "latest",
    "@shopify/react-native-skia": "latest",
    "react-native-reanimated": "latest",
    "react-native-gesture-handler": "latest",
    "react-native-ble-plx": "latest", "react-native-health": "latest",
    "@supabase/supabase-js": "latest", "react-native-purchases": "latest",
    "zustand": "latest", "@gorhom/bottom-sheet": "latest",
    "react-native-safe-area-context": "latest"
  },
  "devDependencies": {
    "typescript": "latest", "jest": "latest", "turbo": "latest",
    "eslint": "latest", "prettier": "latest"
  }
}
```

---

## 11. CODING STANDARDS

1. **TypeScript strict mode** — no `any`
2. **JSDoc** on every function in engine/ and fdcb/
3. **Test coverage**: engine/ ≥ 90%, fdcb/ ≥ 90%, UI ≥ 70%
4. **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`
5. **Branches**: `main`, `dev`, `feat/*`
6. Components: `PascalCase.tsx`, Hooks: `camelCase.ts`, Tests: `*.test.ts`
7. **Zustand**: scanStore, userStore, **fdcbStore** (dedicated)

---

## 12. IMPORTANT CONTEXT FOR AI AGENT

### 12.1 Founder Constraints

- Solo founder, Mac mini 尚未購買
- 目標：3 個月上架 App Store
- 每個決策考慮 solo founder 時間效率

### 12.2 Critical Design Principles

1. 品質差時降級，不輸出假數字
2. Fusion log 每次可解釋
3. BLE RR 永遠優先
4. EWMA 極慢過渡
5. 「極致」用可驗證條件定義，做完就 go
6. **FDCB 永遠可見** — 它是 OS Layer，不是隱藏功能

### 12.3 Don't Touch

- `apps/web/` — 保留現有 prototype
- 星塵動效的「感覺」— 保持 v25.8.2 體驗
- TEI 狀態區間 — 已驗證
- **FDCB 模板規則** — Section 5.4 已完整定義

### 12.4 Concurrent AI Workflow

- **Antigravity**: 主開發環境
- **Claude Code**: terminal-heavy 任務
- **Model**: Claude Opus 4.6 (`claude-opus-4-6`)

---

## 13. NEXT ACTION (Resume Point)

> **當你讀到這裡，請立即執行：**

1. 確認已讀完 ANTIGRAVITY.md v2.0（含 Section 5 FDCB spec）
2. 檢查 `packages/engine/` — 未建立 = 第一優先
3. 檢查 `packages/fdcb/` — 未建立 = 第二優先
4. 檢查 Phase checklist 進度
5. 向 founder 報告狀態 & 建議下一步
6. **永遠先問：「我接下來要做什麼？」**

---

*Last updated: 2026-02-26*
*Version: v2.0 — FDCB System Integration*
*Maintained by: Poshen (Founder) + AI CTO (Claude Opus 4.6)*
