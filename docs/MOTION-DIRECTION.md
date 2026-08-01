# TENKI CORE — 動效方向書 (Motion Direction)

> **地位**：TENKI 動效語言的 canonical（與 `docs/VISUAL-DIRECTION.md` 色彩脊椎並列）。
> 任何 AI（Antigravity / Claude / Copilot）做**任何動效**前必讀本檔 + 對應的 GSAP skill 包（§6 路由表）。
> 對標等級：Apple Watch Activity 的儀器感、Linear 的克制、Arc 的儀式感 — 不是「app 動畫」，是**精密儀器的呼吸**。

## 1. North Star — 一句話定調

**動效是儀器的生命跡象，不是介面的裝飾。** 每一次移動都必須回答：「這在告訴使用者身體的什麼事？」
答不出來的動效 = 刪掉。品牌語調（冷靜・科學・轉折力量）在時間軸上的表現就是：**慢進場、微呼吸、瞬間鎖定**。

## 2. 三條鐵律（違反 = 打回）

1. **誠實動效**：慢速指標不做即時跳動（Body Battery 教訓 — 24h 指標像均衡器跳 = 謊報）。動效幅度以「裝置實看可見」為下限（<1px 的誠實 = 沒做）。**絕不放假的生理讀數**。
2. **GPU-only**：每幀只寫 `transform` / `opacity`；待機 `transition:none` 防 smear；禁 layout thrash（讀寫分離）。詳見 `gsap-performance` skill。
3. **`prefers-reduced-motion` 是一級公民**：每個動效都要有靜態終態版（GSAP 用 `gsap.matchMedia()`；CSS 用 media query）。使用者開「減少動態」時畫面 snap 到最終狀態，不是壞掉。

## 3. Motion Tokens（canonical，已存在於 `apps/preview/tokens.css`）

| Token | 值 | 用途 | GSAP 對應 |
|-------|-----|------|-----------|
| `--ease-calm` | `cubic-bezier(0.22,1,0.36,1)` | 一般進場/狀態切換 | CustomEase `'calm'`（精確；退化時 `expo.out`） |
| `--ease-breath` | `cubic-bezier(0.4,0,0.6,1)` | 呼吸/idle 循環 | CustomEase `'breath'`（精確；退化時 `sine.inOut`） |
| `--ease-secure` | `cubic-bezier(0.19,1,0.22,1)` | 鎖定/確認落地 | CustomEase `'secure'`（精確；退化時 `back.out(1.2)`） |
| brand entrance | `900ms cubic-bezier(0.2,0.7,0.3,1)` | logo/lockup 入場（ANTIGRAVITY §18.4 定案） | — |

**Duration 音階**（不要發明新值）：`150ms` 微反饋 · `300ms` 狀態切換 · `600ms` 元素進場 · `900ms` 品牌入場 · `1400ms` 分數揭曉收斂 · `6s` 呼吸循環 · EWMA `α=0.05` 極慢收斂（數值類）。

> 📌 **CustomEase 精確曲線是 founder 拍板的定案（2026-08-01），不是可有可無的加分項。**
> 背景：`story.js` 一度只載入 CustomEase 卻從未呼叫 `CustomEase.create()`，導致具名 ease 永遠解析失敗、
> 每一拍都靜默 fallback 到近似值（PR #213 修正）。修好後 founder 在桌機把「精確曲線版」與「近似值版」
> 兩版並排實機比較，**選定精確曲線版**。
> 因此：`apps/preview/story.js` 的 `CustomEase.create('calm'|'breath'|'secure', …)` 三行**不可刪除**，
> 值必須與 `tokens.css` 的 `--ease-*` 保持一致（CSS `cubic-bezier(x1,y1,x2,y2)` → path `'M0,0 C x1,y1 x2,y2 1,1'`）。
> 看到「CustomEase 好像沒用到」時不要移除 — 先讀本註記。近似值僅作為 CDN 失效時的 graceful degradation。

## 4. 儀式時刻語彙（choreography vocabulary）

品牌只有四種「動作」，所有畫面從這四種組合，不另創：

| 語彙 | 定義 | 已落地範例 |
|------|------|-----------|
| **Reveal 揭曉** | 數值 `expo.out` 收斂 → `back.out` snap-settle → gold SECURED 輝光 | v6 Edge Score 揭曉（`edgeScoreReveal`） |
| **Breath 呼吸** | 6s `sine.inOut` scale 1↔1.015 / opacity 微幅 | splash lockup、ring bloom、掃描觸點 idle |
| **Lock 鎖定** | 短促 flicker（極速運算感）→ 瞬間 snap → 靜止 + 輝光 | 星塵 climax 鎖定（founder 認可的「极速运算」保留） |
| **Travel 旅程** | 單一主體（orb）連續移動貫穿多幕，色溫 cool→warm 敘事 | onboarding 5-step 金球、story.js 星塵球 |

