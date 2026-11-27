# P0 開發規格 —— 5 秒能力測試＋相容清單（P0-A）／量到・算出・推論標籤（P0-B）

> founder 2026-11-24 啟動。起點：`main` @ `18ba771`（PR #318）。
> 兩項**一起設計、分開驗收**。本檔是規格，不是實作；§6 的 Todo 一條一個 commit。
>
> 🔴 **這一輪不解鎖任何生理功能。** 脈搏節律仍然不進主畫面（沒有任何一支手機做完 #27），
> 本輪做完之後這件事也不會改變。順序是：先確認裝置能不能可靠取得訊號 → 再顯示數據的證據等級 →
> 最後才考慮把驗證過的指標放進正式產品。

---

## 0. 動工前查到的兩件事（會改變設計）

1. **臉部入口目前不量脈搏。** `/v3/` 的 Soul Scan（`readiness-scan.js`）量的是取景、光線、
   均勻度、穩定度、眨眼（`domain/src/contracts/readiness-reading.ts` 的 evidence 欄位），**沒有 rPPG**。
   引擎裡 `fusion.ts` 有 `rppg_*` 來源名稱，但沒有任何擷取層餵它。
   → 相容清單裡「臉部 rPPG」那一欄現在的誠實答案是 **「未實作」**，不是「支援／不支援」。
   把它填成任何能力值，都是在宣稱一條不存在的訊號鏈。
2. **「算出」和既有契約是兩條軸，不是同一件事。**
   `domain/src/contracts/wearable-sample.ts` 的 `SampleDerivation`（`observed`／`derived`／`estimated`）
   回答的是「**拍點時間有沒有保證**」—— 相機產出的一切都是 `estimated`。
   founder 的表把相機 PRV RMSSD 放在「算出」，回答的是「**處理到哪一步**」。
   兩者都對、而且都要跟著數字走：相機 PRV 是「算出」**而且**「拍點時間不保證」。
   如果只留一條軸，「算出」兩個字會讓一個未驗證的相機數字看起來跟胸帶算出的一樣可信 ——
   那正是 founder 說的「不能因為加了算出標籤就取得主畫面資格」。

---

## 1. P0-A｜5 秒機型能力測試＋相容清單

### 1.1 它回答什麼、不回答什麼

| 回答 | 不回答 |
|---|---|
| 這支手機的**訊號路徑**通不通：相機開得起來、幀時間穩不穩、有沒有過曝、光裡有沒有脈動成分 | 脈搏讀數準不準（那是 #27 胸帶對照）|
| 為什麼不通：是哪一個環節 | 這個**型號**能不能用（一台的結果不代表同型號）|

⚠️ **5 秒只夠確認路徑，不夠確認節律。** 5 秒大約 5 拍；節律估計（自相關）在 `live.ts` 需要
`MIN_LIVE_WINDOW_SEC = 15` 秒。所以能力測試**不得**輸出心率、節律、或任何生理數字。

### 1.2 結果只有三種

| 結果 | 什麼時候 | 文案方向 |
|---|---|---|
| `signal_path_ok` | 下列四項都通過 | 「這支手機取得到指尖的脈動訊號，可以開始量測」 |
| `not_yet_confirmed` | 任何一項在 5 秒內沒過，**而且原因不是硬體事實** | 「還無法確認 —— 原因：＿＿。可以＿＿再試」 |
| `hardware_limit` | 只限**確定的硬體事實**：沒有相機、權限被拒、持續幀率低於下限 | 「這支手機的＿＿目前做不到＿＿」—— 仍然不說「不相容」 |

🔴 founder 規則：5 秒內沒建立可靠訊號 → **「尚無法確認」，不是「不相容」**。
`hardware_limit` 只給「量得到、而且換姿勢改不了」的事實（CLAUDE.md：不對使用者改不了的事給調整指引）。

### 1.3 四項檢查（全部重用既有量測，不新寫演算法）

| # | 檢查 | 用什麼 | 門檻來源 |
|---|---|---|---|
| 1 | 相機與補光燈 | `getUserMedia` 成功、`track.getCapabilities().torch` | 沒補光燈是 **advisory 不是拒收**（founder 2026-09-11；iOS Safari 全部沒有）|
| 2 | 實際幀時間 | `exposure-stability.ts` 的 `framesPerSecond`、`longestGapMs` | 幀率下限與最長間隔要**新訂**，見 §5 待決 |
| 3 | 曝光／飽和 | `isOverExposed(clippedFraction)`（`capture-readiness.ts`）、紅通道 DC | `MAX_CLIPPING = 0.05`（`quality.ts`）|
| 4 | 光裡有沒有脈動 | 帶內 AC/DC（灌流）| `MIN_PERFUSION = 0.0015`（`quality.ts`）|

