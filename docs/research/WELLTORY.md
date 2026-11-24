# Welltory 拆解 —— 哪些能拿、哪些不能碰（研究筆記）

> 2026-11-21。來源：founder 轉的 Threads 貼文（Welltory 官方帳號，「#1 all-in-one health app，18+ millions users」）。
> ⚠️ 本 session 的網路擋掉 threads.com 與 help.welltory.com，**原頁一頁都沒讀到**；
> 以下全部來自搜尋引擎摘要（App Store 文案、Welltory 說明中心與部落格的摘錄、第三方評論）。
> 數字都是 Welltory 自己講的，沒有獨立驗證 —— 引用時照這個身分引用。
>
> 這份是**研究筆記，不是規格**。§4 的提案要 founder 選了才會變成規格與 Todo。

---

## 0. 一句話結論

Welltory 的**量測與分數層**大多數正好落在 `CLAUDE.md` 禁止事項裡（相機 HRV → Stress／Energy／Health 百分比）；
真正值得拿的是**它在誠實層做對的三件事**，而那三件事 TENKI 都還沒有：

1. **「感覺」和「讀數」不一致時，把不一致本身當資訊**（他們自己的資料：約 45% 的日子方向相反）。
2. **相關性有明確的出場門檻**（|r| > 0.4 且統計顯著、要累積數月），不夠就不講。
3. **把「這東西對誰不準」寫成一頁**（β 阻斷劑、慢性病），而不是藏在條款裡。

外加一個**反面教材**：它最多的負評不是準確度，是訂閱與取消的 dark pattern。

---

## 1. Welltory 是什麼（機制層，不是行銷層）

| 面向 | Welltory 的做法 | 出處 |
|---|---|---|
| 量測入口 | 指尖蓋相機＋閃光燈做 PPG；也吃 Apple Watch／Samsung／胸帶 | App Store、說明中心 |
| HRV 指標 | lnRMSSD | 說明中心（Health 分數） |
| 三個分數 | **Health**（今日 HRV vs 平均 HRV）、**Battery**（起床靜息心率＋睡眠，白天心率越高放電越快）、**Stress**（單次讀數的「神經系統活化程度」百分比＋長期的 Stress Impact） | 說明中心摘錄 |
| 分數公式 | **不公開**（「based on our studies」） | 說明中心 |
| 措辭 | 自稱量「生理壓力，不是情緒壓力」；App Store 明寫**不能**用相機量血壓 | 說明中心、App Store |
| 量測規範 | 早上 5–12 點同一時段、量前不喝咖啡不吃東西、同姿勢、同一根手指、**開靜音**（通知會降低量測品質）、光不能太亮也不能太暗 | 說明中心、部落格 |
| 相關性 | 只顯示 Pearson 或 Spearman **> 0.4 且統計顯著**的；新接的資料源「可能要幾個月」才找得到 | 說明中心 |
| 感覺 vs 讀數 | 自家資料：約 **45%** 的日子感覺與穿戴讀數方向相反；個人內感覺與早上 Battery 的 Spearman 中位數 **+0.04**；建議「不一致時，相信比較保守的那一邊」 | Welltory 部落格＋社群醫師專欄 |
| 不適用族群 | 有一頁講「為什麼 Welltory 還不適合慢性病患」；β 阻斷劑使用者的 Today 洞察不可靠 | 說明中心 |
| AI | AI Coach 建在 OpenAI GPTs 上，要把 Welltory 帳號授權給 OpenAI | 說明中心、MobiHealthNews 2024 |
| 整合 | 號稱 1000+ app／裝置（行銷數字，無明細） | Product Hunt |
| 分級 | 免費版約三天預覽；Premium 解鎖每日 Health／Battery／Stress 與報告（各平台說法不一） | 第三方評測 |
| 主要負評 | 自動續訂、「終身方案」被續扣、續訂價格變動、年費灰色／月費亮黃的方案頁、Apple 訂閱裡找不到要去官網取消 | Trustpilot、PissedConsumer、App Store 評論 |

獨立研究的背景：Leiden 大學 2025 年約 800 名智慧手錶使用者的研究，裝置壓力分數與自評壓力**幾乎零相關**
（Wareable 反駁：那只是舊款 Garmin 的一套演算法）。這跟 Welltory 自己的 +0.04 指向同一件事。

---

## 2. 🔴 不能拿的（與 `CLAUDE.md` 硬規則直接衝突）