**鎖定不可改的手感**：星塵動效 v25.8.2、`/story/` Hero 進場（SYSTEM.md §8）、splash 900ms 入場 + 6s 呼吸（ANTIGRAVITY §18.4）。polish 可以，重編排不行。
（例外授權：founder 2026-07-10 明確授權 `/story/` Hero 進場做 **motion-only 強化** — 文案/球/版面不變，
編排可升級；範圍與 beat 譜見 `docs/prompts/antigravity-story-motion-kickoff.md`。星塵內部手感仍鎖定。）

## 5. 每個 surface 用什麼引擎

| Surface | 引擎 | 備註 |
|---------|------|------|
| `apps/preview/**`（web） | **GSAP 3.13.x**（CDN；3.13 起全 plugin 免費） | 一律 `if(window.gsap)` 漸進增強，保留無 GSAP fallback（沙箱/斷網不能白屏）；plugin 白名單見 §6 |
| `apps/preview/story.html` | GSAP + ScrollTrigger | 讀 `gsap-scrolltrigger` skill；pin/scrub 已建立 |
| canvas 類（soul-enroll 星塵/金球） | 原生 rAF | 不套 GSAP；調參走 `scripts/orb-tuner/` 截圖迴圈 |
| `apps/mobile`（RN） | **Reanimated 3 + Skia（目標態）** — **GSAP 不進 RN** | 用本檔同一套 tokens/語彙翻譯成 Reanimated（ease 曲線值直接複用）；現有 core-RN Animated 是過渡債 |

## 6. GSAP AI Skills 路由表（`.claude/skills/gsap-*/`，8 包已入庫）

| 你的任務 | 必讀包 |
|---------|--------|
| 任何 GSAP 動效（基礎 API/easing/stagger/reduced-motion） | `gsap-core`（永遠先讀） |
| 多元素編排、節拍序列 | `gsap-timeline` |
| 滾動敘事（story.html 類） | `gsap-scrolltrigger` |
| 卡頓/掉幀/效能 | `gsap-performance` |
| 數值映射、clamp、snap、隨機 | `gsap-utils` |
| Flip/Draggable/SplitText 等 plugin | `gsap-plugins`（GSAP 3.13 起全 plugin 免費；story.html 白名單＝**SplitText / CustomEase / DrawSVG** 三個，founder 2026-07-10 核可 — 要加第四個先過 founder；**ScrollSmoother 明確不用**，理由見 story-motion kickoff） |
| React/RN web 內用 GSAP | `gsap-react`（目前 repo 無此場景） |
| Vue/Svelte | `gsap-frameworks`（目前 repo 無此場景） |

## 7. Antigravity（桌機）調用手冊

1. **讀取路徑**：skill 包在 repo 的 `.claude/skills/gsap-*/SKILL.md` — 這不是 Claude 專屬資料夾，**Antigravity 開工前手動打開對應包全文讀完**（§6 選包），再讀本檔 + `docs/VISUAL-DIRECTION.md`。
2. **實作分工**：動效的「手感、節奏、pixel 對齊、實機 60fps」= 桌機 lane（真瀏覽器 + 真 CDN + GPU）；雲端（Claude Code）只做結構、規格、review、merge。**凡需要眼睛的調參都歸 Antigravity。**
3. **驗收清單**（每個動效 PR 必附）：
   - [ ] 真瀏覽器實走錄影/截圖（雲端沙箱看不到 CDN 資源）
   - [ ] `prefers-reduced-motion: reduce` 模擬過（DevTools → Rendering）：snap 到終態
   - [ ] ~390px 寬 + 短視窗（~660px 高，in-app browser）無溢出無遮擋
   - [ ] 只動 transform/opacity（DevTools Performance 無 purple layout 帶）
   - [ ] 鎖定資產（§4 清單）未被重編排
4. **禁改**：星塵 v25.8.2 手感、/story/ Hero、splash 規格、`--ease-*` token 值（要改先過 founder）。

## 8. 維護規則

- 新的動效模式被 founder 認可 → 收進 §4 語彙表（保持四類以內，能歸類就不加新類）。
- 新 ease/duration 需求 → 先試 §3 音階；真的要加 → 進 tokens.css + 本表，禁止 inline 裸值。
- 同類動效教訓第二次出現 → 提煉進 `docs/PLAYBOOK.md` §6。
