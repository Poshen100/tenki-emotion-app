# FDCB (Floating Decision Control Bar) Specification

> ⚠️ **本文件為精簡摘要。完整規格見 [ANTIGRAVITY.md](../ANTIGRAVITY.md) — Section 5 (FDCB 完整 spec)。**
> **工程實作見 `packages/fdcb/src/` — types, templates, timer, events, analytics, constants。**

## 核心定位
一條永遠浮動在螢幕底部的「自我紀律引擎」。決策 → 數據 → 自我覺察，全閉環。
這不只是計時器。這是一個貼在螢幕底部的「自我紀律引擎」。

## 三區塊結構

```
┌────────────────────────────────────────────────┐
│  [A. 模板選擇]   [B. 計時核心]    [C. 事件紀錄]  │
└────────────────────────────────────────────────┘
```

### A. 左側 — 情境模板入口
- 收合：`[ Canslim GS ▾ ]`
- 展開：Bottom Sheet 顯示 6 個模板
- 選擇後進入 READY 狀態（不立即開始）
- 完整模板定義 → [ANTIGRAVITY.md §5.4](../ANTIGRAVITY.md)

### B. 中央 — 決策計時核心
- 狀態機：`IDLE → READY → RUNNING → COMPLETE → (0.8s auto) → IDLE`
- 進度條分段顯示（依模板 segments 著色）
- Sweet Zone 標示
- 完整狀態機 → [ANTIGRAVITY.md §5.5](../ANTIGRAVITY.md)

### C. 右側 — 事件紀錄 + 勾選節點
- 收合：`[ ● ● ✔ ● ]` 圓點列
- 點擊 ✔ → 記錄 ENTRY（snapshot TEI）
- 長按 → 選擇 ENTRY / ADD / REDUCE / EXIT / CANCEL / NO_TRADE
- Mini Timeline 展開可左右滑動
- 完整事件規格 → [ANTIGRAVITY.md §5.6](../ANTIGRAVITY.md)

## 6 個預設模板（已定案，不可修改）

| ID | 名稱 | 時長 | 類別 | Sweet Zone |
|----|------|------|------|-----------|
| CANSLIM_GS | Canslim 一般設定 | 5min | trading | 60-180s |
| CANSLIM_HIGH_RS | Canslim 高RS | 4min | trading | 45-150s |
| MANCINI_FBD | Mancini 失敗突破 | 3min | trading | 60-120s |
| WORK_FOCUS | 工作專注模式 | 25min | lifestyle | — |
| HEALTH_STRESS | 健康壓力模式 | 3min | lifestyle | — |
| EXERCISE | 運動模式 | 10min | lifestyle | — |

## Mancini FBD 特殊規則
- `lockEntrySec: 60` — 前 60 秒 ENTRY 被拒絕
- `preventEarlyComplete: true` — 必須跑完 180 秒
- `timeoutAction: 'log_patience'` — 逾時記錄為「耐心完成」

## UI 規格
- 位置：`position: fixed bottom`
- 高度：72px (collapsed) / ~200px (expanded)
- 背景：`rgba(28, 28, 30, 0.92)` + blur(20px)
- iOS safe area 自適應
- 渲染位置：Expo Router root layout 層

## 訂閱 Tier Gating
- **Free**：無 FDCB
- **Retail**：基礎計時 + 1 個模板（無事件/無統計）
- **Pro**：完整功能（全模板 + 事件 ✔ + Mini Timeline + TEI Bucket 統計 + 決策洞察）

## Data Layer
- 每次事件 (ENTRY/ADD/REDUCE/EXIT) 紀錄當下的時間與 TEI
- 完成時寫入 `decision_sessions` + `decision_events` → Supabase
- TEI Bucket 統計生成決策洞察：
  *「在 TEI 70-75 時，你通常在 90-150 秒內進場，勝率 62%」*
- 完整 DB schema → [ANTIGRAVITY.md §2.3](../ANTIGRAVITY.md)
