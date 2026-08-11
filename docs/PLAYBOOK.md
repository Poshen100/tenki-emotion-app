# PLAYBOOK.md — TENKI 已知陷阱與標準流程手冊

> **目的**：把歷次 session 的教訓（MEMORY.md 日誌）蒸餾成一份可查表的規則手冊，
> 讓任何 AI —— 不論模型強弱 —— 都不重犯已付過學費的錯。
> **使用方式**：動工前先看 §1 路由表找到你的任務類型；工作中遇到怪症狀，先 grep 本檔再 debug。
> **設計原則**：每條規則都寫成「情境 → 動作」，不需要判斷力也能執行。

---

## 0. 文件優先序（衝突時誰贏）

任何兩份文件矛盾時，**排序在前的贏**：

1. **`CLAUDE.md`** — 工程硬規則（禁止事項、commit 紀律、技術選型）
2. **`SYSTEM.md`** — 產品定位與語言系統（Radar/Baseline/Calibration/Turning Point）
3. **本檔 `docs/PLAYBOOK.md`** — 操作規則與已知陷阱
4. **`MEMORY.md` 最上方的條目** — 最新 session 狀態（越下方越舊）
5. **領域方向文件** — `docs/SOUL-SCAN-NORTH-STAR.md`（掃描）、`docs/brand.md`（品牌語言）、`docs/MOTION-DIRECTION.md`（動效）、`ANTIGRAVITY.md` §18（logo 視覺）、`.cursor/harness/05_maintenance.md`（規則文件自我更新權限）、`.cursor/harness/06_manifesto.md`（交接判斷）
6. **`ANTIGRAVITY.md` 本文** — 產品藍圖（頂部 continuation note 比下方本文新；§14 repo 結構已過時，以 `CLAUDE.md` 的 Monorepo 表為準）

⚠️ **已過時、不得遵循的文件**（僅供考古，內容與上述矛盾時一律忽略；均已加 ⛔/⚠️ 橫幅）：
`AI_INSTRUCTIONS.md`（v1 時代，還在講 trading）、`RULES.md`（v2，還在講 PEAK/OPTIMAL/FDCB 模板）、
`task.md`（2026-06-12 停更）、`TENKI-ULTRA-SPEC.md`、根 `BRAND.md` 與 `docs/BRAND.md`（品牌 canonical 是 `docs/brand.md`）、
`DEPLOYMENTS.md`（部署 canonical 是 `docs/DEPLOYMENT_MAP.md`）、`docs/TEI-SPEC.md`、`docs/progressive-tei-api.md`、
`docs/TRADER-MODE-SPEC.md` 的快訊相關段落（TradingView 快訊 canonical 是 `docs/TRADINGVIEW-ALERT-SPEC.md`；該檔其餘部分見其頂部橫幅）、
`RULES-v3.md` 中「以 ANTIGRAVITY.md 為最終依據」一句（實際以本節排序為準）。

---

## 1. 任務類型路由表

| 你的任務 | 主戰場 | 動工前必讀 | 驗證方式 |
|---------|--------|-----------|---------|
| 引擎邏輯（scoring/baseline/session/compliance） | `packages/engine/` | CLAUDE.md 核心模組表 | `bash scripts/verify.sh` |
| 掃描 pipeline | `packages/scan/` | 同上 | 同上 |
| 共用設定（tokens/zone/tiers/flags） | `packages/shared/` | CLAUDE.md；改 zone 色先讀 §9 定位表 | 同上 |
| 型別合約 / 商業規則 | `domain/` | 同上 | 同上 |
| Mobile 畫面 / 流程 | `apps/mobile/` | `docs/SOUL-SCAN-NORTH-STAR.md`（若涉掃描） | `verify.sh` + 本檔 §7 |
| 瀏覽器 demo / founder 預覽 | `apps/preview/` | 本檔 §6（全部）+ `docs/DEPLOYMENT_MAP.md` | `node --check` + **founder 手機實走**（CI 不涵蓋！） |
| 品牌 / 文案 | 依 §9 定位表 | `SYSTEM.md` + `docs/brand.md` §5 | compliance 詞彙表 |
| 動效 / 動畫（任何 surface） | 依 §9 定位表 | **`docs/MOTION-DIRECTION.md`（canonical）** + 對應 `gsap-*` skill 包（其 §6 路由） | 其 §7 驗收清單（真瀏覽器 + reduced-motion + 短視窗） |
| 文件 / 制度 | 根目錄 + `docs/` | 本檔 §0 優先序 | 無矛盾引入 |
| ❌ 任何理由都不碰 | `apps/web/`（凍結）、`core/`（legacy 參考） | — | hook 會直接擋 |

**新 route 上線** → 同步更新 `docs/DEPLOYMENT_MAP.md` + `.json`（CLAUDE.md 硬規則）。

---

## 2. 每個 session 的開工儀式

1. 讀 `CLAUDE.md`（源頭真相）→ `MEMORY.md` **最上面一條**（上次斷點）→ 本檔相關段落。
2. 確認自己在正確分支（**絕不直推 main** — Antigravity 直推 main 已三度弄紅 CI、一次 clobber 掉已 merge 的檔案）。
3. 跨 session 改同一檔案前先 `git fetch origin main` 比對，避免 stale checkout 覆蓋別人已 merge 的工作。
4. 需求模糊 → 先問 founder，不盲猜（Karpathy 原則 1）。任務超過單檔 → 先寫 plan，Todo 對應 commit。

## 3. 驗證與 Definition of Done

**一條指令跑完整個 merge gate**：

```bash
bash scripts/verify.sh        # lint + 4 套件 tsc + root 測試 + mobile tsc/測試 + preview 語法 + 禁用詞彙
```

沒跑過 `verify.sh` 綠燈，不算做完、不准 push 說「完成」。

**CI 盲區（綠燈 ≠ 安全）**：
- CI 與 Biome **都不涵蓋 `apps/preview/**` 與 `scripts/**`** → preview 改動的最終驗證是 **founder 手機實走**，
  程式端至少 `node --check` 每個改到的 `.js`（inline script 用 `new Function()` 驗）。
  歷史教訓：#105→#106→#108 連續三輪「CI 綠了卻在 iOS 上壞」。
- **preview 改動推上去而沒附實走網址 ＝ 沒做完**（founder 2026-08-07 指示）。回報時：
  網址放在**回覆最前面**，而且是**可直接點的完整深連結**（帶路徑，例如
  `https://<preview-host>/decision-alert/`），不是只給主機名讓 founder 自己接路徑。
  多條分支就每條各給一行並標明對應哪個 PR。取得法與備援見 §4。
  > 這條之所以要明寫成 DoD：驗證方式是「請人去手機上走一遍」時，**沒有網址等於沒交付** ——
  > founder 得回頭開口要，那一來一回就是白費的一輪。
- **「我加了一條 harness 守住 X」在跑過反向驗證之前只是願望**（2026-08-08）。新增的每一條斷言，
  都要**把它宣稱守住的東西真的弄壞一次**，確認它會紅。實例：`.rs-lens` 轉 `opacity:0` 的風險是
  「瀏覽器停止解碼 → 量測無聲死掉」，我寫的「取樣仍在發生」那條看起來正中要害 —— 但把
  `.rs-lens` 改成 `display:none` 與 1px，**兩次都照樣綠**（桌面 Chromium 不管版面照解碼，
  那是 iOS Safari 才有的行為）。真正抓到的是**結構**斷言（不准 display:none/visibility:hidden/
  尺寸壓小）。⚠️ **註解要據實寫哪一條在守什麼** —— 一條自稱守住 X 但其實守不住的 harness，
  比沒有 harness 更危險：它讓下一個人放心地改壞它。
  推論：**CI 跑不到的環境行為（iOS 解碼、記憶體、觸控）只能用「不准長成那個樣子」的結構斷言鎖住**，
  不要假裝在容器裡驗證了行為本身。
- **🔴 守門員自己也有「模型」，模型過期時它會用一個不存在的東西給你打分數**（2026-08-11）。
  星塵的主色守門員原本假設「色帶 b ↔ 高度 (b+0.5)/N 一一對應」；色帶改成螺旋（高度＋方位角）
  之後那個假設就不成立了。它算出的「bloom 0.28 已經到頂、再高就撞 Neutral」**是模型的產物，
  不是產品的性質** —— 改成掃 base × band 全組合重算，同一個 bloom 的 ΔE 從 21.3 ❌ 變成 32.1 ✅，
  真正卡住的其實是色相旋轉。**而我已經照著那個假瓶頸挑完參數了。**
  規則：**改了取樣的結構，就要把該守門員產生過的所有數字重算一遍**，
  也要回頭改掉散在註解／文件裡引用它的數字 —— **過期的量測值比沒有量測值更危險**，
  它看起來像證據，會讓下一個人（包括未來的自己）在假的天花板前面停下來。
