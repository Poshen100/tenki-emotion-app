# TENKI CORE — 視覺方向書 (Visual Direction)

> 創意總監級的視覺定調 + 系統性破口盤點。
> 本檔記錄「為什麼這樣設計」，搭配 `packages/shared/src/design-tokens.ts`（值的 source of truth）與 `apps/preview/tokens.css`（瀏覽器端 token 鏡像）一起看。
> 狀態標記：✅ 已落地 / 🟡 待 founder 拍板（設計/合規決策）。

---

## 1. North Star — 一句話定調

> **TENKI 是一台「會冷靜讀你的精密儀器，活在深空裡」。**

- 不是 trading terminal 的科幻電競感，不是 wellness app 的柔焦療癒感。
- 是 **instrument-grade**：安靜、精密、可信任；數字像被量出來的，不是被慶祝出來的。
- 活在 **深空背景**（單一 `spaceBg`），讓 cyan 的「活訊號」與 gold 的「鎖定」浮出來。
- 完成時刻 **不彈窗慶祝** → 星塵收束成穩定核心，先給結果、再解釋（見 `docs/SOUL-SCAN-NORTH-STAR.md` §2.5 / §4）。

---

## 2. 五大系統破口（盤點）

| # | 破口 | 症狀 | 狀態 |
|---|------|------|------|
| 1 | **五種 cyan 漂移** | `#00F0FF` / `#22D3EE` / `#20D7F2` / `#23F3D4` / `#00B4D8` 散落各處，同一表面互打架 | ✅ 已收斂 |
| 2 | **gold = SECURED 沒進 token** | 「鎖定/校準完成」的金色是埋在 takeover 裡的 magic number | ✅ 已 token 化 |
| 3 | **Neutral 近白搶光** | `#E5E5EA` 近純白搶光 → 改 `#64748B` 低彩度 slate，退進深空 | ✅ 已重定 |
| 4 | **Strain 紫語義打架** | `#5E3A87` 紫 → 改 `#C2703D` 暖琥珀/餘燼，符合「該休息」警示語義；紫留給 session/Premium | ✅ 已重定 |
| 5 | **字體雙頭 source** | tokens 寫 `SF Pro Display/Text`，preview 端混用 Inter；缺單一 type source | 🟡 待拍板 |

---

## 3. 色彩脊椎（✅ 已落地）

單一真相源：`design-tokens.ts` 的 `brand` group + 頂部 `CYAN_* / GOLD_SECURED / SPACE_BG` consts；瀏覽器端鏡像在 `apps/preview/tokens.css`。

### 世界規則
> **cyan = ACTIVE / live（活訊號）　·　gold = SECURED / locked（鎖定）**

| Token | 值 | 用途 |
|-------|-----|------|
| `cyanCore` | `#00B4D8` | 靜態品牌藍、Clear zone、靜息狀態（= `colors.primary`） |
| `cyanActive` | `#22D3EE` | 互動藍：掃描中 / live / in-progress（取代 #00F0FF、#20D7F2、#23F3D4） |
| `goldSecured` | `#FFD46E` | 鎖定金：baseline locked / 校準完成（North Star §4） |
| `spaceBg` | `#020617` | 統一深空背景（取代混用的 #000 / #070e17 / #020408） |

兩階 cyan 取代五種：**靜態用 core、活訊號用 active**。電光藍 `#00F0FF`（電競感）退出共用表面。

### 星塵的色調層（✅ 2026-08-10，founder 指示「更多層次 + 每次掃描都感應使用者變色」）

星塵不再只有一組固定漸層，但**身分不讓位**：cyan→purple→pink 仍是靜息時的樣子，
變化是疊加在它上面的色相旋轉 + 往當下顏色的收束（`stardust.js` 的 `setTone()`）。
🔴 **預設值是恆等變換** —— 沒呼叫它的頁面渲染結果一個位元都不變，v25.8.2 的鎖靠這個結構性質守住。

