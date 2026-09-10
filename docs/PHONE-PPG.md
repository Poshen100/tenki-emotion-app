# PHONE-PPG.md — 手機相機 PPG pipeline（canonical）

> **狀態**：演算法、品質閘、合成 replay、Edge/baseline 接線**已落地並測起來**；
> **相機擷取層（VisionCamera frame processor）尚未實作**，需要實機才能寫與驗證。
> 本檔是相機 PPG 的 canonical 文件。穿戴／健康庫路線見 `docs/WEARABLE-INTEGRATION.md`。
> 對齊 CLAUDE.md：raw frame 不落地、不上雲；`packages/engine/src/biometric/ppg/`。

## 0. 一句話結論

**只有一支手機的使用者是 TENKI 最大的潛在使用者，所以相機 PPG 是一級量測鏈，不是 fallback。**
一級的意思不是「假裝它跟胸帶一樣準」，而是：**它能量到的就報，量不到的就明說沒量到**，
而且下游（Edge Score、baseline）能誠實表達「這一項沒有」。

## 1. 為什麼不能直接對紅通道平均值找峰值

指尖 PPG 的脈動只佔進到感光元件的光的 **1-3%**。剩下 97% 是 DC、曝光漂移、
呼吸擺盪、晃動 —— 每一項都比要量的東西大。所以「對原始平均值找峰值」不是
同一個答案的簡化版，是**另一個錯的答案**。

處理鏈（`packages/engine/src/biometric/ppg/`）：

| 步驟 | 檔案 | 存在的理由（它擋掉哪個錯） |
|---|---|---|
| 重取樣到均勻網格 | `filtering.ts` | 相機時戳會抖也會停。把 frame index 當時間，會得到一個「剛好在裝置吃力時錯掉」的心率。內插比例**回報出來**壓分數，不藏 |
| 零相位帶通 0.7-3.5Hz | `filtering.ts` | 前後各跑一趟抵銷相位延遲。單向濾波對每個峰的位移不同 → 直接汙染 HRV 要用的拍間期 |
| 自相關定週期 | `pulse.ts` | 給出 **periodicity**。「這裡到底有沒有脈搏」全靠它 —— 沒有它，對任何雜訊都算得出一個心率 |
| 峰值偵測 | `pulse.ts` | 不應期由**訊號本身**的週期決定；拋物線內插到次取樣（30fps 一格 33ms，跟要量的 RMSSD 同量級） |
| 偽跡剔除 | `beats.ts` | 絕對範圍擋整拍漏抓／重複，局部中位數擋「範圍內但跟不上鄰居」的晃動假峰 |
| 呼吸率 | `respiration.ts` | tachogram 重取樣 → 0.1-0.5Hz 頻帶 → 自相關＋門檻 |
| 品質評分 | `quality.ts` | 0-100 ＋ confidence ＋ **reasons**（使用者照著改得動的字） |
| 閘門編排 | `analyze.ts` | 每個指標可為 null，並記錄**為什麼**不報 |

## 2. 實際準確度（合成真值比對，不是宣稱）

用 `replay.ts` 的確定性合成器，比對**實際生成**的拍點真值：

| 指標 | 結果 |
|---|---|
| 心率 | 42-130 bpm 全部準確（無八度錯誤、無雙峰重複計數） |
| HRV RMSSD | **系統性低估 7-9%** |
| 呼吸率 | **回報的每一個值都在真值 ±0.1 內；測不到的一律 null** |

### 🔴 HRV 的低估**不加係數修正**

低估來自帶通平滑了拍間時序＋30Hz 網格量化（次取樣內插後仍有殘留）。
**不乘一個修正係數**，因為那正是本 repo 已經拆掉的 `harmonizeHrv() × 0.75` 陷阱
（`WEARABLE-INTEGRATION.md` §3）：一個沒有個人化依據的固定倍率，
會把偏差藏起來而不是修好它。個人 baseline 由同一條 pipeline 建立，
一致的偏差會被吸收；魔術常數不會。

⚠️ 因此**相機 HRV 與手錶／胸帶 HRV 不可當同一個數字比較**。
contract 上它是 `estimated`，胸帶的是 `derived`，手錶的是 `observed`。

## 3. 三個量出來的真問題（都是真值比對抓到的）

這三個都不是推論，是把數字印出來看到的。留在這裡是因為**下一個人很可能重犯**。

1. **呼吸率會跟著心率跑。** `biometric/rr.ts` 的 `estimateBrpmFromRRIntervals()`
   數的是連續拍間差的變號次數。當 jitter > RSA（光學拍點的**常態**），
   幾乎每個差分都變號，於是「呼吸次數」變成**拍數的函數**：
   同一個 14 brpm 的 fixture，50bpm 報 14.3、105bpm 報 33.8 ——
   一路上都長得像正常的生理數字。
   → 相機路徑改用 `ppg/respiration.ts`。`rr.ts` 那支保留給既有 legacy 呼叫者，
   **相機路徑不得使用**。

2. **自相關的八度錯誤。** 經 overlap 正規化後 2T 的相關性會贏過 T，
   16 brpm 報 8、20 報 10 —— 而 8 和 12 一路都對，**只在特定速率才現形**。
   → `preferFundamental()`：只往**整數約數**修正，容忍度 0.75。
   加上 split-half 一致性檢查（真的呼吸節律在前後半段都在，
   取樣不足生出來的次諧波不會）。

