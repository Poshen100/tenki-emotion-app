# 2026-06-17 Session Update (Snapshot 重設計：peeking 磁吸 carousel + 一頁一組 + Body Battery 動起來)

> Founder(IMG_8824):HR/HVR 數字變大了(好)**但圖表要滑才看的到**、**沒有磁鐵感定位反饋**、想要「滑動就清楚看到 數字+圖表 → 再滑就下一組」、目前點小點切換不爽、**Body Battery 能不能動起來**。「像 Fable5 一樣思考,幫我規劃。」

## What was done — `apps/preview/v6/index.html`(`.snap` 區整段重建)
- **一頁一組(數字+圖表同時看得到,不用滑)**:從「兩指標並排、波形被擠到要滑」改成 **4 頁、每頁一張 `.vcard`** —— ① Cardiac(HR+HVR)② Respiration(RR+Stress)③ Autonomic(交感/副交感)④ **Energy(Body Battery)**。每頁高度 fit 進垂直預算(`.vcard` min-height 168),數字(40–46px)+波形(54px)在同一張卡內全可見。
- **peeking 磁吸 carousel(切換爽感)**:頁 `flex:0 0 84vw`、track `padding:4px 8vw`、`scroll-snap-align:center` + **`scroll-snap-stop:always`**(一次只走一頁)→ 露出鄰頁邊緣暗示可滑;**鎖定反饋** = 中央頁 full opacity/scale、鄰頁 `opacity:.5 scale(.9)` 變暗縮小 + 落定瞬間 `.pulse` 彈一下 + `navigator.vibrate(10)` 震動。`centeredIndex()`(中心最近的頁)比 `scrollLeft/clientWidth` 在 peeking 版面更穩。dots 仍可點(`scrollToPage` 置中)但主要靠滑。
- **Body Battery 動起來**:① 數字 `bbVal` 跟著共享 breath phase 78±2 微浮動;② `.bb-bars::after` 一條斜向 charge-flow 光澤 `bbFlow` 3.4s 來回掃(充電感)。原本 15 根 bar 的 JS(L2977)不動。
- **沿用**:#102 的同步活訊號(共享 `ph=t*0.0011`,HR/HVR/RR/Stress 一起 tick、交感↔副交感反相 canvas 波 + bar)、#104 的監視器格線(`.live-wave/.ans-wave` repeating-linear-gradient)。score reveal 未動。

### 教訓 / 注意
- **垂直預算很緊**:hero ~38vh + `.snap` 底部保留 `calc(tabbar74+fdcb58+gap10+24)≈166px` → 只剩 ~240–293px 帶寬。舊版(carousel 206 + coach + dots + 獨立 bb-card)會 overflow → 把 Body Battery 收成第 4 頁(移除垂直競爭者)就 fit。**單卡一頁** 是讓「數字+圖表同時可見」的關鍵。
- 沿用 #103 的 collapse 修法:`.snap-track` 仍 `flex:none` + 明確 `min-height` + `overflow-y:hidden`(flex 容器內橫向 scroll carousel 必備,否則塌成 0)。
- 全合成 demo 值;CI 不涵蓋 `apps/preview/**` → **手機實走驗**(滑動磁吸感、4 頁是否都完整顯示、Body Battery 是否在動)。振幅/速度可在 script `ph` 係數調。

---

# 2026-06-16 Session Update (結果頁 Snapshot：磁吸滑動 carousel + 同步活訊號 — #102)

> Founder:結果頁(`apps/preview/v6/`)雙環數字下方 Snapshot 要更好讀、醫療級、會動;滑動像磁鐵鎖定(HR/HVR → RR/壓力),含交感/副交感同步波動;上下空間變大。

