# TENKI PRO 開發準則 (Claude Opus 4.5 專用)

## ⚠️ 絕對禁止事項 (CRITICAL - READ FIRST)

### 🔒 鎖定檔案 (絕對不可修改)
以下檔案是 **v25.8.2 星塵靈魂視覺系統**，**絕對不可修改、不可重構、不可優化**：

- `index.html` (僅可在 `<!-- SAFE ZONE -->` 區域新增)
- `app.js` (粒子系統核心)
- `rpgg.js` (rPPG 生物識別核心)
- `expression.js` (表情識別核心)
- 任何包含 "Stardust", "8000 particles" 或 "Three.js" 的視覺代碼

### ✅ 允許修改的方式
1. **新增獨立模組**：在 `core/` 或 `ui/` 建立新檔案
2. **透過事件整合**：使用 `EventBridge` 發送事件，不直接調用原始函數
3. **Overlay UI**：新介面必須是 `position: fixed` 的 Overlay，疊加在星塵之上
4. **命名空間**：所有新 CSS 必須使用 `.overlay-` 前綴

---

## 📂 專案架構 (分離策略)

```
tenki-pro/
├── 🔒 LOCKED (星塵靈魂 v25.8.2 - 不可觸碰)
│   ├── index.html (主框架，內含 SAFE ZONE)
│   ├── app.js (視覺粒子系統)
│   ├── rpgg.js (心率偵測)
│   └── expression.js (表情分析)
│
├── ✅ NEW MODULES (可自由開發)
│   ├── core/ (核心邏輯)
│   │   ├── decision-timer.js
│   │   ├── pr-expectancy.js
│   │   ├── ai-behavior.js
│   │   └── database.js
│   │
│   ├── ui/ (介面層)
│   │   ├── overlay.css (必須用 .overlay- 前綴)
│   │   └── overlay-controller.js
│   │
│   └── integration/ (橋接層)
│       └── event-bridge.js (系統通訊中樞)
```

---

## 🔌 整合策略: Event Bridge Pattern

**所有新模組都必須透過「事件橋接器」溝通，絕不直接修改原始碼。**

```javascript
// ✅ 正確：透過 EventBridge 發送
EventBridge.notifyTEIUpdate(72, 'decision-timer');

// ❌ 錯誤：直接修改 app.js 變數
app.currentTEI = 72; 
```

### 核心事件流
1. **Decision Timer** 狀態改變 → `EventBridge`
2. **AI Behavior** 分析完成 → `EventBridge`
3. **Overlay UI** 監聽 `EventBridge` → 更新顯示
4. **星塵靈魂** (可選) 監聽 `EventBridge` → 改變視覺 (這是原生行為，不動代碼)

---

## 🎨 UI 開發規範: Overlay Pattern

### CSS 規則
1. 所有 class 必須加 `.overlay-` 前綴 (例: `.overlay-panel`, `.overlay-btn`)
2. 容器使用 `#tenki-pro-overlay` (`z-index: 1000`)
3. 絕對禁止修改 `body`, `.particle` 或任何原生樣式

### HTML 注入
僅允許在 `index.html` 的特定區域操作：
```html
<!-- TENKI PRO SAFE ZONE START -->
<script src="core/new-module.js"></script>
<!-- TENKI PRO SAFE ZONE END -->
```

---

## 🛠 生態系與工具鏈

### 環境管理
- **Python**: 使用 `uv`
- **Node**: 使用 `nvm` (Node 20)
- **Git**: 使用 `gh` CLI

### 程式碼風格
- **JS**: Vanilla JS (ES6+), 無需編譯步驟 (No bundler required for MVP)
- **CSS**: Vanilla CSS, 變數驅動
- **註解**: 必須包含 JSDoc 風格的函數說明

---

## 🌟 專案願景 (Tenki Core)

**Tenki Emotion App** 是一個結合「情緒偵測」與「健康風險」的即時監控平台。
- **核心技術**: Face ID 微表情分析 + rPPG 心率變異偵測
- **對象**: 交易員、高壓決策者
- **目標**: 提供 TEI (Tenki Emotion Index) 情緒指數，輔助理性決策

