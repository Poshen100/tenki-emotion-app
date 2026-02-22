# 🌟 TENKI Ultra — Antigravity Context File

> **角色**: 你是矽谷頂尖全端工程師兼創業家，也是 Poshen 的合夥人。  
> **任務**: 開發 TENKI Ultra — 一個交易員情緒管理 + 生物感測決策系統。

---

## 🎯 產品核心概念

**TENKI** = 交易決策紀律系統

- 情緒掃描 (TEI) → HRV/PPG 生物感測 → 決策計時器 → 強制紀律
- **核心哲學**: 「TENKI 的價值不在於你做了哪筆交易，而在於你沒有隨機衝動的那些時刻。」
- TIMEOUT IS A WIN（等待 = 獲勝）

---

## 🔒 絕對禁區（永遠不能碰）

```
🔒 LOCKED FILES — DO NOT TOUCH:
├── index.html   ← 只能在 SAFE ZONE 修改
├── app.js       ← 8000粒子 Stardust Soul 系統
├── rpgg.js      ← RPGG 核心系統
└── expression.js ← 表情/表達系統
```

**通訊規則**: 所有功能必須用 `EventBridge` 溝通，絕不直接操作 Stardust DOM。

---

## 📁 專案架構

```
tenki-emotion-app/
├── 🔒 index.html          ← Stardust Soul 主頁 (LOCKED)
├── 🔒 app.js              ← 8000粒子系統 (LOCKED)
├── 🔒 rpgg.js             ← RPGG 核心 (LOCKED)
├── 🔒 expression.js       ← 表情系統 (LOCKED)
│
├── core/                  ← ✅ 主要開發區
│   ├── progressive-tei.js         ← TEI 里程碑計算 (4→15→30→60)
│   ├── smooth-transition.js       ← EWMA 動畫
│   ├── sensor-fusion.js           ← 多模態感測融合
│   ├── kalman-filter.js           ← 2D Kalman HR/HRV
│   ├── expectancy-calculator.js   ← 勝率期望值計算
│   ├── trade-logger.js            ← TEI 交易日誌
│   ├── camera-controller.js       ← PPG 相機生命週期
│   ├── facs-tracker.js            ← FACS 表情追蹤
│   ├── hrv-advanced.js            ← 進階 HRV 分析
│   ├── ppg-analyzer.js            ← PPG 信號分析
│   ├── fusion-controller.js       ← 融合控制器
│   ├── decision-dock-controller.js← 決策面板控制器
│   ├── decision-timer.js          ← 決策計時器核心
│   ├── ai-behavior.js             ← AI 行為規則
│   ├── database.js                ← IndexedDB 資料層
│   └── tenki-2-bootstrap.js       ← TENKI 2.0 系統整合器
│
├── ui/                    ← 介面層
│   ├── camera-overlay.css
│   ├── camera-preview.js
│   ├── overlay-controller.js
│   └── performance-dashboard.html
│
├── integration/           ← 整合層
├── templates/             ← 交易模板
├── tests/                 ← 測試套件
└── docs/                  ← API 文件
```

---

## 🏗️ 全域模組地圖 (CLAUDE.md)

| Global 變數 | 檔案 | 用途 |
|------------|------|------|
| `TENKI_PROGRESSIVE_TEI` | `core/progressive-tei.js` | TEI 里程碑 4→15→30→60 |
| `TENKI_SMOOTH_TRANSITION` | `core/smooth-transition.js` | EWMA 動畫平滑 |
| `TENKI_SENSOR_FUSION` | `core/sensor-fusion.js` | 多來源加權融合 |
| `TENKI_KALMAN` | `core/kalman-filter.js` | 2D Kalman HR/HRV |
| `TENKI_EXPECTANCY` | `core/expectancy-calculator.js` | 期望值 + t-test |
| `TENKI_TRADE_LOGGER` | `core/trade-logger.js` | TEI 交易日誌 |
| `TENKI_CAMERA` | `core/camera-controller.js` | PPG 相機控制 |
| `TENKI2` | `core/tenki-2-bootstrap.js` | 系統整合器 |

---

## 🚦 狀態機

```javascript
IDLE → PRE_CHECK → BREATHING → RUNNING → COMPLETE ✅
                                        → TIMEOUT  🏆 (WIN!)
                                        → ABORT    ❌
                              → LOCKED  🔒
```

---

## 📋 開發進度

### ✅ Phase 1: Core Timer（完成）
- EventBridge 通訊架構
- 決策計時器 T1 (Mancini FBD)
- Overlay UI 系統
- 狀態機
- 情緒分數輸入

### ✅ Phase 2 核心 (TENKI 2.0)（完成）
- Progressive TEI Engine (0.29ms per calc)
- PPG Camera System
- Multi-Modal Sensor Fusion
- Kalman Filter (2.28ms / 1000 updates)
- Expectancy Calculator (1.53ms / 1000 trades)
- HRV Advanced Analysis
- FACS 表情追蹤

### 🔲 尚未完成
- T3 (CANSLIM Pullback) 模板
- T4 (High RS Breakout) 模板
- Health Stress Mode / Night Cooldown
- Deep Focus Mode
- AI Agent hooks
- 微型時間軸 & 模式分析

---

## ⚡ 效能基準

| 指標 | 目標 | 實際 |
|------|------|------|
| TEI 計算 | < 5ms | **0.29ms** ✅ |
| 1000 筆資料 | < 100ms | **0.62ms** ✅ |
| 1000 Kalman 更新 | < 10ms | **2.28ms** ✅ |
| 1000 交易分析 | < 50ms | **1.53ms** ✅ |

---

## 🎨 UI Design Token

```css
--plasma-cyan: #00FFC8
--void-purple: (見 app.js)
--matrix-green: #00FF88
.overlay-idle    { border: rgba(0,255,200,0.3) }
.overlay-running { border: rgba(255,215,0,0.6) }
.overlay-locked  { border: rgba(255,100,100,0.8) }
.overlay-win     { border: rgba(0,255,136,0.8) }
```

---

## 🛠️ 開發指令

```bash
npm run dev      # 啟動 Vite dev server (port 5173)
npm run build    # 打包
npx vitest run   # 跑所有 23 個測試
```

---

## 📐 Coding 規範

- **模組模式**: IIFE `(function(global){ ... })(window)`
- **命名空間**: `global.TENKI_*`
- **通訊**: 只用 EventBridge，不直接操作 DOM
- **UI**: 所有 overlay 用 `.overlay-` prefix
- **語言**: 領域邏輯用中文/日文注釋，API 文件用英文

---

## 🔗 GitHub

- Repo: https://github.com/Poshen100/tenki-emotion-app
- 本機路徑: `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`

---

*Last updated: 2026-02-22 by Antigravity AI*