- **🔴 斷言要問「看得見的通道」，不要問記帳用的旗標**（2026-08-11）。
  「沒呼叫 setReadout 時完全 inert」（＝鎖定資產 v25.8.2 逐位元組不變的那條）原本驗的是
  `readoutState().active === false`。反向驗證時把 `effectiveSat()` 改成永遠走 readout 分支
  —— 靜息飽和度當場從 1.0 變成 1.20，**畫面真的被改掉了，斷言照樣全綠**：
  `active` 只是一個布林旗標，不是「粒子會不會被重新上色」。
  改成驗產品自己的閘門 `toneIdle()` ＋ 靜息飽和度 === 1 之後同一個破壞就紅了。
  判準：**問「輸出會不會不一樣」，不要問「狀態機自認為在哪一格」。**
- **🔴 「有版面」不等於「看得見」—— 遮擋不會改變 bounding rect**（2026-08-11）。
  /v3/ Today 那行「以上四張為示意畫面」被固定在底部的 FDCB 底座整片蓋住，實際讀不到；
  而 harness 的可見性檢查量的是 `getBoundingClientRect()` + `visibility`，**照樣全綠** ——
  是本機截圖才抓到的。判準要再問一次
  `document.elementFromPoint(中心點)`：那個點上最上層的元素必須是它自己或它的子孫。
  ⚠️ 這條特別容易咬 preview：畫面底部有固定的 FDCB 底座與 tab bar，
  **任何 section 的最後一個元素都在它們的陰影裡**。
  ⚠️ 而且它是 scroll 位置的函式 —— harness 只會在它當下的捲動位置驗到。
- **🔴 修一個換壞另一個 → 兩個都要鎖**（2026-08-11）。把說明搬到圓點上方之後，
  換成圓點被底座蓋住 —— 可用高度就那麼多（量出來卡片底 654 → 底座頂 702，少 23px）。
  正解是收緊邊距讓兩個都進得去，**並且對兩個都下斷言**；
  只鎖新修好的那一個，等於允許下次再拿舊的去換新的。
- **🔴 「這個字串不准出現」要問對範圍**（2026-08-11，同一條斷言踩了兩次）。
  `innerText` → 只看**算過版面**的文字，FDCB 膠囊在別的分頁上讀不到，
  把 `Edge Score · 72` 塞回去**沒有紅**（斷言是死的）。
  `textContent` → 連 `<script>` 原始碼都算進來，**我自己解釋這個 bug 的註解讓它紅了**（太寬）。
  正解：複製一份 `body`、移除 `script,style`、再讀 `textContent`
  ——「所有 markup 的文字，含目前沒顯示的」。
- **🔴 非同步 harness 的基準值要在「狀態已經切換完成」之後才取**（2026-08-11）。
  「閘門不過時 progress 不前進」偶爾紅：上一輪餵的是合格的臉，閘門還開著，
  一關門就立刻取基準值，關門前那幾個 rAF tick 仍在**合法**累積 progress。
  是測試的競態，不是產品的 bug。作法：**先餵幾幀把狀態推到位、等它安定，才取基準值。**
  ⚠️ 偶紅的斷言比紅的更貴 —— 它會訓練你忽略紅燈。看到 flaky 就當場修，不要重跑到綠為止。
- **`scripts/preview-*.mjs` 這幾支 harness 沒有進 `verify.sh`**（Playwright 走的是容器限定路徑），
  所以它們**不會自己喊痛**。2026-08-09 實例：把 `.tpl-card` 改名成 `.tpl-row`，
  `preview-strip-color.mjs` 的選擇器當場失效而全綠照舊。**改 preview 的 class 名／id 時，
  一併 `grep` `scripts/*.mjs`**；動完 preview 至少手跑一次相關 harness。
- **合成測試資料要帶著真實世界的耦合，否則測不到它宣稱要測的東西。** 2026-08-09 實例：
  驗「『正對鏡頭』必須排在位置/大小判斷之前」，但合成臉只搬鼻尖、包圍盒完全不變形 ——
  於是**把順序改錯了，測試照樣全綠**。真實的轉頭會壓縮遠側臉頰、抬低頭會位移中心，
  合成資料補上這個耦合才測得到。⚠️ 補了一次還是綠的：只壓臉頰而眼角凸在外面，
  `minX` 由眼角決定、盒中心根本沒動 —— **遠側要整片壓縮**。每次都要用反向驗證確認。
- **「連續幾次讀到一樣就當穩定」是錯的輪詢法。** 卡在中間態的值本身也很穩定，
  這個條件會提早收工並回報中間態。要嘛餵滿一段足夠長的時間再取值，
  要嘛輪詢到**已知的終值特徵**出現，不要輪詢到「不再變動」。
- **分清楚「斷言終值」與「斷言不變量」。** 假相機餵的合成畫面亮度會跳，lighting 閘門
  跟著翻，指令候選擺盪而永遠 committed 不了 —— 硬比對終值只是在賭那一幀的亮度。
  該問的是這條測試真正要守的不變量（例：「正臉的人不會被一直叫去正對鏡頭」），
  然後**照那個寫**。環境限制要寫進註解，不要假裝測到了更多。
- **harness 的本地伺服器要把正式站的 rewrite 補齊，否則會靜默 404。** 2026-08-09 實例：
  `preview-strip-color.mjs` 少了 `/preview/` → `/apps/preview/` 的映射（正式站由
  vercel.json 做），於是頁面載的共用模組一路 404 **而測試照樣全綠** —— 因為那些模組
  當時沒被任何斷言用到。**靜默 404 的測試環境比沒有測試更糟**：它讓你以為驗過了完整的頁面。
  新 harness 一律加 `page.on('pageerror')` 並讓它計入 fail；懷疑時先確認資源真的載到。
  ⚠️ **rewrite 要照抄 `vercel.json`，含 `(.*)` 那幾條，不能只補剛好被斷言用到的路徑。**
  2026-08-10 第二次踩：只補了 `/v3/` **完全比對**、少了 `/v3/(.*)`，於是
  `stardust-scan-takeover.css` 404，而那支 CSS 裡有 `:not(.active){visibility:hidden}` ——
  掃描 takeover 整層蓋在 Session 上，**截圖看起來像產品壞了，差點照著假畫面去修沒壞的東西**。
  推論：**截圖出現「不該在那裡的東西」時，先查資源有沒有全部載到，再懷疑產品。**
- 🔴 **stub 少了現實世界的關鍵條件，就會把錯的行為寫成「規格」。** 2026-08-10 實例：
  `preview-scan-stardust.mjs` 用一個布林 `__sdHostMounted` 假裝「host 已持有星塵綁定」，
  **但沒有真的 host 節點** —— 於是模擬不出真實世界最關鍵的那件事：那個 host 是
  **隱形的**（v6 的 `#universe` 住在 `visibility:hidden` 的 takeover 裡）。
  模擬不出來，「已綁定就不搶」這條錯規則就變成一條通過的測試，**再也沒有人會質疑它**，
  直到 founder 在手機上發現掃描框裡沒有星塵。
  推論：**stub 要模擬的是那個東西在正式站上的處境，不只是它的存在與否。**
  這是「合成測試資料要帶著真實世界的耦合」的第二次，前一次是合成臉太理想。
- 🔴 **反向測試沒紅時，先分清楚「斷言死了」還是「我的 patch 沒生效」。** 2026-08-10 實例：
  驗「progress 不是計時器」，反向 patch 把它改成 `Date.now() - captureStartedAt`，**結果全綠**。
  差點就記成「這條斷言是假的」——實際上 `captureStartedAt` 存的是 `performance.now()`，
  兩個時鐘差 1.7e12，`clamp01` 直接飽和成 1.0，**前後都是 1.0 所以差為 0**。
  換成同一個時鐘就真的紅了。**反向 patch 本身也要驗證它真的改變了行為**
  （最省事的方式：patch 之後先印一次那個值，確認它跟原本不同）。
- 🔴 **守門員的掃描空間要跟著產品一起長大，否則它會靜默失效。** 2026-08-10 實例：
  ΔE 色彩衝突掃描原本只掃「色相 × 飽和度」；readout 層加進了漸層寬度與聚焦之後，
  **不擴大掃描空間的話它會繼續回報一個很安全的數字，而產品早就跑出它掃過的範圍**。
  擴大之後當場擋下我自己的下一個設計（飽和度下限 0.55 對 `--zone-neutral` 只有 ΔE 22.4）。
  推論：**每次替某個機制加一個新的自由度，先問「現有的守門員掃得到它嗎」。**
  上下限一律從產品原始碼讀，不要在測試裡複製一份。