| 時刻 | 顏色與形態 | 依據 |
|------|------|------|
| 靜息 | cyan→purple→pink 原樣（彩度跨度 88） | — |
| 量測中·晃動 | 完整基礎漸層、飽和度地板 1.20（不洗白）、尺度 ×1.18、暗 | `stillness` 低 |
| 量測中·穩住 | **色相沿螺旋散開，彩度跨度衝到 216**、尺度 ×0.86、亮 | `stillness` 高 |
| 量測中（累積） | 整場色相走過 ≤0.20 turn 的旅程 + 亮度 +0.10 | `heldMs/budgetMs` —— **只在閘門通過時前進** |
| SECURED 那一拍 | `goldSecured`，mix 0.8 | 跟光弧同一拍。**沒有讀數就不准上 gold** |
| 收束停留 | `--zone-clear` / `--zone-neutral` / `--zone-strain`，mix 0.85 | 該次帶位 |

（收束時 `clearReadout()` 先關掉散開，再由 `setTone()` 把顏色交給結果 ——
交接點明確，兩個寫入者不會搶同一個通道。）

🔴 **顏色只會變多，不會變少。** 彩度跨度全程 **87–216**（靜息 88）。
2026-08-10 走過一段彎路：為了讓「穩 vs 晃」好辨認，曾把穩定狀態做成
**收成單一青色**，結果在正常握穩的 85–95% 穩定度下彩度跨度只剩 **4–36** ——
founder 連續三次回報「顏色變化很少」。**他要的是豐富，那一版做的是統一。**

🔴 **色域守則守的是「整顆球的主色」，不是每一顆粒子。**
星塵是大面積、流動的多色場，不是訊號燈 —— 單顆粒子是綠的不會被讀成 good。
把每顆都擋在語意色外面，可用色域只剩青紫粉一小段弧，那就是顏色出不來的根源。

⚠️ 新守則自己的陷阱，而且它當場抓到過：**色相散太開，整顆的平均色會趨近灰，
而灰就是 `--zone-neutral`（Neutral 帶位）**。

🔴 **卡住這件事的是「色相旋轉」，不是 bloom**（2026-08-11 修正）：
旋轉 0.24 → 撞 coral ΔE 19.1 ❌、0.32 → 7.5 ❌，所以 **0.20 是硬上限**；
bloom 反而一路到 0.40 都不影響主色（ΔE 維持 32.7），0.52 才開始蝕本（27.4）。
現行 bloom **0.40** 是那個膝點，主色 ΔE **32.7** ✅。

⚠️ **這個結論是推翻我自己前一版寫的數字得到的。** 舊的守門員假設
「色帶 ↔ 高度一一對應」，而色帶改成螺旋之後那個模型就不成立了 ——
它算出的「bloom 0.28 已到頂」是模型的產物，不是產品的性質，我還照著它挑了參數。
**換了模型就要把所有量測值重算一遍**，過期的數字比沒有數字更危險。

🔴 **色帶走螺旋**（高度 0.62 + 方位角 0.38）：顏色同時在上下與繞球兩個方向變，
所以同一高度的粒子會落在不同色帶。純上下漸層是 founder 連三次說「顏色變化很少」
的其中一層原因。守門員因此必須掃 base（12 段高度）× band（16 色帶）的全組合。

⚠️ 材質是 `AdditiveBlending`：密集區疊加到白，**同色系內的飽和度/色相差異會被壓掉**。
想做出可讀的差異只能靠「顏色的**組成**變了」（散開/收攏）或幾何（尺度），
不能只調飽和度。

🔴 **`stillness` 要先重映射再用**：0..1 是它的定義域，不是它會走到的範圍。
實測讀數是 63/87/93%，而 `LANDMARK_STILL_GATE = 0.5` 是閘門門檻 ——
真正的工作區間是 `0.5 → 0.95`。低端**錨在閘門門檻上**（閘門不過 = 視覺最散），
畫面的極值與量測自己的判準對齊。不重映射就有一半以上的視覺預算永遠用不到。

⚠️ 收束的 mix 從 0.5 提到 0.85 也是實走的結果：0.5 時**看不出是哪個帶位** ——
漸層底部本來就是 cyan，往 Clear 拉等於沒拉，三種帶位長得幾乎一樣。
⚠️ 顏色吃的是量得到的東西，**不是情緒推論**；不得有 user-facing 文案往那個方向講。

---

## 3.5 儀器級版面：借彭博的結構與字體，**不借它的琥珀**（✅ 已落地）

founder 2026-09-05 傳了彭博終端機的交易確認畫面當參考：
「讓使用者覺得自己使用的是頂級專業交易者平台」。