⚠️ 第 4 項只能說「光裡有脈動成分」。它**不是**「脈搏清楚」—— CLAUDE.md 已經記過：
階梯式曝光擾動會讓帶內 AC/DC **上升**。所以第 4 項過了但第 3 項顯示亮度在跳，結果是 `not_yet_confirmed`。

### 1.4 相容清單 —— 兩層，分開記

**第一層：這台裝置自己的紀錄**（本機，跟 #27 同一個原則：只代表這台手機）

```
tenki.device.capability.v1 = {
  finger: { result, reasons[], testedAt, torch: true|false|null, fps, longestGapMs, clipped, perfusionOk },
  face:   { result, reasons[], testedAt, fps, faceDetected, lighting },
  facePulse: 'not_implemented'      // 🔴 常數，直到臉部 rPPG 擷取層存在
}
```
只有推導值，沒有幀、沒有波形。不上傳。

**第二層：repo 裡的人工整理清單**（`docs/DEVICE-COMPATIBILITY.md`，只收 founder 與測試者**自己貼回來**的報告）

| 欄位 | 為什麼分開 |
|---|---|
| 指尖 PPG 訊號路徑 | 能力測試的結果 |
| 指尖 PPG #27 胸帶對照 | 準不準，另一件事 |
| 臉部入口（取景／穩定度） | 臉部掃描真正在量的東西 |
| 臉部 rPPG | **未實作** |

⚠️ **瀏覽器分不出手機型號。** iOS Safari 的 UA 只說「iPhone」；Android 的 UA 有時帶型號、有時被精簡。
所以清單的型號欄由**回報的人自己填**，能力測試只記它量得到的東西（幀率、補光燈有無）。
🔴 不做雲端群眾清單：那要上傳裝置資訊，需要 opt-in 流程（`docs/PRIVACY_ARCHITECTURE.md`）—— 那是之後的決定，不在 P0。

### 1.5 P0-A 驗收（獨立於 P0-B）

1. 合成的乾淨指尖訊號 5 秒 → `signal_path_ok`；低灌流 → `not_yet_confirmed`，原因是灌流；
   過曝 → `not_yet_confirmed`，原因是過曝；**沒有任何一種合成訊號得到「不相容」**。
2. 沒補光燈 → 結果不變，只多一條 advisory。
3. 能力測試的畫面上**沒有任何生理數字**（harness 掃 bpm／ms）。
4. `facePulse` 永遠是 `not_implemented`；畫面上臉部那一列不出現「支援脈搏」。
5. 本機紀錄只有 §1.4 列出的欄位（harness 驗 key 集合）。
6. 實機：founder 在自己的手機上跑一次，把結果貼回來，成為 `DEVICE-COMPATIBILITY.md` 第一列。

---

## 2. P0-B｜量到／算出／推論標籤

### 2.1 標籤不是一個字，是四個欄位

```ts
interface EvidenceLabel {
  layer: 'measured' | 'calculated' | 'inferred';   // 量到／算出／推論：處理到哪一步
  source: string;                                   // 「手機相機・指尖」「胸帶」「臉部取景」…
  beatTiming?: SampleDerivation;                    // 有拍點時才有：observed／derived／estimated
  quality: 'passed' | 'limited' | 'withheld';       // 該次擷取的品質狀態
  validation: 'none' | 'this_device_preliminary';   // 有沒有經過對照（#27）
}
```

🔴 **主畫面資格只看 `validation`（加上該次品質），永遠不看 `layer`。**
`layer` 是在說「這個數字是怎麼來的」，不是在說「這個數字可以信」。

### 2.2 現在畫面上每一個數字的標籤（盤點，實作時逐一對上）

| 數字 | 頁面 | layer | source | beatTiming | validation |
|---|---|---|---|---|---|
| 取景／光線／穩定度、帶位 | `/v3/` 臉部掃描 | 量到（取景等）／**推論**（帶位）| 臉部取景 | — | none |
| 脈搏 bpm | `/finger/` | 算出 | 手機相機・指尖 | estimated | none |
| 脈搏節律（ms）證據層 | `/finger/` | 算出 | 手機相機・指尖 | estimated | none |
| 脈搏節律（ms）頭條卡 | `/finger/` | 算出 | 手機相機・指尖 | estimated | **this_device_preliminary**（否則根本不出現）|
| 品質分數 | `/finger/` | 算出（六個分量的合成，§25 已攤開）| 擷取本身 | — | — |
| 偏移、Twin、校準證明、例行計數 | `/drift/` | 推論 | 你的紀錄 | — | none |
| Edge Score | — | **推論** | — | — | 只在有真 HRV 時出現 |

⚠️ 帶位是**推論**，不是量到 —— 它是從取景、穩定度等量到的東西推出來的狀態。
⚠️ 自評（P1）會是第四種來源「你填的」。它**不得**放進這三層的任何一層冒充 —— 見 §5 待決。