- 🔴 **合成資料也要帶著「時間」這個耦合。** 2026-08-10（同類第四次）：驗
  「stillness 有沒有被重映射到實際工作區間」，反向驗證卻是綠的 —— 因為 harness 的
  `feed()` 是同步連續呼叫，兩幀 dt ≈ 1ms，而產品算的是 `speed = 位移 / (dt/1000)`，
  於是**任何**位移都把 speed 衝爆、原始 stillness 直接落到 0。
  **harness 的擺幅比真實使用極端得多，所以分不出有沒有重映射。**
  真實的臉部推論是 ~180ms 一幀；照那個節奏餵（dt≈180ms、位移 0.025 →
  原始 stillness ≈0.60，正是實測讀數那一段）才驗得到。
  推論：**凡是產品公式裡有 `dt` 的，合成測試就必須用真實的時間間隔餵。**
- 🔴 **斷言的輸入被合成資料釘死時，那條斷言等於不存在。** 2026-08-10 第三次踩合成資料太理想：
  我加了「量測中的色相不得為負」，反向驗證（把公式改回會產生負值的舊版）**照樣全綠** ——
  因為合成臉把 105/334（眉）與 13/14（嘴）留在**同一個座標**，於是產品算出來的
  `browTension` 恆為 1、`mouthOpen` 恆為 0：**兩個輸入都是常數，那條斷言一直在測一個點。**
  推論：**每加一條吃輸入的斷言，先確認那些輸入在測試裡真的會動** ——
  補一條「這個值在整輪裡至少出現兩種」的斷言最省事，而且它自己也反向驗證得了。
  （前兩次：合成臉包圍盒不變形、stub 沒有真的 host 節點。）
- **斷言存在性時，先問「這條在該壞的時候會不會照樣綠」。** 同一輪自己寫的兩條弱斷言：
  用「最後一次 mount 掛在 universe 上」當「有還回去」的證據 —— **根本沒借的時候
  那條也成立**，所以反向驗證時它一聲不吭。改成問終態（收尾後綁定確實回到原節點）
  ＋ 問過程真的發生過（mount 三次）。**反向驗證抓到的不只是產品的錯，也是斷言的錯。**
- **模組被 CDN 擋住而驗不到畫面時，把可驗的那一半挖出來驗。** 2026-08-10 實例：
  three.js 被沙箱擋 → 星塵渲染在容器裡完全看不到；但「色調層在預設值下必須是
  恆等變換」（否則會連坐改掉 CLAUDE.md 鎖定的 v25.8.2 資產）是**純數學**，
  把矩陣函式 export 出來就驗得到。⚠️ 註解要據實寫清楚驗到的是數學不是畫面。
- **斷言「有沒有這個元素」時要問的是「看不看得見」，不是 DOM 裡有沒有。**
  2026-08-10 實例：驗收束頁有兩顆按鈕，反向驗證時把第二顆留在 DOM 只設 `display:none`，
  **那條照樣綠** —— 而一顆看不見的按鈕正是那一刀要消滅的東西。
  凡是「使用者看得到 X」的斷言，用 `getBoundingClientRect().width > 0` 之類的可見性條件。
- **走完整條使用者流程，不要跳過「儲存」那一步。** 同一輪發現：harness 從來沒按過
  「記錄並關閉」，所以統一 store 一直是空的，任何「資料有沒有流到下一頁」的斷言都測不到。
- **偽造狀態要照產品真正的寫法。** harness 為了驗收尾畫面而直接 `el.textContent = '...'`，
  結果把該元素的子節點整個清掉，後面驗子節點的斷言就炸了 —— 測到的是**被自己弄壞的 DOM**。
  同理，**靜態掃原始碼的斷言要先剝掉註解**，否則會掃到自己寫的說明文字（兩者都是 2026-08-09 實例）。
- `apps/mobile` **不在 root workspaces** → root `npm test` 測不到它，要 `cd apps/mobile && npm test` 分開跑。
- 測試框架是 **Jest + ts-jest**，不是 vitest（舊文件寫錯已糾正）。
- 動效／視覺類改動：容器內截圖僅供參考，**以 founder 實機為準**；回報時主動請對方確認「減少動態」設定
  （該設定會凍結所有動效，曾造成「動畫壞了」的誤報）。
- **preview 截圖驗證（`node scripts/preview-shot.mjs <path> [out.png]`）**：改 preview 後主動截圖傳給 founder，
  能省一輪「merge 後手機看」。**截圖夠力的**：純 CSS 色彩/版面/字級、靜態狀態、iPhone 視窗溢出檢查；
  多狀態頁面用 `page.evaluate` 切態各截一張（如 zone 三態）。**仍必須實機的**：動效手感、CDN 資源頁
  （GSAP/Three/字型被沙箱擋，只能看 fallback）、iOS Safari 特有行為（100vh/dvh、mix-blend OOM、震動）、
  相機/手勢流程。

## 4. Git 與多 AI 協作陷阱

| 情境 | 規則 |
|------|------|
| PR 被 squash-merge 之後 | 立刻 `git fetch origin main && git reset --hard origin/main` 同步分支，否則下個 PR 必撞 `mergeable_state: dirty` |
| 發現 main 上的檔案被「默默還原」 | 是別台機器的 stale checkout 直推。用 `git diff <pre-feature> <wip>` 確認是否純還原，從正確 commit checkout 回檔案；**別動對方真正的新功能** |
| merge PR 之前（尤其多 session 並行時） | 先 `pull_request_read(get)` 核實 **PR head sha == 你剛推的 tip**。2026-07-08 實例：#165 merge 時 head 停在三刀中的第一刀，後兩個 fix 靜默遺失，靠本地 cherry-pick 救回。merge 後也要 `git log origin/main --oneline -3` 確認你的 commit 真的在裡面 |
| stop-hook 警告 main 頂端 commit「Unverified（noreply@github.com）」並建議 amend | **誤報，絕不可照做**——那是 GitHub 自己產生的 merge/squash commit，amend＝改寫 main 歷史。只有「未推的本地 commit」才適用 reset-author 修簽名 |
| clone 異常肥大 / 大型 merge 之後 | `.gitignore` **擋不住已被 add 的檔案**。抽查 `git ls-files \| grep -c node_modules`——#154 曾把 38,641 個 `apps/mobile/node_modules` 檔案（Skia 44MB .a 等）commit 進 main，clone 肥到 350MB 才被發現。修法 `git rm -r --cached <dir>`（磁碟保留）；歷史 blob 清洗（filter-repo）屬 🔴 需 founder 拍板＋全 session 重 clone |
| 收到 Antigravity 的 patch relay（貼 diff） | 先 `git log --stat` 驗 base 乾淨；**不要盲 `git apply`**，用 Edit 對真實檔案逐段重建（順帶就是 review）；大檔改貼 `git show HEAD:<file>` 全文更可靠 |
| 背景 agent 宣稱完成 | 不可信，用 `git log` 驗實際 commits（agent 可能中途被用量上限砍掉） |
| 雲端環境查 CI | **無 `gh` CLI**。用 GitHub MCP `pull_request_read(get_check_runs)`；用 gh 或未帶 token 的 curl 會空轉 |
| Vercel 部署驗證 | 部署有 protection，匿名 WebFetch 會 403；分支 preview 連結在 PR 頁的 Vercel bot 留言 |
| **要給 founder 驗收網址時** | **永遠從 PR 頁的 Vercel bot 留言讀網址，不要用分支名自己拼。** preview 子網域是 DNS label，上限 63 字元，超過時 Vercel 會**截斷分支名再插一段 hash**——拼出來的網址在瀏覽器是「找不到伺服器」，而 founder 只會看到你給錯連結。2026-08-05 實例：`tenki-emotion-app-git-claude-structure-watch-chenposhens-projects`（65 字）拼錯，真值是 `...-git-claude-struct-7775e3-...`。取得方式：`pull_request_read(get_comments)` 找 `vercel[bot]` 那則。**沒有 PR、或 bot 留言還沒更新時的備援**：`list_deployments` → 取該筆的 `meta.branchAlias`，那就是分支的穩定 preview 別名，**已經包含 Vercel 對超長分支名做的截斷+hash**（實例：`claude/structure-watch` → `...-git-claude-struct-7775e3-...`），比自己拼字串可靠。⚠️ **附網址是 DoD 不是善意**，見 §3 |
| 分支名要當 preview 網址用時 | 名字取短。`claude/<主題>` 的主題超過約 20 字元就會觸發上面的截斷+hash |
| 外部服務（TradingView / Stripe / GitHub webhook）打我們的 API「完全沒反應」 | **先確認對方填的網址是完整的那一條，再懷疑基礎設施。** 2026-08-06 實例：一路懷疑 Deployment Protection、關 SSO、生 bypass 密鑰，真因是 TradingView 存著一條**不完整的舊連結** → `POST /api/alert` 打得進來、被我們自己回 **400**。診斷順序：① 頁面「測試這條連結」（`credentials:'omit'` 打自己，穿得過就不是牆的問題）② 觸發一次真的快訊，`get_runtime_logs` 立刻看狀態碼 ③ 才輪到保護設定 |
| `get_runtime_logs` 查不到東西 | **查不到 ≠ 沒發生。Vercel runtime log 沒有長時間歷史。** 實測 `since` 給 2h / 6h / 24h 回的計數**一模一樣**，全都只涵蓋最近很短一段，而且有一兩分鐘的 ingestion 延遲（頁面正在輪詢，查 6h 卻回空表）。**絕不可**拿「寬視窗查空」當成「請求沒進來」的證據——2026-08-05 就是這樣把整條根因推論建在沙上。要用它就查**剛剛才發生**的事，並且先做一個已知會產生 log 的動作當對照組 |
| 判斷「正式站有沒有被保護」 | **不要從 `ssoProtection.deploymentType` 推論，直接量。** `all_except_custom_domains`（UI 上叫 Standard Protection）豁免的是**正式站網址本身**，不是只有自訂網域——即使專案零自訂網域，`<project>.vercel.app` 仍是匿名可達的。**被保護的是分支 preview。** 量法：`credentials:'omit'` 打一個已知會回 405 的端點，到得了就沒被擋 |
| iOS「加入主畫面」的 PWA 與 Safari 分頁 | **localStorage 不共用，是兩個獨立的儲存空間。** 2026-08-06 一天內踩兩次：① 從主畫面開 TENKI 後 `ch=` 變成全新頻道，TradingView 還指著 Safari 那組舊的 → 快訊進了看不到的頻道 ② 在 Safari 做過的 soul-enroll 眨眼基線（`tenki.baseline.blink`），PWA 裡讀不到 → `blinkCadence` 又回到 `null`。**規則：任何「在手機上重現」的驗收，先問清楚是分頁還是主畫面 app，兩邊的 localStorage 狀態要分開推理。** web push 只有主畫面 app 能用（iOS 16.4+），所以推播相關的驗收一律在 PWA 那側 |
| push 前 | commit-per-todo（CLAUDE.md 硬規則）；`git push -u origin <branch>`，網路失敗指數退避重試 |

