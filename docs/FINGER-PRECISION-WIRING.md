# FINGER-PRECISION-WIRING.md — 手指 PPG「可選補強層」接線契約

> Canonical 接法。任何 AI（Claude Code / Antigravity / 其他）動這個功能前先讀本檔。
> 定位錨在 `MEMORY.md` #12；憲法定位「finger PPG 退為校準/補強層」見 `CLAUDE.md`。
> ⚠️ 改 `apps/preview/**` 屬 CI 盲區，動前讀 `docs/PLAYBOOK.md` §6（iOS 陷阱），完成需 founder 手機實走。

## 1. 產品定位（一句話）
臉部掃描是**唯一主流程**。手指 PPG 只是**可選的「提升精度」補強層** —— 在使用者**看到臉掃結果之後**才出現的入口，安靜、可略過、不打擾主流程。不是回收已刪的手指主流程，是重新定位為補強層。

## 2. 目標接法（架構）
```
[臉掃主流程 /preview/] → 結果揭曉 (#edgeScoreReveal on /preview/v6/)
      │  揭曉完成後，安靜出現、可略過
      ▼
[「提升精度」smart-trigger 卡]        ← 入口 B（沿用既有提醒樣式；日後再補）
      │  onclick
      ▼
openPrecisionBaseline()               ← 獨立入口，重用既有 .baseline-flow 8 狀態儀式
      │  在 'scan' 狀態
      ▼
finger-ppg.js 真後鏡頭 PPG            ← 真 BPM + 品質閘門（取代 68 BPM mock；來自 PR #148）
      │  在 'done'
      ▼
存衍生 HR 基線 + 設 precisionBoosted   ← localStorage，只存衍生值、raw 像素不上雲
      │
      ▼
結果頁顯示「已提升精度」信心徽章         ← 非新分數頁；只是 confidence 指示
```

## 3. 既有零件（重用，不重寫）— 真實座標
| 零件 | 位置 | 現況 |
|------|------|------|
| 手指校準儀式 8 狀態 `.baseline-flow`（`bf-*`：intro→sensor→check→ready→scan→analyze→done） | `apps/preview/v6/index.html` UI ~:2500–2720 | UI 齊全，可重用 |
| 儀式 API `openBaseline(startState)` / `closeBaseline()` / `bfGo(state)` / `bfFinish()` | `apps/preview/v6/index.html` :3999 / :4010 / :3827 / :4019 | 已 expose |
| 儀式現行入口（Lab 卡） | `apps/preview/v6/index.html` :2223 `onclick="openBaseline()"` | 目前唯一入口 |
| 結果揭曉錨點 | `#edgeScoreReveal` :1938；GSAP ceremony :2897；`?from=baseline` :6 | 臉掃結果落點 |
| 真後鏡頭 PPG 引擎 | **PR #148** branch `feat/preview-finger-real-ppg` @ `7c2a253`：`apps/preview/finger-ppg.js` | 未併（draft），等真機驗證 |
| 舊 web 手指 onboarding（留檔不連結） | `apps/preview/index.html` + `baseline-onboarding.js` | 保留、無路由；非本接法路徑 |
| smart-trigger 提醒樣式參考 | mobile `FingerSmartReminder.tsx`（已於 #161 刪，git 史可查） | 入口 B 的樣式來源 |

## 4. 兩個必守約束
1. **入口分離**：手指補強層走**獨立** `openPrecisionBaseline()`，**不要**動臉掃的星塵 takeover。
   背景：`apps/preview/v6/stardust-scan-takeover.js` :51-52 已把 `openBaseline` 覆寫成 no-op（"bypassed in favor of stardust 3D takeover"），就是要擋 mock 手指流程混進臉掃。補強層要用不受該覆寫影響的獨立入口，避免把 mock 塞回主流程。
2. **隱私/合規**：只存**衍生** HR（Welford 基線 + maturity），raw 像素**絕不上雲**（`finger-ppg.js` 已符合）；user-facing 文案走 compliance（禁醫療/金融語言）。

## 5. localStorage schema（衍生值，本機）
> 命名沿用 `tenki.` 前綴（現有如 `tenki.snapHintSeen3`）。`finger-ppg.js`（#148）已有自己的 HR 基線儲存；本層在其上加補強旗標。
- `tenki.precision.hrBaseline` — 衍生靜息 HR 基線（Welford：count/mean/M2 或 #148 既有結構）。
- `tenki.precision.maturity` — `new | building | ready | mature`。
- `tenki.precision.boosted` — `'1'` 一旦完成過一次有效手指校準（結果頁徽章依此顯示）。
- `tenki.precision.lastTs` — 上次校準時間（給入口 B 卡的 smart-trigger 判斷「多久沒校準」）。

## 6. 注入錨點（實作時對準這些點）
- **獨立入口**：新增 `window.openPrecisionBaseline = function(){ /* open .baseline-flow, start 'intro', 不經 stardust override */ }`；供入口 B 卡與 Lab 卡呼叫。
- **真訊號接點**：`bf 'scan'` 狀態內，把寫死的 `HR_BPM=68`（:2956 附近）與 `bfLiveHR`（:2663）換成 `finger-ppg.js` 的即時 `estimateBpm` 輸出 + 品質閘門。
- **完成寫入**：`bfFinish()`（:4019）內，寫 §5 的 localStorage 旗標。
- **結果頁徽章**：`#edgeScoreReveal` 區塊（:1938）旁，依 `tenki.precision.boosted` 顯示「已提升精度」信心徽章。
- **入口 B 卡（日後）**：臉掃 ceremony 完成後（:2897 收尾）安靜插入卡片，樣式沿用 §3 提醒來源，`onclick=openPrecisionBaseline()`；可略過、記 `dismiss`。

## 7. 分工（誰做哪段）
| 誰 | 範圍 |
|----|------|
| **雲端（Claude Code，無 Mac，手機可驗）** | §6 獨立入口 `openPrecisionBaseline()`、§5 localStorage 旗標、結果頁徽章（純 JS、無相機） |
| **Antigravity（桌機/真機）** | 併 PR #148 → §6 真訊號接點（`finger-ppg.js`→`bf 'scan'`）→ 真 iPhone Safari 相機 / iOS OOM / ROI・torch・fps 調參；手指儀式與星塵美學收斂（品味類，founder 眼睛最終裁） |
| **Mac 階段（日後）** | `apps/mobile` 原生鏡射：vision-camera 重建「臉掃結果→可選手指補強」餵 `packages/engine`；若需 face↔finger 融合，重建 `multi-modal-blend`（#161 已刪） |

## 8. 驗證
- **手機（founder，最終裁判）**：`/preview/v6/` → 看結果 →（卡建好後）點「提升精度」→ bf 儀式 → 手指蓋後鏡頭 → 真 BPM → done → 結果頁出現「已提升精度」徽章。
- **機器**：`finger-ppg.js` 14 項 headless（#148）；`node --check apps/preview/v6/index.html`；`bash scripts/verify.sh` 綠。
- 每個 commit 保持 preview 可 `node --check`；動部署雙檔（`DEPLOYMENT_MAP.md`/`.json`）同 commit。
