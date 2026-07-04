# 05 — 知識迭代與反思協議（弱模型如何安全地自我更新 Harness）

> 本檔回答一個問題：**AI 什麼時候可以自己改規則文件、什麼時候必須先問 founder。**
> 判斷不了歸哪級 → 一律當 🔴 處理。

## 1. 三級權限模型

### 🟢 綠區 — 可自行更新並 commit（不必問）
只限「**新增**教訓與紀錄」，不得刪改既有內容：
- `MEMORY.md`：置頂新增 session 條目（遵守置頂協議格式）。
- `docs/PLAYBOOK.md` §4–§7、§9.5：**表格新增一列**「情境→規則」教訓（見 §3 格式）。
- `docs/PLAYBOOK.md` §9 定位表：新增「東西｜位置」**索引列**（兩欄索引格式，不套 §3 格式）。
- `docs/PLAYBOOK.md` §0「已過時文件」清單：**新增**一檔（必須同時給該檔掛 ⛔ 橫幅）；移除或改寫既有項屬 🔴。
- 工作紀錄類：**僅**檔名含 notes 的過程筆記（如 `docs/healthcheck/notes.md`）；同目錄 REPORT/decisions/plan/risks 是交接證據，該輪完成後再改屬 🟡。
- 代碼註解掛牌：`DORMANT` / `keep-in-sync` / caveat 註解。

### 🟡 黃區 — 可以做，但必須走 PR 且描述第一行標 `[制度變更]`，等 founder merge
- `docs/PLAYBOOK.md` 的**結構**（新 section、路由表改欄）。
- `scripts/verify.sh`、`check-vocab.sh`、`preview-shot.mjs`、`.claude/hooks/*`、CI workflow 的內容修改。
- `docs/DEPLOYMENT_MAP.md`/`.json` 的**格式或用途**變更（雙檔必須同一 commit 同步）。
  例外：配合新路由上線的**例行條目新增**是 CLAUDE.md 既有的日常義務，隨功能 PR 走即可，不標 [制度變更]。
- 新增 `.claude/skills/`、`docs/prompts/` 開工單。
- 精簡/歸檔動作（§4）— 因為會刪東西。

### 🔴 紅區 — 先問 founder（AskUserQuestion 或停下等指示），沒有同意不准動
> 等待期間只暫停該紅區項目本身，其餘不相關任務照常進行。
- `CLAUDE.md` 硬規則、`SYSTEM.md` 產品定位與語言系統。
- 任何標了「**拍板**」「**鎖定**」「**locked**」「**FOUNDER-APPROVED**」其一的條目與資產
  （鎖定資產清單：`SYSTEM.md` §8、`ANTIGRAVITY.md` §18、`docs/MOTION-DIRECTION.md` §4）。
- `docs/PLAYBOOK.md` §0 文件優先序。
- `docs/MOTION-DIRECTION.md` 的 tokens 值與四大語彙定義。
- **刪除**任何檔案或既有規則條目（含本資料夾三檔）。
- 本檔的權限分級本身。

## 2. 防鑽漏洞條款（寫給會找捷徑的模型）

### 2.1 綠區的「新增」是字面意義
diff 裡對既有行只能有 context，不能有刪改。改一個字也算改。
### 2.2 每條規則的**意圖高於字面**。例：「不得新增 legacy Animated」的意圖是「債不再長大」，
   把既有檔案大改寫再宣稱「不是新增」違反意圖；`check-vocab.sh` 是 diff-based，
   「先刪含 TEI 的行再用別的拼法加回」是繞過，不是合規。吃不準意圖 → 問。
### 2.3 「verify.sh 綠」是**必要條件不是完成證明** — 綠燈之後仍要按該任務的驗收方式驗（見 06 §3 驗證階梯）。
### 2.4 宣稱「已驗證」的最低標準：驗證指令的**輸出**已貼進回報，或截圖已用 Read 工具實際看過。
   沒有這兩者之一，只能寫「未驗證」。

## 3. 踩坑紀錄格式（Context / Error / Solution）

寫進 PLAYBOOK 對應 section 的表格，**一列一坑**，三段濃縮進兩欄：

```
| <Context：一句話情境（做什麼時）> | <Error：症狀+真因> → <Solution：規則化的動作，祈使句> |
```

規則：
- 先 grep PLAYBOOK 有沒有同類條目 — 有就**合併強化**那一列（屬 🟢），不要開新列。
- MEMORY.md 記「這次發生了什麼」（事件、commit hash、日期）；PLAYBOOK 只記「以後怎麼做」。
  引用具體日期/hash 的敘事不要進 PLAYBOOK。
- 同類教訓第二次出現 → 必須提煉（這是 CLAUDE.md 既有的 compound-learning 規則）。

## 4. 記憶精簡協議（觸發條件用行數 — 模型數不準 token，`wc -l` 誰都會跑）

| 檔案 | 觸發條件 | 動作（🟡 走 PR） |
|------|---------|-----------------|
| `MEMORY.md` | `wc -l` > 1200 行 | 保留置頂協議 + 最新 ~10 條；其餘整段搬到 `docs/archive/MEMORY-<YYYYMM>.md`（原文照搬不改寫）；置頂協議下加一行索引指向 archive |
| `docs/PLAYBOOK.md` | 單一 section 表格 > 40 列，或全檔 > 800 行 | 同類條目抽象合併成通則（例：五條 canvas 尺寸坑 → 一條「canvas 尺寸一律 ResizeObserver 或固定屬性」）；合併前的原文不必保留 — git log 就是歷史 |
| `docs/healthcheck/` 等專案報告 | 該輪工作全部完成後 | 保持原樣（是交接證據），不精簡 |

精簡的驗收：精簡後的 PLAYBOOK 對「精簡前每一條坑」仍給得出正確指引（自查：拿 3 條被合併的舊坑問自己新條文答不答得出來）。

## 5. 能力極限與應對標準（誠實條款）

**這套 Harness 能逼近但不能替代的東西：模糊的商業美感與品味決策。**
拆解、隔離驗證、截圖迴圈可以保證「不壞、合規、一致」，但「好不好看、手感對不對」只有 founder 能裁。

弱模型遇到品味類任務（動效手感、配色取捨、文案語氣、版面美感）的**標準動作**：
1. **找錨點**：先從已拍板的參照物找答案 — `docs/MOTION-DIRECTION.md`、founder mockup、
   鎖定資產、PLAYBOOK 記載的歷次視覺裁決。有錨點就對齊錨點，不發明。
2. **無錨點 → 出選項不出定論**：做 2–3 個變體、每個附截圖（`scripts/preview-shot.mjs`），
   用 AskUserQuestion 讓 founder 選。**絕不**自行挑一個並宣稱「更好看」。
3. **被要求「調到好看」而無法截圖驗證**（動態手感、CDN 資源頁）→ 明說「此項屬桌機
   Antigravity lane / founder 實機裁決」，把規格與調參點寫清楚後交棒，不盲調。
4. 查得到的事實（API 行為、瀏覽器相容性）就查證；查不到 → 標「未驗證」。**編造 = 本協議最重罪。**