## 5. CI / 工具鏈陷阱

| 情境 | 規則 |
|------|------|
| 改 `biome.json` | **不能寫註解**（整份設定會靜默失效、退回全 repo 掃描）；要註解改用 `.jsonc` |
| `biome-ignore` | 只覆蓋「下一行」；JSX 多行屬性要貼在該屬性正上方 |
| 跑 biome | 用 `./node_modules/.bin/biome`；`npx biome` 可能誤抓到無關的舊版 `biome@0.3.3` |
| 乾淨容器 | root 與 `apps/mobile` 要**各自** `npm ci`（mobile 不在 workspaces） |
| 在 `apps/mobile` 裝依賴 | 工具呼叫之間 shell cwd 會重置 → 用單一命令 `cd /abs/path/apps/mobile && npm install ...`，否則會污染 root package.json |
| `expo export` 失敗 | 它會先清空 output dir — dist 消失 = build 失敗的訊號；`dist/` 是 gitignored，需要時 `git add -f` |
| Playwright | 全域裝在 `/opt/pw-browsers`，不要 `playwright install`；orb 截圖迴圈：`node scripts/orb-tuner/shoot.mjs` |

## 6. apps/preview（vanilla JS）前端陷阱

**這是踩坑最密集的區域。改 preview 前整段讀完。**

