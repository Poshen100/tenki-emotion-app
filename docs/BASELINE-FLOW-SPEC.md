# BASELINE-FLOW-SPEC.md — Onboarding Baseline Flow 修復與 UX 整合規格

> **Status**: v1.1 — Spec finalized 2026-05-11(open questions resolved),implementation pending
> **Target surfaces**: `apps/preview/` (中介驗證) → `apps/mobile/` (Phase C 正式實作)
> **Forbidden surface**: `apps/web/`(凍結,本 spec 不在此修)
> **參考依據**: 2026-05-11 founder review of `/baseline` flow on Vercel preview
> **作者**: Claude Code session `claude/create-claude-md-IPDJm`

---

## 0. 為什麼有這份 spec

Founder 在 Vercel preview 走完 onboarding,給出兩個並列問題:

1. **Flow bug** — 掃描完成、星塵 ceremony 出現後,**沒有進結果頁**,反而跳到 FHZ 三選一購買面板上的 BASELINE 卡(「Hold finger on lens for 3 min」)。
2. **設計整合機會** — 那張 FHZ baseline 卡的視覺(即時相機 + NOT DETECTED 徽章 + 三條多維品質條 + 漸層紅黃綠)**很有醫療專業感**,但目前「正在學習你的節奏」極限版只有單圓環與一條波形,**用戶無法理解「穩定中」具體指什麼**。

這份 spec 同時覆蓋這兩件事,因為它們會在同一個 mobile 重寫裡一起被消化。

---

## 1. Bug:Ceremony → Result Page 路由斷掉

### 1.1 期望流程(canonical)

```
intro → sensor → readiness → scan → [ceremony stardust] → result → next
```

對應 `apps/web/baseline-onboarding.js:49` 的 `STEPS = ['onb-step-intro', 'onb-step-sensor', 'onb-step-readiness', 'onb-step-scan', 'onb-step-result', 'onb-step-next']`。

`onb-step-result` 在 line 166-180:
- 標題:**基線已建立**
- 副標:「這是你的目前基線,不是好壞分數。TENKI 已經學到你的心率、呼吸和壓力的『正常範圍』」
- 三張 metric 卡:HR 範圍 / HRV / 呼吸節奏
- Confidence 徽章
- Primary CTA:**繼續**

這頁體驗很對,**符合 v3 wellness 語氣**(「不是好壞分數」)。

### 1.2 實際發生(broken)

掃描結束後,ceremony 出現,然後跳到 FHZ purposes 卡片頁(`apps/web/fhz/fhz-purposes.js:27-35` 的 BASELINE 條目):
- 標題:**Baseline**
- 副標:「Hold finger on lens for 3 min」(英文 + 醫療口吻)
- 「NOT DETECTED」徽章
- Coverage / Stability / Signal quality 三條品質條

這完全跳過 `onb-step-result`,讓「不是好壞分數」的溫柔訊息消失,且把使用者推回另一個 3 分鐘掃描入口 — **體感是「我剛掃完,為什麼又要我掃?」**

### 1.3 根因假設

`scan-complete` 事件(或等價的)被 FHZ controller 攔截/重新路由,搶在 `goToStep(4)`(onb-step-result)之前觸發。需要在 mobile 重寫時:

- **Onboarding flow 必須是 modal / 全螢幕 stack**,不共用 FHZ 的 scan 路由
- Scan 結束的 callback 只能來自 onboarding state machine,**不掛全域 event bus**
- FHZ purpose 卡片頁是 Tab/Discovery 入口,**不該被 onboarding 連到**

### 1.4 驗收(mobile 實作時)

- [ ] `scan` step 結束 100% 進入 `result` step
- [ ] `result` step 顯示 HR / HRV / RR 三張卡 + confidence 徽章
- [ ] CTA 點下去進 `next` step,不進 FHZ
- [ ] Telemetry:`baseline.onboarding.flow.completed` 事件含 step transitions 路徑(可在 dev build 驗證無誤跳)

---

## 2. UX 整合:醫療專業感 → 極限設計

### 2.1 兩邊強弱對照

| 元素 | 極限版「正在學習你的節奏」(現況) | FHZ baseline 卡(醫療版) | 取捨 |
|---|---|---|---|
| 主視覺 | 單一大圓環倒數 | 即時相機畫面 + 狀態徽章 | 各保留,分層 |
| 訊號狀態 | 「穩定中...」一句話 | NOT DETECTED 大徽章 | **必須升級** — 用戶要知道具體狀態 |
| 失敗指引 | 無 | 「Cover the rear camera fully...」浮層 | **必須補上** — failure 路徑要有解 |
| 品質訊息 | 一條心跳波形 | Coverage / Stability / Signal 三條 + 漸層 | **抽屜化** — 預設折疊 |
| 視覺重量 | 極輕,專注 | 重,訊息密集 | **進度條只在失敗時展開** |
| 情緒語氣 | 詩意(「學習你的節奏」) | 工具(「Hold finger on lens」) | 保極限的詩意 |

### 2.2 設計原則:Progressive Disclosure

> **Silent when good. Diagnostic when bad. Detailed on demand.**

| 訊號狀態 | 主畫面顯示 |
|---|---|
| Quality green (`sqi ≥ 0.7`、coverage ≥ 0.8、stability ≥ 0.7) | 極限版原樣:圓環 + 「穩定中...」+ 一條波形,顏色 cyan |
| Quality amber(任一維 0.4–0.7) | 圓環變 amber、文字改為**具體狀態**(下方 2.3),底部展開 1 行「最弱維度」提示 |
| Quality red(任一維 < 0.4) | 圓環變 warm-red、文字改為**具體錯誤**、**自動展開**三條品質條、相機畫面縮圖出現在右下角(讓用戶肉眼確認手指有沒有蓋對) |
| 用戶**長按圓環** 600ms | 拉出 debug drawer(三條品質條 + 相機縮圖 + raw values)— 給好奇 / 開發者。圖示**不**常駐 |

