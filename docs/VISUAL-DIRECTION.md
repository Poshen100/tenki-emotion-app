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
| 靜息 | cyan→purple→pink 原樣 | — |
| 量測中·晃動 | **完整 cyan→purple→pink 漸層**（三色階彼此 ΔE 92）、尺度 ×1.18、暗 | `stillness` 低 |
| 量測中·穩住 | **全部收成單一 `cyanActive`**（三色階彼此 ΔE 0）、尺度 ×0.86、亮 | `stillness` 高 |
| 量測中（累積） | 亮度再提升 0.10 | `heldMs/budgetMs` —— **只在閘門通過時前進**，是累積的有效量測，不是計時器 |

🔴 **「穩 vs 晃」必須是類別差異，不是程度差異。**
2026-08-10 founder 連續三次回報「看不出變化」，量出來的原因是：
粒子漂移 ×1.35→×0.55 的實際**位移差只有 2.2px**；尺度收緊 6% = 9px；
而材質是 `AdditiveBlending`，密集區疊加到白，**同色系內的飽和度/色相差異會被壓掉**
（截圖裡球心一片洗白就是它）。
唯一躲得過那個壓縮的是「顏色的**組成**變了」——一團彩色 ↔ 一顆單色。
⚠️ 因此 `stillness` 的視覺預算全部押在**顏色收斂**與**整體尺度**（32%）上，
粒子漂移退回質感（1.15/0.85），不再當訊號通道。
| SECURED 那一拍 | `goldSecured`，mix 0.8 | 跟光弧同一拍。**沒有讀數就不准上 gold** |
| 收束停留 | `--zone-clear` / `--zone-neutral` / `--zone-strain`，mix 0.85 | 該次帶位 |

🔴 **量測中的聚焦目標是 `cyanActive #22D3EE`，刻意不是 `cyanCore #00B4D8`** ——
後者就是 `--zone-clear`，也就是 Clear **帶位色**，收向它等於在還沒有結果時宣稱結果。
`cyanActive` 的語意本來就是「掃描中 / live / in-progress」，正是這一刻該講的話。

🔴 **飽和度下限 0.95 是 ΔE 掃描定出來的，不是手感挑的**：
「去飽和的青」會逼近 `--zone-neutral #64748B`（代表 Neutral 帶位）——
下限 0.70 時只有 ΔE 20.6。0.95 時全幅收斂仍有 25.8。
⚠️ 飽和度本來就不是可讀的通道（additive 壓掉），預算讓給顏色收斂與尺度。

🔴 **`stillness` 要先重映射再用**：0..1 是它的定義域，不是它會走到的範圍。
實測讀數是 63/87/93%，而 `LANDMARK_STILL_GATE = 0.5` 是閘門門檻 ——
真正的工作區間是 `0.5 → 0.95`。低端**錨在閘門門檻上**（閘門不過 = 視覺最散），
畫面的極值與量測自己的判準對齊。不重映射就有一半以上的視覺預算永遠用不到。

🔴 **色相只往藍紫一側，不得為負**（founder 2026-08-10 實走拍板）。
負向會把漸層底部的 cyan 轉成綠（hue −0.10 → `#00E48B`），而 **`--good` 就是綠 `#34C759`**
—— 等於在還沒有任何結果時亮起「good」。
上限 0.06 也是算出來的：+0.10 時頂端變 `#FF667C`，跟 Timeline「沒有做出判定」的
`#FF7E76` 幾乎同色。**這個範圍由 `preview-scan-stardust.mjs` 的 ΔE 掃描守著**
（對 `--good` / `--warn` / `zone-strain` / 未判定 coral / gold / `zone-neutral`
全部要求 ΔE ≥ 25；現行最小值 28.6）。

⚠️ 收束的 mix 從 0.5 提到 0.85 也是實走的結果：0.5 時**看不出是哪個帶位** ——
漸層底部本來就是 cyan，往 Clear 拉等於沒拉，三種帶位長得幾乎一樣。
⚠️ 顏色吃的是量得到的東西，**不是情緒推論**；不得有 user-facing 文案往那個方向講。

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