| 症狀 / 情境 | 規則 |
|------------|------|
| 準備改 preview 的視覺 | **先問「這個在容器裡截得到嗎」，截得到就自己先看過再推。** 純 DOM / CSS / SVG **不受沙箱擋 CDN 影響**，容器裡就驗得掉；只有 WebGL 畫面、相機、動效手感、CDN 資源頁才是非實機不可。指令：`node scripts/preview-shot.mjs <repo-relative-path>`（一般頁面）、`node scripts/preview-scan-shot.mjs`（掃描覆蓋層，`begin()` 之後才存在的東西一般截不到）。2026-08-07 實例：光弧第一版是「圓套在圓角方框外」的一眼可見錯誤，我沒截圖就推，讓 founder 用手機幫我發現；第二輪自己截圖，當場又多抓到一個收滿時上緣正中的 54px 接縫 —— 那種他大概會看到、但很難說出是什麼的瑕疵 |
| 想沿用站內「已經在實機驗過」的技法 | **連它的前提一起抄，不要只抄 CSS。** 2026-08-07 實例：光弧照抄 takeover 的 conic-gradient + radial mask，理由是「已驗過、不另發明」—— 理由沒錯，錯在**那個環是套在圓形指紋鈕上的**，換到 236px、圓角 64px 的方框就變成兩個不相干的形狀。動手前先問：原本那個技法**假設了什麼形狀 / 尺寸 / 座標系**？進度類尤其要問「它量的是角度還是弧長」——conic 掃角度，套在方形上會邊上跑得快、角落卡住；要沿邊均勻前進得用 SVG 描邊 + `pathLength` 正規化 |
| **兩個頁面共用同一份資料，但數字對不起來** | **判定的單一來源要跨檔成立 —— 抽成共用模組，不要各自鏡射。** 2026-08-09 實例：`decision-alert.js` 改用新語意 tag（`judged_entered`）之後，`/v3/` 的 `isDisciplinedV6()` 仍只認舊的 → 同一筆決策，demo 裡 100%、Session 頁 0%。⚠️ 這是「判定多份實作」的**第三次**，但前兩次都在同檔內 grep 得到，**跨檔這次沒人會想到去對照另一個檔案**。修法：`apps/preview/decision-outcome.js` 當唯一來源，兩頁都載它、區域實作全刪，**且不留 fallback**（「載不到就用本地那份」＝ 又生出第二份判定）。驗收要**端到端**：同一個分頁走完 A 頁流程 → 導到 B 頁讀它自己算的數字 |
| 把 A 頁的資料接到 B 頁，數字對了就想宣告「接通了」 | **一個數字對了不等於這筆紀錄被認得。**「資料到得了」跟「它到了之後還是它自己」是兩件事。2026-08-10 實例：修好判定讓對齊率變 100% 就收工，而同一筆決策在 `/v3/` 長成 `❤️ ES1! · 15:23 · 未達 Readiness · [已記錄]` —— 名稱、圖示、readiness、badge 四處全錯，**沒有一處會報錯**（全是 `\|\| fallback`）。根因是兩套 id 從來沒對上（engine 的 `FBD` vs v6 的 `MANCINI_FBD`）。**規則**：接完資料要**逐欄看那一列長什麼樣**，不要只看彙總數字；`\|\| fallback` 是「錯了也不吭聲」的同義詞，凡是有 fallback 的欄位都要有一條斷言確認**沒有掉進 fallback**。⚠️ 對照表要放進共用模組，且**兩邊的 id 都不改** —— persisted contract 動了會弄壞既有紀錄，只做翻譯 |
| 某筆紀錄缺了某個欄位，而畫面上那一格是二選一（達/未達、通過/失敗） | 🔴 **缺欄位就不准說否定 —— 那是謊報，不是排版瑕疵。** 2026-08-10 實例：`rec.reachedReadiness ? '達' : '未達'`，而快訊決策**根本沒有 readiness 這個量** → `undefined` 落進 else，於是畫面對一次**判定成立並進場**的決策印「未達 Readiness」。修法：先判 `undefined/null`，改報那一筆真的有的事實（來源／用時），沒有就留 `—`。**三元運算子把「沒有這個量」和「這個量是否定的」混成同一個分支**，凡是 `x ? A : B` 的呈現都要先問「x 有可能不存在嗎」 |
| 出口／入口被藏在小字或次要位置，理由是「不佔版面高度」 | **先量再說 —— 假的工程理由最會替藏起來的東西背書。** 2026-08-09→10 實例：收束頁通往決策紀錄的路只有事件鏈裡一列小字，我在 MEMORY 寫的理由是「加按鈕會推回摺線下」；founder 的反應是「**好像不想讓人知道似的**」。實際上 `.sheet-actions` 是 `display:flex` + `.btn{flex:1}`，**同一列加第二顆按鈕的高度成本是零**。工程方便不該贏過產品意圖，更不該用一個沒量過的成本說法去合理化 |
| 同一支模組在兩個入口表現不一樣（一邊有效果、一邊沒有） | **先查那頁上有沒有別人先佔了共用的單例資源。** 2026-08-10 實例：`stardust.js` DOM ready 就 `autoMount()` 到 `#universe`，而 v6 的 `#universe` 住在平常 `visibility:hidden` 的 takeover 裡 —— **一顆沒人看得到的星塵球一直在燒 GPU，還佔著唯一的 WebGL 綁定**，於是 `/v3/` 的掃描框永遠拿不到；`/decision-alert/` 沒有 `#universe` 所以一直是好的。⚠️ 真正的教訓在修法：我當時寫的是「已被持有就放棄」，理由是「第二個 context 是 iOS OOM 區」——**理由對，結論錯**。單例資源的正解是**交接**（借走 → 用完還回去），不是讓位；持有者**看得見**時才真的不能搶。借之前一定要先問到 host（`destroy()` 會把 container 設成 null，拆完就沒人記得該還給誰）|
| 要在畫面上**產生**一個新顏色（色相旋轉、漸層、程序生成的配色） | 🔴 **先問「我即將產生的顏色，在這個產品裡是不是已經有主人」，不只是「我要用的顏色對不對」。** 2026-08-10 實例：我很小心地擋住了 gold（`.locked` 不准上金，因為 gold = SECURED），卻沒想到色相旋轉會把漸層底部的 cyan 轉成綠 `#00E48B` —— 而 v6 的 `--good` 就是綠 `#34C759`，於是量測中的球在**還沒有任何結果**時亮起「good」。**擋住自己要用的色，擋不住自己會算出來的色。** 修法有兩層：①把旋轉改成**單向**，結構上就到不了那個色相（用 0..1 的 drive 乘上限，不是靠 clamp 補救 —— clamp 會讓「為什麼不能為負」從程式碼裡消失）；②**寫一條會喊痛的斷言**：把整個可能的輸出範圍掃過一遍，跟每個已被指派意義的顏色算 ΔE（CIE76 即可），門檻**量出來再定**（現行 28.6 / 舊設計 12.9 → 取 25）。⚠️ 這條斷言只掃它宣稱的範圍，所以必須跟「範圍不得越界」的行為斷言**成對存在**，拆掉任一條另一條都補不上洞 |
| 調了參數想讓效果更明顯，實機上還是看不出來 | 🔴 **算它的絕對幅度，不要看倍率。** 2026-08-10 連踩三輪：「粒子收散 ×1.35→×0.55」聽起來 2.5 倍，實際位移差是**半徑的 1.44%，手機上 2.2px**；「尺度收緊 6%」= 9px；「飽和度 7.5×」在 `AdditiveBlending` 下被疊到白而消失。**倍率是相對的，眼睛看的是絕對的。** 動手前把數字換算成**像素**或**ΔE**，問「這個量級的差異，使用者不比較看得出來嗎」。⚠️ 也要看**材質**：additive 混色會把密集區推向白，**同一色系內的差異在那裡幾乎無效** —— 想在 additive 上做出可讀的差異，只能改「顏色的組成」（一團彩色 ↔ 一顆單色）或幾何（尺度），不能只改飽和度/色相 |
| 為了讓「兩種狀態好分辨」而把某個維度**抽掉** | 🔴 **先確認使用者要的是「分得出來」還是「豐富」** —— 這兩個會互相打架。2026-08-10 實例：founder 要的是「更多層次色彩變化」，我為了讓「穩 vs 晃」一眼可辨，把穩定狀態做成**收成單一青色**。而正常握穩就是 85–95% 穩定度 → **整場掃描幾乎都是單色**，彩度跨度只剩 4–36。他第三次回報「顏色變化還是很少」——**我優化的是可辨識度，他要的是豐富度。** 規則：狀態差異用**不會消耗主訴求的維度**去承載（這裡改成尺度 32% + 亮度），主訴求那個維度只准往「更多」的方向動 |
| 某個色彩／視覺自由度被「語意已被占用」卡死 | **問清楚守則的粒度：守的是單一元素，還是整體印象？** 2026-08-10 實例：產品裡幾乎每個色相都有語意（綠=good、琥珀=warn、金=SECURED、珊瑚=未判定），我把星塵的**每一顆粒子**都擋在那些色外面 → 可用色域只剩青紫粉一小段弧，那正是顏色出不來的根源。**大面積、流動、多色的場不是訊號燈**：單顆粒子是綠的不會被讀成「good」。守則改成守「整顆的主色」之後色域立刻打開。⚠️ 新粒度會長出新風險，要一起驗：**把色相散太開，整體平均色會趨近灰，而灰可能正好是某個語意色**（這裡是 `--zone-neutral`）—— 那個陷阱是新守門員自己當場抓到的 |
| 程度差異怎麼調都不夠明顯 | **換成類別差異。** 不要再問「這個參數要多大」，要問「使用者一眼能不能分辨這是兩種**狀態**」。2026-08-10 實例：把「漸層更集中一點」改成「**收成單一顏色**」——三色階彼此的 ΔE 從 92 掉到 0，這種差別不需要比較。⚠️ 驗收也要跟著換：不要驗「參數有沒有被設定成不同值」，要驗**可見量**（色階之間的 ΔE 跨度、尺度比）。先前三輪的斷言全都只驗到前者，所以三輪都綠、三輪都被 founder 打回 |
| 做了一個「會回應使用者」的效果，但實機上感覺不到它在動 | 🔴 **先查那個訊號的真實分布，不要因為它「正規化成 0..1」就假設它會走遍 0..1。** 2026-08-10 實例：星塵色彩吃 `browTension`（兩眉之間的距離比值）—— 那是**解剖學上近乎固定的距離**，用力皺眉只讓色相動 **0.69°**；`mouthOpen` 在掃描時嘴閉著恆為 ~0.1。做出來的東西「技術上正確」但使用者一句「顏色好像沒變化？」。**選訊號的順序應該是：①它在真實情境下的跨度有多大 ②它是不是使用者能感知自己在控制的東西 ③才是好不好接。** 這一刀改吃 `stillness` —— 每幀、真 0..1、而且**正是畫面上要求使用者控制的那個量**（「保持穩定」）。⚠️ 驗收要斷言**量的跨度**（例：`max-min ≥ 0.25`），不是「有沒有被呼叫」 |
| 使用者被要求做一件事（保持穩定、對準、呼吸） | **主角要對那件事有反應，否則就只是「還不錯」。** 2026-08-10 founder：「不要只是還不錯，我要的是棒透了」。當時畫面寫著「保持穩定」，而星塵球對穩定度**完全沒有反應** —— 使用者做對了得不到任何回饋。**指令與回饋要成對**：凡是介面上出現祈使句，就去找「使用者照做時，畫面上哪個元素會變」，找不到就是缺口 |
| 要讓視覺跟著「使用者狀態」變 | 🔴 **只准吃量得到的東西，而且不准替它貼標籤。** 2026-08-10 founder 要「每次掃描都感應使用者的情緒變色」—— 效果做得到（我們真的在量 landmark 幾何與位移穩定度），但**「情緒」是我們量不到也不能宣稱的**（CLAUDE.md 禁醫療診斷措辭）。做法：顏色直接吃實測值，畫面上不新增任何文案往那個方向講。⚠️ **顏色本身也會宣稱事實** —— `gold = SECURED`，所以**沒有讀數就不准上 gold**，跟文案同一條紅線；連「取景對準（`.locked`）」都不夠格，要等真的有讀數（`.secured`）|
| 要改一個被標成「鎖定資產」的視覺（星塵手感、既有調色盤） | **讓預設值成為恆等變換，鎖就由結構守住，而不是由「我會小心」守住。** 2026-08-10 實例：星塵加色調層時，`setTone()` 預設 `hue:0, sat:1, mix:0` → 矩陣是單位矩陣 → 沒呼叫它的頁面（story / soul-enroll / takeover）逐位元組不變，而且 harness 直接驗那個矩陣是單位矩陣。⚠️ founder 對鎖定資產的授權要**寫下範圍**（這次是「掃描期間的色彩」），否則下一個 session 會把它讀成「星塵可以改了」|
| 畫面上兩個地方對同一筆資料講相反的話（數字說 A、顏色／文案說 B） | **判定只能有一個來源函式。呈現層不得內聯重寫判定。** 2026-08-07 實例：收束頁寫「紀律完成率 100%」，正下方軌跡條卻畫成破戒橘 —— 「算不算紀律」當時活在三處（`isDisciplined()` / `segColor()` / entry panel 內聯的第三份），#219 改 tag 名稱時只更新了第一處。**改列舉型 tag／狀態名稱時，先 `grep` 該 tag 的所有比對點**，別只改「主要那個」。顏色與文案都算判定的下游，必須呼叫同一支函式 |
| 要把某一層藏起來（`opacity:0` / `visibility:hidden` / 縮到 1px） | **先問「有誰在這一層上畫東西」。把一層設成透明＝把掛在那一層上的所有視覺效果一起關掉。** 2026-08-08 實例：`.rs-lens` 為了不露臉改成 `opacity:0`，而鎖定閃光是掛在 `.rs-lens` 上的 `box-shadow` —— opacity:0 的元素連 box-shadow / background 都不畫，**閃光整個消失而 CI 全綠**，直到 founder 說「合一還不夠爽」才發現。改可見性之前 `grep` 那個 class，把附著在它身上的 animation / shadow / background 一起搬到看得見的專屬層 |
| 某個元素會**條件性**隱藏（空值就收起的圖示 / 徽章 / 欄位） | **為它預留的空間要一起收掉。** `display:none` 只拿掉元素，不會拿掉父層為它開的 `padding` / `gap`。2026-08-09 實例：指令膠囊 `padding:0 18px 0 10px`，左邊 10px 是留給圖示的，圖示被 `b:empty{display:none}` 收起後那 10px 還在 → 文字左偏 8px，**只有沒圖示的那一種指令看得出來**，所以三種指令裡只有一種被抓到。修法：由寫入內容的那支 JS 一併掛 `.no-icon` 之類的狀態 class（比 CSS `:has()` 確定，也不賭 Safari 版本）。驗收要**量**：左右間距各是多少，不要用眼睛判斷「看起來有沒有正」 |
| 在 JS 裡設了 `el.hidden = true`，畫面上東西還在 | **`hidden` 只是作者樣式的 `display:none`，任何 `display` 宣告都蓋得掉。** 2026-08-09 實例：揭曉時把指令膠囊設成 hidden，但 `.rs-instruction` 是 `display:inline-flex`，結果收尾畫面上還在叫使用者「把臉放進框裡」。凡是自訂 `display` 的元素要能被 `hidden` 藏起來，就得自己補一條 `[hidden]{display:none}`。⚠️ 這個 bug 在 DOM 上完全正確（屬性真的設了），只有**看圖**才會發現 |
| 做完一段「儀式」（掃描／校準／收束）卻覺得空 | **做完高潮不等於做完儀式 —— 儀式要有交付的那一刻，而交付不能跟過程共用同一個容器與字級。** 2026-08-09 實例：掃描的鎖定拍子做得很足，但結果只是被寫進**剛剛還在下指令的那顆小膠囊**、同字級、停 1.2 秒自動消失，founder 的反應是「不知道剛剛完成了什麼」。修法：結果用 MOTION-DIRECTION §4 的 **Reveal 揭曉** 語彙、放在儀式的舞台上（掃描框內）、儀器的工作零件全部退場、**停著等使用者自己收下**而不是計時器關掉。⚠️ 收尾若收起了原本的關閉鈕，新的出口鈕 listener 必須在**注入 markup 當下**就綁，不能依賴收尾流程跑完，否則收尾一出事人就被關在覆蓋層裡 |
| 想斷言「畫面已經靜下來了」 | **不能用 computed `animation-name`。** CSS 動畫播完之後那個屬性還在（觸發用的 class 不會自己拿掉），照它算會得到一票假陽性。要問的是「**現在**有沒有東西在跑」→ `document.getAnimations().filter(a => a.playState === 'running')` |
| 即時操作回饋（對位標記、跟手的指標）看起來一格一格 | **檢查它是被誰的節奏驅動的。** 量測迴圈的頻率≠繪製該有的頻率：臉部推論 180ms(≈5.5fps)、取樣 66ms(≈15fps)，把插值寫在那些 callback 裡等於用 5.5fps 畫一個該 60fps 的東西。**拆成兩層**：量測只寫目標值，插值放 rAF（且要放在任何節流早退**之前**），並對 `dt` 做步長補償。順帶：每幀只寫 `transform`/`opacity`（MOTION-DIRECTION §2）——改 SVG 的 `cx/cy/r` 會逼重新柵格化 |
| 底部 sheet / 面板的主要按鈕要先捲動才看得到 | **sheet 一定要自己有高度上限並自己捲，而且內容要能在 in-app 瀏覽器的實際高度一屏放得下。** 2026-08-09 實例：收束頁只有 `position:fixed; bottom:0`、沒有 `max-height` —— 而 fixed 是相對**版面視口**定位，in-app 瀏覽器的上下工具列把**視覺視口**壓小之後，「記錄並關閉」就沉到摺線下。三層修法：①`max-height:88dvh`（退回 `88vh`）+ `overflow-y:auto` + `overscroll-behavior:contain`；②主要動作 `position:sticky; bottom:0`；③**`@media (max-height:740px)` 壓縮內容**（縮圖形、收留白），讓它一屏放得下。⚠️ 只有第 ③ 層在容器裡驗得到 —— headless 的版面視口等於視覺視口，iOS 那個差異重現不了 |
| 同一個尺寸同時寫在 CSS 與 JS | **尺寸也只能有一個來源。** 2026-08-09 實例：`drawResultArc()` 寫死 `size=176` 又自己設 `canvas.style.width/height`，把 CSS 蓋掉 —— 於是短視窗的 media query 完全無效。改成 CSS 變數（`--result-arc`）當唯一來源，JS 讀 computed 寬度只決定 canvas backing store |
| 全屏儀式頁 CTA 被 iOS 底部工具列蓋住 | `100vh` 陷阱 → 一律 `100dvh`（保留 `100vh` fallback）+ 容器 `overflow-y:auto` 保險 |
| 改了模式/文案，實機某一步仍冒舊文案 | preview 指示文案有**兩層**：靜態 HTML（如 `#scan-banner` 寫死的 title/sub/icon）+ JS 動態 writer（如 `#scan-guidance`）。改模式要**兩層都 grep**（2026-07-08 臉部文案第 3 度漏網就是只改了 JS 層） |
| 修了 JS 但 founder 手機行為沒變 | script 標籤用**固定** `?v=` 字串（如 `?v=stardust_restore_v2`）＝ CDN/Safari 永遠供舊檔。**改 preview JS 必 bump `?v=` 成新字串**，並提醒 founder 硬重載。⚠️ CSS 的 `<link>` 同樣要 bump（2026-08-01 漏過一次：改了 takeover 的 JS 卻沒動 `?v=gyro_v5`） |
| 某個區塊點不動 / 滑不動 / 「被遮擋、位置跑掉」，但畫面上看不到任何東西蓋著 | **先 `document.elementFromPoint(x, y)` 問瀏覽器那個點到底命中誰**，不要盯著 CSS 猜。全屏疊層（v6 的 `#stardust-scan-takeover`）用 `opacity:0` + `pointer-events:none` **擋不住 descendant 自己宣告 `pointer-events:auto`** —— 指紋鈕就是這樣，一顆 124px 的隱形按鈕長期浮在 Today 上，在 760px 以下可視高度剛好壓在 Snapshot 輪播卡正中央，左右滑與上下捲一起被吃掉（2026-08-01 founder 回報才查出，main 上已存在很久）。**修法**：`#overlay:not(.active){visibility:hidden}` —— visibility 會繼承且不會被 descendant 的 `pointer-events` 推翻，比逐一 scope 每條 `pointer-events:auto` 穩。 |
| 畫面上要顯示一個東西的「代號 / 型號 / 分類」 | **內部 id 一律不上畫面。** 2026-08-09 實例：模板標題寫成 `nameZh（tpl.id）`，於是畫面出現「高 RS 突破流程（MODE_2）」—— 而在 Adam Mancini 的語彙裡「Mode 2」指的是**盤整日盤勢**，跟那個模板完全兩回事。⚠️ 最值得記的是：**repo 早就知道**（`packages/engine/src/session/templates.ts` 與 `docs/TRADING-METHODOLOGY.md` 都寫著那個 id 只是 persisted contract 的歷史遺留），知識在文件裡卻從介面漏出去。修法：另建一張 **顯示用代號表**，內部 id 留給儲存層。領域術語尤其危險 —— 你的內部命名可能剛好是使用者專業詞彙裡的另一個東西 |
| 要做「像某個專業工具」的介面（彭博 / 終端機 / 儀表板） | **那是一種排版形式，不是「拿掉裝飾」。** 2026-08-09 實例：我提「拿掉 emoji、加分隔線」，founder 直接回「**少了 彭博終端機**」。終端機的要素是具體且可列舉的：欄位表頭 + hairline、`1)` `2)` `3)` 列編號、硬邊（`border-radius:0`、無陰影漸層）、欄位固定寬對齊、頂端狀態列、等寬 + `tabular-nums`。⚠️ 兩個在地化判斷：①**等寬只給拉丁與數字**，中文維持比例字體 —— 等寬 CJK 每個字撐成全形方塊，密度垮掉還斷行在奇怪的位置；②**抄排版不抄配色** —— 彭博琥珀色會撞掉 TENKI 的 gold=SECURED 語意 |
| 沙箱擋掉某個 CDN，那條路「測不到」 | **先看產品碼是透過哪個全域取用它 —— 塞個 stub 進去往往就能測到真的產品邏輯。** 2026-08-08 實例：MediaPipe 被擋，tier A（landmark）整條路本來完全沒有自動化覆蓋；但 `readiness-scan.js` 只用 `window.FaceMesh` 一個全域，harness 用 `addInitScript` 塞一個假的（`onResults` 把 callback 存起來），就能自己餵 landmark 把「取景判定 → 遲滯 → 鎖定」整條鏈跑起來 —— 測到的是**真的產品程式**，不是加 class 演戲。⚠️ 界線要講清楚：這樣測到的是邏輯，**畫面長相仍然只有實機能判** |
| 寫 Playwright harness 驗 preview，結果一片 FAIL | **先懷疑 harness，不要先改產品碼。** 2026-08-04 一輪內連踩四次、產品碼四次都是對的：①sheet 的 class 是 `show` 不是 `open` ②`setStrainSilent` 是 `<input type=checkbox>` 用 `.checked`，不是 class toggle（照 class 點下去反而把預設開啟的設定關掉）③`#resultRate` 開場先被塞佔位字串，真值要等弧掃完的 `reveal()` ④真值本身是 600ms 遞增動畫，`waitForSelector` 一過就讀會拿到 p≈0 的那一幀。**規則**：斷言前先 `waitForFunction` 等「終值特徵」出現，再輪詢到**文字不再變動**為止；選擇器一律去 HTML 裡 grep 確認，不要照直覺猜 |
| 水平輪播卡片上下滑不動 | 橫向輪播的 `touch-action` 不能只寫 `pan-x` —— 那會把垂直手勢整個吞掉。祖先是垂直捲動容器時要寫 `pan-x pan-y`（瀏覽器仍會把偏水平的拖曳判給輪播，因為祖先不能水平捲）。症狀：卡片被下方 bar 切掉，而卡片本身正好是唯一捲不動的地方 |
| 要調 readiness 帶位/信心門檻（實機校準） | 門檻活在**四個地方**，只改一處會靜默分岔（CI 紅或 preview 與 domain 行為不一致）：①`domain/src/policies/readiness-band.ts` 常數本尊（`CLEAR_AT`/`NEUTRAL_AT`/`HIGH_CONFIDENCE_AT`/`MODERATE_CONFIDENCE_AT`/三個 `WEIGHT_*`）②`apps/preview/readiness-scan.js` 的鏡射版 ③`apps/preview/decision-alert.js` 的新鮮度/語彙鏡射 ④`domain/src/__tests__/readiness-band.test.ts`（22 個 Jest 有斷言綁在門檻上，如 stillness 0.95→clear、0.55→neutral、0.05→strain）。**四處必須同一次改完**。preview 是 vanilla JS 不能 import domain，鏡射是刻意的慣例，不是可以順手消除的重複。⚠️ 眨眼的 `BAND_BELOW`/`BAND_ABOVE` **不在這四處之列** —— 它們住在 `apps/preview/blink-cadence.js`，正規化成 0..1 的 `regularity()` 也刻意放在同一支檔案；要換算眨眼時**呼叫它、不要在呼叫端重寫比值**，否則這條會變成五處 |
| 覺得 evidence 某一欄「量不到、誠實留 null 就好」 | **先 grep 現有 surface 有沒有那個訊號源再下結論**。2026-08-01 踩過：把 `blinkCadence: null` / `tier: 'B'` 寫成「刻意的誠實邊界」寫進 PR 與 commit，實際上 v6 早就載了 MediaPipe、takeover 早就接了 `TENKI_BLINK` —— 是沒接，不是量不到。**代價不只是少一個欄位**：拿殘缺 evidence 去做實機門檻校準，接上真訊號源後量測基準就變了，整輪校準作廢 |
| canvas 波形／圖表空白但數字會動 | 不要在某個時間點抓 `offsetWidth`（splash/takeover 蓋著時是 0）→ 用 **ResizeObserver** 自我修復，或給 canvas 固定 `width/height` 屬性 |
| flex 容器裡的橫向 scroll-snap carousel 塌成 0 高 | 容器要 `flex:none` + 明確高度 + `overflow-y:hidden`（否則 overflow 自動升級成雙軸 scroll，`min-height:auto` 變 0） |
| 卡片內容被底部 bar 遮住 | `.screen` 是 absolute 定位，`.screens` 的 padding 對它無效 → 每頁 body **自帶** FDCB+tabbar 底部預留；carousel 用固定高不用 `flex:1` |
| 固定高卡片（如 190px snap-track）內容溢出 | 卡片內容要算高度預算；加 checklist 項目後回頭檢查 end screen 是否還 fit |
| 暫時性提示/膠囊看不到 | `overflow:hidden` 容器會裁掉它 → 改 `position:absolute` 浮層 + `pointer-events:none`；父層 `position:relative` |
| 修好 hint 但使用者還是看不到 | 壞掉版可能已在不可見狀態把 localStorage seen-flag 燒掉 → **修 hint 時升 storage key** |
| 新加的子元素被莫名動畫控制 | `.snap > *` 等萬用 entrance 動畫會套到新子元素 → 該元素補 `animation:none` |
| 可捲動頁面的高對比 overlay 邊緣滑進內容 | `absolute inset:0` 只蓋第一個視窗高 → 高對比 overlay 用 `position:fixed` |
| v6/index.html 加 CSS override 沒生效 | 同權重「早寫的必輸」— override 要嘛放對應基礎規則**之後**、要嘛提高權重（如 `.screens .screen`）；改完一律 headless 截圖驗過才算數（2026-07-03 同 session 踩兩次） |
| 想讓 `.screen` 在短視窗捲動 | 光開 `overflow-y:auto` 沒用：`.snap` 是 `flex:1`（高度=剩餘空間，永不撐開容器），內容在它體內溢出到 bar 底下 → 同時要 `.snap{flex:0 0 auto}`（取自然高度）+ 子元素 `flex-shrink:0`；驗收看 `scrollHeight > clientHeight` |
| 雙環/hero 尺寸 | **founder 拍板（2026-07-03）：V6 原比例 `min(72vw,300px)` 鎖定，任何視窗都不縮** — 短視窗用捲動解，不准再上「自適應縮環」方案 |
| iPhone Safari 直接 crash（OOM） | 禁 `mix-blend-mode: screen`；`backdrop-filter` blur 值收斂（32px→4px 曾是修法） |
| 想用震動回饋 | **iOS Safari 網頁完全不能震**（`navigator.vibrate` 無效）→ 真震動只能原生 app |
| 慢速指標（如 Body Battery）要「動起來」 | 別做即時跳動 = 謊報；誠實做法 = 一次性進場 + 極微呼吸 + 只有「當下」那格真的動 |
| 動效「誠實細微」到看不見 | 幅度 <1px 等於沒做 → 設肉眼可見下限，以裝置實看為準 |
| 每幀動畫效能 | 只寫 `transform`/`opacity`（GPU 友善）；待機 `transition:none` 避免 smear |
| 改「金沙球 / Securing 幕」 | 在 `apps/preview/soul-enroll.js` 的 `drawProcessingOrb()` — **不是** `v6/stardust.js`（那是另一顆 three.js 星塵球） |
| 動 onboarding overlay | 不可重構 `soul-enroll.js` 的掃描 FSM；`Enable Camera` 必須是真 user tap 內呼叫 `window.TENKI_ENROLL.begin()`（相機權限依賴手勢） |
| CDN 資源（GSAP/Three/MediaPipe/Inter） | 雲端沙箱擋 CDN → 容器內只能結構性驗證；動效手感一律留給 founder 實機 |
| 任何 UI 顯示生理數值 | **不得放假的生理讀數**（曾移除假 "HR 87 bpm"）；demo 值要明顯是合成示意 |
| 看到 `styles.css` 的 `--tenki-accent-*` 調色盤（#c97b2f 金）想併入 tokens.css | **不要** — founder 2026-07-03 拍板保留：出自參考截圖的刻意掃描流視覺，不是漏收斂的 bug |
| TradingView alert 觸發、TV 自家通知有跳,但快訊沒進 TENKI | 先調 **Vercel MCP `get_runtime_logs`** 看 `POST /api/alert` 狀態:**400 = payload 不合格（最常見:webhook URL 漏 `&symbol=`,`symbol` 是 schema 必填）**;**404 = 頻道不符（PWA/Safari/重設連結會換頻道,webhook 指到舊的）**。**根治已上線**:①`/decision-alert/`（`?v=alert13+`）**快訊網址產生器**把 symbol 烤進「複製連結」（UI 端）② **頻道預設 symbol**（`?v=alert16` 起頁面綁定、`api/alert.ts` 回填）讓裸連結也 200（server 端兜底）。仍 400 表示該頻道**沒綁到預設 symbol** → 請 founder 開 `/decision-alert/`（PWA）填標的一次即綁定。⚠️ **iOS Web Push 只在『加入主畫面』的 PWA 才會背景跳,Safari 分頁不算**;且推播訂閱與 webhook 必須同一頻道（2026-07 三度踩「裸連結漏 symbol」+ push 沒跳才提煉此條） |

