# Edge DNA — 長期認知模式分析架構

> **最後更新**：2026-08-14
> **版本**：v1.0
> **狀態**：Active
> **原則**：一個模式要先在你自己的兩半歷史裡都成立，才配叫做「你的樣子」。

---

## 1. 現況盤點 — 先讀這節

**Edge DNA 不是新引擎。** 它是既有 AI Coach P2 / P3 的**使用者可見名稱**。

| 需求（brief） | 已經存在？ | 位置 |
|--------------|-----------|------|
| focus window timing | ✅ **已完整實作** | `packages/engine/src/analytics/focus-window.ts` |
| HRV / stress / sleep 相關性 | ⚠️ 已在路線圖（Coach **P2**，門檻 30 筆標註） | `GROWTH-ARCHITECTURE.md` §6.2 |
| 個人模型 / profile | ⚠️ 已在路線圖（Coach **P3**，門檻 90 筆） | 同上 |
| Personal Edge Graph | ✅ 已是 tier 欄位 | `subscription-tiers.ts` `edgeGraph` |
| 決策標註資料集 | ✅ 已有 | `shared/growth/decision-performance-record.ts` |
| ANS balance | ✅ 已有推導 | `packages/engine/src/biometric/ans-balance.ts` |
| 合規詞彙引擎 | ✅ 已有 | `packages/engine/src/compliance/safe-copy.ts` |

**所以這次真正新增的只有兩件事**：相關性計算（§3）與特質推導（§4）。

> 如果在這裡再寫一套相關性分析，產品就會有**兩個「睡眠如何影響你」**、來源不同、
> 算法不同。這個 codebase 已經因為重複概念漂移吃過兩次虧
> （`EDGE-DETECTOR-ARCHITECTURE.md` §5.5 有紀錄）。Edge DNA 只做組裝，不重算。

### 1.1 兩個必須先補的資料缺口

`DecisionPerformanceRecord` 原本**沒有存睡眠，也沒有存 ANS position** ——
但 brief 要求的「High Sleep Dependence」與「Stable HRV Focus Zone」兩個特質都需要它們。

| 欄位 | 為什麼要存在記錄上，而不是事後查 |
|------|--------------------------------|
| `sleep: SleepContext` | 睡眠屬於**某一個決策的前一晚**。三個月後回頭查，等於用猜的決定那筆記錄對應哪一晚 |
| `biometrics.ansPosition` | ANS position 是相對於**當時**的基線。基線後來移動了，事後重算會得到不同的數字 |

兩者都已加入（`sleep-` 與 `ans-` 欄位皆可為 `null`，資料不足不會讓整筆記錄失效）。

---

## 2. 分析架構

```
┌──────────────────────────────────────────────────────────┐
│ 資料來源（全部裝置端）                                      │
│   DecisionPerformanceRecord[]  ← 已標註的決策時刻           │
│   每筆含：sleep · ansPosition · stressLevel · hrv          │
│           · clarityRating(1–5) · timeBucket · 時間戳        │
├──────────────────────────────────────────────────────────┤
│ L1  配對抽取                                               │
│   每個 driver 各抽一組 CorrelationPair[]                    │
│   （只取 clarityRating 非 null 的記錄 = labeled set）        │
├──────────────────────────────────────────────────────────┤
│ L2  相關性分析（correlation.ts）— Coach P2                  │
│   Spearman → 效果量門檻 → 分半穩定性 → CorrelationResult    │
├──────────────────────────────────────────────────────────┤
│ L3  特質推導（edge-dna.ts）— Coach P3                       │
│   CorrelationResult + FocusWindowResult → EdgeDnaTrait[]    │
├──────────────────────────────────────────────────────────┤
│ L4  Profile 組裝                                           │
│   ≥2 個特質才成立 → EdgeDnaProfile（含 revisability note）  │
└──────────────────────────────────────────────────────────┘
```

**全部在裝置端。** Edge DNA 讀的是 DPD，而 DPD 是 `local_only`
（`PRIVACY_ARCHITECTURE.md` §3.2）。這份 profile 永遠不上雲，
也不進 §4 benchmark 的匿名封包 —— 它太個人化，本質上就是準識別資訊。

