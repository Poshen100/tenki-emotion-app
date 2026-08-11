# Edge Score — 定義（founder 2026-08-11 拍板）

> 📌 **Edge Score 是「相對你自己基線的位置」，1-99，50 = 你的常態。**
> 不是絕對分數、不是健康量測、不是跟別人比。
> 實作：`domain/src/policies/baseline-score.ts` · 測試：`domain/src/__tests__/baseline-score.test.ts`
> ✅ `PR99` 已於 2026-08-11 **內部解禁**：code 註解／docs／commit message 都可以用，
> **但不得進 user-facing copy**（由 `packages/engine/src/compliance/safe-copy.ts` 執行）。
> 血統與理由見 §7。

---

## 1. 定義

```
composite = 只有「人」的訊號（stillness + blinkCadence）
z         = (今天的 composite − 你的均值) / 你的標準差
Edge Score = clamp(round(100 × Φ(z)), 1, 99)
```

| z | Edge Score | 白話 |
|---|---|---|
| 0 | **50** | 完全是你的常態 |
| +1 | 84 | 高於你 84% 的日子 |
| −1 | 16 | 只高於你 16% 的日子 |
| ±2.33 | 99 / 1 | 比你 99% 的日子更極端 |

---

## 2. 為什麼是 1-99 而不是 0-100

founder 的直覺是「0 或 100 看起來怪」。真正的理由更硬：

🔴 **用經驗排名算百分位時，端點不是罕見，是必然。** 你史上最好的那天**就是**最大值。
每創一次新紀錄就頂到天花板 —— n 天歷史裡有 2/n 的讀數壓在端點上（n=30 時約 7%）。

換成 z 分數 → 常態 CDF 之後，1-99 是**從數學掉出來的**：Φ(±2.33) 正好是 1% 與 99%，
所以顯示範圍與 `Z_CLAMP` 是同一句話的兩種寫法。

⚠️ **但保證的來源要講清楚**：數學上 Φ 是開區間，**浮點數上不是** ——
|z| 大到約 38 之後 `exp(-x²)` 在 float64 underflow，`normalCdf` 會回傳正好 0 或 1。
所以「不會出現 0 或 100」靠的是 **`Z_CLAMP` 先把 z 夾住**，不是曲線本身。
（這是寫測試時當場抓到的，原本的註解寫錯了。）

🔴 **最大的收穫其實不是端點，是 50 有了意義。** 絕對分 0-100 裡，50 什麼都不代表；
這個尺度裡，50 = 完全是你的常態，而那正是產品要講的第一句話。

---

## 3. 三條紅線

### 3.1 排名的對象**不准包含環境**

舊的 composite 是 `stillness*0.5 + blinkCadence*0.3 + quality*0.2`，
而 `quality = lighting*0.6 + uniformity*0.4` —— **那是房間，不是你**。
拿它排名等於「房間暗一點你的分數就低」。

環境只能決定 **confidence**（`resolveConfidence()` 已經在做），不能決定分數。

### 3.2 「絕對分」與「位置分」的門檻**不可混用**

| 尺度 | 門檻 | 在哪 |
|---|---|---|
| 絕對 composite (0..1) | `CLEAR_AT 0.7` / `NEUTRAL_AT 0.45` | `readiness-band.ts`（冷啟動路徑） |
| 位置分 (1..99) | `SCORE_CLEAR_AT 80` / `SCORE_NEUTRAL_AT 20` | `baseline-score.ts` |

🔴 **為什麼位置分的門檻必須是 80/20**：位置分對使用者自己是均勻分布的，
所以刻度佔多少比例，日子就佔多少比例。沿用舊的 70/40 → `0-39` 佔 40% 的刻度
→ **使用者永遠有 40% 的日子落在最低帶，不管他過得多好。**
那既是壞產品，也是合規風險。

80/20 → 高兩成、典型六成、低兩成。**門檻在這個模型下決定的是「多常講一次」，
不是生理事實。**

⚠️ `packages/shared/src/zone-config.ts` 的 70/40 是**絕對分**的門檻，
目前只有它自己的測試在用。等 UI 接上位置分之後應一併退役。

### 3.3 樣本不足就閉嘴

`MIN_SAMPLES_FOR_SCORE = 14`，**刻意高於引擎的 `ready`（5 次）**：
n=5 的標準差極不穩定，分數會為了跟使用者無關的理由亂跳。

未達 → 回 `null`，**不是回一個看起來像真的的數字**。
`std === 0` 也回 `null`（z 會是 ±∞，而且那代表「離散度還不是真的」）。

---

## 4. 兩段式：冷啟動與成熟期

| 階段 | 有分數嗎 | 帶位從哪來 |
|---|---|---|
| 沒有基線（第 1–13 次） | ❌ `null` | `deriveBand()` 的**絕對** composite（照舊） |
| 基線成熟（≥14 次） | ✅ 1-99 | `scoreBand()` 的**位置**門檻 80/20 |

使用者在基線成熟那一刻會看到帶位判準改變 —— 這是可解釋的（「現在是跟你自己比」），
而且正是 `docs/PRICING-STRATEGY.md` §3 說的價值里程碑。

---

## 5. 已知限制（誠實記錄）

