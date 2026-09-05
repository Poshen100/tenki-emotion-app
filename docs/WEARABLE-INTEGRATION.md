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

### HRV 換算：已裁決採 (b)，2026-09-04

原本 `packages/engine/src/biometric/hrv.ts` 的 `harmonizeHrv()` 把 HealthKit 的 SDNN 乘 0.75
當 RMSSD 用。那個係數沒有個人化依據（跨人差異很大），與規則 1 直接衝突。
**founder 已裁決採選項 (b)：兩條獨立基線軌，誰有資料用誰。** 已實作：

| 改動 | 位置 |
|---|---|
| `harmonizeHrv()` 移除（v3 模組；`legacy/hrv.ts` 保留不動） | `packages/engine/src/biometric/hrv.ts` |
| `HrvMetric` / `HrvObservation` / `NATIVE_HRV_METRIC` / `buildHrvObservation()` —— 每個 HRV 值都帶著「它到底是哪個統計量」，**永不換算** | 同上 |
| `BaselineProfile.hrvSdnn` —— SDNN 自己的基線軌（optional，舊 profile 沒有就是「還沒有 SDNN 基線」，不從 RMSSD 軌回填） | `packages/engine/src/common/types.ts` |
| `updateBaselineProfile(..., hrvSdnnMs)` 路由 SDNN、`selectHrvBaseline(profile, metric, bucket)` 取對的軌 | `packages/engine/src/baseline/baseline.ts` |

⚠️ **Edge Score 數值沒有變**：`harmonizeHrv()` 當時沒有任何 pipeline 呼叫（只有 engine index 再匯出），
SDNN 軌在 HealthKit 接上前也不會有資料。這是把陷阱在被接上之前拆掉，不是改計分。

Phase 1 接 HealthKit 時的義務：SDNN 值必須走 `hrvSdnnMs` 進 SDNN 軌，
**不得塞進 `BiometricReading.hrvRmssdMs`**；沒有對應軌的基線就不出該項讀數，不借用另一軌。

## 4. Phase 1 — 連接頁（非原生部分已完成，2026-09-04）

`apps/mobile/features/devices/` + route `/devices`（Lab → Devices 進入）。
**接縫是 `port.ts` 的 `DeviceLinkPort`**：上面全是純邏輯、今天就能測；
下面是要 Mac 才能寫的 native module。原生階段只要實作這個介面，
畫面、狀態機、store 都不用改。

| 檔案 | 職責 |
|---|---|
| `providers.ts` | 四個入口的 catalogue + `resolveUnavailableReason()`（先擋錯 OS，再擋第二波，再擋沒裝 Health Connect，最後才是沒有 adapter） |
| `copy.ts` | 所有 user-facing 字串集中一處，測試直接驗 §1 命名紅線與 compliance |
| `machine/deviceLinkMachine.ts` | 每個 provider 一台連線狀態機（`unavailable` / `disconnected` / `requesting` / `denied` / `connected` / `error`） |
| `store/devicesStore.ts` | 連線紀錄（狀態、拿到哪些 scope、上次同步）—— 生理數值不經過它 |
| `status.ts` | 「Apple Watch · 12 分鐘前」；stale 門檻 borrow domain 的 `METRIC_FRESHNESS_MS` |
| `port.ts` | **原生階段的實作點**；預設 `createUnwiredLinkPort()` 對每個 provider 都回「這個版本還沒有裝置連接模組」 |

已定案的行為（有測試守著，改動前先看測試）：

- **PARTIAL 授權算已連接**，畫面列出實際拿到的 scope，不含糊帶過。
- **DENIED 不是 error、也不是死路**：那一列明說「相機掃描仍可完整使用」，RETRY 永遠在。
- **BLOCK 從任何狀態都收**：使用者可能中途解除安裝 Health Connect，
  不能讓「已連接」卡在那裡宣稱不存在的連線。
- **沒有 adapter 就照實說**，那是我們的缺口不是使用者的；不得長成「連了但永遠沒資料」。
- 隱私說明與中斷連接就在頁面上，整頁免費（v3 硬規則：隱私控制不得放在付費牆後）。

## 4b. 三個來源的資料轉換層（已完成，2026-09-05）

原生模組還沒有，但**每個來源真正容易出錯的那一段是純函式，已經寫完並測起來**：
native 橋接之後只負責把平台資料交出來，剩下的判斷都在這裡。

