# 沒有 Mac 的資料取得路徑

> **最後更新**：2026-08-14
> **版本**：v1.0
> **狀態**：Active
> **前提**：只有 iPhone、沒有 Apple Watch、沒有 Mac、沒有 Apple Developer 帳號

---

## 1. 現在的處境

引擎層完成度很高：Edge Score（8 維度）、Focus Window、Edge DNA 相關性
（Spearman + 效果量 + 分半穩定性）全部寫好也測過。

**但一筆真實資料都沒有。** 所有統計門檻——
`MIN_ABS_RHO = 0.35`、`MIN_PAIRS_FOR_CORRELATION = 20`、`MIN_SPAN_DAYS = 14`——
都是**推理出來的，沒有被任何真實資料驗證過**。

這份文件記錄在上述限制下，資料實際上從哪裡來。

---

## 2. 三個 driver，三個來源

Edge DNA 需要三種輸入。它們的來源完全不同，而且沒有任何一個來源能同時提供全部：

| Driver | 來源 | 為什麼是這個來源 |
|--------|------|-----------------|
| **睡眠** | Apple Health 匯出檔 | iPhone 追蹤得到睡眠，相機拿不到 |
| **HRV / 心率** | 相機指尖 PPG | **iPhone 沒有心率感測器**，Health 匯出檔裡不會有 |
| **clarity 評分** | 使用者反思 | 只能自己填，沒有任何裝置量得到 |

第三個是**最稀缺的**，也是護城河最深的那一層
（`GROWTH-ARCHITECTURE.md` §3.3 Layer 3）。沒有它，前兩個只是生理趨勢。

---

## 3. 睡眠 — Apple Health 匯出

### 3.1 步驟

1. 健康 App → 右上角**大頭貼** → 滑到底 → **匯出所有健康資料**
2. 打包完存到**檔案** App（是一個 zip）
3. 在檔案 App **長按 zip → 解壓縮**
4. 手機瀏覽器開 `/preview/health-import.html`，選裡面的 `export.xml`

### 3.2 你會看到什麼

頁面直接回答「這份資料夠不夠」，並列出相關紀錄數、睡眠夜數、橫跨天數、平均睡眠。
可下載成 JSON。

**檔案完全不離開裝置** —— `apps/preview/health-import.js` 裡沒有任何一行網路呼叫，
解析全在瀏覽器完成。

### 3.3 誠實的限制

| 限制 | 說明 |
|------|------|
| **沒有 Watch 就沒有 HRV** | iPhone 沒有心率感測器。匯出檔會明確告訴你這件事，不會安靜地給零 |
| **沒在追蹤睡眠就沒有睡眠** | 睡眠只有在你用「睡眠專注模式」排程或睡眠 app 時才會寫入。空的匯出檔會**明說是空的**，不會讓你以為程式壞了 |
| **這不會驗證 Edge DNA 的相關性** | 相關性需要 clarity 配對，匯出檔裡沒有。它驗證的是睡眠夜段切分、資料密度、以及 `sleep_sensitivity` 這條路走不走得通 |

### 3.4 實作

| 檔案 | 角色 |
|------|------|
| `packages/engine/src/importers/apple-health.ts` | 解析器本體（有測試）|
| `apps/preview/health-import.{html,js}` | 手機上跑的頁面（ES5 鏡像）|
| `.../__tests__/apple-health-preview-parity.test.ts` | **防止鏡像漂移** —— 兩份實作輸出必須完全一致 |

> 為什麼逐行 regex 而不是 XML DOM parser：多年資料的 `export.xml` 可以到**數百 MB**，
> 在手機 Safari 上餵給 DOMParser 會直接把分頁記憶體吃爆。該檔的 `<Record>`
> 實務上是一行一個自閉合標籤，逐行抽取又快又能串流。

---

## 4. HRV — 相機指尖 PPG（已經能跑）

`apps/preview/camera-scan.js`（320 行）**已經實作完成**：

```
getUserMedia(後鏡頭) → 膚色覆蓋率 → 紅通道 ROI 平均
  → 3 點平滑 → 峰值偵測（40–180 BPM 帶）
  → IBI 序列 → BPM + RMSSD + 呼吸速率估計 + SQI
```

