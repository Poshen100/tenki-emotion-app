# WEARABLE-INTEGRATION.md — 穿戴資料整合路線（canonical）

> **狀態**：Phase 0（資料契約）**已落地**；Phase 1 以後**尚未實作**。
> 本檔是穿戴／健康資料整合的 canonical 文件。Garmin 專屬的 Body Battery 路線見
> `docs/garmin-integration.md`（本檔的 Phase 4 = 該檔的 Phase 0/2/3，兩者不衝突）。
> ⚠️ **手機相機 PPG 不在本檔範圍**，它是獨立的一級量測鏈 —— 見 `docs/PHONE-PPG.md`。
> 穿戴是**補強層**，不是前置條件：沒有任何穿戴裝置的使用者必須能走完整個核心循環。
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

四條結構性規則（改動前先讀完本節）：

1. **SDNN ≠ RMSSD。** Apple 健康的 HRV 是 SDNN、Health Connect 定義的 HRV 型別是 RMSSD。
   兩者都可以參與 Edge Score，但**必須各自對自己的個人基線正規化**，永遠不共用欄位。
2. **每個 sample 自帶 provenance / quality / confidence / observedAt。**
   沒有來源的裸數字事後無法仲裁，也無法在 UI 誠實顯示「Apple Watch · 12 分鐘前」。
3. **`rr_interval_ms` 是 raw 搏間序列 → 留在裝置**（`LOCAL_ONLY_METRICS`）。
   由它算出的 RMSSD / SDNN 屬 derived，不受此限。使用者同意能放寬「讀什麼」，
   **不能放寬「什麼可以離開裝置」**。
   ⚠️ 這條現在是 **runtime 檢查**不是慣例：`adapters/bleHrv.ts` 用
   `mayLeaveDevice()` 把它變成會丟例外的守門，手滑加一行會當場炸。
4. **每個 sample 帶 `derivation`：`observed` / `derived` / `estimated`**（2026-09-10 加）。
   來源平台記得住「從哪個牌子來」，記不住「這個數字是怎麼來的」——
   而那三件事能宣稱的話完全不同：

   | derivation | 意思 | 例 |
   |---|---|---|
   | `observed` | 平台自己量到並回報這個 metric | Apple 健康的 SDNN、胸帶的心率 |
   | `derived` | TENKI 從來源真的量到的高解析序列算出來的 | 由胸帶 RR 算的 RMSSD、由睡眠 session 算的時數 |
   | `estimated` | 從拍點時序沒有保證的間接訊號推估 | **相機產生的任何東西** |

   **不是 quality 的同義詞**：高品質的相機估計仍然是估計，低品質的胸帶讀數
   仍然是由真 RR 算出來的。validator 擋掉沒有標記與不在名單內的值。

   ⚠️ **標記了不代表有人在讀。** `derivation` 與 freshness 一開始零消費者 ——
   契約分得出來，但沒有任何一層據此改變行為。現在由
   `domain/src/policies/reading-claim.ts` 消費（2026-09-10）：

   - `buildReadingClaim()` → 這筆讀數**能被講成什麼**（qualifier ＋ tense）。
     刻意回**結構**不回句子：文案分語言分 surface，字串產生器在這裡只會
     被繞過或變成第二套文案系統。
   - `mayClaimAsCurrent()` → stale 一律 false。
   - `validateReadingCopy()` → 兩條：stale 不得講成「現在」、
     estimated 不得不加限定詞。
   - 🔴 **否定豁免是刻意的**：`「這不是你現在的讀數」` 必須放行。
     本 repo 已被鏡像版本咬過一次（substring 比對 `predict` 擋掉了
     「this is not a prediction」，MEMORY 2026-09-09）。
     擋不住否認的檢查器會把文案逼向更含糊，正好與目的相反。

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

## 4c. Android 原生層（已寫，2026-09-08，**尚未在真裝置上跑過**）

| 檔案 | 職責 |
|---|---|
| `adapters/healthConnectPort.ts` | Health Connect 的 `DeviceLinkPort` 實作 |
| `adapters/healthConnectNormalize.ts` | 套件的真實形狀 → mapper 吃的扁平記錄（純函式，有測試）|
| `adapters/bleChestStrapPort.ts` | 公版 Heart Rate Service（`0x180D`）的胸帶連線 |
| `adapters/bleChestStrap.ts` | base64 解碼 + 掃描權限（純函式，有測試）|
| `adapters/composeLinkPorts.ts` | 一個畫面一個 port，但每列路由到自己的 adapter（純函式，有測試）|
| `adapters/selectLinkPort.ts` | 平台選擇；iOS 仍是 unwired port |
| `apps/mobile/eas.json` + `.github/workflows/android-dev-build.yml` | 手機可觸發的 APK build |

**畫面、狀態機、store、三支 mapper 一行都沒改** —— 這就是先把 `DeviceLinkPort`
定出來的用途。

### 寫的時候才發現的形狀差異（猜錯都不會 crash，只會靜靜壞掉）

1. Health Connect 的時間是 **ISO 字串**，不是 Unix ms。
2. **`HeartRate` 是一整包 samples**，不是單一讀數 —— 攤平錯了，四十拍變一拍。
3. energy 已預先換算成 `{inKilocalories, …}`，不是 `{unit, value}`。
4. ble-plx 的 characteristic 值是 **base64 字串**，不是 bytes。
5. **Android 12 起掃描要 `BLUETOOTH_SCAN`/`CONNECT`，12 之前要 `ACCESS_FINE_LOCATION`**
   —— 要錯的症狀是「永遠找不到胸帶」，不是權限錯誤。

