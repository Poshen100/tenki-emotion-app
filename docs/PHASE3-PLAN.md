# TENKI Phase 3 — Implementation Plan

## 現況分析（基於 tenki-emotion-app.vercel.app 實測）

````carousel
### 🔴 問題 1：T5: Degraded 常駐警告
右上角「T5: Degraded」badge 持續顯示，暗示感測器 T5 信號品質降級。
Simulation Mode 時應改為更友善的提示，而非錯誤感的警告紅色。

<!-- slide -->

### 🟡 問題 2：DecisionDock 完全隱藏
`DecisionDockController v1.1` 已初始化，但 `floatingCard` 在 scan 完成後才顯示。
沒有任何 UI 入口點讓用戶主動開啟決策計時器，功能被困在背後。

<!-- slide -->

### 🟡 問題 3：Simulation 掃描流程無終點
TAP TO SCAN → Simulation Mode，但沒有「掃描完成」UI 反饋，
沒有 TEI 分數輸出，也沒有觸發 DecisionDock 顯示的機制。

<!-- slide -->

### 🔲 功能缺口：T3 模板未實作段落邏輯
`decision-dock-controller.js` 的 `TEMPLATES` 陣列有 T3 名稱，
但 `DecisionTimer` 的段落邏輯（Wait→Observe→Entry Window）只有 T1 實作。
````

---

## Proposed Changes

### Component 1 — `core/decision-dock-controller.js`

#### [MODIFY] [decision-dock-controller.js](file:///C:/Users/patron/.gemini/antigravity/scratch/tenki-emotion-app/core/decision-dock-controller.js)

**Todo 1**: 加入「⏱ 開啟決策計時器」快速入口按鈕，在掃描完成後出現在指紋按鈕旁邊
- 訂閱 `EventBridge` 的 `scan:complete` / `tei:updated` 事件
- 收到後自動呼叫 `showFloatingCard()` 並更新 TEI 值

**Todo 2**: 實作 T3 CANSLIM 段落邏輯（3 段）
```
T3 CANSLIM_GROWTH (5 min = 300s):
  Segment 1: 0–60s   — "等待方向確認" (WAIT)
  Segment 2: 60–240s — "觀察量能收縮" (OBSERVE)
  Segment 3: 240–300s — "進場窗口" (ENTRY — only if TEI ≥ 60)
```

**Todo 3**: T4 High RS Breakout 段落邏輯（2 段）
```
T4 CANSLIM_HIGHRS (4 min = 240s):
  Segment 1: 0–60s   — "等待確認" (WAIT)
  Segment 2: 60–240s — "進場窗口🚀" (ENTRY)
  Timeout = 自動 WIN
```

---

### Component 2 — `core/dashboard-patch.js`

#### [MODIFY] [dashboard-patch.js](file:///C:/Users/patron/.gemini/antigravity/scratch/tenki-emotion-app/core/dashboard-patch.js)

**Todo 4**: 修正 T5 Degraded badge 在 Simulation Mode 下的顯示邏輯
- 當偵測到 `SIMULATION_MODE`（無相機）時，將 badge 改為「🧪 模擬模式」（黃色）
- 真正感測器降級才顯示紅色 `T5: Degraded`

---

### Component 3 — `core/ai-behavior.js`

#### [MODIFY] [ai-behavior.js](file:///C:/Users/patron/.gemini/antigravity/scratch/tenki-emotion-app/core/ai-behavior.js)

**Todo 5**: 在 TEI ≥ 60 時，DecisionDock 顯示 AI 提示 hint
- 根據 TENKI SPEC AI 規則：不可說「You should have / If only」
- 格式：`💡 「{emotionLevel} 情緒狀態良好，{templateName} 計時開始」`

---

## 🚦 Verification Plan

### 自動化測試

現有測試：
```bash
# 在 C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app 執行
npx vitest run tests/progressive-tei.test.js   # 18 個 unit tests
npx vitest run tests/benchmark                  # 5 個效能基準
```

新增測試 — `tests/decision-dock.test.js`：
- T3 段落邏輯：確認 300s 分為 3 段，第 3 段需 TEI ≥ 60
- T4 段落邏輯：確認 240s 分為 2 段，Timeout = WIN

### 瀏覽器手動驗證

1. 開啟 `http://localhost:5173`（`npm run dev`）
2. **T5 Badge 測試**：無相機環境 → 應顯示黃色「🧪 模擬模式」而非紅色
3. **DecisionDock 觸發**：點擊指紋按鈕完成模擬掃描 → DecisionDock 浮動卡片自動出現
4. **T3 模板**：選擇「Cansilm 成長股」→ 啟動 → 確認 3 段切換（0–60s / 60–240s / 240–300s）
5. **T4 模板**：選擇「High RS Breakout」→ 讓計時器跑完 → 確認出現 🏆「耐心完成！」

---

## 📋 Commit 計畫（每 Todo 一個 commit）

```
feat(dock): auto-show DecisionDock on scan:complete event
feat(templates): implement T3 CANSLIM 3-segment logic (300s)
feat(templates): implement T4 High RS 2-segment logic (240s)
fix(dashboard): show simulation badge instead of T5:Degraded in sim mode
feat(ai): add TEI-aware hint messages on timer start
test(dock): add T3/T4 segment logic unit tests
```

---

> **Version**: Phase 3 Plan v1.0  
> **Date**: 2026-02-22  
> **Status**: 待審核