| Welltory 做法 | 撞到哪條 | 備註 |
|---|---|---|
| 相機 PPG → HRV → Health 分數 | 「相機的 PRV 不得叫 HRV、不得填 `hrvRmssdMs`、不得進 HRV baseline」 | 品質分數 99 的擷取 PRV 可以錯 156%（`docs/PHONE-PPG.md` §13） |
| Stress =「神經系統活化程度」百分比 | 「不得產出 SNS／PNS score、自律神經分數」 | `regulation-evidence.ts` 連欄位都沒有 |
| Battery（白天持續放電） | Phone-first：「連手錶才能用的流程都是錯的」 | 只有連續心率才算得出來；手機版只能編 |
| 公式不公開 | 「畫面顯示合成數字卻沒給齊組成 → 那個數字就是任意的」（§25） | TENKI 的反向立場本身就是賣點 |
| GPT 教練（帳號授權給 OpenAI） | Local-first，raw biometric 不上雲 | 即使只送推導值，也要先過 `PRIVACY_ARCHITECTURE.md` |
| 1000+ 整合 | 不是現階段對外部交易者的獲取／啟用／留存／收入 | `WEARABLE-INTEGRATION.md` 的 Phase 3 已涵蓋必要的那幾個 |
| 訂閱 dark pattern | 「隱私控制不得放付費牆後」的精神；也是信任型產品的自殺行為 | 見 §3.4 |

---

## 3. ✅ 可以拿的 —— 對照 TENKI 現況

### 3.1 「感覺 vs 讀數」不一致 = 資訊（價值最高）

**Welltory 給的證據**：45% 的日子方向相反、相關 +0.04。也就是說，「你的感覺」與「量到的狀態」
是兩個**幾乎獨立**的訊號 —— 這不是任一邊壞了，是兩邊量的東西不同。

**TENKI 現況**：
- `EvidenceBasis.provenance` 已經有 `reported`（使用者自己填的）—— 位置在，但**掃描前沒有任何「你自己覺得如何」的輸入**。
  `ReadinessHistorySample` 只存 stillness／lighting／uniformity／blinkCadence／band／confidence。
- 已有的同型規則：`CLAUDE.md`「兩個來源不一致時取平均 → 不行，顯示訊號衝突」。這條可以直接套到「感覺 vs 讀數」。

**為什麼對主觀交易者特別重要**：交易者最危險的狀態往往是**自評很好、讀數不好**（過度自信）——
這正是 `DECISION-INTELLIGENCE.md` §0 那句「你正變成最容易偏離自己的版本」。
Welltory 把它當健康提示；對 TENKI，它是**決策前最有價值的一句話**，而且**不需要任何新感測器**。

**怎麼拿才不違規**：
- ❌ 不照抄「相信比較保守的那一邊」—— 在交易情境裡那句話很容易被讀成「別進場」（金融建議紅線 + `DECISION-INTELLIGENCE.md` §5 第 6 條不得預測）。
- ✅ 只**並列兩邊**＋說它們不一致，並在歷史夠了之後陳述**使用者自己的紀錄**：
  「你的紀錄裡，自評高於讀數的那幾次，流程一致性比較低（n=7，跨 12 天）」—— 跟 Decision Twin 同一套規則。
- ✅ 不一致本身進 Decision Black Box 當一個事件。
- ✅ 自評只能是**粗粒度**（三格，跟帶位同形），否則就是請使用者幫我們編假精準。

### 3.2 相關性的出場門檻

**Welltory**：|r| > 0.4 且顯著、要幾個月。**TENKI**：`resolveInsightConfidence()` 已經吃樣本數與天數，
Clear Window 刻意留白 —— 方向一致，但**沒有「兩個變數有沒有關係」這一類 insight 的門檻**。
未來任何「X 伴隨 Y」（反思標籤 × 流程一致性、時段 × 帶位）都會需要它。

**怎麼拿**：把 Welltory 的門檻當**下限**而不是答案 —— 個人內 Spearman、|ρ| ≥ 0.4、
加上 TENKI 自己的樣本數＋跨天數；**不夠就回 `insufficient` 並說還差多少**（§3.3 第一級公民）。
⚠️ 一次檢查很多組配對就必然撞出假相關（多重比較）—— 門檻要對「測了幾組」負責，這是 Welltory 沒講的。
⚠️ 這條 Phase 2 才用得到，現在只寫進規格，**不要先寫程式**（§1：「不要因為表格有洞就去把它填滿」）。

### 3.3 量測條件一致性

**Welltory**：同時段、同姿勢、**開靜音**（通知會降品質）、光線適中。
**TENKI 現況**：drift 已經按 time bucket 比；就位閘（`capture-readiness.ts`）只擋接觸，光與晃是 advisory。
**缺的**：「通知打斷擷取」這件事沒有任何地方提到。對交易者這是**必然發生**的 —— 他們掃描時手機就是會跳行情通知。

**怎麼拿**：掃描前一行 advisory（「掃描中的通知會打斷量測」），跟光／晃同級，**不擋**。
不做成檢查清單 —— `DECISION-RECORD-LOOP.md` §4 已裁決「不要 modal」，同一個精神。

### 3.4 「這對誰不準」寫成一頁 + 反 dark pattern

**Welltory**：有一頁專門講慢性病與 β 阻斷劑。這是它少數讓人更信任它的地方。
**TENKI 現況**：`docs/PHONE-PPG.md` 與 `analyze.ts` 有提到心律不整等情形，但**沒有一個 user-facing 的地方**講。
β 阻斷劑會直接壓低心率與變異 —— 對一個用掃描做決策前儀式的人，這是要事先知道的事。
（措辭要過 Compliance Layer：講「讀數可能不代表你的狀態」，**不講病名診斷**。）