而且 `apps/preview` 已經有 `manifest.webmanifest` + `sw.js` —— **它已經是 PWA**。

**今天就能在你的 iPhone Safari 上跑，不需要 Mac、不需要 App Store、不需要花錢。**

引擎端對應模組：`packages/engine/src/biometric/finger-ppg.ts`。

---

## 5. 各平台路徑與真實成本

查證於 2026-08：

| 路徑 | 需要 Mac | 成本 | 狀態 |
|------|---------|------|------|
| **瀏覽器 PWA（相機 PPG）** | ❌ | 免費 | ✅ 已可用 |
| **Apple Health 匯出** | ❌ | 免費 | ✅ 已可用 |
| **Android Health Connect** | ❌（Gradle 在 Linux/Windows 就能編）| 免費 | 未做 |
| **Web Bluetooth（BLE 胸帶）** | ❌ | 需胸帶 | 未做，**Android Chrome only** |
| **iOS 原生上機** | ❌ 但⋯⋯ | **$99 USD/年** | 未做 |

### 5.1 iOS 的真實阻礙不是 Mac，是 $99

**EAS Build 免費層**每月提供 15 次 iOS + 15 次 Android 雲端建置，
iOS 跑在 Expo 託管的 macOS runner 上 —— 所以**編譯不需要 Mac**。

但**裝到自己手機**需要 Apple Developer Program（$99/年）：
免費 Apple ID 側載必須透過 Xcode，而 Xcode 只跑在 macOS 上。

免費層另外兩個現實限制：建置進共用佇列（尖峰時可能等數十分鐘）、
managed workflow 的 prebuild 可能撞到 45 分鐘逾時。

### 5.2 Android 是沒有 Mac 時的自然路徑

Gradle 在 Linux/Windows 都能編，完全沒有 macOS 依賴。

**Google Fit 是死路，不要走**：
2024-05-01 起**不再接受新開發者註冊**，且 API 只支援到 **2026 年底**。
Health Connect 是唯一選項 —— 它是裝置端的統一健康資料層，
會整合 Fitbit、Samsung Health 等來源。

### 5.3 Web Bluetooth 的取捨

BLE 胸帶（Polar H10 之類）給的是**真正的 RR interval**，
品質遠優於相機 PPG —— HRV 分析的黃金標準。

但 **iOS Safari 至今不支援 Web Bluetooth**（2026-04 仍是如此），
只有 Chromium 系（含 Android Chrome）支援。
iOS 上要靠第三方 Safari extension 橋接 CoreBluetooth 才行，不是可靠的產品路徑。

---

## 6. 建議順序

1. **匯入 Health 匯出檔** ← 現在就能做，一個下午看得到你有多少睡眠歷史
2. **每天用 PWA 掃描 + 填 clarity** ← 這是唯一能產生標註的方式，越早開始越好
3. 累積到 20 筆配對 / 14 天後，第一次跑相關性 —— **這時候才會知道門檻訂得對不對**
4. 需要更好的 HRV 品質時，再考慮 Android + BLE 胸帶
5. 真的要上 App Store 時，才付 $99

> 第 2 步是時間換不來的：`MIN_SPAN_DAYS = 14` 是硬的，
> 今天開始記錄，最快也要兩週後才有第一個可能成立的特質。

---

## 7. Open Questions

| # | 問題 | 狀態 |
|---|------|------|
| 1 | 匯入的睡眠 JSON 如何接回 PWA 的本地儲存？ | 待做 —— 還沒有 DAL |
| 2 | PWA 要不要加 clarity 反思輸入？ | **建議優先** —— 沒有它相關性永遠跑不起來 |
| 3 | 相機 PPG 的 RMSSD 與胸帶的差距有多大？ | 需實測；影響門檻是否需要依來源調整 |
| 4 | 若長期沒有 Watch，`hrv_coupling` 特質是否改用相機 PPG 的 RMSSD？ | 傾向是，但需標記資料來源 |

---

*— END OF DATA BOOTSTRAP v1.0 —*