### 2.3 狀態文案對照(Hierarchy:主標保留詩意,副標換具體狀態)

**主標(永遠)**:`正在學習你的節奏`(極限版招牌句,保留)

**副標**(依狀態,zone-transition 才換,**不每幀換**避免閃動):

| 條件 | 副標(zh-Hant) | 顏色 token |
|---|---|---|
| coverage < 0.5 | 手指沒蓋滿鏡頭 | warn-red |
| brightness < threshold(暗) | 光線太暗,靠近光源 | warn-amber |
| brightness > threshold(過曝) | 光線太強,稍微遮一下 | warn-amber |
| stability < 0.5(動太多) | 放輕鬆,手別動 | warn-amber |
| sqi 上升中、其他維 ok | 正在對焦 | cyan |
| sqi ≥ 0.7、stability ≥ 0.7 | 穩定中⋯ | cyan |
| 倒數最後 5 秒 | 快好了 | cyan-bright |

換句節流:同一個 zone 內**不換副標**,只有 green↔amber↔red transition 才觸發 fade-swap(Reanimated 3 timing 240ms)。

所有文案**經 Compliance Layer**(`packages/engine/src/compliance/`),嚴禁醫療/金融語言。

### 2.4 相機縮圖規範

- **預設隱藏整個縮圖**(極限主義 + 隱私感:避免「相機畫面常駐」帶來的潛意識被監視感)
- 掃描全程在左下角顯示一個 **2×2 dp 呼吸點**(liveness indicator,opacity 0.35→0.6 呼吸,2s period),告訴用戶「相機在跑、沒當機」,但**不**顯示畫面內容
- 訊號 red 時呼吸點**展開**為 96×96 縮圖(spring 300ms),圓角 16,陰影輕
- 上層疊一個半透明狀態徽章(`未偵測` / `光線不足` / `動太多`)
- 點擊縮圖 → 放大到 viewport 70% 寬,讓使用者校正
- Green/amber 時縮圖不自動展開;但用戶**長按圓環觸發 debug drawer** 時會把縮圖一併拉出

### 2.5 三條品質條(drawer)

```
Coverage     ████████░░░░  64%
Stability    ██████████░░  82%
Signal       ██████░░░░░░  47%
```

- 漸層 stops 用 design tokens:`--zone-strain` → `--zone-neutral` → `--zone-clear`(對齊 3 zone 配色,**不是**獨立紅黃綠)
- 每條右側百分比、底部一行 micro-copy(「越穩越快學會你的節奏」之類,經 compliance)
- Drawer 用 Reanimated 3 spring 從圓環區域上推(長按手勢觸發),不擋圓環
- **不**包含歷史 sparkline(YAGNI:無用戶需求 + 違反 progressive disclosure;若日後需要,獨立到 Settings → Telemetry 頁,不擠在 baseline drawer)

---

## 3. 實作位置(v3 對齊)

| 層 | 職責 | 檔案路徑 |
|---|---|---|
| Domain | 品質維度狀態機(green/amber/red)定義、狀態 → 文案 mapping | `domain/src/policies/baseline-quality-policy.ts` |
| Engine | 從 sample stream 算 coverage / stability / SQI(已存在) | `packages/engine/src/baseline/signal-quality-gate.ts` |
| Shared copy | 七條狀態文案 + drawer 文案 | `packages/shared/src/copy/baseline-onboarding.ts` |
| Mobile UI | 圓環(Skia)、相機縮圖、drawer、文案綁定 | `apps/mobile/app/baseline/scan.tsx` + 子元件 |
| Preview | 同上但用 vanilla(快速 founder 驗證) | `apps/preview/baseline-onboarding.js` |

**禁止**:在 `apps/web/` 加任何補丁。本 spec 的修正完全發生在 preview / mobile 兩個 active surface。

---

## 4. Out of Scope(本 spec 不處理)

- FHZ purposes 頁本身的去留(那是 Discovery / Scan tab 的話題,獨立 spec)
- Result page 的視覺改版(`docs/RESULTS-PAGE-SPEC.md` 已有規格)
- 3-min long baseline 是否要保留為單獨 mode(產品決策,等 founder)
- A/B 是否要把 ceremony 縮短或延長(視覺方向,獨立 review)

---

## 5. Resolutions(2026-05-11,founder 全依建議)

| # | 原問題 | 決議 | 落腳處 |
|---|---|---|---|
| 1 | drawer 圖示要不要常駐? | **不常駐**。用「長按圓環 600ms」這個藏式 gesture 觸發,green 狀態下整個 UI 完全沒有 affordance,徹底 silent-when-good | §2.2 表格、§2.5 |
| 2 | 相機縮圖預設可見度? | **預設隱藏整個畫面**,但保留左下角 2×2 dp 呼吸點作為 liveness 指示;訊號 red 時呼吸點 spring 展開成 96×96 縮圖。**不**用 8×8 angular dot(那仍會洩露畫面動態) | §2.4 |
| 3 | 「正在學習你的節奏」要不要保留? | **保留為主標**(永遠),只換**副標**;副標只在 zone transition (green↔amber↔red) 時 fade-swap,**不每幀換**避免閃動 | §2.3 |
| 4 | 三條品質條要不要加歷史 sparkline? | **不加**(此 spec 階段)。YAGNI + 違反 progressive disclosure。若日後做趨勢功能,獨立到 Settings → Telemetry,不擠在 baseline drawer | §2.5 |

決議已內嵌進 §2 對應段落,本節僅作 audit trail。