---

## 3. 相關性分析（Coach P2）

### 3.1 三個統計決定

一個 wellness 產品跟使用者說「你高度依賴睡眠」，如果證據薄弱，是會造成實際傷害的
（他會據此重新安排生活）。所以三個決定都偏保守：

#### ① Spearman 而不是 Pearson

`clarityRating` 是 **1–5 的順序量表**，不是等距量表。
用 Pearson 等於假設「4 到 5」和「1 到 2」的差距一樣大 —— 沒有根據。
Rank correlation 是誠實的工具，而且對小樣本必然存在的離群值不敏感。

#### ② 用效果量，不用顯著性

樣本數只有數十筆，而我們同時檢定 **4 個特質**。
在 p<0.05 下做 4 次獨立檢定，**至少一個假陽性的機率約 19%** ——
五個使用者裡就有一個會被告知一個不存在的「特質」。

所以**不做顯著性檢定，也不宣稱顯著**。改用magnitude 門檻：

| 常數 | 值 | 意義 |
|------|-----|------|
| `MIN_PAIRS_FOR_CORRELATION` | 20 | 配對數下限 |
| `MIN_SPAN_DAYS` | 14 | 時間跨度下限（一週內的資料不能構成特質）|
| `MIN_ABS_RHO` | 0.35 | 低於此不呈現 |
| `STRONG_RHO_THRESHOLD` | 0.6 | 以上稱 strong，否則 moderate |

#### ③ 分半穩定性 —— 最重要的一道

**一個相關性必須在歷史的前半與後半都成立、而且同方向，才會被呈現。**

```
MIN_HALF_ABS_RHO = 0.15   // 兩半都至少要往同一邊傾斜
```

雜訊很少能通過這一關；真正的個人模式通常可以。這是防止
「把偶然說成你是誰」的主要防線，而且它**可以解釋給使用者聽**：
這個模式在你前半段和後半段的紀錄裡都出現了。

`CorrelationFinding` 保留 `firstHalfRho` / `secondHalfRho`，讓這個宣稱可被稽核。

### 3.2 失敗是一等公民

`CorrelationResult` 的 `none` 帶著**是哪一道門擋下的**：

| gap | 對使用者的意義 |
|-----|--------------|
| `insufficient_pairs` | 還在累積 |
| `insufficient_span` | 還在累積（時間不夠長）|
| `no_variance` | 這個訊號在你的紀錄裡沒有變化 |
| `effect_too_small` | 沒有明顯關聯 —— **這是一個答案，不是失敗** |
| `unstable_across_halves` | 看起來像關聯，但不穩定 |

UI 必須能區分「還在學」與「查過了，沒有」。兩者都誠實，但意思完全不同。

---

## 4. 特質推導（Coach P3）

### 4.1 四個特質

| Kind | 來源 | Level 意義 |
|------|------|-----------|
| `focus_timing` | `focus-window.ts` 的視窗寬度 + clear rate | 視窗越窄越集中 = 越 defined |
| `sleep_sensitivity` | clarity × 睡眠時數 | \|rho\| 越大 = 越依賴睡眠 |
| `stress_tolerance` | clarity × strain level | **反轉**，見下 |
| `hrv_coupling` | clarity × 恢復訊號（HRV / ANS） | \|rho\| 越大 = 耦合越緊 |

### 4.2 stress_tolerance 必須反轉

這是最容易寫錯、而且寫錯最傷的一個：

> clarity 與 strain **強負相關** = 壓力一升清晰度就掉 = **低耐受度**

如果照 magnitude 直接對映，會把一個對壓力極敏感的人標成「Steady Under Strain」——
**既是錯的，也剛好是反過來的建議**。`traitFromCorrelation()` 對這個 kind 做 `invertLevel()`，
並有專門的測試釘住。

### 4.3 Profile 至少要兩個特質

一個特質不是 decision style，是一個觀察。
只有一個就叫它 profile，等於誇大資料能支撐的結論。
`MIN_TRAITS_FOR_PROFILE = 2`，不足時回傳 `building` 並附 `traitsFound`，
讓 UI 可以誠實顯示進度。

