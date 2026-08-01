# Antigravity 開工單 v2 — Hero「鏡頭感」進場（2026-08-01，founder 拍板）

> **取代** `docs/prompts/antigravity-story-motion-kickoff.md`（v1，已完成但未達標）。
> v1 做出來的東西 founder 看過:**技術正確、但不震撼**。本開工單修正的是 v1 的方法論本身。

---

## 為什麼 v1 失敗（讀這段，別重蹈覆轍）

v1 由雲端 AI 憑「重建」寫了一份**逐拍規格表**（元素／時間／時長／ease），Antigravity 忠實照做了 —— 五個 commit
拍點分毫不差。問題出在**規格本身**:

1. **它只是一份「依序淡入 + 上移」的清單**。nav → kicker → 逐字 → sub → 按鈕，全部都是 `autoAlpha + y`。
   有品味，但沒有任何一拍是「奇觀」。這是標準 stagger 進場，不是震撼。
2. **整個畫面是平的。** 全場只有 y 軸位移，沒有任何縱深、沒有鏡頭運動。
3. **最大的槓桿從沒被碰過:** `#universe` 是真的 Three.js 場景（`v6/stardust.js`），裡面有一台
   `THREE.PerspectiveCamera`，`camera.position.z = 5` 設定後**永遠不動**。Hero 有一台真相機卻從不運鏡。
4. **規格寫太死反而關掉了創作空間。** 當初那個讓 founder 驚豔、但沒存檔的版本，是 Antigravity
   拿著 GPU 自由發揮的產物；v1 把它變成照號碼填色，天花板被規格本身壓住了。

**所以本開工單不再給你逐拍表。** 改成:定義**不可破的底線** + **震撼的定義** + **技術彈藥庫**，
其餘由你發揮，並且**一次交三個差異夠大的版本**讓 founder 挑。

---

## 貼進 Antigravity 的 prompt

你是 TENKI CORE 的桌機動效實作 AI。先 `git pull origin main`，然後**依序讀完**（不要跳）:

1. `CLAUDE.md` → `docs/PLAYBOOK.md` §0/§1/§6 → `ANTIGRAVITY.md` 置頂 note
2. `docs/MOTION-DIRECTION.md` 全文（動效 canonical;驗收 = §7;**注意 §3 的 CustomEase 註記**）
3. `.claude/skills/gsap-core` + `gsap-timeline` + `gsap-scrolltrigger` + `gsap-performance` 全文
4. 本開工單全文

任務:重做 `/story/` Hero 進場，做到 founder 說的**「非常震撼」**。
**Rule #0（防丟失，最高優先）:** 開工第一分鐘就
`git checkout -b feat/hero-camera && git push -u origin feat/hero-camera`;
**每個 take 完成就 commit + push**；quota 快用完 → 先 push 再收工，並在 `ANTIGRAVITY.md`
置頂加一行「停在哪」。（v1 的前身版本就是沒 push 而永久遺失的。）

---

## 震撼 = 鏡頭感（founder 2026-08-01 明確指定）

Founder 在四個選項中選了:**「鏡頭感:推進／拉遠／縱深穿越」**。

這是本次唯一的北極星。判準很簡單:**畫面要有 Z 軸。** 使用者應該感覺到自己在一個立體空間裡被
「帶著走」，而不是在看一張平面海報上的元素淡入。做完後自問:「把這段錄影靜音播給沒看過的人，
他會不會說『哇』?」不會，就還沒到。

**不是**多加特效或加快速度 —— 是**空間感**。

## 技術彈藥庫（提高天花板用的，不是待辦清單）

挑你判斷最有效的，不必全用;有更好的想法**歡迎超出這份清單**:

**A. 真 3D 相機運鏡（最大槓桿，優先試）**
`apps/preview/v6/stardust.js` 裡有 `camera = new THREE.PerspectiveCamera(75, …)`，`camera.position.z = 5`
之後從未變動。把它交給 GSAP 開動 —— 推進穿過粒子場、拉遠揭露全景、或滾動驅動的縱深穿越。
⚠️ **必須用「加法」方式做**（見下方 Guardrails）:stardust 同時被 `/v3/` 與 `/preview/` 使用，
新增一個預設不改變現有行為的 API（例如 `setCameraZ()` / `getCamera()`），**不要改動粒子邏輯本身**。

