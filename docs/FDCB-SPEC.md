# FDCB (Floating Decision Control Bar) Specification

> **Version**: v2.0
> **Last updated**: 2026-03-06
> **Implementation**: `packages/fdcb/src/`

---

## 1. 核心定位

一條永遠浮動在螢幕底部的「自我紀律引擎」。

- **元件名稱**: Floating Decision Control Bar (FDCB)
- **設計哲學**: 決策 → 數據 → 自我覺察，全閉環
- **這不只是計時器。這是一個貼在螢幕底部的「自我紀律引擎」。**

---

## 2. 位置與層級

```
position: fixed bottom
height: 72px (collapsed), ~200px (expanded)
iOS safe area: 自適應 (useSafeAreaInsets)
z-index: 高於內容層，低於 modal
背景: 半透明模糊 (BlurView) + 暗色 rgba(28, 28, 30, 0.92)
渲染位置: Expo Router root layout 層（不被頁面切換影響）
```

---

## 3. 三區塊結構

```
┌────────────────────────────────────────────────┐
│  [A. 模板選擇]   [B. 計時核心]    [C. 事件紀錄]  │
└────────────────────────────────────────────────┘
```

### 3.1 區塊 A：左側 — 情境模板入口

- **收合**: `[ Canslim GS ▾ ]`
- **展開**: Bottom Sheet 顯示 6 種模板
- **選擇行為**: 選模板 → READY 狀態 → 中央計時區亮起

### 3.2 區塊 B：中央 — 決策計時核心

**狀態機**: `IDLE → READY → RUNNING → COMPLETE → (0.8s) → IDLE`

```
1️⃣ IDLE:     [ Start Decision ]  TEI 72
2️⃣ READY:    [ ▶ Canslim GS · 5:00 ]  Tap to Start
3️⃣ RUNNING:  [ 02:18 ]  Sweet Zone  ▓▓▓▓▓▓░░░░░░
4️⃣ COMPLETE: [ ✔ Decision Logged ]  → 0.8s 後回 IDLE
```

### 3.3 區塊 C：右側 — 事件紀錄

- **收合**: `[ ● ● ✔ ● ]` (每個點 = Micro Event)
- **點擊 ✔**: 記錄決策動作 (預設 ENTRY)
- **長按 ✔**: 選擇 Entry / Add / Reduce / Exit / Cancel / No Trade
- **展開 Mini Timeline**: 可左右滑動

---

## 4. 6 種預設模板

| ID | 名稱 | 時長 | 類型 | Sweet Zone |
|----|------|------|------|-----------|
| `CANSLIM_GS` | Canslim 一般設定 | 5 min | 交易 | 60-180s |
| `CANSLIM_HIGH_RS` | Canslim 高RS | 4 min | 交易 | 45-150s |
| `MANCINI_FBD` | Mancini 失敗突破 | 3 min | 交易 | 60-120s |
| `WORK_FOCUS` | 工作專注模式 | 25 min | 生活 | — |
| `HEALTH_STRESS` | 健康壓力模式 | 3 min | 生活 | — |
| `EXERCISE` | 運動模式 | 10 min | 生活 | — |

### 4.1 Mancini FBD 特殊規則
1. 浮動條變紫 (`barColor: '#5E3A87'`)
2. 前 60 秒鎖定 ✔ Entry（按了沒反應 + tooltip）
3. 60-120 秒 Execute 段，允許 ✔
4. Timeout 自動紀錄「耐心完成」

---

## 5. TEI 歷史統計互動

✔ Entry 時系統紀錄: TEI PR + 模板 + 時間段 → 寫入 TEI Bucket

**READY 狀態顯示決策洞察**:
```
📊 在 TEI 70-75 時，你通常在 90-150 秒內進場，勝率 62%
```

---

## 6. 事件類型

```typescript
type EventType = 'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE';
type SessionResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE' | null;
type FdcbState = 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETE';
```

---

## 7. 訂閱 Tier Gating

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

## 8. Database Schema

```sql
decision_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  template_id TEXT NOT NULL,
  tei_at_start INTEGER,
  tei_at_end INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,
  result TEXT,           -- 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE'
  completed BOOLEAN DEFAULT FALSE
)

decision_events (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES decision_sessions,
  user_id UUID REFERENCES users,
  event_type TEXT NOT NULL,
  elapsed_sec INTEGER,
  tei_at_event INTEGER,
  timestamp TIMESTAMPTZ
)
```

---

## 9. Implementation Reference

| Module | File | Tests |
|--------|------|-------|
| Types | `packages/fdcb/src/types.ts` | — |
| Templates | `packages/fdcb/src/templates.ts` | `templates.test.ts` |
| Timer | `packages/fdcb/src/timer.ts` | `timer.test.ts` |
| Events | `packages/fdcb/src/events.ts` | `events.test.ts` |
| Analytics | `packages/fdcb/src/analytics.ts` | `analytics.test.ts` |
| Constants | `packages/fdcb/src/constants.ts` | `constants.test.ts` |

---

*FDCB 模板規則已鎖定，不可自行修改。*
*See also: [ANTIGRAVITY.md](../ANTIGRAVITY.md) Section 5 for complete FDCB spec.*