### 🔴 動手前先量顏色 —— 彭博的招牌色在這個產品裡已經有三個主人

| 顏色 | hue | 誰的 |
|---|---|---|
| `zoneStrain` `#C2703D` | 56.0° | **該休息**（警示語義）|
| **Bloomberg 琥珀** `#FFA028` | **69.1°** | — |
| `--warning` `#F5A623` | 74.7° | 警告（**ΔE 只有 7.5，肉眼同一色**）|
| `goldSecured` `#FFD46E` | 86.4° | **SECURED / 鎖定** |

彭博琥珀正好落在「該休息」與「鎖定」中間。**鋪成主色＝同時弄壞兩個語義。**
founder 拍板：**只借結構與字體，主色維持 cyan。**
cyan-on-black 的儀器感一點都不輸 amber-on-black。

⚠️ 順帶一個值得記的巧合：founder 另一張網路設計截圖的橘色主鈕實測是
`#F5A623` —— **跟本 repo 的 `--warning` 一模一樣（ΔE 0.0）**。
「我在網路上看到的漂亮橘色」很可能就是你自己 token 裡那個警告色。

### ⚠️ §1 North Star 那句「不是 trading terminal」不是在擋這件事

North Star 寫「**不是 trading terminal 的科幻電競感**」—— 擋的是**霓虹電競儀表板**。
同一段的正面定義是「**instrument-grade：安靜、精密、可信任；數字像被量出來的，
不是被慶祝出來的**」，而彭博終端機正是那句話的實體：不美化、不慶祝、密排、對齊。
**儀器級版面跟 North Star 同向，不是例外。**

### 這套語言長什麼樣（值的來源：`apps/preview/decision-alert.html`）

| 元素 | 值 |
|---|---|
| 狀態列 / 欄位表頭 | 9~10px、字距 0.08~0.14em、`#4A5568`~`#64748B` |
| 分隔 | `1px solid var(--border)` hairline，**零圓角零陰影** |
| 欄位對齊 | 標籤欄**固定寬**（模板表 96px、收束頁 62px）—— 固定寬才是對齊的來源 |
| 等寬 | `var(--mono)`（tokens.css），`font-variant-numeric: tabular-nums` |
| 強調 | `--cyan-active`（= ACTIVE），**不是琥珀** |

🔴 **等寬只給拉丁字母、數字、代號、時鐘。中文一律比例字。**
等寬 CJK 會把每個字撐成全形方塊，密度整個垮掉還斷在奇怪的地方
（實測截圖：「Mancini 招 / 牌結構」）。**彭博的密度來自對齊與克制，
不是來自「所有東西都用 mono」。** `preview-strip-color.mjs` 有兩條斷言擋著。

### 落地範圍

| 表面 | 狀態 |
|---|---|
| `/decision-alert/` 模板表 | ✅ 2026-08-09 |
| `/decision-alert/` 收束頁 | ✅ 2026-09-05 |
| `/decision-alert/` 快訊入口面板 | ⬜ 未做 |
| `/v3/` 計時器底座與判定列 | ⬜ 未做 |

⚠️ 收束頁在 660px（in-app 瀏覽器）的高度預算**只有 ~19px**
（sheet 561 / 上限 88dvh = 580）。往這一頁加任何東西之前先量，
`@media (max-height:740px)` 是買空間的地方 —— 壓留白，不砍欄位。

---

## 3.6 `v6/index.html` 的顏色盤點（📋 只記錄，2026-09-06 未動任何值）

`§2 破口 1`（五種 cyan 漂移）修的是 `tokens.css`。但 **`/v3/` 有自己的 `:root`**，
而真正的漂移住在那裡。這一節是逐項量出來的結果 —— **不是設計提案，是現況帳**。

🔴 **重跑：`python3 scripts/audit-v6-colors.py`**（方法寫在檔頭）。
這一節每個數字都由它產生 —— **上一輪那個灌水的「72 種寫死色」正是肉眼＋壞正則的產物**，
所以這次連量法一起 commit。它**不是 merge gate**（不進 `verify.sh`），是一份可重跑的帳。

### 🔴 先修掃描方法，因為上一輪的數字是錯的