**反 dark pattern**：Welltory 的負評主力是續訂與取消。TENKI 的 Premium 還沒上，現在寫下承諾最便宜：
方案頁兩個選項同等視覺權重、取消路徑與訂閱路徑同一處、續訂前提醒。
**這是商業決策 → founder 拍板，不是 AI 能自己寫進規則的**（`.cursor/harness/05_maintenance.md` 權限分級）。

### 3.5 已經比 Welltory 好、不要退步的地方（記下來免得被「對標」拉回去）

| TENKI | Welltory |
|---|---|
| 公式與組成全攤開（§25：各列加起來等於分數） | 不公開 |
| 沒有真 HRV 就不給數字，給帶位＋證據 | 相機就給三個百分比 |
| `no_clear_shift` 是結果不是失敗 | — |
| 比較對象只有你自己 | 有「平均 HRV」等群體式比較 |
| 不宣稱偵測情緒 | 「physical, not emotional」— 同方向，但它還是出 Stress % |

⚠️ 「18M 使用者」不構成照做的理由。上表左欄是 TENKI 的護城河，不是缺口。

---

## 4. 整合提案（給 founder 選）

用 `CLAUDE.md` 的問題篩：「它對外部交易者的獲取／啟用／留存／收入是哪一項？」

| # | 提案 | 對應 | 大小 | 需要 founder 決定的事 |
|---|---|---|---|---|
| A | **自評 vs 讀數**：快訊／掃描前一個三格自評 → 與帶位並列 → 不一致進黑盒子；歷史夠了才出「你的紀錄裡…」 | 留存（北極星決策數的品質）＋啟用（第一次掃描就有「它看到我沒看到的」） | 中：contract + policy + `intelligence/` 一支 + `copy.ts` + preview | 自評放在流程哪一步（會多一個按鍵）；三格的字 |
| B | 相關性 insight 門檻寫進 `DECISION-INTELLIGENCE.md`（只寫規格） | Phase 2 前置 | 小：文件 | 無（但要你同意進 canonical 規格） |
| C | 掃描前「通知會打斷量測」advisory | 啟用（擷取成功率） | 小 | 無 |
| D | 「讀數可能不代表你的時候」一頁（β 阻斷劑、心律不整、起搏器等，不寫診斷） | 信任／App Store 合規 | 小：文件 + preview 一頁 | 是否要醫療背景的人看過措辭 |
| E | 訂閱公平承諾（同權重方案頁、一處取消、續訂前提醒） | 收入（信任型付費） | 規則一條 | 🔴 商業決策，只能 founder 定 |

建議順序：**A 先**（唯一直接動北極星的），C 與 B 順手，D、E 等 Premium 上線前。

---

## 5. 來源

- [Overview of the Welltory app（說明中心）](https://help.welltory.com/en/articles/3352351-overview-of-the-welltory-app)
- [How do I make sense of my measurement results（說明中心）](https://help.welltory.com/en/articles/4253039-how-do-i-make-sense-of-my-measurement-results)
- [Welltory Premium（說明中心）](https://help.welltory.com/en/articles/4007331-welltory-premium-personalized-guidance-habit-analytics-and-so-much-more)
- [Why Welltory isn't really for people with chronic conditions yet（說明中心）](https://help.welltory.com/en/articles/12927837-why-welltory-isn-t-really-for-people-with-chronic-conditions-yet)
- [How to use Welltory AI Coach（說明中心）](https://help.welltory.com/en/articles/8727843-how-to-use-welltory-ai-coach)
- [Data sources and how to connect them（說明中心）](https://help.welltory.com/en/articles/11130907-data-sources-and-how-to-connect-them)
- [Rules for accurate HRV measurements（部落格）](https://welltory.com/rules-accurate-hrv-measurements/)
- [Why your wearable and your feelings disagree（部落格）](https://welltory.com/blog/why-your-wearable-and-your-feelings-disagree)
- [Body vs Numbers mismatch（社群醫師專欄）](https://community-home.welltory.com/doctor/body-vs-numbers-mismatch)
- [Welltory — App Store](https://apps.apple.com/us/app/welltory-health-heart-rate/id1074367771)
- [Welltory releases AI feature（MobiHealthNews 2024）](https://www.mobihealthnews.com/news/welltory-releases-ai-feature-pair-apple-watch-health-data-usable-insights)
- [Welltory reviews（Product Hunt）](https://www.producthunt.com/products/welltory/reviews)
- [Welltory（Trustpilot）](https://au.trustpilot.com/review/welltory.com)
- [Welltory（PissedConsumer）](https://www.pissedconsumer.com/welltory/RT-F.html)
- [Does your smartwatch say you're stressed? It may often be wrong（Leiden 2025）](https://www.universiteitleiden.nl/en/news/2025/07/does-your-smartwatch-say-youre-stressed-it-may-often-be-wrong)
- [Smartwatches aren't confused about…（Wareable 反駁）](https://wareable.substack.com/p/smartwatches-arent-confused-about)
- [Correlation Analysis（Marco Altini，HRV4Training）](https://marcoaltini.substack.com/p/correlation-analysis)