---

## 5. 命名風險：為什麼「DNA」需要規則

**「DNA」在這裡是比喻，只是比喻。**

一個 Health & Fitness 分類的 app 暗示自己在解讀遺傳資訊，是**另一個審查類別**，
也是產品完全無法支撐的宣稱。三條硬規則：

| 規則 | 說明 |
|------|------|
| 文案不得出現 genetic / genes / inherited / hardwired / born with | 由測試強制 |
| 文案不得出現 "DNA" 字樣本身 | 產品名可以叫 Edge DNA，但**特質描述裡不出現這個詞** |
| Profile 必須明示可變 | `PROFILE_REVISABILITY_NOTE` 隨 profile 一起回傳，永遠顯示 |

revisability note 不是免責聲明的擺設 —— 它是**產品真相**：
特質會隨證據累積而改變，`buildEdgeDnaProfile()` 每次都重新推導。

---

## 6. 絕不做族群比較

brief 給的範例洞察之一是：

> 「Your cognitive clarity appears to be **more sensitive to sleep quality than average**.」

**這一句不能出貨**，兩個獨立的理由：

1. **它是比較式健康聲明。** 說某人的生理反應「高於平均」是對他身體狀態的評斷，
   不是對他自己紀錄的觀察。
2. **裝置上根本沒有這個資料。** DPD 是 local-only，benchmark 只收
   k≥50 的匿名分桶 zone 分布（`GROWTH-ARCHITECTURE.md` §4），
   裡面沒有睡眠、沒有相關係數，也不可能有。

`GROWTH-ARCHITECTURE.md` §9.3 已經記過同一條線：「Based on users like you」
會把個人觀察變成準健康聲明。

**安全改寫：**

| 🚫 不能出貨 | ✅ 可以出貨 |
|------------|-----------|
| 你的清晰度對睡眠比平均更敏感 | 在你自己的紀錄裡，清晰度評分與睡眠時數一起變動的程度相當明顯 |
| 你的 HRV 高於同齡族群 | 你的清晰狀態多半出現在恢復訊號較高的日子 |

---

## 7. 範例洞察

全部通過 `findProhibitedTerms()`，且全部是**對自己紀錄的觀察**：

| 特質 | 洞察文案 |
|------|---------|
| Defined Focus Window | Your clear states have clustered strongly in one part of the day. |
| High Sleep Dependence | Your clarity ratings have tracked your sleep closely. |
| Sensitive To Strain | Your clarity ratings have tended to fall as strain signals rise. |
| Stable Recovery Focus Zone | Your clarity ratings have followed your recovery signals closely. |

三條語言規則（沿用 `ANTIGRAVITY.md` §13.5）：

1. 用**過去式**描述已發生的紀錄，不用未來式（`predict` 是禁用詞）
2. 用 **tended to / have** 不用 because / causes（相關不是因果）
3. 每句都含 **your** —— 主詞永遠是使用者自己的資料，不是族群

---

## 8. UI — EDGE DNA 畫面

### 8.1 版面

```
┌─────────────────────────────────────────┐
│  EDGE DNA                                │
│  Based on 62 records over 88 days        │  ← 證據先行
├─────────────────────────────────────────┤
│  DECISION STYLE                          │
│  ┌───────────────┐ ┌───────────────┐    │
│  │ Defined       │ │ High Sleep    │    │
│  │ Focus Window  │ │ Dependence    │    │
│  └───────────────┘ └───────────────┘    │
│  ┌───────────────┐ ┌───────────────┐    │
│  │ Sensitive     │ │ Stable        │    │
│  │ To Strain     │ │ Recovery Zone │    │
│  └───────────────┘ └───────────────┘    │
├─────────────────────────────────────────┤
│  FOCUS WINDOW                            │
│  ▁▁▂▃▅▇█▇▅▃▂▁▁▁▁▁▁▁▁▁▁▁▁                │
│  0    6    10  12   18       24          │
│  10:00 – 12:00 · 70% clear               │
├─────────────────────────────────────────┤
│  STRESS RESPONSE                         │
│  clarity ●                               │
│      5 │ ●  ●                            │
│      3 │    ● ●  ●                       │
│      1 │        ●  ●                     │
│        └──────────────── strain          │
│  在你的紀錄裡，兩者傾向反向移動            │
├─────────────────────────────────────────┤
│  ⓘ This profile describes patterns in    │
│    your own history so far. It updates   │
│    as you record more, and it is not a   │
│    fixed trait.                          │
└─────────────────────────────────────────┘
```