3. **偽跡剔除會靜靜地低報變異度。** `irregular` fixture 真值 RMSSD 262ms，
   剔掉 19% 之後 survivors 給出 **125ms** —— 不是雜訊，是一個品質分數 83、
   看起來完全生理合理、**不到真值一半**的數字。
   光學拍點分不出「真的不規則」與「偵測偽跡」，所以超過門檻的窗口
   survivors 是一個低報未知量的過濾序列，唯一誠實的輸出是**不報**。
   → `MAX_ARTIFACT_FRACTION` 0.2 → **0.1**。

## 4. 已知的物理極限（不是 bug，不要「修」）

- **呼吸率受拍點取樣限制。** tachogram 一拍取樣一次，所以**心率就是呼吸的取樣率**。
  慢脈搏配快呼吸會低於自己的 Nyquist：68bpm ＋ 20brpm ＝ 每次呼吸 3.4 拍，
  測不到。處置是**拒答**（`MIN_BEATS_PER_BREATH = 4` ＋ split-half），
  代價是連原本會對的也一起放棄 —— 這是刻意的：
  **報一半的呼吸率比不報更糟，因為下游分不出它跟真的差在哪。**
- **相機 HRV 永遠是 estimated。** 不是醫療級、不等同 ECG、不等同胸帶。

## 5. Scan modes（`biometric/scan-modes.ts`）

| Mode | 訊號源 | 最短 | 目標 | 可報 |
|---|---|---|---|---|
| `quick_check` | 相機 | 15s | 30s | 心率＋品質 |
| `full_scan` | 相機 | 45s | 90s | 心率＋HRV＋呼吸（品質允許時）|
| `precision` | 外部拍點感測器 | 60s | 120s | 同上，來自胸帶 |

🔴 **`quick_check` 不產 HRV 是結構性的**（`reports` 清單裡沒有），
不是靠品質分數擋。訊號再好也不產 —— 有測試守著這件事。

⚠️ 手錶在背景同步**不是 scan**，是被動來源（見 `WEARABLE-INTEGRATION.md`）。
`precision` 是使用者戴著胸帶**主動**量的那一次。

## 6. 隱私

- **frame 進不到這個模組。** `PpgFrame` 是擷取端已經化簡成純量的東西
  （通道平均、覆蓋率、晃動、過曝比例）。原始像素不持久化、不傳遞、
  **從這裡也拿不到** —— privacy 規則是靠輸入的**形狀**執行的，不是靠記得刪。
- raw 拍間序列 `rr_interval_ms` 屬 `LOCAL_ONLY_METRICS`，
  由它算出的 RMSSD/SDNN 是 derived，不受此限。

## 7. 合成 replay 是量具，不是資料來源

`replay.ts` 的確定性合成器 ＋ 八個 fixture（clean / motion / lowPerfusion /
clipped / irregular / frameDrops / poorCoverage / tooShort）。
**它產生的任何東西都不得成為使用者看得到的讀數。**

🔴 兩個教訓：

- **合成器回報的是「實際生成的拍點」，不是參數。** RSA 與 jitter 都會把
  實現出來的拍間期推離你要求的值；比對參數等於什麼都沒比對。
- **fixture 的參數要生理上合理。** 第一版 `CLEAN_SCAN` 是 jitter 主導
  （RSA 18ms p-p vs jitter 22ms SD），結果呼吸路徑**每個 fixture 都拒答，
  而拒答看起來像正確的謹慎**。靜息時 RSA 本來就是拍間變異的大宗。

## 8. 門檻是量出來的，不是抄來的

🔴 `MIN_PERFUSION` / `GOOD_PERFUSION` 是對著 `perfusionIndex()` **實際回傳值**
校準的，不是教科書上的 1-3% 灌流指數。這裡的量測是對帶通後訊號取 RMS，
而脈波形是窄尖峰，所以健康的合成指尖讀 **0.0062**、半灌流 0.0032、
幾乎沒灌流 0.00096。照教科書設門檻會把**每一次好掃描都標成 `weak_pulse`**
—— 本檔第一版就是這樣，是把 fixture 的數字印出來才發現的。
（PLAYBOOK §3「守門員自己也有模型」的同一族。）

**改 `perfusionIndex` 就要把這兩個數字重新量一次。**

## 9. 還缺什麼（需要實機）

| 缺口 | 為什麼 |
|---|---|
| VisionCamera frame processor → `PpgFrame` | 需要實機：ROI 取樣、閃光燈控制、曝光鎖定、每幀成本 |
| 掃描 UI（引導、品質即時回饋、reasons 顯示）| 見 `docs/SOUL-SCAN-NORTH-STAR.md`；**不要把手指流程塞進 `(tabs)/scan.tsx`** |
| 實機準確度 | 合成真值不能代替真手指。第一次實走要抽驗 perfusion／periodicity 的實際分布，門檻很可能要重校 |
| 效能／發熱 | 逐幀處理不得進 React state、不得每幀 rerender（brief §34）|

⚠️ **合成測試全綠不等於在真手指上可用。** 這條 pipeline 目前的證據
全部來自 `replay.ts`；實機是另一個驗證，不是同一個。