**B. DOM 端的假相機（便宜、可與 A 疊加）**
父層 `perspective` + 子層 `translateZ`/`z`，GSAP 可直接補間 `z` / `rotationX` / `rotationY` /
`transformPerspective`。把 kicker／標題／sub／CTA 放在**不同 Z 深度**，鏡頭推進時它們以不同速度掠過 —— 真視差。

**C. 縱深穿越 = 滾動的延續**
「穿越」最自然的落點是 Hero → 第一個 story panel 的交界:ScrollTrigger scrub 讓相機**繼續往前飛穿過球體**
進入故事段，而不是現在的「淡出換頁」。Hero 與 story 變成一鏡到底。

**D. 遮罩式文字揭曉**
`overflow:hidden` 容器 + 內層 `y:100%` 升起（SplitText 已在頁面上），比單純淡入高級得多，且與鏡頭推進疊加時特別有力。

**E. 節奏**
鏡頭運動需要**時間**才有重量。目前整段 2 秒跑完;震撼的運鏡通常需要 3–5 秒的自信鋪陳。
Duration 音階（MOTION-DIRECTION §3）不夠用時可提案新值，但要在 PR 說明理由。

## 交付方式:三個 take，founder 挑一個

做 **3 個差異夠大的版本**（不是同一個東西的三種微調 —— 要是三種不同的鏡頭語言，例如
「推進」vs「拉遠揭露」vs「穿越」）。每個 take:

- 獨立 commit + push（Rule #0）
- **必附全程螢幕錄影**（founder 只能靠錄影判斷，截圖對運鏡完全無效）
- 一句話說明這個 take 的鏡頭概念

Founder 挑定一個之後，我們才把它 polish 並鎖進 canon。**別自己先收斂成一個「安全解」——
天花板是這次的重點。**

## Guardrails（不可破）

1. **`stardust.js` 只能加法修改**。新增 API 必須向後相容:`/v3/` 與 `/preview/` 不傳新參數時，
   行為必須與現在**完全一致**（星塵手感 v25.8.2 鎖定，`SYSTEM.md` §8）。不要改粒子數／顏色／既有動態。
   改完務必回頭實走 `/v3/` 與 `/preview/` 確認沒壞。
2. **內容不動**:headline 文案、星塵球身份、版面結構、kicker/sub/CTA 文字全部維持。**只有動效可以重做**
   （founder 2026-07-10 授權 motion-only 強化，2026-08-01 再次確認要重做進場）。
3. **`prefers-reduced-motion` 是一級公民，這次尤其致命** —— 鏡頭推進／穿越是最容易誘發動暈的動效類型。
   `gsap.matchMedia()` 的 reduced 分支必須是**靜態終態、零相機運動**，不是放慢版。
4. **效能硬門檻**:8k 粒子 + 相機運動要在真手機上維持 60fps。掉幀就降級（降粒子數或用 matchMedia
   只在桌機給完整版），不要交一個會卡的版本。
5. 每幀只動 transform／opacity（`z`/`rotationX` 屬 transform，OK）;`if (window.gsap)` 漸進增強保留;
   `document.fonts.ready` → `ScrollTrigger.refresh()` 保留。
6. 改 preview 前先讀 `docs/PLAYBOOK.md` §6（iOS 陷阱）。

## 驗收清單（每個 take 都要）

- [ ] **全程錄影**（Hero 進場 + 捲到故事段），founder 靠這個挑
- [ ] `prefers-reduced-motion: reduce` 模擬:靜態終態、**完全沒有相機運動**
- [ ] 真 iPhone Safari 實走:60fps、~390px 無溢出、短視窗（~660px）不破版
- [ ] `/v3/` 與 `/preview/` 回歸確認（若動了 stardust.js）
- [ ] DevTools Performance 無 purple layout 帶
- [ ] `npm run verify` 綠燈;分支已 push（**每個 take 都要**）

完成後 push + 三支錄影回報 founder，由雲端 Claude Code 開 PR 與 merge。