## 7. apps/mobile / engine 陷阱

| 情境 | 規則 |
|------|------|
| mobile 需要 engine 邏輯 | mobile **不 import** `packages/engine`（runtime 無 alias）→ 慣例是 `utils/` 自帶 mirror（如 `pulse.ts`、`maturityStage`）；**改其一必須兩邊同步** |
| 跨屏傳遞流程狀態 | 用 store 旗標（如 `entryContext: 'onboarding' \| 'standalone'`），**別用 query param**（param 活不過多屏 `router.push` 鏈） |
| `utils/` 目錄 | **永遠不 import react-native** — jest contract harness 依賴這個約定；純邏輯放 utils、hook 只 re-export |
| vision-camera v5 | permission API 在 `VisionCamera` factory 上，不在 `Camera` 元件上 |
| Scan tab | `(tabs)/scan.tsx` 只做路由儀表板，**capture 流程不得塞回去**（North Star 鐵律 1） |
| 引擎改動 | 先寫測試再整合；engine/scan 覆蓋率 ≥ 90%；純函式、platform-neutral |
| mobile 要 import `packages/*` | tsc 靠 tsconfig paths、**Metro 靠 `metro.config.js` 的 `watchFolders`** — 兩邊都要有，否則 tsc 綠但 runtime/web bundle 掛 |
| Expo Web 全白 + `import.meta` SyntaxError | zustand v5 ESM 被 web 'import' 條件選中 → metro.config 已把 zustand 釘到 CJS；新增類似 ESM-only 套件時比照處理。**不要**全域關 `unstable_enablePackageExports`（會弄壞 react-native→react-native-web alias） |
| Expo Web 報 "importing a module from 'react-native' instead of 'react-native-web'" | 有 native-only 套件（vision-camera/nitro 等）被頂層 import 進了 web 可達的模組 → 改 platform-split（`.native.tsx`）或 native 分支內 `await import()` |
| 想截 RN 畫面給 founder | `cd apps/mobile && npx expo export --platform web`（offline 模式）→ 本地 serve dist → Playwright 截圖。dev server（`expo start`）的 LogBox 在 web 會拉 RN internals，**用生產 export 別用 dev**。（`/face-baseline/` 公開網址與 app.json baseUrl 已於 2026-07-03 退場 — dist 不再入庫，僅本地截圖用） |
| 跑 `pkill -f <pattern>` | pattern 若出現在自己這條命令字串裡會自殺（exit 144）→ 用 `[x]` 技巧如 `pkill -f 'cli/build/[b]in'` |