| 方法 | 結果 |
|---|---|
| 三位數 hex 正則直接掃全檔（**上一輪用的**） | 81 種 / 243 處 |
| **先剝掉註解再掃**（正確） | **76 種 / 235 處** |
| 被誤算成顏色的 | `#103` `#106` `#121` `#148` `#231` —— **全是中文註解裡的 PR 編號** |
| 🔴 `rgba()` / `rgb()` 字面 | **372 處** |

**真正的量體是 `rgba()`，不是 hex。** 只掃 hex 等於漏掉四分之三 ——
而「72 種寫死色」那個數字同時灌了水又低估了規模。

### ① 私有 `:root` 的 18 個顏色 token —— 一半是死的

對比是對地面 `--n-950 #020617` 與底座 `--n-900 #181E26` 各量一次。

| token | 值 | 用量 | 地面 | 底座 | 裁決 |
|---|---|---|---|---|---|
| `--primary` | `#00B4D8`（**被模板覆寫**）| 61 | 8.18 | 6.80 | 🔴 見 ② —— 它不是一個顏色角色 |
| `--txt-sec` | `#8E8E93` | **69** | 6.19 | 5.14 | 🔴 **併進中性階**（見 ③）|
| `--good` | `#34C759` | 35 | 9.09 | 7.55 | ＝ `--success`，重複宣告 → 併 |
| `--txt-dim` | `#48484A` | 12 | **2.21** | **1.84** | 🔴 見 ③，且對比不足 |
| `--warn` | `#F5A623` | 12 | 9.95 | 8.27 | ＝ `--warning`，且見 ④ → **退場** |
| `--surface` | `#1C1C1E` | 4 | — | — | ＝ tokens.css，併 |
| `--txt` / `--fdcb-complete` / `--fdcb-border` / `--tabbar-bg` | — | 各 1 | — | — | 併或就地展開 |
| `--zone-clear` / `--zone-neutral` / `--zone-strain` | 三個帶位色 | **0** | — | — | 💀 **死宣告**，見 ③ |
| `--bg` `#000` | ≠ `--bg-space #020617` | **0** | — | — | 💀 死，且是地面曾漂過的證據 |
| `--card` / `--border` | ＝ tokens.css | **0** | — | — | 💀 死 |
| `--sns` `#FF6B35` / `--pns` `#00B4D8` | 自律神經色 | **0** | — | — | 💀 死，**零風險可刪** |

⚠️ **`--sns` / `--pns` 的「零風險」是這一輪才成立的**：`f1cfacd` 把三段軌從 `--sns`
換成中性階，順手拿掉了 `--sns` 的最後一個消費者。
在那之前我對 founder 說過「動它會掃到 Session / Timeline / vitals」—— **那句話現在是錯的**。

### ② 🔴 模板身分色沒有自己的色域 —— 它是跟語義色借的

`--primary` 不是「品牌主色」，是**當下選了哪個模板**的別名。而六個模板的顏色是：

| 模板 | 值 | L* | hue | 底座對比 | 這個值的主人 |
|---|---|---|---|---|---|
| Canslim GS | `#00B4D8` | 67.7 | 228.6° | 6.80 | **＝ `--zone-clear` / `--cyan-core`** |
| Canslim High RS | `#00B4D8` | 67.7 | 228.6° | 6.80 | **同上** |
| Work Focus | `#00B4D8` | 67.7 | 228.6° | 6.80 | **同上** |
| Mancini FBD | `#5E3A87` | 32.2 | 310.9° | **1.94** 🔴 | 自己的值（但不可讀）|
| Health Stress | `#34C759` | 71.1 | 144.3° | 7.55 | **＝ `--success` / `--good`** |
| Exercise | `#FF6B35` | 63.4 | 46.5° | 5.91 | **＝ `--sns`** |

**六個身分色來自三個語義主人加一個不可讀的紫。** 這就是紫時鐘那個 bug 的根 ——
不是「有人挑錯顏色」，是 **`--primary` 這個概念本身把「哪一個模板」跟「這是什麼東西」綁在一起**。

🔴 **而它還在說話**：`.fdcb-fill`（進度填充）吃 `var(--primary)`，所以
**Health Stress 跑起來時那條進度條就是 `--success` 綠** ——
一個決策還沒有結果，畫面已經在用「跟著流程完成」的語意色畫它。
（`f1cfacd` 保留 `#fdcbFill` 的理由是「它是唯一真的在講進行中的東西」，
**這一條量完之後那個理由只對五個模板成立**。）

