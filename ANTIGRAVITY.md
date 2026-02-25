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

## 📋 開發進度（最後更新：2026-02-23）

### ✅ Phase 1: Core Timer（完成）
- EventBridge 通訊架構、決策計時器 T1、Overlay UI、狀態機、情緒分數輸入

### ✅ Phase 2 核心 (TENKI 2.0)（完成）
- Progressive TEI Engine (0.29ms)、PPG Camera、Sensor Fusion
- Kalman Filter (2.28ms)、Expectancy Calculator、HRV Advanced、FACS

### ✅ Phase 3 & Phase 5: Results Page UI & Bio-Risk SaaS（已完成）
- **UI 像素級還原**: `results-page.css` 與 `results-page.js` 已完全依照設計稿翻新
- **雙環動畫修復**: 補上 `@keyframes rp-rotate-outer` 確保 8s/12s 雙環旋轉
- **細節打磨**: ANS Balance 漸層修復、單行文字不折行；呼吸 Icon 替換；Heart Rate Delta 真實資料綁定
- **Phase 5**: PWA 整合、4-State 區間變色、Hybrid Sync 藍牙心跳機制 (`tei-pr99-engine.js`)

### ⏭️ 下次繼續：Phase 2 (Progressive TEI) & Phase 3 (Multi-Modal)

> **登入後對 Antigravity 說「CONTINUE」即可從這裡接續。**

**🔜 待辦 Todo（優先順序）：**
1. **Phase 2** — Scan Start → 2s GLIMPSE → 15s PREVIEW → 30s DEFAULT → 60s SPECTRUM 里程碑
2. **Phase 2** — Canvas mini-waveform for ECG in HR card (real-time from rPPG data)
3. **Phase 3** — HealthKit/Google Fit connector stub (Capacitor ready)
4. **Phase 3** — User calibration baseline persistence (IndexedDB)
5. **Phase 4** — `tests/results-page.test.js` 與整體測試套件完善

**🧪 測試方式：**
```bash
npm run dev   # port 5173
# → 按住指紋 2.5 秒 → 驗證 Results Page 滑入
```

**📂 Workspace：**
`C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`

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

## � Git Commit 規範（強制執行）

> **每個 Plan 裡的 Todo = 一個獨立 Git Commit**

```bash
# 完成一個 Todo → 立即 commit
git add <changed-files>
git commit -m "<type>(<scope>): <todo描述>"
```

| type | 場景 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修 Bug |
| `test` | 加測試 |
| `refactor` | 重構 |
| `perf` | 效能優化 |

**範例：**
```
feat(core): implement T3 CANSLIM template
fix(ppg): fix camera lifecycle on reload
test(kalman): add zero-variance edge case
```

❌ **禁止**: 累積多個 Todo 才 commit、message 寫 "update"  
✅ **好處**: `git log` = 完整 plan 執行軌跡，Bug 可 `git bisect` 精確定位

> 詳見 `.agent/workflows/git-commit-todo.md`

---

## �📐 Coding 規範

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

*Last updated: 2026-02-25 by Antigravity AI*

---

## 📋 Session Progress (2026-02-25)

### ✅ 本次完成

| 任務 | 檔案 | 狀態 |
|------|------|------|
| Task A: DOM 結構分析 | — | ✅ 所有 selector 已確認 |
| Task B: WaveformEngine | `snapshot-wave.js` (root) | ✅ Canvas 2D, 四軌, 30fps, Demo mode |
| Task C: 情緒光譜配色 | `spectrum.css` + `desktop-compat.js` | ✅ HSL 5錨點, 1.5s transition |
| Task D: 桌面版修復 | `desktop-compat.js` | ✅ TouchBridge click→touch |
| index.html | +3 行 before `</body>` | ✅ 零改動鎖定檔案 |

### 🔑 關鍵 DOM Selectors

```
TEI 分數:     #dash-score
TEI 外環:     #ring-score
TEI HRV 環:   #ring-hrv
掃描按鈕:     #scan-trigger-wrapper (.fingerprint-wrapper)
Snapshot:     #snap-hr / #snap-rr / #hrv-val / #ans-ratio
波形容器:     #snapshot-waveform-container
Dashboard:    #dashboard-layer
```

### ⚠️ 已知問題

1. **EventBridgeV2 未載入**: `core/event-bridge-v2.js` 沒有被 index.html 的 `<script>` 標籤載入，導致桌面版 TEST/D 觸發 scan:complete 無法顯示 Results Page
2. **解法**: 在 `desktop-compat.js` 加入 EventBridge fallback 直接呼叫 `TenkiResultsPage.show()`，或在 index.html 加載 event-bridge-v2.js（但 3 行限額已用完）

### 🎯 下次繼續

- [ ] 修復 EventBridgeV2 → Results Page 桌面觸發
- [ ] 在 Vercel live 站驗證 spectrum color + waveform
- [ ] Progressive TEI Scan Milestone Overlay（GLIMPSE→SPECTRUM 浮動指示器）
- [ ] IndexedDB 校準基線持久化

### 🛠 環境備註

- **Node.js**: portable v22.13.1 at `C:\Users\patron\AppData\Local\nodejs-portable\node-v22.13.1-win-x64`
- **Git**: `C:\Users\patron\AppData\Local\Programs\Git\bin\git.exe`
- **Dev server**: `npm run dev` → `http://localhost:5173/`
- **Git user**: `Poshen100 <poshen100@users.noreply.github.com>` (repo-level config)