### 兩條刻意的克制

- `disconnect()` **不呼叫 `revokeAllPermissions()`**：套件文件寫明撤銷要等 app
  process 重啟才生效，拿它做 in-app 開關會變成「畫面說已中斷、其實還在讀」。
  改成清掉自己的狀態並開啟 Health Connect 設定。
- 一個 scope 要**全部** record type 都授權才算拿到（半個 bucket 不是 bucket）。

### 動這些檔案時的鐵律

原生套件一律 `await import()` **動態載入，絕不 top-level import**，而且測試碰得到的
模組**不 import react-native**（PLAYBOOK §7 兩條）。驗證方式：改完跑
`npx expo export --platform web`，web bundle 要照樣成功、`/devices` 渲染零 console error。

## 4d. 第一次真機實走（Android，零費用路線）

**founder 端（手機上，約 15 分鐘）**

1. 借到的 Android 手機：設定 → 關於手機 → 確認 **Android 版本**（14+ 內建 Health
   Connect；13 以下到 Play 商店裝）。
2. 設定 → 應用程式 → 特殊存取權 → **安裝不明應用程式** → 允許 Chrome。
3. `expo.dev` 註冊（免費）→ 帳號設定產生 **Access Token**。
4. GitHub → repo → Settings → Secrets and variables → Actions → New secret，
   名稱 **`EXPO_TOKEN`**，值貼上。

**出 APK（手機上）**

GitHub → Actions → **Android dev build (EAS)** → Run workflow → 等約 15 分鐘 →
到 expo.dev 的 Builds 下載安裝。

**要驗的四件事**

| # | 動作 | 通過的樣子 |
|---|---|---|
| 1 | Lab → Devices | 「Health Connect」那列的按鈕變成**可按的「連接」**（不再是「尚未開放連接」）|
| 2 | 點連接 | 跳出**真的 Health Connect 權限視窗**，逐項可勾 |
| 3 | 只勾一部分 | 回到頁面仍是「已連接」，chip 只列出**實際拿到的** scope |
| 4 | 點「心率胸帶」連接 | 跳藍牙權限 → 掃描 → 找到胸帶就連上；沒有胸帶會顯示「找不到心率胸帶」（正確行為）|

**沒有手錶／胸帶也能驗**：Health Connect Toolbox（Google 的開發者工具，可塞測試資料）
與 BLE Peripheral Simulator（讓另一支 Android 假裝成心率裝置）。⚠️ 名稱憑記憶，
到商店確認；找不到就回報。

**第一次連上時務必抽驗**：三支 mapper 都沒見過真資料。看實際的單位字串／record 形狀
有沒有落在 accepted 清單裡 —— 不在就會被拒收（設計行為），補進表即可。

## 4e. RR interval → HRV（已完成，2026-09-10）

解析器原本停在 RR 陣列：單位、offset、contact bit 都解對了，但**沒有任何一行
把它變成 HRV**。「BLE 是否可以使用 RR interval 計算 HRV」在此之前的答案其實是 NO。

| 檔案 | 職責 |
|---|---|
| `packages/engine/src/biometric/beat-series.ts` | 偽跡剔除 → RMSSD ＋ SDNN ＋ 拍數 ＋ 偽跡比例；證據不足一律 null 並說明理由（`no_rr_intervals` / `too_few_beats` / `too_many_artifacts` / `poor_sensor_contact`）。`extendBeatWindow()` 攢窗口（胸帶一秒才推一兩拍）|

刻意與相機路徑**共用** `ppg/beats.ts` 的剔除與統計：兩條路徑對
「什麼叫可信的拍間序列」用同一把尺，差別只在 `derivation`。

已定案的行為（有測試守著）：

- **接觸不良（`poor`）的窗口不產 HRV** —— 那些拍間期描述的是電極接觸，不是使用者。
- **`not_supported` 不等於 `poor`**：很多胸帶根本回報不了接觸狀態，
  那是缺資訊，不是壞讀數。不擋，但扣 confidence。
- SDNN 與 RMSSD 各自成筆，永不互換。

## 5. Phase 1–4 —— 還缺什麼

| Phase | 內容 | 為什麼還沒做 |
|---|---|---|
| 1 | iOS HealthKit 橋接（實作 `DeviceLinkPort`）、30 天基線首次同步 | 需要 Apple Developer 帳號才能把 dev build 裝進 iPhone（見下節）|
| 2 | Android Health Connect | **程式已寫（§4c），等真機實走（§4d）** |
| 3 | BLE Precision Link：只支援標準 Heart Rate Service | **連線、解析、RR→HRV 已寫（§4c、§4e），等真機實走**。⚠️ 沒有 RR interval 的裝置只能提升心率品質，**不得宣稱量到胸帶 HRV** —— 現已由 `bleHrv.ts` 結構性擋住，不是靠記得 |
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

### 現況（2026-09-08 查核）

- **Android**：Health Connect 與 BLE 胸帶的原生層已寫（§4c），相依套件已裝，
  但**沒有任何一行在真裝置上跑過**。第一次實走照 §4d。
- **iOS**：完全沒有 HealthKit 實作，連接頁上每一列都會顯示「尚未開放連接」——
  設計行為，不是 bug。
- 尚未 prebuild（沒有 `ios/` 或 `android/` 資料夾）—— EAS build 時才產生。

既有的其他槽位：

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