### 8.2 三個版面決定

| 決定 | 理由 |
|------|------|
| **證據放在最上面**，不放在最下面 | 「62 筆 / 88 天」決定了整個畫面該被多認真看待。放在底部等於讓人先相信再質疑 |
| 散佈圖用**實際資料點**，不畫趨勢線 | 趨勢線在 n=40 時看起來比實情確定得多。點自己會說話，包含「很分散」這件事 |
| revisability note **常駐**，不是可關閉的 tooltip | 它是產品真相不是法務裝飾（§5）|

### 8.3 building 狀態

特質不足 2 個時，畫面不是空的，而是顯示進度：

```
EDGE DNA is still forming.
1 of 2 patterns found so far.
Keep recording how your decisions felt — that is
the part that turns readings into a profile.
```

最後一句是刻意的：它告訴使用者**反思才是稀缺的那一半**
（`GROWTH-ARCHITECTURE.md` §3.3 Layer 3 的 labeling moat）。

---

## 9. Tier 與門檻

| 能力 | Free | Pro | 資料門檻 |
|------|------|-----|---------|
| Focus Window（單一特質） | ✅ | ✅ | 20 筆 |
| 完整 Edge DNA profile | — | ✅ | ≥2 特質 |
| 相關性特質 | — | ✅ | 每項 20 配對 / 14 天 |

對應既有 tier 欄位 `aiCoach: 'basic' | 'advanced'` 與 `edgeGraph`，**不新增 tier 欄位**。

---

## 10. 合規檢查表

| # | 檢查項 | 答案 |
|---|--------|------|
| 1 | 金融語彙？ | 無 —— 全部文案跑 `findProhibitedTerms()`，測試強制 |
| 2 | 醫療診斷語言？ | 無 —— 特質是傾向描述，不分級、不診斷 |
| 3 | 因果宣稱？ | 無 —— 測試禁 because / causes / leads to（§7）|
| 4 | 族群比較？ | 無 —— 測試禁 than average / people like you（§6）|
| 5 | 遺傳暗示？ | 無 —— 測試禁 genetic / genes / inherited / DNA（§5）|
| 6 | 行動指示？ | 無 —— 測試禁 you should / you must / try to |
| 7 | 資料離開裝置？ | 否 —— profile 純裝置端，不進 benchmark 封包 |
| 8 | 薄證據被當成結論？ | 否 —— 三道統計門檻 + 至少 2 特質（§3、§4.3）|

---

## 11. Open Questions

| # | 問題 | 影響 | 狀態 |
|---|------|------|------|
| 1 | 既有使用者的 DPD 沒有 `sleep` / `ansPosition`，如何遷移？ | 舊記錄無法支撐這兩個特質 | 建議：欄位可為 null，舊記錄自然被配對抽取略過，不回填 |
| 2 | 分半穩定性在使用者行為**真的改變**時會擋掉真實變化 | 例如換工作後作息真的變了 | 待觀察；可能需要「最近 N 天」與「全歷史」兩種 profile |
| 3 | 四個特質同時檢定的假陽性率，是否需要更嚴的門檻？ | 統計嚴謹度 | 目前靠效果量 + 分半；若特質數增加需重新評估 |
| 4 | `dopamineState` 自評是否該成為第五個特質？ | 需要足夠的自評樣本 | 待資料累積 |
| 5 | Profile 要不要能匯出（PDF / 分享）？ | 分享出去就是公開個人生理模式 | **傾向不做** —— 與 Edge Snapshot 只分享單一分數的原則一致 |

---

*— END OF EDGE DNA ARCHITECTURE v1.0 —*
