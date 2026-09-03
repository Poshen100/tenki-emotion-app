# WEARABLE-INTEGRATION.md — 穿戴資料整合路線（canonical）

> **狀態**：Phase 0（資料契約）**已落地**；Phase 1 以後**尚未實作**。
> 本檔是穿戴／健康資料整合的 canonical 文件。Garmin 專屬的 Body Battery 路線見
> `docs/garmin-integration.md`（本檔的 Phase 4 = 該檔的 Phase 0/2/3，兩者不衝突）。
> 對齊 CLAUDE.md：**Local-first + Cloud-minimal，raw biometric 不上雲**。

## 0. 一句話結論

**iOS 以 Apple 健康（HealthKit）為第一級整合中樞、Android 以 Health Connect 為第一級整合中樞，
再加標準 BLE 胸帶直連補高精度 RR interval。Garmin 官方 API 放第二波，Google Fit 不做新開發。**

理由：一次串接就覆蓋 Apple Watch、以及會回寫系統健康庫的 Garmin / Fitbit / Samsung / Wear OS
與其他 App，不必逐一談品牌 SDK 或商業授權。

## 1. 命名（對外／對內都照這個講）

| ✗ 不要講 | ✓ 正確講法 | 為什麼 |
|---|---|---|
| 連接 Apple 健身 | **連接 Apple 健康**（技術名 HealthKit） | Apple Fitness 是使用者介面／服務品牌，不是資料 API；資料入口是 HealthKit |
| 連接 Google Fit | **連接 Health Connect** | Google Fit API 已進入淘汰期，不得成為新架構依賴 |
| 「偵測情緒」「量測壓力指數」 | 「讀取心率／HRV／睡眠等已記錄的資料」 | compliance 紅線：不得宣稱診斷或情緒偵測 |
| 已支援 Garmin / Apple Watch | 目前**尚未**串接任何健康庫（見 §5 現況） | 不得宣稱未實作的能力 |

App 內連接頁應只出現四個選項：**Apple 健康**（iOS）／**Health Connect**（Android）／
**心率胸帶**（進階）／**Garmin Connect**（可選、第二波）。

## 2. 優先序

| 優先級 | 入口 | 覆蓋 | 對 Edge Score 的價值 | 成本 |
|---|---|---|---|---|
| P0 | HealthKit（iOS） | iPhone、Apple Watch、回寫 Apple 健康的第三方裝置 | 心率、靜止心率、HRV(SDNN)、睡眠、活動 | 平台原生，無授權費 |
| P0 | Health Connect（Android） | Android、Wear OS、Fitbit 等 | 心率、HRV(RMSSD)、睡眠、SpO₂、呼吸率、活動 | 平台原生，無授權費 |
| P0 | BLE 胸帶直連 | Polar H10、Wahoo TICKR、Garmin HRM、Coospo… | 真 RR interval → 高品質短窗 HRV | 標準 Heart Rate Service（`0x180D` / 量測 characteristic `0x2A37`），不需品牌合作 |
| P1 | Garmin Health API | Garmin 重度使用者 | Body Battery / Stress / Pulse Ox（健康庫拿不到） | B2B 審核制，商業使用可能付費 → `docs/garmin-integration.md` |
| P2 | Oura / Withings / Ultrahuman 等雲端 API | 各自生態 | 夜間 HRV、恢復趨勢 | 先由健康庫吸收，有付費留存需求再談 |

## 3. Phase 0 — 資料契約（已完成）

所有來源都正規化成同一個模型，adapter 之後的每一層都不該知道資料出自哪個品牌：

| 檔案 | 職責 |
|---|---|
| `domain/src/contracts/wearable-sample.ts` | `BiometricSample` 正規模型、metric / platform / permissionScope 詞彙、`LOCAL_ONLY_METRICS` |
| `domain/src/schemas/wearable-schema.ts` | adapter 輸出當**不可信輸入**驗證（生理合理範圍、未來時間戳、批次 partition） |
| `domain/src/policies/wearable-source-policy.ts` | 來源優先序、freshness 窗、每 metric 選一個贏家、舊來源詞彙對應 |

三條結構性規則（改動前先讀完本節）：

1. **SDNN ≠ RMSSD。** Apple 健康的 HRV 是 SDNN、Health Connect 定義的 HRV 型別是 RMSSD。
   兩者都可以參與 Edge Score，但**必須各自對自己的個人基線正規化**，永遠不共用欄位。
2. **每個 sample 自帶 provenance / quality / confidence / observedAt。**
   沒有來源的裸數字事後無法仲裁，也無法在 UI 誠實顯示「Apple Watch · 12 分鐘前」。