### 2.3 規則

1. 每一個顯示的數字都要有標籤，**四個欄位都要能看到**（點開看也可以，但要看得到）。
2. 標籤文案只有一個產生點（照 `intelligence/copy.ts` 的做法），並逐字串過 `isCompliantCopy()`。
3. 「算出」旁邊**一定**跟著來源；來源是相機時一定跟著「拍點時間不保證」的白話版。
4. 不得出現「醫療級」「精準」「驗證過的 HRV」這類字。`this_device_preliminary` 的白話一律是
   「這台手機做過初步的胸帶對照」（跟 #27 現有文案同一句）。

### 2.4 P0-B 驗收（獨立於 P0-A）

1. §2.2 表上的每一個數字在畫面上都有標籤（harness 逐一點名，少一個就紅）。
2. 🔴 反向驗證：把某個數字的 `layer` 改成 `calculated`，它**不會**因此出現在頭條卡（頭條資格只吃 `validation`）。
3. 相機來源的「算出」都帶著拍點不保證的說明。
4. 所有標籤文案過 `isCompliantCopy()`。

---

## 3. 兩項的關係

P0-A 決定「這支手機能不能開始量」，P0-B 決定「量出來的東西怎麼標」。
共用的只有 `source` 欄位的詞彙。分開驗收：P0-A 不需要 P0-B 做完才能合併，反之亦然。

## 4. 不在這一輪

- 臉部 rPPG 擷取層（要另開規格；它在相容清單裡只會是「未實作」）。
- 雲端群眾相容清單（要先有 opt-in）。
- 任何讓脈搏節律更容易上主畫面的改動。
- P1 自評、R3 真實前後配對、P2 擴大驗證。

## 5. 待 founder 決定（實作前）

> ✅ **2026-11-27 founder：三項都同意**（照下面的建議實作）。第 1 項是理論值，實機回報進來後再定案。
> 實作時多發現一件事，記在這裡：**脈動光不能只看灌流** —— 合成雜訊的綠通道灌流 0.0016–0.0020 就過
> `MIN_PERFUSION`（綠的 DC 約只有紅的一半），乾淨訊號的綠通道也才 0.0024，沒有鑑別力。
> 所以第 4 項改成跟正式擷取同一套：先用節律選通道，再要求**同一通道**過灌流與 Pulse Lock 門檻（`capability-test.ts` 檔頭）。
> 另外補了第 5 項「晃動」（沿用 `MAX_MOTION`）：晃動的合成訊號在綠通道可以撐出 0.68 的節律。

1. **幀率下限**：建議**持續 ≥ 20 fps、最長間隔 ≤ 200 ms** 才算過第 2 項（理由：帶通到 3.5 Hz 需要約 2 倍取樣，
   30 fps 是目標；20 留餘裕）。⚠️ 這兩個數字目前沒有實機分布支撐 —— 照 CLAUDE.md「只用理論值訂門檻」那條，
   先用它跑 founder 的手機，看實測值落在哪再定。
2. **能力測試放哪**：建議放在 `/finger/` 就位畫面之前（第一次用時自動跑、之後可以手動重跑），
   **不擋**後面的量測 —— 測試結果是 `not_yet_confirmed` 時仍然讓人試完整量測。
3. **自評在標籤系統裡叫什麼**：建議第四種來源「你填的」（對應既有 provenance `reported`），
   不放進量到／算出／推論任何一層。

## 6. Todo（一條一個 commit）

**P0-A**
1. `feat(engine)`：`ppg/capability-test.ts` —— 5 秒判定（三種結果＋原因），重用既有量測；單元測試含 §1.5 第 1、2 條
2. `feat(preview)`：`/finger/` 能力測試畫面＋本機紀錄 `tenki.device.capability.v1`；harness §1.5 第 3–5 條
3. `docs`：`docs/DEVICE-COMPATIBILITY.md` 空表＋回報格式（第一列等 founder 實機）

**P0-B**
4. `feat(domain)`：`EvidenceLabel` 契約＋白話產生器（單一產生點、compliance 測試）
   ⚠️ 實作放在 `packages/engine/src/compliance/evidence-label.ts`，不在 domain：engine 不 import domain（PLAYBOOK §7），preview 的 bundle 從 engine 建 —— 放 domain 就要兩份。`beatTiming` 照 `PULSE_ANCHOR_DERIVATION` 的先例鏡射 domain 的 `SampleDerivation`。
5. `feat(preview)`：`/finger/` 每個數字掛標籤；harness §2.4 第 1、3 條＋反向驗證第 2 條
6. `feat(preview)`：`/v3/` 臉部讀數與 `/drift/` 推論卡掛標籤
