# ⛔ 已被取代（2026-08-01）— 請改讀 `docs/prompts/antigravity-hero-camera-kickoff.md`

> 本開工單（v1）已執行完畢並 merge（PR #212），但 **founder 看過後認定「不夠震撼」**。
> 失敗原因不在執行，而在本檔的方法論:給了一份逐拍規格表，內容實質上只是「依序淡入 + 上移」，
> 畫面全平、沒有鏡頭運動，且過死的規格壓住了創作天花板。完整檢討與新做法見
> **`docs/prompts/antigravity-hero-camera-kickoff.md`（v2，現行）**。
> 以下保留作為歷史紀錄 —— **不要照著執行**。

---

# Antigravity 開工單 — /story/ Hero + 全頁 GSAP 動效重現（2026-07-10，founder 拍板交辦）

> 使用方式：founder 在桌機 Antigravity 貼上下方 prompt 即可開工。
> 背景：先前某次桌機 session 做出的 Hero 進場動效 founder 非常喜歡（「非常震撼」），
> 但**沒有 commit、沒有 push，已不可恢復**。本開工單把那個等級的編排寫成規格，
> 這次照譜實作 + 逐拍推送，讓成果永久留在 repo。

---

## 貼進 Antigravity 的 prompt

你是 TENKI CORE 的桌機動效實作 AI。先 `git pull origin main`，然後**依序讀完**（不要跳）：

1. `CLAUDE.md` → `docs/PLAYBOOK.md` §0/§1/§6 → `ANTIGRAVITY.md` 置頂 note
2. `docs/MOTION-DIRECTION.md` 全文（動效 canonical；驗收 = §7 清單）
3. `.claude/skills/gsap-core/SKILL.md` + `gsap-timeline` + `gsap-scrolltrigger` + `gsap-plugins`
   （一般資料夾，手動開檔讀全文）
4. 本開工單全文（`docs/prompts/antigravity-story-motion-kickoff.md`）— beat 譜在下方

任務：照本開工單的 beat 譜，把 `/story/`（`apps/preview/story.html` + `story.js`）的
Hero 進場與後續各段動效實作到「非常震撼」等級。**Rule #0（防丟失，最高優先）：**
開工第一分鐘就 `git checkout -b feat/story-motion-v2 && git push -u origin feat/story-motion-v2`；
**每完成一個 beat 就 commit + push**（WIP commit 允許）；quota 快用完 → 先 push 再收工，
並在 `ANTIGRAVITY.md` 置頂加一行「停在哪」。上次的損失不允許重演。

---

## 授權紀錄（governance）

`/story/` Hero 進場原為鎖定資產（`SYSTEM.md` §8、`MOTION-DIRECTION` §4）。
**Founder 於 2026-07-10 明確授權本次 motion-only 強化**：headline 文案、星塵球身份
（`TENKI_STARDUST`）、版面結構、kicker/sub/CTA 內容一律不變；**只有動效編排可以強化**。
本檔即為授權紀錄。星塵球內部（`v6/stardust.js` 粒子手感 v25.8.2）仍不可改 —— 用它現有的
API（`playEntrance/dim/brighten`）與外層 wrapper transform 來編排。

## GSAP 技術路線（這就是「怎麼調用最好」的答案）

1. **升級 pin：GSAP 3.12.5 → 3.13.x**（cdnjs/jsdelivr）。3.13 起原 Club plugin 全部免費、
   公開 CDN 可載。本頁白名單**恰好三個**：
   - **SplitText** — headline / panel 標題逐字逐行編排（震撼感的最大單一來源）
   - **CustomEase** — 把 `tokens.css` 三條 ease 註冊成具名曲線 `calm` / `breath` / `secure`，
     全頁每一拍共用同一隻手，取代近似值
   - **DrawSVG** — 折線 / 底線 draw-on（儀器感）
   - **明確不用 ScrollSmoother**：要包一層 wrapper 重構捲動 + 手機怪癖，風險 > 收益；
     原生捲動 + `scrub` 延遲已有電影感重量（Simplicity First）