- **常態假設**：composite 是有界的（0..1）且可能偏斜，z 分數在尾部是近似值。
  對 1-99 的顯示夠用，但**不要拿它當精確的機率宣稱**。
  真實使用者資料跑一陣子之後，可以改成經驗排名（Weibull `i/(n+1)`），
  介面不必改 —— 但那需要存時間序列，目前全 repo 沒有任何地方在存。
- **自相關**：連續幾天的狀態是相關的，百分位假設樣本獨立。
  顯示無妨，但**若之後要做預測就必須處理**。
- 🔴 **再現性尚未量到數字，但已經有量測工具**：`/preview/reliability.html`
  （`apps/preview/reliability.js`）。連掃 3 次、中間刻意放開 15 秒讓每次是獨立取像，
  比較**同場離散度**與**跨天離散度**。
  **需要跨天顯著大於同場，這個 z 模型才有意義** —— 否則分子分母量到的都是儀器噪音，
  分數看起來很權威，實際上是隨機的。
  ⚠️ 背靠背連掃會共用姿勢與光線，離散度會**低估**真實噪音（讓儀器看起來比實際可靠），
  所以「放開再重新取像」是方法學要求，不是禮貌。
  ⚠️ 這也會給 `MIN_SAMPLES_FOR_SCORE = 14` 實證依據 —— 目前那個 14 是估的，不是量的。
- **非平穩**：引擎的 `MAX_SAMPLE_COUNT 100` + `DECAY_FACTOR 0.95` 本身就是
  一個軟性滾動窗口，所以「拿今天跟一個已經不存在的你比」大致被擋住了。
  ⚠️ 副作用：如果使用者**穩定進步**，他會一直落在自己近況的 ~50 ——
  「基線本身在移動」這件事要另外用趨勢講（PRO 功能）。
- **方向**：z 有正負號，所以這個模型**確實**帶得出 Above / Below Baseline，
  而 `docs/brand.md` §7 說「引擎抓不到方向」正是卡住那個遷移的原因。
  ⚠️ 但「高穩定度」對應到 brand.md 的 Above 還是 Below，是另一個**尚未拍板**的問題
  —— 不得自行決定。

---

## 6. 尚未做的事

- 接 UI、接掃描流程
- **持久化**：z 分數不需要時間序列，但那四個數字（mean/std/sampleCount/lastUpdatedAt）
  今天也還沒被存下來（`faceBaselineStore` 沒有 persist、preview 沒有 baseline profile）
- `apps/mobile/features/face-baseline/utils/dailyScan.ts` 的 `deriveDailyEdgeScore`：
  fallback 是 `Math.sin(day)` 的假分數，真路徑把 **confidence 當成分數**（範疇錯誤）。
  兩個都要換掉，但它連著 UI，另案處理。

---

## 7. 血統：這不是新發明，是把 v3 走錯的一步走回來

🔴 **v2 的 `PR99` 本來就是「跟自己歷史比的 1-99 百分位」。**
`packages/engine/src/common/legacy-tei-adapter.ts:20` 白紙黑字：

> Legacy PR99 **was a percentile rank against personal history**.
> Edge Score is a weighted multi-factor score. **They measure different things.**

v3 遷移把它換成 0-100 的**絕對加權分** —— 而那個絕對分，這條管線根本產不出來
（`apps/preview/readiness-scan.js:9-10` 契約明寫「永遠不生成 0-100 分」）。
所以 2026-08-11 這一刀不是新發明，是**修正 v3 的那一步**。

⚠️ **當初該退役的是「趕快加倉」那套交易話術，不是統計模型。**
查證過的禁用理由（`CLAUDE.md`、`ANTIGRAVITY.md:1126`、`BRAND.md:93`、
`brand/TAGLINE-SYSTEM.md:113`）**沒有任何一條說那個數學是錯的** ——
全部是品牌與定位的遷移衛生。

### v2 版有兩個毛病，新版剛好都避開了

`packages/engine/src/legacy/tei.ts:43` 的 `calculateTeiPr()`：

| v2 | 新版 |
|---|---|
| 沒有歷史時 **`return 50`**（一個看起來像真的的假數字） | `null`，直到 n ≥ 14 |
| `countBelow/n` 再硬夾 1-99 → **端點必然被撞到**（史上最好那天就是最大值） | `Φ(z)` + `Z_CLAMP`，1/99 各自代表「比 99% 的日子更極端」 |

⚠️ v2 用的是**經驗排名**（需要保留歷史陣列），新版用 **z 分數**（只需要
`{mean, std, n}`）。兩者都合理；選 z 是因為 Welford 的統計已經存在、
而全 repo 目前沒有任何地方在存時間序列（見 §5）。

### 詞彙規則（founder 2026-08-11 拍板）

| 場合 | `PR99` |
|---|---|
| code 註解、docs、commit message、內部討論 | ✅ 可用 |
| **user-facing copy** | 🔴 禁用，由 compliance 層擋 |

🔴 理由不是儀式：**台灣語境裡「PR 值」壓倒性地指基測／學測 —— 跟別人比的排名。**
而 Edge Score 的核心承諾恰好相反：跟你自己比。對目標使用者而言這個詞會主動誤導。

⚠️ `TEI` **未解禁**（它連著整套 v2 架構詞彙），`scripts/check-vocab.sh` 仍然擋它。

---

*最後更新：2026-08-11 · Claude Code（founder 拍板 1-99、並內部解禁 PR99 當天）*
