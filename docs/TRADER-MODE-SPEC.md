> ⚠️ **部分被取代（2026-07-11，founder 核可）**：本檔為 v2 時代規格，使用已廢棄詞彙（TEI、Retail/Pro 分級、
> 舊模板名）。**TradingView 快訊行為一律以 `docs/TRADINGVIEW-ALERT-SPEC.md` 為準**。本檔仍有效的部分
> （模板預覽卡、session 進行中靜音快訊、Decision Complete / Cancel / Timeout 區分、模板脈衝色）已收編進新檔。
> 除本橫幅外，本檔內文維持 LOCKED 不動。

# TENKI PRO App｜交易者模式（Trader Mode）— 情境模板超完整最終規格書

> **Version**: v1.0 FINAL
> **Status**: 已確認，可直接交付設計（Figma）與工程（Frontend / State / Logic）
> **Created**: 2026-03-30

---

## 一、情境模板總體規格

### 1. 情境模板在 TENKI 中的角色定義

**情境模板 ≠ 單一計時器**
**情境模板 = 一組「決策環境鎖定系統」**

在「交易者模式」下，情境模板同時控制：

* 可使用的 **計時器模板（僅 3 選）**
* TradingView 提醒是否允許
* TEI 掃描強度與頻率
* 決策中斷、取消、重啟的行為限制
* 成就 / 紀律 / 統計歸屬

### 2. 交易者模式可選情境模板（最終，不可變更）

使用者在 Trader Mode 中 **最多同時啟用 3 個模板**（固定）：

1. **Canslim GS 5min**
2. **Canslim High RS Breakout 4min**
3. **Mancini FBD 3min**

❗ 交易者模式中：

* ❌ 不可新增其他模板
* ❌ 不可調整時長
* ✅ 僅可切換模板（Scenario Switch）

---

## 二、模式系統（Mode System）

### App 預設模式：健康壓力模式（Health Stress）

TENKI 的 **預設身份 = 即時情緒偵測 + 決策品質引擎**

| 模式 | 定位 | 預設 | 解鎖方式 |
|------|------|------|---------|
| 一般模式 | 基礎情緒監測 | — | 免費 |
| 健康壓力模式 | 日常決策品質管理 | ✅ **預設** | 免費 |
| 工作專注模式 | 專注力 + 倦怠偵測 | — | Retail |
| **交易者模式** | 職業交易決策引擎 | — | **Pro (設定中啟用)** |

### 切換邏輯

- 預設 = 健康壓力模式，用語和功能全部以「決策品質 + 控制感」為核心
- 使用者從「設定」→「情境模板」切換到 Trader Mode
- 切換後用語、UI、功能全部同步套用（Decision → Trade Decision、建議 → 交易建議）

---

## 三、使用者流程（User Flow）

### Flow 0｜模式選擇

```
App 啟動
  ↓
模式選擇（設定中）
  → 一般模式
  → ✅ 健康壓力模式（預設）
  → 工作專注模式
  → 交易者模式（Trader Mode）
```

#### 進入 Trader Mode 系統行為：

* 自動載入 3 個交易模板
* 啟用「行為鎖定層」
* TradingView 快訊預設：**僅觸發，不顯示**

### Flow 1｜情境模板選擇（核心流程）

```
Trader Dashboard
  ↓ 點擊「啟動計時器 ▼」
顯示模板清單（僅 3 個）
  ↓ 點擊其中一個
情境預覽卡（0.3s）
  ↓ 確認啟動
計時器啟動（左側貼邊）
```

#### 情境預覽卡（必須顯示）

```
[Canslim GS 5min]
・用途：成長股 pullback / breakout
・總時長：5:00
・行為限制：
   - 禁止追價
   - 靜音 TV 快訊
・TEI 掃描：中
```

### Flow 2｜計時器運行中（情境鎖定）

* ❌ 無法切換模板
* ❌ 無法重啟（需 Cancel）
* ❌ 無法開啟 TV 提醒
* ✅ 僅允許：✔ Decision Complete / ✘ Cancel

### Flow 3｜Decision Complete

```
使用者點擊 ✔
  ↓ 0.8s 名言彈窗
  ↓ 系統紀錄：模板類型 / 耗時 / TEI / 是否超時
  ↓ 自動截圖 → 對應圖庫
  ↓ 返回 Trader Dashboard
```

### Flow 4｜Cancel / Timeout

| 行為 | 紀錄 | 紀律影響 |
|------|------|---------|
| Cancel | 中斷行為 | 降低紀律分數，不記勝率 |
| Timeout | 耐心完成 | 正向訊息，紀律加權 |

---

## 四、模板專屬視覺差異

| 模板 | 脈衝顏色 | 名言來源 | 圖庫 |
|------|---------|---------|------|
| Canslim GS | 綠 #34C759 | Growth investing | GS 圖庫 |
| High RS | 藍綠 #00B4D8 | CANSLIM / RS | High RS |
| Mancini FBD | 紫 #5E3A87 | Adam Mancini | FBD |

---

## 五、工程狀態欄位

```json
{
  "mode": "trader",
  "activeTemplate": "MANCINI_FBD",
  "timerState": "RUNNING",
  "tei": 62,
  "tvAlertsMuted": true,
  "disciplineLock": true
}
```

---

## 六、產品定位

> **為職業交易者打造的「決策延遲引擎」與「紀律放大器」**

*Last updated: 2026-03-30*
*Status: LOCKED — 不可自行修改*