3. **`rr_interval_ms` 是 raw 搏間序列 → 留在裝置**（`LOCAL_ONLY_METRICS`）。
   由它算出的 RMSSD / SDNN 屬 derived，不受此限。使用者同意能放寬「讀什麼」，
   **不能放寬「什麼可以離開裝置」**。

### 已知衝突（待 founder 裁決，本次未動）

`packages/engine/src/biometric/hrv.ts` 的 `harmonizeHrv()` 目前把 HealthKit 的 SDNN 乘 0.75
當成 RMSSD 用。這與規則 1 直接衝突（該係數沒有個人化依據，跨人差異很大）。
改它會動到 Edge Score 數值 → 屬產品決策，不在 Phase 0 範圍。三個選項：

- (a) 保留係數，但在 UI／log 標記「換算值、信心降級」；
- (b) 改成兩條獨立的基線軌（SDNN 軌與 RMSSD 軌），誰有資料用誰；← 與本契約一致
- (c) 只在同一來源內比較，不跨來源換算。

## 4. Phase 1–4 — 尚未實作

| Phase | 內容 | 為什麼還沒做 |
|---|---|---|
| 1 | iOS HealthKit 原生橋接、contextual 權限、30 天基線首次同步、資料新鮮度顯示 | 需要 native module + Mac 實機驗證（CLAUDE.md AI 分工表） |
| 2 | Android Health Connect（權限分群 Vitals / Sleep / Activity；未安裝時導引，不當成登入失敗） | 同上 |
| 3 | BLE Precision Link：只支援標準 Heart Rate Service，即時顯示有效搏數與 RR 可用性 | 同上。⚠️ 沒有 RR interval 的裝置只能提升心率品質，**不得宣稱量到胸帶 HRV** |
| 4 | Garmin Health API（先申請 evaluation，不把授權費放進 MVP 必要條件） | 審核制外部相依 → `docs/garmin-integration.md` |

Phase 1–3 的共同驗收線：**權限被拒時相機 Soul Scan 仍完整可用**，穿戴資料是補強層，不是前置條件。

## 5. 現況（2026-09-03 查核）

repo 內**沒有**任何可用的 HealthKit / Health Connect / Garmin / BLE 讀取實作。
既有的只有型別槽位與 UI 佔位：

- `packages/engine/src/common/types.ts` — `BiometricSource`、`SleepRecoveryInput`（有槽位，無資料）
- `packages/engine/src/fusion.ts` — `FusionSource` 優先序（本檔 Phase 0 沿用其排序）
- `packages/engine/src/pipeline/scan-pipeline.ts` — `wearableHrvRmssdMs` 覆寫路徑（等資料）
- `apps/mobile/app/(tabs)/lab.tsx:81` — Devices 入口 `onPress: undefined`（佔位）

因此**任何對外文案都不得宣稱已支援穿戴裝置**。

## 6. 詞彙收斂（技術債，逐步進行）

同一件事目前有四套名字，新代碼一律用 `BiometricSourcePlatform`：

| 舊名 | 位置 | canonical |
|---|---|---|
| `watch_healthkit` | `packages/engine/src/types.ts` `FusionSource` | `healthkit` |
| `rppg_glabella` / `rppg_forehead` / `rppg_cheek` | 同上 | `camera` |
| `finger_ppg` / `face_estimate` | `apps/mobile/stores/autonomic-store.ts` | `finger_scan` / `camera` |
| `HrvSource` | `packages/engine/src/biometric/hrv.ts` | `BiometricSourcePlatform` |

轉換用 `resolveSourcePlatform()`；不做一次性 breaking rename（會同時動到掃描與計分路徑）。

## 7. 訂閱與 compliance 界線

- 付費價值是**把使用者已有的資料轉成可驗證的決策準備度**，不是「收資料」。
  Free：相機掃描 + 連一個系統健康來源。Premium：個人基線、睡眠／HRV context、多裝置融合。
- **隱私控制不得放在付費牆後**（CLAUDE.md v3 硬規則）。
- 誠實狀態優先於漂亮分數：「訊號不足」「資料過期」「建議重新量測」要能真的顯示出來。
- Edge Score 是 readiness / self-management 訊號，**不是**憂鬱、焦慮、心臟疾病的診斷，
  也不是任何獲利保證。心律事件類資料只能用來建議「暫停掃描／尋求適當協助」，不得自行判讀。
- HealthKit 與相機臉部資料不得用於廣告、行銷或第三方行為資料探勘（App Store 審核要求）。
