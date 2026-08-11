# TENKI CORE — 定價戰略

> 📌 founder 2026-08-11 拍板的方向 + 論據。價格數字未定案前，本檔是**推薦**不是規格。
> 與 `packages/shared/src/subscription-tiers.ts`（能力表的真相源）一起看。
> ⚠️ `docs/PRD.md` 的 v2 三階（$9 / $22）與 `docs/ORBI_SPEC.md` 的 NT$149 都已過期，不得參照。

---

## 0. 一句話

**免費的是量測，收費的是槓桿。**
不配給掃描次數 —— 配給的是「拿這些量測去做什麼」的深度。

---

## 1. 🔴 為什麼不限掃描次數（推翻了原本「每天 1 次」的想法）

原始想法是免費層每天 1 次掃描。**方向是反的**，理由不是慷慨，是三個可查證的事實：

1. **邊際成本是零。** 掃描全部在裝置上算（MediaPipe + canvas，`readiness-scan.js`），
   沒有伺服器推論、沒有頻寬。限制一個零成本的行為，換到的施壓很小。
2. **每一次掃描都讓護城河更深。** 產品的價值來自 personal baseline，
   而 baseline 需要樣本（engine 的 Welford bootstrap、baseline maturity
   `new/building/ready/mature`）。**限制次數 = 延後 baseline 成熟。**
3. **延後 baseline 成熟 = 延後轉換。** 使用者願意付錢的那一刻，是 App 第一次
   說出「今天跟你平常不一樣」。在那之前，任何付費牆都是在跟一個還沒感受到價值的人收錢。

**「今天是 Clear」不太可行動；「你今天比你自己的基線低」才是產品。**
前者免費送，後者才是 PRO。

⚠️ 這也跟既有規則一致：`ANTIGRAVITY.md` §12.2 明寫「基本掃描能力不得付費牆」——
原本 `dailyScanLimit: 1` 其實跟那條就是打架的。

---

## 2. 分層

| | 免費 | PRO |
|---|---|---|
| 掃描次數 | **無限** | 無限 |
| 今天的帶位（Clear / Neutral / Strain） | ✅ | ✅ |
| 本機歷史 | 7 天 | 無限 |
| **跟自己基線的落差** | ✗ | ✅ ← 核心賣點 |
| 趨勢 / Edge Timeline | 受限 | 完整 |
| 決策迴圈（快訊 → 決策 → 結果對齊） | ✗ | ✅ |
| Session governance / 模板 | 受限 | 完整 |
| 進階洞察 / 匿名 benchmark | ✗ | ✅ |
| **隱私控制、資料刪除、匯出** | ✅ | ✅ |

🔴 最後一列是硬規則，不是行銷選擇：`CLAUDE.md`「把隱私控制放在付費牆後」= 禁止。
`RULES-v3.md:38`、`ANTIGRAVITY.md` §12.2 同樣列明。**任何時候都不得移到 PRO。**

---

## 3. 🔴 付費牆掛在「價值里程碑」，不是第 7 天

baseline maturity 走到 `ready` 的那一刻，App 第一次有資格說
「今天跟你平常不一樣」。**那一刻是賺來的，不是排程的。**

- 這是唯一有說服力的轉換點：使用者剛剛親眼看到產品認得他。
- 順帶解決試用長度的爭論：baseline 成熟約需兩週，**7 天試用會在使用者
  感受到價值之前就結束** —— 那是在最糟的時機要錢。
- 型別已經存在（`new/building/ready/mature`），不需要新概念。

---

## 4. 價格建議

**$9.99/月 · $79/年（省 34%）**，主推年繳。

- 年繳與產品的物理特性一致：baseline 的價值隨時間累積，**產品越用越準**。
- 年繳擋掉最痛的流失：月繳用戶常在第 2 個月退訂 —— 那時 baseline 還沒成熟，
  他退訂的是一個還沒開始運作的產品。
- ⚠️ **定位張力要知道**：App Store 上必須是 wellness 框架（合規），
  而 wellness 的付費意願是 $5–15/月；真正的高付費意願在 decision/trading
  區間（$50–200/月）。$9.99 落在前者的高端、後者的地板。
  這不是錯，但要清楚你在跟誰比價 —— 提價的前提是**先把決策迴圈做成不可替代**。

---

## 5. 🔴 定價之前要先解決的產品定義問題

**你要賣的那個數字，目前的管線產不出來。**

- `readiness-scan.js` 的契約明寫「**永遠不生成 0-100 分**」，它輸出的是
  質化帶位 + 信心 + 證據。
- 但 `CLAUDE.md` 說核心指標是 Decision Edge Score (0-100)，
  `ANTIGRAVITY.md` §12.2 說「Edge Score 計算」必須免費體驗。

兩邊對不起來。這是**產品定義問題，不是文案問題**，而且它會直接影響定價頁怎麼寫。
兩條路：

1. Edge Score 由上層算出來（多次掃描 + baseline + session 表現），
   單次掃描仍只給帶位 —— 那 Edge Score 天然就是 PRO 的東西（需要歷史）。
2. **核心指標正名成帶位**，不再承諾 0-100。

**建議走 (1)**：它讓「跟自己基線的落差」與 Edge Score 是同一件事，
付費理由與技術現實一致，而且不必推翻既有語言。
⚠️ 但這需要 founder 拍板，AI 不得自行決定（`CLAUDE.md` §禁止事項：
不得自行重新命名 zone/Baseline 語言）。

---

## 6. 現況盤點（實作距離）

**已存在**：tier taxonomy 與能力表、`hasFeature`、feature flag 評估器、
`domain/src/policies/` 的純函式政策層（含 alert 的日界配額 + 冷卻的完整實作可當範本）、
`PRIVACY_ARCHITECTURE.md` §16.3 的無帳號模式（訂閱才需要帳號）。

**完全不存在**：IAP SDK（沒有 RevenueCat / expo-in-app-purchases / StoreKit，
連 transitive 都沒有）、product id、價格常數、paywall 畫面、restore purchases、
EAS 設定（沒有 `eas.json`）、相機用途說明（`app.json` 沒有 `NSCameraUsageDescription`，
但已經依賴 `react-native-vision-camera`）。
`docs/APP_STORE_COMPLIANCE.md` 的送審清單目前全部未勾。

⚠️ 也就是說：**距離能收第一塊錢，還隔著一整塊「訂閱基礎建設」的工。**
本檔只定戰略；那塊工是獨立的一刀。

---

*最後更新：2026-08-11 · Claude Code（founder 拍板「限深度、不限次數」當天）*
