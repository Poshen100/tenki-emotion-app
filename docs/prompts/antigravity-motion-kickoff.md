# Antigravity 動效開工單（2026-07-03，founder 拍板交辦）

> 使用方式：founder 在桌機 Antigravity 貼上下方 prompt 即可開工。

---

你是 TENKI CORE 的桌機實作 AI。先 `git pull origin main`，然後**依序讀完**（不要跳）：

1. `CLAUDE.md`（硬規則）→ `docs/PLAYBOOK.md` §0/§1/§6（矛盾裁決、路由、preview 陷阱）
2. `ANTIGRAVITY.md` 置頂 2026-07-03 continuation note（你的 lane 與現況）
3. `docs/MOTION-DIRECTION.md` 全文（動效語言 canonical — 你的驗收標準在 §7）
4. `.claude/skills/gsap-core/SKILL.md` 全文（這是一般資料夾，手動開檔；其他 7 包按 MOTION-DIRECTION §6 路由表任務用到才讀）

**本次任務：視覺動效拉到國際品牌等級（founder 拍板交辦）。優先序：**

1. **`/preview/` onboarding → Soul Scan 動效 polish**（真 CDN 環境下逐 beat 實走）：
   對照 MOTION-DIRECTION §4 四大語彙檢查每一拍 — 金球 Travel 的 ease/節奏、
   步驟轉場、hold-to-calibrate 手感、`AUTO` dwell 時長。調參點見 ANTIGRAVITY.md
   置頂 note 任務 1。Optional high-value：`.ob-orb` 換真 `TENKI_STARDUST` 品牌球。
2. **`/v3/`（v6 Today）動效 polish**：ring 揭曉（Reveal 語彙：expo.out 收斂 →
   back.out settle → SECURED 輝光）、6s Breath、carousel 磁吸手感 — 只調 timing/
   ease/幅度，不重編排。⚠️ 短視窗（≤760px 高）有新的降級 tier，調參時兩種高度都要看。
3. **（設計案，先出 mockup 給 founder）**RN 版 v6 風格揭曉儀式 — 見 ANTIGRAVITY.md
   置頂 note 任務 2，不准自行發明視覺。

**紀律**：`feat/*` 分支（絕不直推 main）；commit-per-todo；完工跑 `npm run verify`；
每個動效改動附 MOTION-DIRECTION §7 驗收清單（真瀏覽器錄影、reduced-motion、
390px + 短視窗、只動 transform/opacity）；鎖定資產（星塵 v25.8.2 手感、/story/
Hero、splash 規格、--ease-* token 值）不准動。改 preview 前先 grep PLAYBOOK §6。
完成後 push 分支 + 截圖/錄影回報 founder，由雲端 Claude Code 開 PR 與 merge。
