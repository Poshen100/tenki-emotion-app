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
| 3 | **Neutral 近白搶光** | `zones.neutral.bg = #E5E5EA` 近純白，在深空背景裡比 Clear/Strain 還搶眼，違反「中性 = 不需注意」 | 🟡 待拍板 |
| 4 | **Strain 紫語義打架** | `zones.strain.bg = #5E3A87` 是紫；紫在多數產品語彙 = premium/神秘，不是「警示/該休息」 | 🟡 待拍板 |
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

---

## 4. 儀式三時刻（✅ 已落地，GSAP）

引入 gsap 3.12.5（CDN），全程 `if(window.gsap)` 漸進增強 + 保留原 fallback；不破壞既有星塵手感（CLAUDE.md：v25.8.2 視覺體驗不能改）。

| 時刻 | 表面 | 做法 |
|------|------|------|
| **Edge Score 揭曉** | Today | rAF 計數 → GSAP timeline，`expo.out` 收斂 + lock 呼吸 |
| **星塵 climax 鎖定** | baseline takeover | 保留「极速运算」flicker，只把落地升級成 `back.out` snap-settle + gold SECURED 輝光（`.tei-secured` 吃 `--gold-secured`） |
| **掃描觸點呼吸** | takeover trigger | 不動既有 rAF fill/drain 物理（本就 pause-not-reset 平滑回抽）；只在 trigger core 加 EWMA-slow idle breath（`sine.inOut` infinite yoyo），hold 時 pause、放開 resume、climax kill |

原則：**GSAP 只驅動「儀式生命感」，不接管已被調好的輸入驅動物理。**

---

## 5. 兩個待拍板的設計決策 🟡

兩者都是會動到「產品可見語義」或「合規 copy」的決策，需 founder 拍板，不由 AI 擅自代決。

### 5.1 Zone 語義重定
現值：`clear #00B4D8` · `neutral #E5E5EA`（近白搶光）· `strain #5E3A87`（紫語義打架）。

建議方向（提案，未實作）：
- **Neutral 降亮**：改成深空裡的低彩度灰藍，傳達「中性 = 不需注意」，把注意力讓給 Clear 與 Strain。
- **Strain 改暖警示**：從紫換成低飽和暖橙/琥珀系，符合「該休息/降速」的直覺語義。
- **紫色保留給 Premium**：讓紫回到它在產品語彙裡的位置（付費/進階），避免與 zone 警示混淆。

阻擋點：zone 顏色牽動 Compliance Layer 的 user-facing copy 與既有畫面，需先做一次 compliance + 畫面盤點再動。

### 5.2 soul-enroll / finger-demo 招牌電光藍
`apps/preview/soul-enroll.*` 與 `finger-demo.html` 各自用局部 `--cyan / --cyan-glow = #00F0FF`，內部自洽。
是否併入 cyan token 系統（改 `cyanActive`）屬「改招牌色」的設計決策，非單純收斂 → 留給 founder 決定是否動。

---

## 6. 維護規則

- 任何顏色只能引用 token，不得寫裸 hex（canvas 例外：用 `getComputedStyle` 解析 CSS 變數，見 `apps/preview/scan-result.js`）。
- 新增 cyan/gold 用途 → 先回到本檔的「世界規則」判斷該用哪一階，再加 token。
- 被糾正一次 → 更新本檔 + `CLAUDE.md`（compound learning）。

*最後更新：2026-06-20 · Claude Code（視覺方向 session）*