## 8. 合規與文案（紅線）

- 禁用詞彙與安全替代表：`ANTIGRAVITY.md` §2.1；user-facing copy 過 `packages/engine/src/compliance/safe-copy`。
- `docs/brand.md` 的 dopamine/withdrawal/craving 內部語言**禁止**出現在 user-facing copy。
- `TEI` / `PR99` 禁止出現在新代碼（`scripts/check-vocab.sh` 會在 CI 擋；既有殘留如 v6 的 `tlTlTlTeiScore` id 屬已知債，另開任務清）。
- Zone 改名（Clear/Neutral/Strain → Baseline 語言）**尚未定案** — 不要自行 rename `EdgeZone` / `zone-config.ts`。
- 鎖定資產（polish 可以、redesign 不行）：`/story/` Hero + 星塵球（SYSTEM.md §8）、logo 與 lockup（ANTIGRAVITY.md §18）、
  Tier-1 taglines（`brand/TAGLINE-SYSTEM.md`）、星塵動效 v25.8.2 手感。

## 9. 東西在哪裡（快速定位表）

| 要找的東西 | 位置 |
|-----------|------|
| 金沙球（processing orb） | `apps/preview/soul-enroll.js` → `drawProcessingOrb()` |
| 星塵球（brand orb, three.js） | `apps/preview/v6/stardust.js`（`TENKI_STARDUST`） |
| 掃描儀式 FSM（web） | `apps/preview/soul-enroll.js`（vanilla IIFE） |
| Onboarding overlay（5-step） | `apps/preview/soul-onboarding.js` + `soul-enroll.html` `#onboarding` |
| 結果頁 / Today（web demo） | `apps/preview/v6/index.html`（=`/v3/` 同一頁，vercel rewrite） |
| Zone 色 / brand 色 canonical | `packages/shared/src/design-tokens.ts` consts + `apps/preview/tokens.css`（web 鏡像） |
| mobile 主題鏡像 | `apps/mobile/theme/index.ts`（keep-in-sync 註解） |
| Edge Score 8 因子 | `packages/engine/src/scoring/edge-score.ts` |
| 臉部基線 FSM（mobile） | `apps/mobile/features/face-baseline/`（SPEC.md 同目錄） |
| 路由 ↔ 部署對照 | `docs/DEPLOYMENT_MAP.md`（+ `.json`） |
| orb 截圖回饋迴圈 | `scripts/orb-tuner/`（`node shoot.mjs` → `out/*.png`） |
| logo master | `docs/assets/brand/tenki-mark.svg`（衍生資產一律由此輸出） |