## What was done — `apps/preview/v6/index.html`(`.snap` 區)
- **磁吸滑動 carousel**:`#snapTrack`(`scroll-snap-type:x mandatory`,iOS 原生磁吸)3 頁 —— 1) Heart Rate + HVR、2) Respiratory + Stress、3) **ANS 交感/副交感**;下方 page-dots 鎖定指示(scroll 監聽算 index → active page 放大/鄰頁淡縮)。
- **同步活訊號**:一個共享 breath phase 驅動所有數字一起微浮動(HR 66–70、HVR、RR、Stress)+ **交感/副交感反相波動**(SNS 升↔PNS 降,canvas 畫 anti-phase 正弦 + bar 寬度/百分比同步)→ 醫療監視器的「活著」感。數字 ~1Hz tick、波形每幀。
- **版面放大**:每頁 `.card.metric` min-height 172、數字 46px、波形 height 74、column 排版 → 更好讀。Body Battery 保留(carousel 下方),bbBars JS 不動。
- 純前端(synthetic demo 值,合規:非醫療宣稱;raw biometric 不上雲——本來就全合成)。reveal/score(#tlTlTlTeiScore=84)未動。

### 注意
- 全合成假值;CI 不涵蓋 `apps/preview/**` → 手機實走驗。波形/浮動幅度可再依回饋微調(script 內 `ph` 係數 + 各 `Math.sin(...)` 振幅)。
- **#103 修 collapse(教訓)**:carousel 一開始整個 0 高度看不到卡片。根因 = `.snap-track` 是 `.snap`(flex column)的 flex item,給了 `overflow-x:auto` → 另一軸 `overflow-y:visible` 自動升級成 `auto` → 變成雙軸 scroll container → flex item 的 `min-height:auto` 變 0 → 被壓成 0 高並裁掉內容。**修法**:`flex:none` + 明確 `min-height` + 明確 `overflow-y:hidden`(避免自動升級)。**通則**:flex 容器裡的橫向 scroll-snap carousel,容器要 `flex:none`/明確高度,否則會塌。

---

# 2026-06-16 Session Update (Guided Lock-On：一步步精準對位 — #101)

> Founder:「一步步協助精準對位(智能提醒)、對位完成有超棒反饋、且實際提高掃描精準度/可靠性;連 10 歲小孩都會操作。」核心真理:baseline 只有在**一致、受控的條件**下量測才有意義 → 引導精準對位 = 強制**可重複性** = 真精準(非裝飾)。

## What was done — `apps/preview/soul-enroll.{html,js}`(正式流程 face_detecting 段)
- **解鎖量測**:MediaPipe 開 `outputFaceBlendshapes` → 眼開度/眨眼;從 landmark 算 **inter-ocular 距離**(遠近)、**roll**(頭歪)、cx/cy(置中)。原本只有 brightness/uniformity/motion/centerOffset/coverage/yaw。
- **Guided Lock-On**:`face_detecting` 改成一次一個目標的引導對位 —— 單一最重要提醒(優先序 present>light>distance>center>level>eyes,debounce 不閃爍)、每個子目標 hold 350ms 才鎖定(磁吸 hysteresis)、4 個 pip(Distance/Center/Level/Eyes)鎖定變綠、**「把點移進圈圈」**中央 dot+target(小孩友善,鏡像 x)、子鎖定有 haptic + flash 反饋、全鎖定→大 haptic→face_locked。
- **晶格「對焦」**:`uGlitch = max(headTurnGlitch, (1-alignProg)*0.5)` → 沒對準時粒子散亂/glitch,鎖定時收斂清晰(誠實訊號 + 美學)。
- **永不卡死**:present 達 9s 直接放行;MediaPipe 沒 active → 回退原本 2D detect 行為(零回歸)。
- 常數 `ALIGN`(distMin/Max、centerMax、rollMax、yawMax、eyeOpenMin、holdMs)集中可調。

### 注意 / 待辦
- **可調**:距離帶 distMin 0.085/distMax 0.22 等是估值,要 founder 手機實測微調(iОS Safari 無法 headless 驗證)。
- **下一步(plan 內)**:錄下 locked 對位 signature(距離/姿態/框/光)存基線 → 日後每日掃描引導對位「對齊基線」= apples-to-apples;把 alignment quality 餵進 `sampleConfidence()`/engine `ConfidenceBreakdown`;之後 mirror 進 `apps/mobile`(複用 FaceScanFrame/MotionGuideCue/QualityStatusPills + deriveQualityStatus + 測試)。

---

# 2026-06-14 Session Update (TENKI Pulse：會學習迭代的觸覺 — #95 cyberpunk / #96 引擎 / #97 原生 adapter)

> Founder:「適時的震動反應,讓 TENKI 感覺有生命、而且震動會學習迭代。」

## What was done
1. **Ghost Protocol cyberpunk restyle #95**(`apps/preview/baseline-3d.{html,js}`):把 Soul Lattice 改成特務 HUD —— 菱形資料節點 shader + 多重掃描線 + 轉頭 glitch + 更銳利 bloom + 鎖定二十面體核心/資料環/六邊形衝擊波 + DOM HUD(準星/NODES/SYNC/THREAT)。**合規:拿掉 founder 提的「HR 87 bpm」假心率讀數**(privacy-first,不暗示量測生理/醫療),改用 SYNC/NODES/THREAT。
2. **TENKI Pulse 引擎 #96**(`packages/engine/src/haptics/`,275 測試全綠):純函式、platform-neutral。`scanEventPulse`(臉鎖/tick/里程碑/鎖定)、`zonePulse`(Clear 呼吸/Neutral 穩/Strain 較銳)、`evolvePulseProfile`(依基線成熟度 new→building→ready→mature + zone EWMA 學習迭代,強度/節奏/refinement 有安全上下限)、`toWebVibration`。
3b. **Ghost Protocol 移植進正式流程 #98**(`apps/preview/soul-enroll.{html,js}`):正式 `/preview/` capture 段從 478 點雲升級成 ~6k 資料節點粒子晶格(菱形 shader + rim + 掃描線 + 轉頭 glitch + UnrealBloom);守 cyan(ACTIVE)→gold(SECURED) 法則(橙當掃描 accent);保留 FSM/chrome/processing/v6 + 2D 星塵 fallback。
3c. **Agent HUD 進正式流程 #99**(soul-enroll,founder 選 option 2):capture 段顯示特務 HUD —— 中央準星 + brand/binary + NODES(粒子數)/SYNC(captureProgress%)/THREAT:LOW/MODE:GHOST。用 cyan/gold + mono(不套原型橙重配色),只在 `M3D_PHASES` 步驟顯示,純 DOM overlay 零功能風險。ON-DEVICE 沿用既有 securedPill 不重複。
3d. **Ghost Protocol 音效 #100**(`apps/preview/baseline-3d.{html,js}`,**原型先做**):Web Audio —— scanning 時低頻 breathing hum、phase 切換 tick、locking whoosh(noise bandpass sweep + low thud)、locked confirm 雙音。**opt-in**:「▶ Ghost Protocol · Sound」toggle(預設關;tap 同時 unlock iOS AudioContext)。色彩/glitch 微調待 founder 具體方向(需他的眼睛,不盲調)。滿意再 port 進正式流程(聲音進 onboarding 是品牌決策,先原型)。
3. **原生 adapter #97**(`apps/mobile`,61 測試全綠):`utils/pulse.ts`(engine 的 mobile mirror,重用 `maturityStage`)、`utils/pulsePlayer.ts`(把 HapticPattern 播成連續 expo-haptics impacts:intensity→ImpactFeedbackStyle、gap→節奏)、`stores/pulse-profile-store.ts`(persist/AsyncStorage 的學習 profile)、`useBaselineHaptics.playPattern()`。

### ⚠️ 關鍵限制 / 注意
- **iOS Safari 網頁完全不能震**(`navigator.vibrate` 無效)→ 真震動只能原生 app;founder 要 **Mac/build** 才感受得到。這也是為何先做「引擎 + adapter」(純 TS 可測),不靠裝置驗證。
- **mobile 不在 root workspaces、不 import `packages/engine`** → 沿用既有慣例「mobile 自帶 util mirror engine」(如 `maturityStage`/`qualityThresholds`)。`apps/mobile/.../utils/pulse.ts` 是 engine TENKI Pulse 的 mirror,**改其一要兩邊同步**。
- 合規:profile 全裝置端、無生理原始資料、不上雲;震動是「感受」非醫療宣稱;`reducedMotion` 時不震。

## Next session（接手點 — 待 founder 有 Mac/build）
1. **最後一哩(會動到掃描畫面,要實機測才做)**:把 3 接線點接進實際 screens —— 臉鎖/掃描/鎖定→`playPattern(scanEventPulse(...))`、分數揭曉→`playPattern(zonePulse(zone,profile))`、掃描完成→`usePulseProfileStore.getState().recordScan(zone,score)`。
2. Ghost Protocol 手感微調(配色/glitch/掃描線);或加音效 + 「Activate Ghost Protocol」切換。
3. 把 Soul Lattice / Ghost Protocol renderer 移植進正式 soul-enroll capture 段(目前正式流程仍是 #94 發光點雲版)。

---

# 2026-06-14 Session Update (3D 視覺「飛躍」：Soul Lattice 發光粒子晶格 #94 已 merge)

> Founder 要 3D 不露臉建模有「飛躍的大升級」(看了 Fable 5 vs Opus 行銷影片受啟發 —— 那些 4M token/GTA VI 宣稱是未證實行銷,不採信,但「要大躍進」的需求照做)。

## What was done
1. **Soul Lattice 升級 PR #94**(只動獨立原型 `apps/preview/baseline-3d.{html,js}`,**不碰正式 soul-enroll**):
   - **478 點 → ~5–6k 粒子**:沿 `FACE_LANDMARKS_TESSELATION` 每條邊插值取樣(`K_PER_EDGE=2`),每幀 = 兩端 landmark 的 lerp。
   - **真 Bloom**:`EffectComposer + UnrealBloomPass`(import map 加 `three/addons/`),composer pixelRatio 降到 1.5 給手機。
   - **自訂 ShaderMaterial**(Points):depth 打光 + 移動掃描光帶 `uScanY` + 每粒子 twinkle + `uMix` cyan→gold,additive。
   - **編排**:forming 粒子**從散開球面飛入**(staggered, smoothstep);locking 收束成金核 + **擴散衝擊波環**(RingGeometry)。
   - 仍 privacy-first(無真實臉部像素)、鎖定釋放相機。先 prototype 驗收,**OK 後再移植進 soul-enroll capture 段**。

### ⚠️ LESSON(這次踩到)
- **Squash-merge 同一條分支不 rebase → 會撞合併衝突**:#94 一開 PR 就 `mergeable_state: dirty`(`MEMORY.md` 三方合併打架),因為 merge-base 還停在舊 commit、main 是 squash 出來的新樹。**解法 + 往後習慣**:每次 squash-merge 後 `git fetch origin main && git reset --hard origin/main`(force-with-lease push)把分支同步回 main,下個 PR 才乾淨。本次已用 `git reset --soft origin/main` 收成單一 commit 解掉。

## Next session（接手點）
1. **收 founder 對 Soul Lattice 的回饋**(`/preview/baseline-3d.html`):夠不夠飛躍 / 效能順不順。
2. 滿意 → **把 Soul Lattice renderer 移植進 `soul-enroll.js` 的 `m3d` 層**(取代目前正式流程的 478 點版);注意保留漸進增強 fallback。
3. 想更猛:afterimage 拖尾、虹彩漸層、真實法線受光、blendshapes 眨眼 liveness。
4. 原生(需 Mac):ARKit TrueDepth / vision-camera + MediaPipe RN。

---

# 2026-06-14 Session Update (3D 互動式臉部基線建模：MediaPipe + Three.js，#91/#92 已 merge)

> Branch `claude/face-baseline-enrollment-9cacp6`。Founder 要「第一次臉部掃描」像 Face ID 一樣超酷超專業、且**不一定要露臉**。決策:**只用在基線建立**(日常 Soul Scan 維持 v6 星塵)。

## What was done
1. **方向(model B-honest + privacy)**:不顯示鏡頭畫面,只渲染從臉推導的**抽象 3D 點雲/網格**(Face-ID 點陣投影器美學)→ 同時超專業 + 超隱私。
2. **獨立原型 PR #91**(`apps/preview/baseline-3d.html` + `.js`):MediaPipe FaceLandmarker(478 個 on-device 3D landmark)+ Three.js 點雲 + tessellation 網格。儀式 `loading→await_face→forming(掃描成型)→scanning(轉頭旋轉)→locking(青→金收束金核)→locked`。獨立網址 `/preview/baseline-3d.html`,純展示驗證手感。
3. **接進真正流程 PR #92**(`apps/preview/soul-enroll.{html,js}`):把 capture 段(`face_detecting→stability`)的 2D 星塵換成 3D 模型。真 landmark 置中取代啟發式;capture 時隱藏鏡頭預覽。**保留**環境檢查(3 燈)、金球 processing、基線數據、v6 銜接。
   - 接法:HTML 加 import map(`three`)+ module bootstrap 把 `window.THREE`/`window.TENKI_MP` 掛上;加 `#model3d` WebGL 層。soul-enroll.js 維持 classic IIFE,新增 `m3d` 場景 + `detectLandmarks`/`ingestLandmarks`;`state.mpActive` 時用 landmark 的 centerOffset/coverage 餵進 `evalGates`,gating 放寬成 `(state.mpActive || state.tierA)`。
   - **漸進增強/零回歸**:3D 是加強層,`m3d.ready` 為 false(CDN 載不到)→ 自動回退既有 2D 星塵流程。
4. **CTA 卡關 hotfix PR #93**(`soul-enroll.html` CSS):founder 回報跑到「Baseline established」頁就過不去——金色「Start your first scan」按鈕被 **iOS Safari 底部工具列蓋住**(`100vh` 比可視高度高,底部對齊內容被推到螢幕外)。改 `html/body/#stage` 用 **`100dvh`**(留 `100vh`/`100%` fallback)、`#stage overflow-y:auto` 保險、縮 `#copy` 底 padding(`58→max(20px,safe-area)`)/`#indicators`/`#baseline-extra`/`.bx-list` 間距。流程現在能一路接到 `/preview/v6/` 星塵靈魂掃描。

### 關鍵突破 / 注意
- **MediaPipe 自帶模型 → iOS Safari 也能拿到真 478 landmark**,一舉解掉之前「iOS 無 `FaceDetector` 只能啟發式」的痛點。
- **iOS Safari `100vh` 陷阱**:底部對齊的 CTA 會被工具列蓋住 → 一律用 `100dvh`(+ fallback)。preview 全屏儀式頁都要注意。
- CDN(runtime,founder 瀏覽器):`three@0.160.0`(jsdelivr)、`@mediapipe/tasks-vision@0.10.12`(jsdelivr,含 `/wasm`)、model `face_landmarker.task`(storage.googleapis.com)。容器無法 headless 驗證,靠手機實走。
- arc「轉頭」目前是**視覺旋轉**(模型即時跟著轉),進度仍走既有 handheld 計時 —— 沒硬卡 yaw,避免 dead-end。

> 上線狀態:#91/#92/#93 全 merge 進 `main`(最後 `adbf696`),Vercel 自動部署。完整流程 `/preview/` 基線(3D capture)→ processing → Baseline locked → 基線數據 →「Start your first scan」→ `/preview/v6/` 星塵靈魂掃描 + Today 84。

## Next session（接手點）
1. 收 founder 手機回饋,微調 `M3D.SCALE`/`DEPTH`/`SMOOTH`、點大小、網格 opacity(都在 `soul-enroll.js` 的 `M3D` 與 `m3d.points/lines` material)。
2. (選做進階)把 arc 改成**真 yaw 覆蓋進度**(轉頭補完背面)+ blendshapes 眨眼 liveness(MediaPipe `outputFaceBlendshapes`)。
3. 原生(需 Mac):iOS ARKit TrueDepth 真深度版當旗艦;或 vision-camera + MediaPipe RN plugin 移植進 `apps/mobile`。

---

# 2026-06-13 Session Update (上線 + 手持卡頓 hotfix：#89/#90 已 merge 進 main)

> Branch `claude/face-baseline-enrollment-9cacp6`。這次把前面兩段（門面 + Model B 旅程）開 PR、收 founder 手機回饋、修 bug、上線。

## What was done
1. **PR #89** = 門面（真鏡頭 live gates）+ Model B 全程旅程 + 金色 processing 頁 + mobile parity → squash-merge 進 `main`（CI 全綠）。
2. **Founder iPhone 回饋**：`/preview/` 卡在第二頁（環境檢查）— Lighting✓ Centering✓ 但 **Stillness 永遠灰**，三燈無法同時亮 → 流程不前進（「只有兩頁」）。
3. **手持 hotfix（PR #90，已 merge `a2441a7`）**：`soul-enroll.js` 的 motion 門檻對手持太嚴（`motion = 每像素平均亮度差 / 40`，Stillness 要 ≤0.16 = 平均差 ≤6.4，手機微震永遠超過）。放寬 `motionStill 0.16→0.40`、`motionNeutral 0.15→0.36`、`motionStability 0.13→0.30`、`motionArc 0.36→0.62`；`ENV_HOLD_MS 1500→1100`；新增 `ENV_FALLBACK_MS=6000`（Lighting 過且停留 >6s 就自動前進 → ceremony **永不 dead-end**）。門檻仍有反應（遮鏡頭 Lighting 紅、大動作 Stillness 跳）。

### ⚠️ LESSONS（寫進來避免重犯）
- **CI 不涵蓋 `apps/preview/**`**：`ci.yml` 只測 `packages/** + domain + apps/mobile`；`biome.json` 的 `files.includes` 也只有那三個。所以 preview 壞掉 CI 不會抓到 → **preview 改動一律手機實走驗證**，別靠 CI 綠燈當保證。
- **GOTCHA：#89 在我推 hotfix 之前就被 squash-merge** → 修正落在已關閉的分支、不在 main、CI 不會跑（PR 已 closed）→ 只好開 catch-up PR #90。教訓：preview 類改動最好在 founder merge 前就 push 完整；或預期會有補丁 PR。
- **Vercel deployment protection**：分支 preview 與正式站 `vercel.app/preview/` 匿名抓都 403，無法用 WebFetch 驗證部署內容；founder 是登入狀態才看得到。要程式化驗證得用 Vercel MCP（需授權）。

## Next session（接手點）
1. 收 founder 在 iPhone 確認 `/preview/` 整條（環境 → lock → neutral/arc/stability → processing 金球 → Baseline locked → 基線數據 → v6）順走。
2. 若手持門檻還是太鬆/太緊，微調 `T.motion*`（檔案 `apps/preview/soul-enroll.js`）。
3. （選做）v6 揭曉分數依即時品質浮動 + 清 `tlTlTlTeiScore` 命名；原生 vision-camera（需 Mac）。

---

# 2026-06-13 Session Update (Model B 全程串接：基線 → 掃描 → 結果，導入 v6)

> Branch `claude/face-baseline-enrollment-9cacp6`。承上：soul-enroll 之前停在「Baseline locked.」就沒了。本次把第一次的完整 Model B 旅程串起來。

## What was done（commit-per-todo）
1. **soul-enroll 旅程延伸**（`soul-enroll.js`/`.html`）：「Baseline locked.」→ 新增**質化「基線數據」快照**（maturity New、signal quality band、捕捉到的參考訊號清單 Steadiness/Centering/Lighting/Eye openness、文案「This is your personal reference — not a score」）→ CTA `Start your first scan` **導入 `/preview/v6/?from=baseline`**（重用既有星塵臉部掃描 + Today 揭曉 Edge Score）。決策：重用 v6（不另做掃描/結果頁）；分數維持固定 84（不動 v6 邏輯）。
2. **Processing 頁不漏掉**（founder 指定附圖）：把 `processing` 從一閃而過改成顯眼的**金色軌道球體**畫面 — canvas 畫 3 條傾斜旋轉金環 + 亮核 + glass sphere，搭配大字 `%` 倒數（PROCESSING_MS 1900→2800），文案「Securing your unique baseline…」+「All data is processed and stored locally for maximum privacy.」對齊附圖。
3. **手指流程收尾導入 v6**（`baseline-onboarding.js`）：`selectNextAction` 由 `/v3/…` 改為 founder 指定的 `/preview/v6/…`（scan→`?from=baseline`、explore→`#lab`）。Model B：finger PPG = 校準層，完成後進 Today 首頁。

### Notes / gotchas
- 完整 Model B 第一次旅程：`/preview/`（臉部基線 ceremony）→ 基線數據 → `/preview/v6/?from=baseline`（星塵臉部掃描 + 結果）；finger PPG 走 `/preview/finger/` → `/preview/v6/`。`/v3/` 與 `/preview/v6/` 是同一頁（vercel rewrite 雙路徑）。
- v6 揭曉分數元素 id 仍叫 `tlTlTlTeiScore`（v2 TEI 殘留命名），但對外呈現是 v3（Clear/Neutral/Strain）；本次未動 v6，固定 84。
- soul-enroll 仍是 vanilla canvas，無 Jest；驗證靠手機實走。

## Next session（接手點）
1. 收 founder 在 iPhone 實走整條 `/preview/ → v6` 的回饋。
2. （選做）讓 v6 揭曉分數依即時掃描品質浮動、並清掉 `tlTlTlTeiScore` 的 TEI 殘留命名。
3. 原生（需 Mac）：vision-camera 真 landmarks → 真 6 信號 → Skia。

---

# 2026-06-13 Session Update (Soul Scan 升級成 /preview/ 門面 + 真鏡頭 live gates)

> Branch `claude/face-baseline-enrollment-9cacp6`。目標：讓「第一次臉部掃描」像 iPhone Face ID — 精準、安靜、會對真臉反應。以已部署的 `/preview/` 為基底（founder 認可的最高完成度）。

## What was done（commit-per-todo）
1. **soul-enroll 真鏡頭重寫**：`apps/preview/soul-enroll.js` 從「純計時腳本」改成 **事件驅動 FSM**（鏡像 `faceBaselineMachine.ts`）。
   - 真前鏡頭 `getUserMedia`；每幀抽樣到 80×80 offscreen canvas 算 **brightness / lighting uniformity / motion**（真量測，全瀏覽器有效）。
   - **分層偵測**：Tier A 有 `window.FaceDetector`（Chrome/Edge）→ 真 centering / coverage / face-lock / arc；Tier B（**iOS Safari 沒有 FaceDetector**）退到誠實啟發式（中央細節 + 光線），lock/arc 導引式。
   - 3 個 precision indicators（Lighting/Centering/Stillness）反映**真實 gate 狀態**；environment 三燈同時過 1.5s 才放行。
   - 擷取階段進度**只在 gate 過時累積、掉時暫停不歸零**；持續掉 → `retry_needed` 局部重掃（neutral 重來、arc/stability 保留）。第一次基線用 strict 門檻。
   - 隱私：所有分析在 canvas/on-device，**沒有任何 frame 或衍生資料上網**。
2. **HTML camera layer**：`soul-enroll.html` 加 `<video id="cam-video">`（鏡像、cover、貼合掃描框圓角方形），+ favicon/OG meta 達門面水準。
3. **/preview/ 門面切換**：`vercel.json` 把 `/preview/` → `soul-enroll.html`，finger onboarding 移到 `/preview/finger/`（North Star §1：臉是主入口、finger 是校準層）。DEPLOYMENT_MAP(.md/.json) 同步。
4. **Mobile parity**：env 燈號標籤 `Distance/Stability` → `Centering/Stillness`（key 不變、僅顯示字 + icon🎯），intro 文案對齊 `Create your Face Baseline.`。mobile `npx tsc --noEmit` exit 0、face-baseline 49 tests 全綠。

### Notes / gotchas
- **iOS Safari 無 FaceDetector**（founder 多半用 iPhone）→ 臉部 centering/lock 在 iOS 是啟發式 + 導引；但 lighting/stillness gate 在所有瀏覽器都是真的，所以仍有「會對你反應」的感受。誠實設計，別宣稱 iOS 有真 3D 臉偵測。
- `apps/preview` 是 vanilla JS、沒有 Jest，且 biome 設定忽略它 → preview 驗證靠手機實走（grant 鏡頭、遮鏡頭看 Lighting 變紅擋進度、動一下看 Stillness 暫停進度）。
- 容器乾淨 clone：跑 mobile 驗證要先 `cd apps/mobile && npm install`（不在 root workspaces）。
- `/preview/` 直接路徑 `/preview/soul-enroll.html` 仍可用（內容相同）；finger 舊頁 `/preview/finger/`。

## Next session（接手點）
1. 收 founder 在 iPhone 上實走 `/preview/` 的回饋（節奏、文案、gate 鬆緊）。
2. 原生（需 Mac）：vision-camera frame processor 餵真 landmarks → 真 6 信號 → Skia halo（North Star §6 step 4）。
3. 把 mobile `/face-baseline` 接成 onboarding 主入口（North Star §6 step 3 未做部分）。

---

# 2026-06-13 Session Update (Face Baseline Enrollment — FSM 拆分 + 品質閘 + preview ceremony)

> Branch `claude/face-baseline-enrollment-7bmdmp`，7 commits（commit-per-todo）。落地 SOUL-SCAN-NORTH-STAR §6 step 2 的「雲端可做」邏輯層。

## What was done
1. **FSM 拆分（North Star §5 缺口）**：`motion_capture` → `arc_left` / `arc_right`，新增 `stability_pass`。
   流程 `neutral → arc_left → arc_right → stability_pass → processing`。新事件 `ARC_LEFT_DONE / ARC_RIGHT_DONE / STABILITY_DONE`（刪 `MOTION_DONE`）。`RESUME_TARGET` + `partialRetryPhase` 擴充：arc 失敗保留 neutral，stability 失敗保留 neutral+arc（局部重掃不整套重來）。
2. **QualityMetrics 擴充**：加 6 個臉部信號 `landmarkConfidence / headPoseRange / lightingUniformity / eyeVisibility / neutralExpressionConfidence / totalBaselineConfidence`。
3. **Per-phase 品質閘**：`neutralGate / arcGate / stabilityGate`，每個有 `{ strict }` —**第一次基線比日常嚴格**（`STRICT_DELTA=0.08`，North Star 鐵律 2）。`deriveQualityStatus` 加 arc `poseRange` nudge（arc 容忍轉頭、ceiling 0.6）。`totalBaselineConfidence` 聚合 6 信號（權重和=1）。`captureProgress` 重新加權 neutral .5 / arc .3 / stability .2。
4. **Screens/routes**：`BaselineCaptureMotionScreen` → `BaselineCaptureArcScreen`（arc_left→arc_right 單條閉合光弧 + 單一指令 turn left/right/return to center）；新增 `BaselineCaptureStabilityScreen`（一次自然呼吸）。route `capture-arc` / `capture-stability`。copy 走 compliance（不用「emotion」字眼）。
5. **測試**：mobile 4 suites 49 tests 全綠；`npx tsc --noEmit` exit 0；改動檔 biome 0 warning。
6. **Preview ceremony（給 founder 手機看）**：`/preview/soul-enroll.html`（+`.js`）獨立頁，自包含 canvas 星塵 mesh + 閉合金弧 + 3 個 precision indicators，cyan ACTIVE → gold SECURED，完成時粒子收束成核心 + `Baseline locked.`。對應 mobile FSM。DEPLOYMENT_MAP(.md/.json) 已登錄。

### Notes / gotchas
- 既有 finger ceremony `apps/preview/baseline-onboarding.js`（2000 行、iOS OOM 調校）**沒有**臉部 arc 流程，且改它風險高 → 改開獨立 `soul-enroll.html`，較安全也更貼合「感受 Face ID arc」的目標。
- 容器是乾淨 clone，root 與 apps/mobile 的 `node_modules` 都要各自 `npm ci`（mobile 不在 root workspaces）。`npx biome` 會誤抓到無關的 `biome@0.3.3`；要用 root 的 `./node_modules/.bin/biome`（@biomejs/biome 2.4.16）。biome 設定忽略 `apps/preview`。
- 仍未做（需 Mac，North Star §6 step 4）：vision-camera 真臉部偵測餵 6 信號、Skia halo gradient path、Reanimated 3。screens 目前用 timer mock 驅動（與既有 capture screen 同模式），契約不變、之後可換真信號。

## Next session（接手點）
1. 原生 session（Mac）：`useFaceDetector` frame processor → 真 landmarks → 真 6 信號餵 per-phase gate；Skia 化 halo。
2. 產品定位：把 `/face-baseline` 接成 onboarding 主入口；Scan tab 重定位為日常 Soul Scan（讀已建立 baseline），finger PPG 移校準層（North Star §6 step 3）。
3. 收 founder 看 `/preview/soul-enroll.html` 的回饋再迭代節奏/文案。

---

# 2026-06-13 Session Update (準星重設計 + 視覺迭代收口)

## What was done（PR #84、#85 均由 founder merge）

1. **Soul Lock 準星重設計（PR #84）**：founder 嫌舊準星難看 — 它是「虛線旋轉圈 + 十字箭頭 + `--` 殘影」的軍用 HUD 混合體。重設計為 Face-ID 級安靜 locus：96px 細環 + 四方位微點，等待白色呼吸（3.2s）、鎖定青色 bloom、訊號弱琥珀。十字箭頭全刪；計時改 300 字重、倒數前隱藏。
2. **同輪精準化（PR #84）**：face 模式 JS 蓋掉英文標題的 bug 修正（`Environment Calibration` 保住）；就緒頁降噪（藏 finger 時代 stage chips 與重複標題，coach 氣泡 = 唯一即時指令）；全 cosmos 畫面補紫/粉/藍三層 CSS 星雲；intro 去圓章 icon。
3. **黑屏遮擋修復（PR #85）**：掃描頁可捲動，但 `.scan-backdrop` 是 absolute — 跟著捲，95% 黑的 vignette 邊緣橫切畫面蓋住 banner/狀態列。改 `position: fixed` 釘 viewport + 黑度放軟 0.95→0.52。

### Notes / gotchas
- **scrollable step 裡的 `absolute inset:0` 覆蓋層都有同樣風險**（只蓋第一個視窗高、邊緣會滑進內容）— `.step::before/::after` 的星塵/星雲因為漸層淡出所以無感，但任何高對比 overlay 要用 fixed。
- 準星等互動狀態的視覺現在集中在 styles.css 尾部的 override 區塊，調整大小/顏色/呼吸速度都是單行改動。

## Next session
1. 視覺回饋隨時繼續（founder 連續快速 merge，迭代節奏很順）。
2. FSM 補缺口（雲端可做）：`arc_left/right`、`stability_pass`、QualityMetrics 擴充 + 測試。
3. 原生 session（等 Mac）：vision-camera 真信號、Skia orb、實機 QA。

---

# 2026-06-12 Session Update (品牌定案入庫 + Soul Scan 定調 + /preview/ 視覺對齊)

## What was done（PR #81、#82 均已 merge）

1. **品牌 Logo 定案入庫（PR #81）**：founder 的定案 mark（風掃過的浪）一直只存在 v6 splash 的 HTML 裡。已正式化：
   - `docs/assets/brand/tenki-mark.svg`（從 v6 splash 抽出的 master，currentColor）
   - `apps/mobile/assets/` 四個 PNG 全部從 master 重新輸出（之前是 Expo 佔位符！）
   - ANTIGRAVITY.md §18 = FINALIZED 規格（三段式 lockup：mark / TENKI 200·0.32em / CORE 600·0.4em `#00B4D8`+glow；動態 900ms 入場 + 6s 呼吸）
   - `/preview/brand/` 品牌預覽頁；中途的 Resonance Ensō 探索版已移除
   - 分工：`docs/BRAND.md` 管品牌語言、§18 管視覺，互相引用
2. **Soul Scan North Star（PR #81）**：`docs/SOUL-SCAN-NORTH-STAR.md` — 臉部基線 = 主掃描入口、finger 退為校準層、Face-ID 級首次建立、與現有 FSM 對照（缺口僅 `arc_left/right` 拆分 + `stability_pass` + 6 個原生品質信號）。CLAUDE.md 已加必讀指標。
3. **Visual Alignment Sprint（PR #82）**：`apps/preview/` 三畫面對齊參考圖（task.md P1–P3 全勾，5 commits）— tokens 進 `:root`、深空漸層 + CSS 星塵、漸層+光暈 CTA、Env Calibration 三顆狀態 pills（接 latched 訊號）、金框+藍弧+刻度尺+PRIVACY SECURED 的 capture 畫面。**task.md 寫的 "apps/web" 是筆誤，實際目標是 apps/preview**（apps/web 仍凍結未動）。
4. **持續擦屁股**：main 直推又兩次破壞（async-storage 沒裝、§18 衝突），均已修復。domain 測試 9 → 45。

### Notes / gotchas
- **Antigravity 仍在直推 main** — 已三度把紅燈/缺依賴帶進 main。請改走 feat/* → PR。
- npm 指令的 shell cwd 會在工具呼叫間被重置 — 在 apps/mobile 裝依賴務必用單一命令 `cd /abs/path && npm install ...`，否則會污染 root package.json。
- 背景 agent 可能撞 session 用量上限被砍 — 重要工作檢查 `git log` 確認實際 commits，別信 agent 的完成宣稱。

## Next session
1. 視覺二輪：吃 founder 看 `/preview/`、`/face-baseline/`、`/preview/brand/` 的回饋。
2. FSM 補缺口（可雲端做）：`arc_left/right`、`stability_pass`、QualityMetrics 擴充 + 測試（見 SOUL-SCAN-NORTH-STAR §5/§6）。
3. 原生 session（需 Mac）：vision-camera 真信號、Skia orb、實機 QA。

---

# 2026-06-11 Session Update #2 (main CI 紅燈修復 + 9 屏視覺對齊 pass)

## What was done（同分支續用，PR #79）

1. **修復 main CI 紅燈**：Antigravity 桌機把 Phase 1 視覺、Phase 2A（Skia+haptics）、2B（live camera）直推 main，8 個 commits CI 全紅。修復內容：
   - `BlurMask` 沒有 `sigma` prop → `blur`（兩個 `*Skia.native.tsx` 共 12 處）
   - 平台分檔 `*Skia.native/.web.tsx` 缺 tsc 解析目標 → 補 `.d.ts` shim（Metro 選平台檔、tsc 讀宣告）
   - vision-camera **v5** 沒有 `Camera.requestCameraPermission()` → `VisionCamera.requestCameraPermission()`（回傳 boolean）
   - hooks barrel 還在 export 已刪除的 `setHapticsImplementation`/`HapticsImpl`
   - hook 改為直接 import react-native 後破壞「無 RN 的 jest harness」→ `shouldFireHaptic` 純邏輯移回 `utils/haptics.ts`，hook re-export
   - 11 個 lint errors（forEach return + index keys）
   - `BrandWordmark` 的 favicon require 多一層 `../` → **web bundling 直接失敗**（dist 被 expo export 清空才發現）
2. **9 屏視覺對齊 pass**（founder 給 9 張 canonical 參考圖 + 嚴格任務書「收斂不創新」）：
   - 安裝 `expo-linear-gradient@~15.0.7` + `expo-blur@~15.0.7`（Expo Go + Web 相容）
   - 真 LinearGradient / BlurView 全面取代硬切色塊假漸層假毛玻璃；14 個 style commits（tokens → shared 元件 → 逐屏）
   - 逐屏自評 7.5–8.5/10，誠實差距與被原生卡住項目都寫在 PR #79 描述裡
3. Expo Web bundle 重建（`dist/` 是 gitignored，要 `git add -f`，沿用 Antigravity 的 force-add 慣例）。

## 結果
- **PR #79 已 merge**（founder 審過 preview）→ main CI 回綠，`/face-baseline/` 固定網址已是視覺對齊版。

### Notes / gotchas（給下個 session）
- **不要直推 main**：CI 只能擋 PR，直推會把紅燈帶進 main。Antigravity 桌機請改走 `feat/*` → PR。
- vision-camera v5 的 permission API 在 `VisionCamera` factory 上，不在 `Camera` 元件上。
- `expo export` 失敗時會先清空 output dir — dist 消失即 build 失敗的訊號。
- jest contract harness 依賴「`utils/` 永遠不 import react-native」這個約定，動 hooks 時要保持純邏輯在 utils。

## Next session
1. PR #79 merge 後：視覺第二輪（吃 founder 看 preview 的回饋）。
2. 原生 session（需 Mac）：Skia orb shader（消除同心圓色帶）、相機實拍、實機 haptics、Reanimated 轉場。
3. P2 backlog 不變：encrypted SQLite 持久化、Today tab 接 engine、domain policies 測試、Maestro E2E。

---

# 2026-06-11 Session Update (P0 基礎建設：CI + Biome + 文件糾正)

## What was done（branch `claude/fable5-opus48-specs-xaoghq`，Commit-Per-Todo 共 9 commits）

1. **CI 上線**：`.github/workflows/ci.yml` — 兩個 job（workspaces：lint + 4 套件 tsc + root npm test；mobile：tsc + jest）。在此之前 repo 完全沒有自動化檢查。
2. **Biome linter 上線**：root `biome.json` 只掃 packages/domain/apps-mobile（apps/web、core/、apps/preview 排除）；formatter 關閉避免大 diff。`npm run lint` / `npm run lint:fix`。`noExplicitAny` = error；`noNonNullAssertion`、`useExhaustiveDependencies` 降為 warn（hook deps 修正需實機 QA，留給 native 整合階段）。
3. **修了 4 個被掩蓋的真 bug**：
   - `packages/shared` 沒有 test script → 3 個測試套件（56 tests）從未被 root `npm test` 跑過；補上後曝露 `flags.ts` 的 import 路徑少一層 `../`（已修）。
   - `tsconfig.base.json` 的 `ignoreDeprecations: "6.0"` 在 TS 5.9 是非法值 → 所有 `tsc -p` 都跑不起來（已移除）。
   - `app/(tabs)/session.tsx` 的 `<ScrollView>` 沒關閉 → 該檔無法編譯（已修）。
   - `apps/mobile/package-lock.json` 與 package.json 不同步 → `npm ci` 失敗（已同步）。
4. **Lint 清理（104 檔）**：import type 轉換、移除 unused imports、7 個 `any` 換成正確型別、list key 改用內容 key（純計數渲染用 biome-ignore 註明）、`mock-scan.ts` 排程 helper 改為內部累加 timeline。
5. **文件糾正**：CLAUDE.md 工作流指令改為 Jest 實況（vitest 是寫錯的）+ 加 lint/CI 說明；root `vite.config.js` 移除從未生效的 vitest test 區塊。

## 驗證狀態
- root `npm test`：engine 259 + scan 111 + shared 56 + domain 9 = **435 tests 全綠**
- `cd apps/mobile && npm test`：**40 tests 全綠**；`tsc --noEmit` 零錯誤（4 個 packages 也零錯誤）
- `npm run lint`：**0 errors**（51 warnings 是刻意保留的已知項目）

### Notes / gotchas
- `biome.json` **不能寫註解**（會整份設定失效、退回全 repo 預設掃描）；要註解得改用 `biome.jsonc`。
- biome-ignore 註解只覆蓋「下一行」；JSX 多行屬性時要把註解放在 `key={i}` 的正上方（開標籤內可以放 `//` 註解）。
- `apps/mobile` 的 `(tabs)/scan.tsx` 仍在用 legacy `Animated`（違反 Reanimated 3 規範）— 是 mock 階段的權宜，P1 裝 Reanimated 時要一併改掉。

## Next session（P1 — Face Baseline 原生整合，原 plan 不變）
1. `apps/mobile` 安裝 `@shopify/react-native-skia`、`react-native-reanimated@3`、`react-native-vision-camera`(+face detection)、`expo-haptics`、`expo-blur`。
2. 按 SPEC Task 5 順序升級 14 個 Skia / 8 個 Reanimated `INTEGRATION` 標記點。
3. 實機 QA（需要 Mac / 裝置）。
4. P2 候選：encrypted SQLite 持久化（privacy-first 核心承諾，目前 0%）、Today tab 接 engine 真資料、domain policies 補測試、Maestro E2E。

---

# 2026-06-10 Session Update (Face Baseline System — Spec + Logic Foundation)

## What was done

1. **9-reference design unification**: Reverse-engineered all 9 Face Baseline reference frames into one production spec at `apps/mobile/features/face-baseline/SPEC.md`.
   - **Unifying law**: `cyan/blue = ACTIVE` (scan, setup, guidance, pre-baseline CTAs) · `gold = SECURED` (resonance, success, trust, maturity CTAs). CTA accent encodes which world the user acts from. Do NOT split these into two products.
   - 11 screens, full state machine, copy system, tokens, animation/haptics, Figma structure, guardrails.
2. **Camera-free logic foundation built + verified** (4 feat commits, Commit-Per-Todo):
   - `tokens/faceBaseline.tokens.ts` — design tokens
   - `types/` + `utils/` — domain types + pure logic (quality gate, maturity stages, capture progress weighting 0.6/0.4, retry-reason classification, confidence bands)
   - `store/` — Zustand store + selectors (maturity-aware)
   - `machine/` — typed dependency-free state machine + partial-retry/resume helpers
   - `index.ts` barrel.
   - Verified: `tsc --strict` clean on all `.ts`; runtime sanity checks pass (happy path + recovery + denied + maturity + retry classification).

## Recommended continuation

1. **Decide native dependency stack** before building components: `@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` (+ face detection), `expo-haptics`, `expo-blur`. None are installed yet; the app can't be run headlessly here, so this needs a deliberate install + a Mac/device to verify rendering.
2. Then build components in SPEC Task 5 order: `CosmicBackground` → `GlassInfoCard` → `GlowPrimaryButton` (cyan/gold) → `FaceScanFrame` → orbs/mesh.
3. Wire screens via `FaceBaselineNavigator` (expo-router) consuming the store + machine.

### Notes / gotchas
- `apps/mobile` is NOT in the root npm `workspaces` (only `packages/*` + `domain`) and has no vitest config — foundation was verified via standalone `tsc` + a throwaway compiled node script, not committed tests. If/when `apps/mobile` gets a test runner, port the sanity checks into real specs.
- No `node_modules` present on fresh container; installed `typescript` + `zustand` `--no-save` only for typechecking.

### Update — Static screens layer (same session)
Built the **onboarding-quality UI flow** on top of the verified logic foundation, using **core RN only** (no Skia/Reanimated/camera yet); every richer-visual point is marked `INTEGRATION (...)` in-file.
- `copy/face-baseline.copy.ts` — canonical English copy, all 11 screens, compliance-safe lexicon.
- `components/` — core-RN library faithful to the references: `CosmicBackground` (mode-driven), `GlowPrimaryButton` (cyan/gold accent law), glass card, resonance glyph, trust shield, privacy list, env checklist, `FaceScanFrame` (square/halo), soul mesh placeholder, processing orb, resonance orb, maturity bar, scan-history, insight card, recovery checklist, success card.
- `screens/` — 11 screens wired to the store + flow with **mocked** signals (env auto-readies, face auto-locks, capture/processing auto-progress with the 1.8s processing ritual honored).
- `app/face-baseline/` — **dedicated expo-router Stack** (`_layout.tsx` + 11 route files re-exporting feature screens). Reachable at route **`/face-baseline`**. Deliberately separate from `(tabs)/scan.tsx` — the generic scan tab was NOT touched.
- Verified: `tsc --strict` clean across all `.ts`/`.tsx` (RN+expo+zustand types installed `--no-save` for checking only; lockfile/package.json untouched). No runtime/device verification possible in this headless container.

### Next session continuation
1. Install the native stack (`@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` + face detection, `expo-haptics`, `expo-blur`) and upgrade each `INTEGRATION`-marked spot.
2. Replace mocked hooks with real `useCameraPermission` / `useFaceDetector` / `useEnvironmentChecks` / `useQualityMetrics`.
3. Wire a real entry point into `/face-baseline` (e.g. from first-run onboarding) and persist baseline + maturity to secure local storage.
4. Visual QA on device against the 9 references.

### Update — Logic tests (same session)
Converted the earlier throwaway sanity-checks into a committed **jest + ts-jest** harness (mirrors `packages/engine`; project uses jest, not vitest despite CLAUDE.md wording).
- `apps/mobile/package.json` — added `test` script, jest devDeps, and a jest block that transforms via a standalone `features/face-baseline/jest.tsconfig.json` (no expo extend, so tests don't need the RN/expo type tree).
- `features/face-baseline/__tests__/` — `machine.test.ts`, `utils.test.ts`, `store.test.ts` → **33 tests, all green** (state-machine happy path/recovery/denied/invariants, quality+maturity+progress+retry+confidence utils, store actions + selectors).
- Run with `cd apps/mobile && npm test`. apps/mobile is NOT a root workspace member, so root `npm test` won't pick these up — run them from the app dir.
- Verified green in-container; lockfile/`package-lock.json` untouched (test deps installed `--no-save` for the run only, but ARE declared in apps/mobile devDependencies for real installs).

*Last updated: 2026-06-10 (Claude Code — Face Baseline foundation + static screens + logic tests)*

---

# 2026-06-09 Session Update (New Computer Setup - 4th Migration)

## What was done

1. **New Machine Clone**: Cloned the repository into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`.
2. **Tools Configuration**: Set up Portable Node.js v22.22.3 (LTS Jod) and MinGit v2.45.1 (Portable Git) under `C:\Users\patron\.gemini\antigravity\scratch\tools\node` and `C:\Users\patron\.gemini\antigravity\scratch\tools\git` respectively.
3. **Environment Integration**:
   - Added paths persistently to the User `PATH` environment variable.
   - Updated and wired all environment wrapper scripts in the repo root: `env.bat`, `env.cmd`, `env.ps1`, and `start_env.bat` to refer to the new `tools/node` and `tools/git/cmd` locations.
4. **Dependencies Resolved**: Completed `npm install` successfully without engine conflicts (Node v22.22.3 fully satisfies Vite 7 requirements).
5. **Handoff Documentation**: Updated `ANTIGRAVITY.md` and `MEMORY.md` with the new machine environment status for seamless future handoffs.

## Recommended continuation

1. Run `npm test` inside the project to verify that all 19 suites and 259 tests pass under Node v22.22.3.
2. Launch the dev servers or Expo shell under `apps/mobile` or `apps/preview` to check runtime environments.
3. Resume the Phase B/C implementation (Replay Engine, Insight Generator, and mobile view integrations).

---

# 2026-05-14 Session Update (iOS Safari OOM Fixes - Preview Flow)

## What was done

1. Conducted an end-to-end review of the `apps/preview/` Finger Baseline onboarding flow.
2. Verified 11 existing OOM fixes previously implemented by the team.
3. Identified and fixed the root cause of the remaining iPhone 13 Safari crashes:
   - **OOM Fix #12 & #13**: Removed `mix-blend-mode: screen` from `.scan-flash` and `.finger-silhouette` in `styles.css`. iOS WebKit forces full stacking-context per-pixel compositing when mix-blend is active, which triggered the crash. Replaced with safe opacity/alpha fallbacks.
   - Reduced `backdrop-filter: blur(32px)` on `ceremony-dialog` to `4px` during the `gather` phase to prevent overlapping with particles and camera layers.
4. E2E tested the full 6-step flow in Vite dev server on desktop — successful completion, 60-second timer runs correctly, and transitions are clean.

## Recommended continuation

1. Start the **Delight Upgrade (爽感升級)**:
   - `stardust.js`: Spring/damping sync, dual-layer halo particles, pointer events for ripple/attractor, score-driven palette.
   - `haptics.js`: Breath-haptic sync during scanning.
   - `scan-ux.js`, `audio-engine.js`: Integrate breath syncing and audio pulses.
   - `results-renderer.js` / `results-page.css`: Atmosphere tint and ring glow.

---

# 2026-05-14 Session Update (New Windows Machine — 3rd Migration)

1. Cloned the repo on the new machine into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
2. Initially installed portable Node.js v20.12.2, then **upgraded to v20.19.2** (LTS Iron) to satisfy React Native 0.81 / Metro 0.83 engine requirements (`>= 20.19.4`)
3. Updated `start_env.bat` to point to the new portable Node.js path
4. Installed dependencies at repo root, `packages/engine`, and `apps/mobile`
5. Verified:
   - Node.js `v20.19.2`
   - npm `10.8.2`
   - Engine tests: **19 suites, 259 tests — ALL PASSING**
6. Updated `ANTIGRAVITY.md` continuation note with new machine paths

## Important machine-specific notes

- Repo path: `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Portable Node.js: `C:\Users\patron\.gemini\antigravity\scratch\nodejs\node-v20.19.2-win-x64`
- Always set PATH before running npm/expo commands (use `start_env.bat` or set `$env:PATH` in PowerShell)

## Recommended continuation

1. Launch the Expo app from `apps/mobile` and verify the 5-tab shell
2. Continue Phase C integration — wire mobile screens to engine/domain/shared
3. First slice candidates: Today screen data wiring, Scan flow engine integration, or Session gate/state integration

---

# 2026-04-28 Session Update (New Windows Machine / Continuation Handoff)

## What was done

1. Cloned the repo again on the new machine into `C:\Users\patron\Documents\Codex\2026-04-28\clone-https-github-com-poshen100-tenki`
2. Installed portable Node.js at `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64`
3. Verified `start_env.bat` already targets that portable Node.js path
4. Installed dependencies at repo root and at `apps/mobile`
5. Rebuilt npm dependencies successfully after correcting PATH to portable Node.js
6. Verified:
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes

## Important machine-specific warning

On this machine, the default `node.exe` may resolve to a WindowsApps / Codex stub. When npm spawns child processes through that path, commands can fail with `Access is denied`.

Safe rule for future sessions:

- Always open the shell with `start_env.bat`
- Or prepend `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64` to `PATH` before using npm/expo

## Active app reality check

- The real active mobile app is `apps/mobile`
- `README.md` now points collaborators to `apps/mobile` and `docs/DEPLOYMENT_MAP.md`
- The correct next-session dev path is:

```powershell
cd apps\mobile
npm start
```

## Recommended continuation

1. Launch the Expo app from `apps/mobile`
2. Verify the existing 5-tab shell renders on this machine
3. Continue Phase C integration/polish by wiring mobile screens to existing engine/domain/shared layers
4. Clean up stale root-level docs after confirming runtime flow

## Deployment map note

- Deployment URL meaning is now documented in `docs/DEPLOYMENT_MAP.md`
- Public Vercel root currently maps to `apps/web`
- `/preview/` routes map to `apps/preview`
- `apps/mobile` is the active implementation path but has no confirmed public deployment URL recorded in repo yet

# MEMORY.md — TENKI CORE AI Session Memory

> 此檔案由 AI 助手在每次 session 結束時更新。
> 人類不需要手動維護，但可以隨時修改或刪除任何條目。
> 每個 AI 工具（Antigravity / Claude / Claude Code）都應該讀取並更新此檔案。

---

## ⚠️ v3.0 架構轉型宣告 (2026-04-07)

**已廢棄概念（deprecated — 不要在新代碼中使用）**
- TEI / TEI PR99 → 改用 **Decision Edge Score (0-100)**
- FDCB (Floating Decision Control Bar) → 舊語意已廢棄
  - 計時/模板/事件邏輯 → 搬到 `packages/engine/src/session/`
  - `packages/fdcb/` → 改名為 `packages/scan/`（Finger Detection & Camera Biometrics）
- 4 zone (PEAK/OPTIMAL/NEUTRAL/DEGRADED) → 改為 **3 zone (Clear/Neutral/Strain)**
- 3 tier 訂閱 (free/retail/pro) → 改為 **2 tier (free/premium)**
- Supabase-first 架構 → 改為 **local-first + cloud-minimal**
- Trading 導向語言 → 改為 **wellness/readiness 語言**
- WIN/LOSS/BREAKEVEN → 改為 **outcome_tag**

**生效概念（active）**
- Decision Edge Score 0-100（8 維度加權）
- Session Governance Layer（modes + templates + timer + gate + violations）
- packages/scan/（Finger Heat Zone 掃描 pipeline）
- 3 zone：Clear (70-100) / Neutral (40-69) / Strain (0-39)
- 2 tier：Free / Premium
- Local-first encrypted SQLite
- Compliance Guardrail Engine
- Feature flags for dark launch

---

## 專案決策紀錄
- [2026-04-07] **v3.0 架構轉型啟動** — Founder 提供完整 16-section App Store-safe 規格書
  - 10 項決策全部確認：同目錄並行遷移、2 tier、scan 取代 fdcb、session governance、domain/ 取代 core 概念、ANTIGRAVITY v3 重寫、RULES-v3 建立、Phase A→B→C 順序、legacy adapter、feature flags
  - ANTIGRAVITY-v2.md 歸檔至 docs/archive/
  - ANTIGRAVITY.md v3.0 重寫完成
  - RULES-v3.md 建立（待 Founder 確認後覆蓋 RULES.md）
- [2026-03-27] 根目錄重整 — Web prototype 移入 apps/web/，Prompt 文件移入 docs/prompts/
- [2026-02-25] 架構決策：選擇 React Native + Swift Hybrid
- [2026-02-25] 後端選擇 Supabase → ⚠️ v3 改為 local-first
- [2026-02-25] 訂閱計費選擇 RevenueCat
- [2026-02-26] FDCB v2.0 spec → ⚠️ v3 已重新定義
- [2026-03-01] packages/engine/ 全模組完工（v2 — 現歸入 legacy）
- [2026-03-01] packages/fdcb/ 完整實作（v2 — 現歸入 legacy）
- [2026-03-02] **Phase 0 完工** — Engine 99.53% / FDCB 97.93% coverage（v2 baseline）

## Founder 偏好（AI 應記住）
- Poshen 偏好先看架構全貌再進細節
- 溝通語言：繁體中文，代碼用英文
- 不喜歡過長的解釋，喜歡表格比較 + 明確結論
- 每次決策要考慮 solo founder 時間效率
- 重視 Garmin 數據對齊（用戶信任感）
- 習慣雙 AI 工作流（Antigravity 寫代碼、Claude 做 review）
- Mac mini 尚未購買，目前只能做不需要 Mac 的任務
- **v3 新增**：重視 App Store compliance、privacy-first、安全語言

## 已知地雷（AI 應避免）
- 不要動 apps/web/ 裡的任何檔案
- 不要使用 prohibited vocabulary（見 ANTIGRAVITY.md v3 Section 2）
- 不要在 user-facing copy 中使用醫療或金融建議語言
- 不要把 raw biometric data 設計為上傳到雲端
- 星塵動效的「感覺」不能改，重建時保持 v25.8.2 的視覺體驗
- 不要用 SVG 畫環，用 Skia
- 不要用 Animated (legacy)，只用 Reanimated 3
- **v3 新增**：不要使用 TEI、PR99、舊 FDCB 語意
- **v3 新增**：不要設計 4 zone 或 3 tier subscription
- **v3 新增**：不要把隱私控制放在付費牆後

## 技術偏好與標準
- TypeScript strict mode，不允許 any
- 測試用 Jest + ts-jest
- 狀態管理用 Zustand（不用 Redux）
- 常數要導出且具名
- Edge Score 用加權正規化（不再是 PR99 百分位）
- 每個 function 必須有 JSDoc
- engine/ 和 scan/ 測試覆蓋率 ≥ 90%
- 動畫用 Reanimated 3（不用 legacy Animated）
- 環形圖用 Skia（不用 SVG）
- EWMA α=0.05 極慢收斂
- **v3 新增**：Feature flags 控制所有未成熟功能
- **v3 新增**：Compliance Layer 驗證所有 user-facing copy
- **v3 新增**：Local-first — 使用 encrypted SQLite

## 上次 Session 結束點
- **日期**: 2026-04-14
- **最後完成**:
  - ✅ Baseline Onboarding 4 交付全部完成
  - ✅ Signal Quality Gate (coverage/brightness/stability/SQI 四維度閘門)
  - ✅ Baseline Bootstrap Engine (30-60s 掃描 → 初始基線)
  - ✅ Domain contracts + policies (6 步狀態機、重試邏輯、失敗分類)
  - ✅ 6-step UX copy (5 個 UX 標準全部滿足)
  - ✅ Web Preview UI (`apps/preview/`) — 瀏覽器驗證全部通過
  - ✅ 22 個新測試案例 (signal-quality-gate: 12, bootstrap: 10)
- **下一步**:
  1. 跑 vitest 確認 engine 測試通過（需安裝 Node.js）
  2. git commit + push 所有 baseline onboarding 程式碼
  3. 繼續 Phase C — 5 Tab UI (Today/Scan/Session/Timeline/Lab)
  4. 或依 Founder 指示做下一個功能

## 各 AI 工具的角色分工
| 工具 | 角色 | 目前使用狀態 |
|------|------|-------------|
| Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro) | 主力代碼生成 + 架構 | ✅ 使用中 |
| Claude (claude.ai) | 架構決策、代碼 review、文件制定 | ✅ 使用中 |
| Claude Code | Terminal 任務、Expo init、Native Module | ❌ 等 Mac 到手 |

---

## 2026-04-14 Session Update (Baseline Onboarding Complete)

### 4 Deliverables Completed:
1. **Baseline Onboarding Flow** — 6-step guided flow (Intro → Sensor Choice → Readiness Check → Calibration Scan → Baseline Result → Next Action)
2. **Signal Quality Gate** — Multi-dimensional readiness check (coverage, brightness, stability, SQI) with human-readable messages per failure type
3. **Baseline Bootstrap Engine** — Converts 30-60s scan into initial BaselineProfile via Welford's algorithm. Classifiable error codes: NO_READINGS, ALL_REJECTED, INSUFFICIENT_QUALITY, INSUFFICIENT_DURATION
4. **Completion UX** — "不是好壞分數" messaging, confidence badge, metric cards, next action routing

### New Files Created:
- `packages/engine/src/baseline/signal-quality-gate.ts`
- `packages/engine/src/baseline/bootstrap.ts`
- `packages/engine/src/baseline/__tests__/signal-quality-gate.test.ts` (12 test cases)
- `packages/engine/src/baseline/__tests__/bootstrap.test.ts` (10 test cases)
- `domain/src/contracts/baseline-contract.ts`
- `domain/src/policies/baseline-policy.ts`
- `packages/shared/src/copy/baseline-onboarding.ts`
- `apps/preview/index.html`
- `apps/preview/styles.css`
- `apps/preview/baseline-onboarding.js`

### UX Standards Met:
1. ✅ 掃描前就讓使用者知道成功條件
2. ✅ 掃描中只顯示 1 個主狀態
3. ✅ 任何失敗都可解釋
4. ✅ 結果頁講人話（「不是好壞分數」）
5. ✅ 成功後感受到之後每次評估都會更準

### Browser Verification:
- All 6 steps rendered and transitioned correctly
- Readiness meters animated properly
- Scan timer + progress ring worked
- Baseline result displayed realistic metric values
- No console errors

## 2026-04-21 Session Update (Library Session)

### 達成進度：
1. **環境設定與維護**：在免安裝 Node.js (v24.15.0) 環境中修復 `vitest` 到 `jest` 的兼容性錯誤，`packages/engine` 的 19 個測試套件 (259 個測試) 現已全數通過。
2. **Phase B 基礎建設 (Step 2)**：
   - 透過 GitHub 介面手動部署了 145KB 的 `apps/preview/v6/index.html`，成功規避了大檔案寫入造成的 Timeout 錯誤。
   - 完成 `.tei` 到 `.tl-tei` 的 CSS Class 重新命名任務（包含 3300 多行程式碼）。
   - 實作 **v3 語意合規**：全面替換不符合 v3 架構的專有名詞，例如將 `TEI` 替換為 `Edge Score`，將 `PR99` 替換為 `Decision Edge`。

### 下一步 (Next Session)：
1. 實作 Replay Engine 與 Insight Generator。
2. 完成完整的整合測試 (Full Pipeline)。

*Last updated: 2026-04-21 11:46*
*Updated by: Antigravity (Library Session End)*