### ③ 兩個家族的破口本體，就是這一頁最常用的兩個文字色

`--txt-sec`（69 處）與 `--txt-dim`（12 處）是 **iOS 系統灰**（彩度 ≈ 0），
而新立的中性階是 268° 的藍調 slate。**這一頁的次要文字與最弱文字，全部不屬於那個家族。**
`--txt-dim` 對地面只有 **2.21:1**、對底座 **1.84:1** —— 兩個都不到任何門檻。

而三個帶位色**在這一頁有三份宣告**：`tokens.css` 一份、v6 `:root` 一份（0 用量）、
以及 `BAND_COLOR_V6 = { clear:'#00B4D8', neutral:'#64748B', strain:'#C2703D' }`
（`:5151`，**JS 裡寫死**）—— 實際被用的是第三份，前兩份都繞過去了。

### ④ 🔴 琥珀離 `--warning` 太近，而我挑它的時候沒量這一組

| 色盲 | 最近的一組 | ΔE | 正常視覺 |
|---|---|---|---|
| 綠色盲 deuteranopia | **`amber-400` × `--warning`** | **0.6** | 7.5 |
| 藍黃盲 tritanopia | 同上 | 1.8 | 7.5 |
| 紅色盲 protanopia | 同上 | 3.1 | 7.5 |

挑琥珀時我量的是它離 `gold`（31.0）與 `strain`（34.5）多遠 ——
**沒量它離 `--warning` 多近**。正常視覺就只差 ΔE 7.5，綠色盲下 **0.6，等於同一個顏色**。

→ **所以「`--warning` 退場」不是可選的清理，是鋪琥珀的前置條件。**
兩個同時在畫面上，「可以動手」與「警告」就是同一個顏色。

⚠️ `preview-token-scale.mjs` 的色盲守門**看不到這一組**：它只驗 `tokens.css` 裡
承載語義的 `-400` 階，而 `--warning` 不是 `-400`。守門綠，撞色仍然存在。

### ⑤ 暖色弧：六個主人擠在 50.1°

`error 36.3°` → `--sns 46.5°` → `zone-strain 56.0°` → `amber-400 69.1°` →
`--warning 74.7°` → `gold-secured 86.4°`。

⚠️ 上一輪我先說「三個」、後來更正成「五個」。**逐項量完是六個** ——
每次數都變多，因為每次都只掃了一部分的檔案。這一節的數字是**剝註解 + 含 rgba + 含 v6 私有 `:root`** 的版本。

### ⑥ 我的「發光計數」漏了一整類

上一輪的 68/11/34/31 只數 `box-shadow` / `text-shadow` / `radial-gradient` / `blur(`。
**沒有數 `filter: drop-shadow()`**：