## 9.5 Sub-agent（便宜模型）使用紀律

| 情境 | 規則 |
|------|------|
| 讓 sub-agent 跑會產生副作用的指令（`jest --coverage`、任何 build） | prompt 裡明定清理義務，或本體事後清理（2026-07-03 實例：coverage/ 產物被 Biome 掃到，lint gate 假紅） |
| 便宜模型回報異常（「lint 紅了」「測試壞了」） | **本體必須覆核再採信** — 它可能把自己污染環境的結果當成 repo 現況回報 |
| 兩個 agent 結論矛盾 | 本體親自跑一次關鍵指令裁決，別選邊猜（2026-07-03 實例：tei.ts 引用狀態，grep pattern 歧義） |
| agent 宣稱「零引用/可刪」 | 抽查其證據指令；刪除動作永遠由本體執行 |

## 10. 本檔維護規則（compound learning 制度）

> **改任何規則文件（含本檔）前，先讀 `.cursor/harness/05_maintenance.md`** — 三級權限（🟢自行新增教訓 / 🟡走PR標[制度變更] / 🔴先問founder）、踩坑紀錄格式、行數觸發的精簡協議、能力極限應對標準都在那裡。Fable 5 的交接判斷（驗證階梯、退化模式預警）見 `.cursor/harness/06_manifesto.md`。

1. **糾正即入檔**：AI 被糾正一次 → 當個 session 就把教訓寫進本檔對應段落（工程規則歸 CLAUDE.md，操作陷阱歸本檔）。
2. **二次即提煉**：同類教訓在 MEMORY.md 出現第二次 → 必須提煉成本檔一條「情境 → 規則」。
3. **MEMORY.md 是日誌、本檔是法典**：MEMORY.md 記「這次發生什麼」，本檔記「以後怎麼做」。日誌可以長，法典必須短（新增前先找同類條目合併）。
4. 規則失效或被推翻 → 刪改屬 🟡/🔴 級（見 05 協議），不留屍體（歷史在 git log 裡）。