2. **漸進增強不變**：`if (window.gsap)` guard 保留；無 GSAP 時頁面靜態可讀不白屏。
3. **鐵律不變**（MOTION-DIRECTION §2）：每幀只動 transform/opacity；
   `gsap.matchMedia()` 的 reduced-motion 分支 = 全部 `gsap.set` 到終態；
   `document.fonts.ready` 後 `ScrollTrigger.refresh()`（已存在，保留）。

## Beat 譜 — Hero 進場（master timeline，載入播一次）

用 position label 排在**同一條** timeline 上，跟星塵球互相咬合（不是各播各的）：

| # | 時間 | 元素 | 動作 | 時長/ease |
|---|------|------|------|-----------|
| 0 | 0.00s | `#universe` | `TENKI_STARDUST.playEntrance()`（現有，不改內部） | — |
| 1 | 0.25s | `#nav` | opacity 0→1, y -12→0 | 0.5s `calm` |
| 2 | 0.35s | `#hero-kicker` | y 16→0 + fade | 0.6s `calm` |
| 3 | 0.50s | `#hero-title` **SplitText(words)** | y 40→0 + fade，stagger 0.055 | 0.9s `calm`(expo.out) |
| 4 | +0.1s | accent words（"it reads you."） | 同上 + scale 0.98→1（微強調） | 同上 |
| 5 | 1.30s | `#hero-sub` | y 18→0 + fade | 0.6s `calm` |
| 6 | 1.50s | `#hero-actions .btn` | y 18→0 + scale 0.96→1，stagger 0.08 | 0.6s `secure`(back.out(1.2)) |
| 7 | 2.00s | `#scroll-cue` | fade in → 進入 `breath` 微 y 循環 | loop `breath`(sine.inOut) |

**Hero 退場（新增）**：ScrollTrigger scrub（hero → 第一 panel）：星塵球「外層容器」
y 微下沉 + opacity → ~0.35（用 wrapper transform，禁碰 stardust 內部）、hero 文字群
y -30 + fade —— 讓 Hero「交棒」給故事段，而不是被硬捲走。

## Beat 譜 — 後續各段（質感一致化）

| 段落 | 處理 |
|------|------|
| 3 個 story panels（`initStoryPanels`） | 每 panel 一條 scrub timeline：`scrub: 0.8`、`anticipatePin: 1`；標題 SplitText(lines) stagger 0.08 進場；視覺層 ±20px 視差深度；`story-index` 底線 DrawSVG draw-on |
| Unlock 轉場（`initTransition`） | 保留獨立 breath loop（不 scrub — 現有設計正確），落地瞬間用 `secure` snap（Lock 語彙） |
| Dashboard（`initDashboard`） | 手機框 perspective wrapper：rotationX 8→0 + rotationY -6→0 + y 進場（`calm`），捲動視差保留 |
| Footer（`initFooter`） | CTA 群 stagger rise（0.6s `calm`, stagger 0.08） |

時長一律取 MOTION-DIRECTION §3 音階（150/300/600/900/1400ms、6s 呼吸），不發明新值。

## 驗收（每個 beat PR 附 §7 清單 + 以下）

- [ ] 全頁實走**錄影**（Hero 進場 + 捲到底）— founder 看錄影拍板
- [ ] reduced-motion 模擬：全頁 snap 終態
- [ ] ~390px + 短視窗（~660px）無溢出
- [ ] DevTools Performance：無 purple layout 帶；Hero 進場期間 60fps
- [ ] 星塵內部未改（`git diff` 不含 `v6/stardust.js`）；headline/copy/版面未變
- [ ] `npm run verify` 綠燈；分支已 push（**每拍都要**）

**紀律**：`feat/story-motion-v2` 分支；commit-per-beat；改 preview 前 grep PLAYBOOK §6；
完成後 push + 錄影/截圖回報 founder，由雲端 Claude Code 開 PR 與 merge。