> **Critical**: 我們正在保護的是它的「靈魂」—— 那個由 8000 顆粒子組成的視覺回饋系統。任何開發都不能破壞這個體驗。

---

## 🧠 AI Skills (已整合)

### Skill 1: HRV 信號處理專家 🫀
**模組**: `core/hrv-advanced.js`

| 指標 | 方法 | 說明 |
|------|------|------|
| SDNN | `calculateTimeDomain()` | 整體 HRV 變異 |
| rMSSD | `calculateTimeDomain()` | 副交感神經活性 |
| pNN50 | `calculateTimeDomain()` | 心跳間隔 >50ms 百分比 |
| LF (0.04-0.15Hz) | `calculateFrequencyDomain()` | 交感 + 副交感 |
| HF (0.15-0.4Hz) | `calculateFrequencyDomain()` | 副交感神經 |
| LF/HF Ratio | `calculateFrequencyDomain()` | 自律神經平衡 |

```javascript
const hrv = TENKI_HRV_ADVANCED.create(rppgController);
hrv.pushRR(800);  // Push RR interval (ms)
const metrics = hrv.getMetrics();
```

---

### Skill 2: 面部表情分析專家 😊
**模組**: `core/facs-tracker.js`

| Action Unit | 名稱 | 情緒關聯 |
|------------|------|---------|
| AU6 | 臉頰上提 | 😊 快樂 |
| AU12 | 嘴角上揚 | 😊 快樂 |
| AU1 + AU15 | 內眉上揚 + 嘴角下垂 | 😢 悲傷 |
| AU4 | 皺眉 | 😠 專注/憤怒 |

```javascript
const facs = TENKI_FACS.create();
facs.pushFrame(faceMeshLandmarks);
const emotions = facs.getEmotions();
// { happy: 0.7, sad: 0.1, neutral: 0.2 }
```

---

### Skill 3: 多模態融合專家 🔗
**模組**: `core/fusion-controller.js`

**預設權重**:
- 面部表情: 30%
- HRV (rPPG): 60%
- 穿戴裝置: 10%

**降級策略**:
| 模式 | 條件 |
|------|------|
| `FULL` | 所有模態可用 |
| `HRV_EXPRESSION` | 無穿戴裝置 |
| `HRV_ONLY` | 僅生理信號 |
| `EXPRESSION_ONLY` | 僅表情 |
| `HISTORICAL` | 使用歷史基準 |

```javascript
const fusion = TENKI_FUSION.create({ hrvModule: hrv, facsModule: facs });
const result = fusion.computeFusion();
// { score: 0.72, teiEquivalent: 72, confidence: 0.85 }
```

---

## 📊 Signal Processing 模組架構

```
core/
├── 🔒 LOCKED (不可修改)
│   ├── rpgg.js (rPPG 核心)
│   └── expression.js (表情核心)
│
├── ✅ NEW Signal Processing
│   ├── hrv-advanced.js (進階 HRV 分析)
│   ├── facs-tracker.js (FACS 動作單元)
│   └── fusion-controller.js (多模態融合)
│
└── Window API 暴露
    ├── TENKI_HRV_ADVANCED
    ├── TENKI_FACS
    └── TENKI_FUSION
```

---

## 💡 專案記憶

### 核心決策
- ✅ 保留星塵視覺 (v25.8.2)
- ✅ Event Bridge Pattern 通訊
- ✅ TEI PR99 系統 (1-99 分)
- ✅ 漸進式精度 (2s → 15s → 60s+)

### 常見錯誤解決
| 錯誤 | 解決方案 |
|------|---------|
| PPG 雜訊過多 | 增加帶通濾波 0.5-4 Hz |
| 面部遮擋誤判 | 可見度 <70% 降低權重 |
| 頻域分析不穩定 | 需要至少 120 秒資料 |