| 檔案 | 職責 | 守住什麼 |
|---|---|---|
| `adapters/bleHeartRate.ts` | 解析標準 Heart Rate Measurement（`0x180D` / `0x2A37`） | RR interval 單位是 **1/1024 秒不是毫秒**；energy 欄位在 RR 之前，offset 算錯會生出假的第一拍；contact-status bit 在 supported bit 沒設時無意義，不得顯示成「接觸良好」 |
| `adapters/healthKitMapping.ts` | Apple 健康 sample → `BiometricSample` | Apple 的 HRV 一律落 `hrv_sdnn_ms`；**沒告知的單位一律拒收不猜**（HealthKit 的 percent 是分數、SDNN 可能是秒也可能是毫秒）；使用者手動輸入的數字降級 |
| `adapters/healthConnectMapping.ts` | Health Connect record → `BiometricSample` | Health Connect 的 HRV 一律落 `hrv_rmssd_ms`；SpO2 已是 0..100；energy 只認 kcal / joules |

**兩道網，缺一不可**：① adapter 不猜單位 ② 每一筆再過一次 domain 的
`validateBiometricSample()`。所以就算單位判斷錯了，撞到生理合理範圍還是會被擋掉
（SpO2 0.97 會被拒收，不會被當成 0.97% 存進基線）。

⚠️ 一個平台一支 mapper 是**刻意的**，不要為了 DRY 合併：
Apple 給 SDNN、Health Connect 給 RMSSD，分開寫才讓那個差異在結構上無法被含糊帶過。

## 5. Phase 1–4 原生部分 — 尚未實作

| Phase | 內容 | 為什麼還沒做 |
|---|---|---|
| 1 | iOS HealthKit 橋接（實作 `DeviceLinkPort`）、30 天基線首次同步 | 需要 native module + Mac 實機驗證（CLAUDE.md AI 分工表） |
| 2 | Android Health Connect（權限分群 Vitals / Sleep / Activity；未安裝時導引，不當成登入失敗） | 同上 |
| 3 | BLE Precision Link：只支援標準 Heart Rate Service，即時顯示有效搏數與 RR 可用性 | 同上。⚠️ 沒有 RR interval 的裝置只能提升心率品質，**不得宣稱量到胸帶 HRV** |
| 4 | Garmin Health API（先申請 evaluation，不把授權費放進 MVP 必要條件） | 審核制外部相依 → `docs/garmin-integration.md` |

Phase 1–3 的共同驗收線：**權限被拒時相機 Soul Scan 仍完整可用**，穿戴資料是補強層，不是前置條件。

### 沒有 Mac 也能建 iOS 版（founder 端的前置條件）

「等 Mac」其實不精確 —— **EAS Build 是在 Expo 的雲端 macOS 上編譯**，不需要自己有 Mac。
真正的前置條件是：

| 需要 | 為什麼 | 成本 |
|---|---|---|
| **Expo 帳號 + EAS Build** | Expo Go **載不了自訂原生模組**，三條 P0 都需要 development build（dev client） | 免費方案有 build 額度與排隊，夠用 |
| **Apple Developer Program** | 把 dev build 裝進實體 iPhone 需要 provisioning；日後 TestFlight／上架也要 | 年費（以 Apple 官方公告為準） |
| 一支 Android 手機（可借） | Health Connect 與 BLE 兩條可以**零費用**先驗，APK 直接側載 | 0 |

⚠️ 這三條沒有一條是 Claude Code 能代辦的（都要 founder 的帳號與付款）。
在它們到位之前，原生模組寫了也**無法驗證**，而未經驗證的橋接比沒有橋接更危險 ——
它會讓連接頁開始說謊。

實作 `DeviceLinkPort` 時的義務：
1. `describeEnvironment()` 要照實回報 adapter 是否存在 —— 回 `true` 但沒有橋接，
   會讓畫面開始說謊。
2. SDNN 值走 `updateBaselineProfile(..., hrvSdnnMs)` 進 SDNN 軌，
   **不得塞進 `BiometricReading.hrvRmssdMs`**（見 §3）。
3. 權限要 contextual（掃描之後才問），且逐個 scope，不在冷啟動一次要全部。

### 現況（2026-09-05 查核）

repo 內**沒有**任何原生的 HealthKit / Health Connect / Garmin / BLE 讀取實作 ——
沒有相關相依套件、也還沒 prebuild（沒有 `ios/` 或 `android/`）。
連接頁在真機上會顯示「尚未開放連接，功能還在開發中」，這是設計行為，不是 bug。
資料轉換層已完成（見 §4b），等的是把資料交進來的那一層。既有的其他槽位：

- `packages/engine/src/common/types.ts` — `BiometricSource`、`SleepRecoveryInput`（有槽位，無資料）
- `packages/engine/src/fusion.ts` — `FusionSource` 優先序（本檔 Phase 0 沿用其排序）
- `packages/engine/src/pipeline/scan-pipeline.ts` — `wearableHrvRmssdMs` 覆寫路徑（等資料）

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