| | box-shadow | text-shadow | radial-gradient | blur( | **drop-shadow** |
|---|---|---|---|---|---|
| `decision-alert.html` | 3 | 0 | 1 | 2 | **0** |
| `v6/index.html` | 61 | 8 | 35 | 33 | **19** |

對照組的結論沒有被推翻（彭博與收束頁兩邊都是 0，差距只有更大），
但 🔴 **其中一個 drop-shadow 就在底座上**：`.fdcb-tmpl .ic`（`:1546`）掛著
`drop-shadow(0 0 6px rgba(0,180,216,0.4))` —— 一個**寫死的青色光暈**，
即使圖示本身是綠的或紫的也照樣發青光。
**「儀器世界關燈」那一輪沒關掉它，因為我的量測方式看不見它。**

### 裁決摘要（等 founder 拍板，本輪未執行）

| 優先 | 動作 | 風險 |
|---|---|---|
| 1 | 刪 8 個死 token（`--sns` `--pns` `--bg` `--card` `--border` + 三個 `--zone-*`）| **零**（0 用量，可用 grep 證明）|
| 2 | 拿掉 `.fdcb-tmpl .ic` 的 drop-shadow | 極低，補完上一輪的關燈 |
| 3 | `--txt-sec` / `--txt-dim` → 中性階 | 中（81 處，但都是文字色，且會**修好** 1.84:1）|
| 4 | `--warning` / `--warn` 退場 | 中，**且是鋪琥珀的前置** |
| 5 | 拆開 `--primary`：模板身分 vs「進行中」 | 高，要先決定模板身分還需不需要顏色 |

---

## 4. 儀式三時刻（✅ 已落地，GSAP）

引入 gsap 3.12.5（CDN），全程 `if(window.gsap)` 漸進增強 + 保留原 fallback；不破壞既有星塵手感（CLAUDE.md：v25.8.2 視覺體驗不能改）。

| 時刻 | 表面 | 做法 |
|------|------|------|
| **Edge Score 揭曉** | Today | rAF 計數 → GSAP timeline，`expo.out` 收斂 + lock 呼吸 |
| **星塵 climax 鎖定** | baseline takeover | 保留「极速运算」flicker，只把落地升級成 `back.out` snap-settle + gold SECURED 輝光（`.tei-secured` 吃 `--gold-secured`） |
| **掃描觸點呼吸** | takeover trigger | 不動既有 rAF fill/drain 物理（本就 pause-not-reset 平滑回抽）；只在 trigger core 加 EWMA-slow idle breath（`sine.inOut` infinite yoyo），hold 時 pause、放開 resume、climax kill |

原則：**GSAP 只驅動「儀式生命感」，不接管已被調好的輸入驅動物理。**

### 4.1 Soul Scan 首屏 glow-up（✅ 已落地，`apps/preview/soul-enroll.js`）
第一個映入眼簾的畫面 = 「一台活在深空的精密儀器，正掃描一個有生命的靈魂」。
- **靈魂**（`drawParticles`）：cyan 點 → neural-lattice 星座（nearest-neighbour ≤3 連線 + depth sort，乾淨不蜘蛛網）+ 呼吸核心光暈 + 視差/緩慢公轉 + 偶發 twinkle。
- **框框**（`drawCorners`）：平角括號 → 精密 reticle（雙層發光 + 轉角發光節點 + 邊中測量刻度 + 呼吸）+ idle 掃描光線掃框。
- 全部以 `idle = 1 - 收束量` 收尾，capture/3D 階段照舊；headless Chromium 截圖驗證。

---

## 5. Zone 語義重定（✅ 已落地）+ 待拍板項

### 5.1 Zone 語義重定（✅ 已落地，founder 拍板：Neutral→slate、Strain→ember）
| Zone | 舊 | 新 | 語義 |
|------|----|----|------|
| Clear | `#00B4D8` | `#00B4D8`（= `cyanCore`） | 主角，不變 |
| Neutral | `#E5E5EA` 近白搶光 | **`#64748B`** 低彩度 slate | 退進深空，「不需注意」 |
| Strain | `#5E3A87` 紫 | **`#C2703D`** 暖琥珀/餘燼 | 暖警示，「該休息/降速」 |

- 單一真相源：`design-tokens.ts` 抽 `ZONE_NEUTRAL/ZONE_STRAIN` consts；`zone-config.ts` 指向 `TENKI_THEME.zones`；`apps/mobile/theme` 與 preview（tokens.css / styles.css / v6）為同步鏡像。text 統一白色。
- **不動 compliance copy**（`label`/`guidance` 與 `color` 是分開欄位）。
- **紫色保留**：`#5E3A87` 在 v6 還是 session/呼吸段語義（Exhale / Lock / MANCINI_FBD），不是 zone-strain，全部留著；紫之後可正式收給 Premium。

### 5.2 soul-enroll / finger-demo 招牌電光藍 🟡（待拍板）
`apps/preview/soul-enroll.*` 與 `finger-demo.html` 各自用局部 `--cyan / --cyan-glow = #00F0FF`，內部自洽。
是否併入 cyan token 系統（改 `cyanActive`）屬「改招牌色」的設計決策，非單純收斂 → 留給 founder 決定是否動。

---

## 6. 維護規則

- 任何顏色只能引用 token，不得寫裸 hex（canvas 例外：用 `getComputedStyle` 解析 CSS 變數，見 `apps/preview/scan-result.js`）。
- 新增 cyan/gold 用途 → 先回到本檔的「世界規則」判斷該用哪一階，再加 token。
- 被糾正一次 → 更新本檔 + `CLAUDE.md`（compound learning）。

*最後更新：2026-06-20 · Claude Code（視覺方向 session — 含 zone 重定 + Soul Scan glow-up）*
