/**
 * TENKI — Soul Scan（正典掃描模組）
 *
 * 「一個掃描，多道門」：v6 Scan tab、/decision-alert/ 進入決策、待命狀態卡，
 * 全部開這一支。以前 v6 的星塵 takeover 是唯一實作但耦合 v6 DOM 且寫死讀數，
 * 這支把它升格成兩個 host 都能載入的共用模組。
 *
 * 對外唯一輸出是一個 ReadinessReading（契約見
 * domain/src/contracts/readiness-reading.ts）—— 質化帶位，永遠不生成 0-100 分。
 *
 * 合規：全程校準/流程語言；無醫療、無情緒辨識、無進出場建議；影像只在本機運算。
 *
 * S1（骨架）：markup 注入 + 生命週期 + mission 框架。
 * S2（本次）：逐幀量測 → evidence 匯總 → band/confidence → 寫入
 *   `tenki.readiness.reading.v1`。S3 再疊 cyan/gold 儀式層。
 */
(function (global) {
  'use strict';

  var OVERLAY_ID = 'tenki-readiness-scan';
  /** 必須蓋過 v6 既有 takeover 的 z9000（含底部常駐指紋 wrapper）。 */
  var OVERLAY_Z = 9700;

  /** 讀數 store —— 與 apps/preview/decision-alert.js 同一把鑰匙。 */
  var READING_STORE_KEY = 'tenki.readiness.reading.v1';

  // ── 量測常數（鏡射 apps/preview/soul-enroll.js 的閘門，不另立一套）──

  /** 取樣邊長：夠算亮度/均勻度/逐幀位移，成本低到能持續跑。 */
  var SAMP = 64;
  /** ~15fps 取樣；比 rAF 慢，省電且對量測精度無損。 */
  var SAMPLE_INTERVAL_MS = 66;
  /** 每像素平均 luma 變化達此值 → 視為完全不穩。 */
  var MOTION_DIVISOR = 40;
  /** 四象限亮度標準差達此值 → 均勻度歸零。 */
  var UNIFORMITY_SD_DIVISOR = 60;
  /** 中央區水平梯度除數（Tier B 取景啟發式）。 */
  var DETAIL_DIVISOR = 18;

  /**
   * 曝光。0.34 原本同時是「滿分下限」和「閘門」—— 實機在夜間室內光下直接卡死
   * （2026-08-01 founder 23:17 實走：LIGHTING 紅、進度條停在 0，掃描永遠走不完）。
   * 拆成兩個角色：0.34 以上算滿分，0.16 以下才真的太暗；中間是**斜坡**，
   * 光線差就讓 captureQuality 掉、confidence 跟著降 —— 而不是不給讀數。
   * 0.16（≈41/255）以下臉基本上只剩剪影，landmark 也追不動，那時停下來是有依據的。
   */
  var BRIGHTNESS_FULL_MIN = 0.34;
  var BRIGHTNESS_FLOOR = 0.16;
  var BRIGHTNESS_MAX = 0.97;
  var UNIFORMITY_MIN = 0.50;
  var MOTION_STILL_MAX = 0.40;
  var DETAIL_MIN = 0.20;

  // ── 臉部追蹤（Tier A）常數 ──
  // 全部沿用 v6/stardust-scan-takeover.js 已經調過的值，不另立一套。

  /** MediaPipe 推論節流：~5.5fps。比這快在手機上只是燒電。 */
  var FACE_INTERVAL_MS = 180;
  /** 位移速度達此值＝takeover 判定「HOLD STILL」的門檻 → stillness 讀 0。 */
  var LANDMARK_MOTION_CEILING = 0.35;
  /**
   * Tier A 的 stillness 閘門。**不能借用 `MOTION_STILL_MAX`** —— 那是 soul-enroll
   * 給「整幀 luma 差分」調的尺度，跟 landmark 位移不是同一種量。取 takeover 那個
   * 已調過的 HOLD STILL 門檻的一半當閘門（speed ≤ 0.175 ⟺ stillness ≥ 0.5），
   * 留餘裕給低光下的 landmark 抖動。
   */
  var LANDMARK_STILL_GATE = 0.5;
  /** 眼睛開合正規化除數（landmark y 距離 → 0..1）。 */
  var EYE_OPEN_DIVISOR = 0.035;
  /** 主指令的去抖動視窗 —— 沿用 takeover `stabilizeHint` 已調過的值。 */
  var HINT_HOLD_MS = 350;
  /**
   * 對位標記的平滑係數（EWMA）。
   *
   * ⚠️ **刻意不是 CLAUDE.md 的 `α=0.05`。** 那個是給慢速指標（分數類）用的 ——
   * Body Battery 的教訓是「24h 指標像均衡器跳＝謊報」。但對位標記是**即時操作回饋**：
   * 使用者動一下就要看到它跟著動，0.05 會慢到完全沒法用來對位。
   * 兩者服務的是不同的誠實：慢指標不能假裝反應快，操作回饋不能假裝沒收到。
   * 下個 session 不要「順手統一」成 0.05。
   */
  var RETICLE_SMOOTH = 0.35;
  /**
   * 鎖定磁吸期間的收束係數 —— 比追蹤時果斷得多。
   *
   * 追蹤時 0.35 是「跟著你」，磁吸時要的是「**被儀器拉進去**」：
   * 使用者沒有在操作它了，是儀器在收。兩者是不同的事，不共用一個值。
   */
  var RETICLE_SNAP_SMOOTH = 0.75;
  /** 磁吸持續時間 —— MOTION-DIRECTION §3 音階的「狀態切換」。 */
  var RETICLE_SNAP_MS = 300;
  /** 目標環半徑（viewBox 單位）＝ 理想臉框大小落在框內的視覺尺度。 */
  var RETICLE_TARGET_R = 52;
  /**
   * 對位誤差飽和點（以容差為 1.0 的尺度）。
   * 2 ＝ 偏離到容差的兩倍才算「完全沒對準」；剛好進容差時 err=0.5，
   * 對應角括號 scale(1.07)＝改動前的固定值，所以鎖定那一刻不會跳。
   */
  var ERR_RATIO_SPAN = 2;
  /** 眨眼遲滯門檻（EAR-normalized，與 takeover 同一組）。 */
  var BLINK_CLOSE = 0.25;
  var BLINK_OPEN = 0.55;
  /** 星塵表情的正規化除數 —— 沿用 takeover 已調過的值，改動＝改星塵手感。 */
  var MOUTH_OPEN_DIVISOR = 0.05;
  var BROW_SPAN_DIVISOR = 0.22;
  /** 收束曲線與色值：對齊 tokens.css 的 --ease-secure / --cyan-active / --gold-secured。
   *  這裡寫字面值而不是 var()，因為本模組自帶樣式、不假設 host 載了 tokens.css。 */
  var EASE_SECURE = 'cubic-bezier(0.19,1,0.22,1)';
  var HALO_ACTIVE = '#22D3EE';
  var HALO_SECURED = '#FFD46E';
  /**
   * 星塵在收束時要落到的帶位色 —— **鏡射 `apps/preview/tokens.css` 的 zone token**
   * （`--zone-clear` / `--zone-neutral` / `--zone-strain`，見 `docs/VISUAL-DIRECTION.md` §3）。
   *
   * ⚠️ 這是一份鏡射，鏡射就會漂移。理由跟上面 HALO_* 一樣：本模組自帶樣式、
   * 不假設 host 載了 tokens.css，`getComputedStyle` 解 `var()` 又不能放進每幀路徑。
   * 所以**由 harness 去比對這裡的字面值與 tokens.css 是否仍相同** ——
   * 讓漂移會喊痛，而不是靠人記得（PLAYBOOK §6：判定/呈現只能有一個來源；
   * 真的必須鏡射時，要有東西守住兩份是一樣的）。
   */
  var BAND_TONE = { clear: '#00B4D8', neutral: '#64748B', strain: '#C2703D' };
  /**
   * 收束時往帶位色拉多少。
   *
   * ⚠️ 2026-08-10 由 0.5 調到 0.85（founder 實走）：0.5 時**看不出是哪個帶位** ——
   * 因為漸層底部本來就是 cyan，往 Clear（`#00B4D8`）拉等於沒拉，只有頂端被拉一半，
   * 於是 Clear / Neutral / Strain 三種收束長得幾乎一樣。金框有做到 SECURED，
   * 但球沒有說出結果。0.85 讓三種一眼分得出來，剩下的 0.15 保住粒子的層次。
   */
  var TONE_REVEAL_MIX = 0.85;
  /** SECURED 那一拍先閃過的金，隨後才落到帶位色。要夠強，否則會被隨後的帶位色蓋掉。 */
  var TONE_SECURED_MIX = 0.8;
  /** gold → 帶位色的停留時間。 */
  var TONE_SECURED_MS = 700;
  /**
   * 量測中色相位移的上限（turn）。**單向：0 → +TONE_LIVE_HUE，不得為負。**
   *
   * 🔴 為什麼不能往負向走：負向旋轉會把漸層底部的 cyan 轉成綠
   * （hue −0.10 → `#00E48B`），而 **v6 的 `--good` 就是綠 `#34C759`** ——
   * 等於在還沒有任何結果時亮起「good」。founder 2026-08-10 實走截圖抓到的就是這個。
   * ⚠️ 這跟「`.locked` 不該上金」是同一類錯：我擋住了自己要用的色，卻沒有反過來問
   * **「我即將產生的顏色，在這個產品裡是不是已經有主人」**。
   *
   * 上限 0.06 也是算出來的，不是估的：+0.10 時漸層頂端變成 `#FF667C`，
   * 跟 Timeline 上「沒有做出判定」的 `#FF7E76` 幾乎同一個色；
   * +0.06 的頂端 `#FF62A0` 仍明確是粉紅，三個色階全部留在原本的家族裡。
   * harness 會把 0..+0.06 全掃一遍去撞已被指派意義的色，改這個數字前先看那條。
   */
  var TONE_LIVE_HUE = 0.06;
  /**
   * 星塵讀出的 stillness 高錨（低錨用 `LANDMARK_STILL_GATE`）。
   * 0.95 而不是 1.00 —— 要求使用者做到完美才給滿分的回饋，那個回饋等於拿不到。
   */
  var READOUT_STILL_HI = 0.95;
  /**
   * 光弧起點位移（周長比例）—— 把起點從 SVG rect 的預設起點移到**上緣正中**。
   *
   * 推導（rect x=1 y=1 w=h=234 rx=ry=63）：直線段 = 234 - 2×63 = 108；
   * 每個圓角 = π×63/2 ≈ 98.96；周長 = 4×108 + 4×98.96 ≈ 827.84。
   * rect 路徑起點在 (x+rx, y) = 左上圓角結束處、順時針沿上緣往右，
   * 上緣中點距它 234/2 - 63 = 54px → 54 / 827.84 ≈ 0.0652。
   */
  var HALO_START_OFFSET = 0.0652;
  /** 取景範圍：臉框邊長與置中容差。 */
  var FACE_SIZE_MIN = 0.30;
  var FACE_SIZE_MAX = 0.65;
  var FACE_CENTER_X_TOL = 0.08;
  var FACE_CENTER_Y_TOL = 0.09;
  /**
   * 鎖定遲滯（見 `evalFramed`）。
   *
   * `FRAME_LOCK_STREAK = 2`：以 `FACE_INTERVAL_MS`(180ms) 計 ≈ 360ms 才入鎖。
   * 取 2 是先驗的折衷（濾掉邊界抖動 vs 不讓儀器顯得遲鈍），**還沒有實機調過** ——
   * 手感調參歸桌機 lane（MOTION-DIRECTION §7），雲端這邊只負責把旋鈕做出來。
   * `FRAME_RELEASE_SLACK = 1.25`：解鎖容差放寬 25%，呼吸與微幅晃動不會把人踢出去。
   */
  var FRAME_LOCK_STREAK = 2;
  var FRAME_RELEASE_SLACK = 1.25;
  /**
   * 頭部朝向的 landmark 索引與門檻（見 `headPose`）。
   * 鼻尖 1、左右眼外角 33 / 263 —— MediaPipe FaceMesh 的標準索引，
   * 與檔內其他索引（159/145/386/374 眼、13/14 嘴）同一套。
   */
  var NOSE_TIP = 1;
  var EYE_OUTER_L = 33;
  var EYE_OUTER_R = 263;
  /**
   * 「沒有正對鏡頭」的門檻（以兩眼外角距離正規化的偏移）。
   *
   * ⚠️ 這兩個值是**先驗的保守估計，還沒實機調過** —— 手感調參歸桌機 lane
   * （MOTION-DIRECTION §7）。取得偏寬鬆，寧可少講一次也不要一直誤報「正對鏡頭」：
   * 一個一直亮的提示比沒有提示更糟。
   * pitch 的容忍度比 yaw 大：正臉時鼻尖本來就在兩眼中點**下方**，基線不是 0。
   */
  var YAW_SQUARE_MAX = 0.22;
  var PITCH_SQUARE_MIN = 0.16;
  var PITCH_SQUARE_MAX = 0.62;
  /** 臉部資料超過這麼久沒更新就當作臉不在（推論比取樣慢，要留寬容）。 */
  var FACE_STALE_MS = 700;
  /** Tier A 要成立，landmark 樣本至少要這麼多 —— 只瞄到一兩幀不算量到。 */
  var MIN_LANDMARK_SAMPLES = 10;

  /** 低於此的有效取景時間不足以生讀數 —— 寧可沒有讀數，也不生一個。 */
  var MIN_HELD_MS = 5000;
  /** 品質一直不過關時的牆鐘上限（budget × 此值），避免無限等待。 */
  var CEILING_FACTOR = 3;
  // 這裡以前有一個 REVEAL_MS = 1200：揭示停 1.2 秒就自動關掉。
  // 已移除 —— 揭曉改成**停著等使用者自己點「完成」**（founder 2026-08-09），
  // 所以收尾不再由計時器決定。要調節奏請看 showVerdict()，不要把常數加回來。

  // ── band / confidence 政策（鏡射 domain/src/policies/readiness-band.ts）──
  // preview 是 vanilla JS 不能 import domain，沿用 decision-alert.js 既有的鏡射慣例；
  // 閾值與權重改動時兩邊要一起改。

  var CLEAR_AT = 0.7;
  var NEUTRAL_AT = 0.45;
  var HIGH_CONFIDENCE_AT = 0.75;
  var MODERATE_CONFIDENCE_AT = 0.5;
  var WEIGHT_STILLNESS = 0.5;
  var WEIGHT_BLINK = 0.3;
  var WEIGHT_CAPTURE = 0.2;

  var BAND_LABEL = { clear: 'Clear', neutral: 'Neutral', strain: 'Strain' };
  var CONFIDENCE_LABEL = { high: '信心高', moderate: '信心中', low: '信心低' };

  /** 來意 — 同一台儀器，不同任務。決定文案與時間預算。 */
  var MISSIONS = {
    daily:    { label: '建立今天的讀數', budgetSec: 10 },
    decision: { label: '決策前讀數',     budgetSec: 8  },
    refresh:  { label: '重新讀一次',     budgetSec: 8  },
  };

  var session = null; // { resolve, mission, symbol, stream, raf, cancelled }

  // ── markup（冪等注入；模組自帶 DOM，不依賴 host 頁面預先具備任何 id）──

  function ensureOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    var style = document.createElement('style');
    style.setAttribute('data-tenki-readiness-scan', '1');
    style.textContent = [
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:' + OVERLAY_Z + ';display:none;',
      'background:#05060A;color:#F4F6FF;font-family:inherit;',
      'flex-direction:column;align-items:center;justify-content:center;gap:18px;}',
      '#' + OVERLAY_ID + '.open{display:flex;}',
      // 🔴 相機影像一幀都不顯示（North Star §4，founder 2026-08-08 拍板）。
      // 看到自己的臉會變成自拍、有容貌焦慮的人反而更緊張，而且牽涉肖像權與免責。
      // 完全露臉只保留在建立臉部基線那條流程。對位改用框內的抽象標記（見下）。
      //
      // ⚠️ **video 元素必須留在版面裡並維持解碼** —— `sampleFrame()` 靠
      // `drawImage(video)` 取像素。改成 `display:none` 或壓成 1px 會讓瀏覽器
      // 停止解碼，整個量測會**無聲死掉**（掃描跑完卻沒有讀數）。
      // `drawImage` 取的是 videoWidth/videoHeight 內在尺寸，與 CSS 尺寸無關，
      // 所以「透明但仍佔版面」既看不到、也不影響取樣品質。
      '#' + OVERLAY_ID + ' .rs-lens{position:absolute;inset:0;border-radius:64px;',
      'overflow:hidden;opacity:0;pointer-events:none;}',
      '#' + OVERLAY_ID + ' .rs-video{width:100%;height:100%;display:block;',
      'object-fit:cover;transform:scaleX(-1);}',
      // 星塵核心（North Star §4「內核 = 星塵靈魂，外框 = 精密掃描框」）。
      // 住在 .rs-frame 裡、夾在 video 與線稿之間；pointer-events:none 讓取消鈕維持可按。
      // 沒有 three.js / 已被 host 佔用 / reduced-motion 時這層是空的 div，不影響版面。
      // 裁成與 .rs-lens 同一個超橢圓，粒子不會溢出到框外。
      // ⚠️ overflow 放在這一層，不能放 .rs-frame —— 那會切掉光弧描邊與角括號。
      '#' + OVERLAY_ID + ' .rs-stardust{position:absolute;inset:0;border-radius:64px;',
      'overflow:hidden;pointer-events:none;}',
      '#' + OVERLAY_ID + ' .rs-stage{position:relative;z-index:1;display:flex;',
      'flex-direction:column;align-items:center;gap:18px;padding:0 24px;text-align:center;}',
      '#' + OVERLAY_ID + ' .rs-mission{font-size:11px;letter-spacing:0.24em;',
      'text-transform:uppercase;color:#A6ADC8;}',
      '#' + OVERLAY_ID + ' .rs-symbol{font-size:13px;color:#3DE0FF;letter-spacing:0.08em;}',
      '#' + OVERLAY_ID + ' .rs-symbol:empty{display:none;}',
      // 掃描框：只負責版面尺寸。**框線本身由 SVG 的 track 描邊畫**（見下），
      // 這裡不能再放 CSS border —— 兩個形狀疊在一起正是 2026-08-07 實走看到的
      // 「金色圓圈與圓角方框各自為政」。
      '#' + OVERLAY_ID + ' .rs-frame{position:relative;width:236px;height:236px;}',
      // Progress Halo（North Star §4「沿臉框逐段閉合的光弧，不用一般圓形 loading」）。
      // track 與 fill 是**幾何完全相同**的兩個 rect：track 就是框，fill 是進度。
      // 只有一條路徑，所以不可能再出現第二個形狀。
      '#' + OVERLAY_ID + ' .rs-halo{position:absolute;inset:0;width:100%;height:100%;',
      'overflow:visible;pointer-events:none;}',
      '#' + OVERLAY_ID + ' .rs-halo rect{fill:none;stroke-linecap:round;',
      'transition:stroke 0.3s ' + EASE_SECURE + ';}',
      '#' + OVERLAY_ID + ' .rs-halo .rs-halo-track{stroke:rgba(61,224,255,0.28);stroke-width:1;}',
      '#' + OVERLAY_ID + ' .rs-halo .rs-halo-fill{stroke:' + HALO_ACTIVE + ';stroke-width:2.5;}',
      '#' + OVERLAY_ID + ' .rs-frame.secured .rs-halo-track{stroke:rgba(255,212,110,0.45);}',
      '#' + OVERLAY_ID + ' .rs-frame.secured .rs-halo-fill{stroke:' + HALO_SECURED + ';',
      'filter:drop-shadow(0 0 6px rgba(255,212,110,0.55));}',
      // 進度停住時光弧明顯黯下去。**這不是裝飾** —— 進度只在品質閘門通過時前進
      // （pause-not-reset），這一層就是把那個因果講出來：「環停住是因為你沒對準」。
      '#' + OVERLAY_ID + ' .rs-frame.stalled .rs-halo-fill{opacity:0.3;}',
      '#' + OVERLAY_ID + ' .rs-halo-fill{transition:opacity 0.3s ' + EASE_SECURE + ';}',

      // ── cyan 角括號 ──
      // 也長在**同一條路徑**上（第三個幾何相同的 rect），只是用 dash 只露出四個圓角。
      // 這是 2026-08-07 那個「圓套在方框外」的同一課：任何要「沿著框」的東西，
      // 就得跟框共用路徑，不能自己另外畫一個形狀近似它。
      //
      // 為什麼 dash 值是這兩個數：pathLength=1 之下，每段直線佔 0.130460、
      // 每個圓角佔 0.119540，兩者相加正好 0.25 —— 所以「露出圓角、藏起直線」
      // 這個 pattern 每 1/4 周長重複一次，四個角自動等距。offset 推到第一個圓角起點。
      //
      // 收攏程度**連續**綁在對位誤差上（`--rs-err` 由 updateReticle 每幀寫）：
      // 越接近越緊，這是「越來越熱」的頻道，跟 reticle 的「你在哪裡」互補。
      // err 沒被寫（還沒看到臉）時退回 1 ＝ 張到最開，讀作「在搜尋」。
      // transition 短於 halo 的 0.3s —— 它要跟得上手的動作，不是慢速指標。
      '#' + OVERLAY_ID + ' .rs-halo .rs-halo-corners{stroke:' + HALO_ACTIVE + ';stroke-width:3;',
      'stroke-dasharray:0.11954 0.13046;stroke-dashoffset:-0.13046;',
      'opacity:calc(0.4 + (1 - var(--rs-err, 1)) * 0.35);',
      'transform-box:fill-box;transform-origin:center;',
      'transform:scale(calc(1 + var(--rs-err, 1) * 0.14));',
      'transition:transform 0.16s linear,opacity 0.16s linear;}',
      // 鎖定後回到 Lock 語彙的 snap 曲線（此時 --rs-err 已經很小，位移不大，
      // 差別在**手感**：收斂是跟手的，snap 是儀器自己下的判斷）。
      '#' + OVERLAY_ID + ' .rs-frame.locked .rs-halo-corners{',
      'transition:transform 0.3s ' + EASE_SECURE + ',opacity 0.3s ' + EASE_SECURE + ';}',
      // ── 目標環 + 對位標記：取代「看自己的臉」──
      // 望遠鏡／雷達的作法：不給你看目標長什麼樣，給你看儀器有沒有套住它。
      '#' + OVERLAY_ID + ' .rs-halo .rs-target{fill:none;stroke:rgba(61,224,255,0.30);',
      'stroke-width:1;stroke-dasharray:4 7;}',
      // 位置與大小全部走 transform（每幀只寫 transform/opacity，見 renderReticle）。
      // transform-box:fill-box + origin:center 讓 scale 以圓心為準，不會往左上飄。
      '#' + OVERLAY_ID + ' .rs-halo .rs-reticle{fill:rgba(34,211,238,0.10);',
      'stroke:' + HALO_ACTIVE + ';stroke-width:2;opacity:0;',
      'transform-box:fill-box;transform-origin:center;',
      // 描邊不隨 scale 變粗變細 —— 儀器的線寬是固定的，變的是它套住多大的東西。
      'vector-effect:non-scaling-stroke;',
      'transition:opacity 0.3s ' + EASE_SECURE + ';}',
      // 有臉才顯示標記 —— 沒量到就不畫，不憑空生一個位置出來。
      '#' + OVERLAY_ID + ' .rs-frame.tracking .rs-reticle{opacity:1;}',
      // 鎖定：標記與目標環合一（磁吸由 JS 把座標寫回中心，這裡只負責視覺強調）。
      '#' + OVERLAY_ID + ' .rs-frame.locked .rs-reticle{fill:rgba(34,211,238,0.22);',
      'filter:drop-shadow(0 0 8px rgba(34,211,238,0.6));}',
      '#' + OVERLAY_ID + ' .rs-frame.locked .rs-target{stroke:rgba(34,211,238,0.55);',
      'stroke-dasharray:none;}',
      '#' + OVERLAY_ID + ' .rs-frame.secured .rs-reticle{stroke:' + HALO_SECURED + ';',
      'fill:rgba(255,212,110,0.18);filter:drop-shadow(0 0 8px rgba(255,212,110,0.55));}',
      '#' + OVERLAY_ID + ' .rs-frame.secured .rs-target{stroke:rgba(255,212,110,0.5);}',
      // snap：四角一起收到位並提亮 —— MOTION-DIRECTION §4「Lock 鎖定」的落點。
      '#' + OVERLAY_ID + ' .rs-frame.locked .rs-halo-corners{transform:scale(1);opacity:1;}',
      // 收束時角括號跟著整組轉 gold（cyan=ACTIVE / gold=SECURED）。
      '#' + OVERLAY_ID + ' .rs-frame.secured .rs-halo-corners{stroke:' + HALO_SECURED + ';}',
      // ── 鎖定那一拍：發散 → 一擊 → 靜 ──
      // 爽的不是更多動作，是**突然的靜**。所以這裡的每個動畫都只播一次、
      // 都在 300ms 內結束，之後畫面完全不動 —— 那個安靜才是「我抓到你了」。
      // 時長一律取 MOTION-DIRECTION §3 的音階（150 / 300 / 600），不自創數值。
      '#' + OVERLAY_ID + ' .rs-flash{position:absolute;inset:0;border-radius:64px;',
      'pointer-events:none;opacity:0;background:radial-gradient(circle at center,',
      'rgba(34,211,238,0.60) 0%,rgba(34,211,238,0.20) 48%,rgba(34,211,238,0) 76%);}',
      // flicker（極速運算感）150ms + 閃光 300ms + 角括號回彈 300ms，同一拍下。
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-halo-track{animation:rs-flicker 0.15s steps(1) 1;}',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-flash{animation:rs-bloom 0.3s ' + EASE_SECURE + ' 1;}',
      // 回彈才有 snap：--ease-secure 是 expo-out（不回彈），所以 overshoot 得寫在
      // keyframes 裡 —— 收過頭一點點再回到位，這是「咬住」而不是「滑到」。
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-halo-corners{',
      'animation:rs-corner-snap 0.3s ' + EASE_SECURE + ' 1;}',
      '@keyframes rs-flicker{0%{stroke:' + HALO_ACTIVE + ';}',
      '35%{stroke:rgba(61,224,255,0.28);}70%{stroke:' + HALO_ACTIVE + ';}',
      '100%{stroke:rgba(61,224,255,0.28);}}',
      '@keyframes rs-bloom{0%{opacity:0;}22%{opacity:1;}100%{opacity:0;}}',
      '@keyframes rs-corner-snap{0%{transform:scale(1.07);}',
      '55%{transform:scale(0.985);}100%{transform:scale(1);}}',
      // 衝擊波 600ms（音階上的「元素進場」）—— 比一擊長，是那一擊的餘波。
      // 只寫 transform/opacity；non-scaling-stroke 讓波紋擴散時線寬不變粗。
      '#' + OVERLAY_ID + ' .rs-halo .rs-wave{fill:none;stroke:' + HALO_ACTIVE + ';',
      'stroke-width:2;opacity:0;vector-effect:non-scaling-stroke;',
      'transform-box:fill-box;transform-origin:center;}',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-wave{',
      'animation:rs-wave-out 0.6s ' + EASE_SECURE + ' 1;}',
      // opacity 要撐過前三分之一才看得見 —— --ease-secure 是 expo-out，
      // 不補這個中間 keyframe 的話波紋一出生就淡掉了（實測截圖看出來的）。
      '@keyframes rs-wave-out{0%{transform:scale(1);opacity:0.95;}',
      '32%{opacity:0.8;}100%{transform:scale(2.3);opacity:0;}}',

      // ── 揭曉面板（MOTION-DIRECTION §4「Reveal 揭曉」）──
      //
      // 為什麼需要這一塊：先前收尾只是把帶位寫進**剛剛還在叫你「保持穩定」的
      // 那顆小膠囊**，同一個字級，停 1.2 秒就消失。founder 2026-08-09 實走：
      // 「掃完了以後沒有出現數字，不知道剛剛完成了什麼？」—— 儀式做完了，
      // 儀器卻什麼都沒交給他。答案要在框裡、要有份量、而且要等他自己收下。
      '#' + OVERLAY_ID + ' .rs-verdict{position:absolute;inset:0;display:flex;',
      'flex-direction:column;align-items:center;justify-content:center;gap:8px;',
      'pointer-events:none;opacity:0;visibility:hidden;padding:0 22px;text-align:center;}',
      // 帶位大字。Reveal 語彙：收斂 → 收過頭一點 → 落定（overshoot 在 keyframes 裡，
      // 因為 --ease-secure 是 expo-out 不回彈）。1400ms 是音階上的「分數揭曉收斂」。
      // 預設是**靜音的灰**，不是 cyan。視覺世界規則裡 cyan = ACTIVE、gold = SECURED，
      // 而「訊號不足」兩者都不是 —— 用 cyan 會讓一次失敗看起來像個成果。
      // 只有真的收束成讀數（.secured）才升上 gold，見下。
      '#' + OVERLAY_ID + ' .rs-verdict-band{font-size:40px;font-weight:700;',
      'letter-spacing:-0.01em;line-height:1;color:#8A93AB;}',
      // 「你剛剛做了什麼」—— 不是分數，是行為。全部取自真量到的值。
      // 規格行用等寬 + tabular-nums：數字對齊才有儀器讀數的樣子，
      // 而且點數/幀數在不同掃描之間位數會變，比例字體會讓它左右跳。
      '#' + OVERLAY_ID + ' .rs-verdict-fact{max-width:320px;}',
      '#' + OVERLAY_ID + ' .rs-verdict-spec{font-size:12.5px;line-height:1.5;',
      'color:#C6CCDD;letter-spacing:0.01em;',
      'font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;',
      'font-variant-numeric:tabular-nums;}',
      // 退讓詞（信心中）住在第二行、更小更暗 —— 誠實但不當開場白。
      '#' + OVERLAY_ID + ' .rs-verdict-quality{font-size:11px;line-height:1.6;',
      'color:#6E778F;letter-spacing:0.04em;margin-top:3px;',
      'font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;',
      'font-variant-numeric:tabular-nums;}',
      // ⚠️ `hidden` 屬性只是作者樣式 `display:none`，**會被任何 display 宣告蓋掉**。
      // .rs-instruction 是 inline-flex、.rs-dots 是 flex —— 沒有這兩條，
      // 設了 hidden 也照樣顯示（2026-08-09 截圖當場抓到：揭曉時膠囊還在叫你把臉放進框裡）。
      '#' + OVERLAY_ID + ' .rs-instruction[hidden],',
      '#' + OVERLAY_ID + ' .rs-dots[hidden],',
      '#' + OVERLAY_ID + ' .rs-verdict-fact[hidden]{display:none;}',
      '#' + OVERLAY_ID + ' .rs-frame.revealed .rs-verdict{visibility:visible;opacity:1;',
      'animation:rs-verdict-in 1.4s ' + EASE_SECURE + ' 1;}',
      '@keyframes rs-verdict-in{0%{opacity:0;transform:scale(1.18);}',
      '18%{opacity:1;}34%{transform:scale(0.98);}100%{opacity:1;transform:scale(1);}}',
      // 收束成功才轉 gold（gold = SECURED/calibrated；訊號不足那條不得用）。
      '#' + OVERLAY_ID + ' .rs-frame.revealed.secured .rs-verdict-band{',
      'color:' + HALO_SECURED + ';filter:drop-shadow(0 0 12px rgba(255,212,110,0.45));}',
      // 儀器的工作部件退場 —— 對位標記、目標環、角括號的任務結束了。
      // 這是「安靜的收尾」的一部分：畫面上只剩結果，沒有還在運轉的零件。
      '#' + OVERLAY_ID + ' .rs-frame.revealed .rs-reticle,',
      '#' + OVERLAY_ID + ' .rs-frame.revealed .rs-target,',
      '#' + OVERLAY_ID + ' .rs-frame.revealed .rs-halo-corners{opacity:0;',
      'transition:opacity 0.6s ' + EASE_SECURE + ';}',
      // 完成鈕：揭曉之後唯一的出口，所以做得夠大、夠像個按鈕。
      // 完成鈕同理：預設中性，收束成功才是 gold。
      '#' + OVERLAY_ID + ' .rs-done{min-height:48px;padding:0 34px;border-radius:999px;',
      'border:1px solid rgba(166,173,200,0.4);background:rgba(166,173,200,0.08);',
      'color:#C6CCDD;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;',
      'letter-spacing:0.04em;}',
      '#' + OVERLAY_ID + '.secured-run .rs-done{border-color:rgba(255,212,110,0.5);',
      'background:rgba(255,212,110,0.10);color:' + HALO_SECURED + ';}',
      '#' + OVERLAY_ID + ' .rs-done[hidden]{display:none;}',

      // ── 指令膠囊（North Star §4：一次只顯示 1 個主指令）──
      // ⚠️ 左內距 10px 是**留給圖示的**（圖示 26px + gap 10px 之後才是文字）。
      // `b:empty{display:none}` 把圖示拿掉時那 10px 還在，文字就往左偏 8px ——
      // 只有「保持穩定」這種沒圖示的指令會被看出來，founder 2026-08-09 實走抓到。
      // 沒圖示時由 setInstruction() 掛 .no-icon 換成對稱內距。
      '#' + OVERLAY_ID + ' .rs-instruction{display:inline-flex;align-items:center;gap:10px;',
      'min-height:44px;padding:0 18px 0 10px;border-radius:999px;',
      'background:rgba(10,14,24,0.72);border:1px solid rgba(61,224,255,0.22);',
      'font-size:16px;font-weight:600;letter-spacing:0.02em;',
      'transition:border-color 0.3s ' + EASE_SECURE + ';}',
      '#' + OVERLAY_ID + ' .rs-instruction b{width:26px;height:26px;flex:none;',
      'display:flex;align-items:center;justify-content:center;border-radius:50%;',
      'background:rgba(61,224,255,0.14);color:' + HALO_ACTIVE + ';',
      'font-size:14px;font-weight:400;font-style:normal;}',
      '#' + OVERLAY_ID + ' .rs-instruction b:empty{display:none;}',
      '#' + OVERLAY_ID + ' .rs-instruction.no-icon{padding:0 18px;}',
      // 鎖定時膠囊轉成「已對準」的靜態語氣，不再閃爍求你動。
      '#' + OVERLAY_ID + ' .rs-frame.locked ~ .rs-instruction{border-color:rgba(34,211,238,0.55);}',

      // reduced-motion：flicker / bloom / snap 全部跳過，但**鎖定仍然看得出來** ——
      // 角括號直接在終態、膠囊照樣變色。靜態終態不等於沒有回饋（鐵律 3）。
      '@media (prefers-reduced-motion: reduce){',
      // ⚠️ 選擇器要與上面的基礎規則**同樣具體**（id + .rs-halo + .rs-halo-corners）。
      // 少寫一層 class 就會輸掉優先權，媒體查詢看起來有寫、實際上沒生效。
      '#' + OVERLAY_ID + ' .rs-halo .rs-halo-corners{transition:none;}',
      // .locked 那條 transition 的選擇器更具體，不重寫一次會蓋不掉（同上一課）。
      '#' + OVERLAY_ID + ' .rs-frame.locked .rs-halo-corners{transition:none;}',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-halo-track,',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-halo-corners,',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-wave,',
      '#' + OVERLAY_ID + ' .rs-frame.lock-beat .rs-flash{animation:none;}}',
      '#' + OVERLAY_ID + ' .rs-dots{display:flex;gap:14px;font-size:10px;color:#5A6178;',
      'letter-spacing:0.1em;text-transform:uppercase;}',
      '#' + OVERLAY_ID + ' .rs-dot{display:flex;align-items:center;gap:5px;}',
      '#' + OVERLAY_ID + ' .rs-dot i{width:6px;height:6px;border-radius:50%;',
      'background:#5A6178;display:inline-block;}',
      '#' + OVERLAY_ID + ' .rs-dot.pass i{background:#46E0B0;}',
      '#' + OVERLAY_ID + ' .rs-dot.fail i{background:#FF6B6B;}',
      '#' + OVERLAY_ID + ' .rs-privacy{font-size:11px;color:#5A6178;}',
      '#' + OVERLAY_ID + ' .rs-cancel{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);',
      'right:16px;z-index:2;background:none;border:0;color:#A6ADC8;font-size:15px;',
      'font-family:inherit;padding:10px 14px;cursor:pointer;}',
      // ── ceremony 層（opt-in）──
      // 進度環用 conic-gradient 吃 --rs-hold-p，跟沿框光弧同一個 p。
      '#' + OVERLAY_ID + ' .rs-hold{display:flex;flex-direction:column;align-items:center;',
      'gap:10px;margin-top:2px;}',
      '#' + OVERLAY_ID + ' .rs-hold[hidden]{display:none;}',
      '#' + OVERLAY_ID + ' .rs-hold-btn{position:relative;width:74px;height:74px;',
      'border-radius:50%;display:flex;align-items:center;justify-content:center;',
      'cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none;',
      'user-select:none;-webkit-user-select:none;}',
      '#' + OVERLAY_ID + ' .rs-hold-ring{position:absolute;inset:0;border-radius:50%;',
      // 未按住時是一圈暗軌；按住並且閘門通過時，p 會前進。
      'background:conic-gradient(var(--rs-hold-c,#22D3EE) var(--rs-hold-p,0%),',
      'rgba(255,255,255,0.10) 0);',
      '-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 0);',
      'mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 0);',
      'transition:opacity .2s ease;}',
      '#' + OVERLAY_ID + ' .rs-hold-core{width:52px;height:52px;border-radius:50%;',
      'background:rgba(34,211,238,0.10);border:1px solid rgba(34,211,238,0.28);',
      'transition:transform .18s ease, background .18s ease;}',
      '#' + OVERLAY_ID + ' .rs-hold.holding .rs-hold-core{transform:scale(0.92);',
      'background:rgba(34,211,238,0.20);}',
      '#' + OVERLAY_ID + ' .rs-hold-label{font-size:11px;letter-spacing:0.14em;',
      'color:#5A6178;text-transform:uppercase;}',
      '#' + OVERLAY_ID + ' .rs-hold.holding .rs-hold-label{color:#A6ADC8;}',
      // 收束之後手勢層退場 —— 揭曉時畫面上只留答案與完成鈕。
      '#' + OVERLAY_ID + '.secured-run .rs-hold{display:none;}',
    ].join('');
    document.head.appendChild(style);

    var node = document.createElement('div');
    node.id = OVERLAY_ID;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', '狀態讀數掃描');
    node.innerHTML = [
      // iOS 17.4+ 切換 switch 會讓 Safari 播系統觸感。未公開行為、沙箱驗不了，
      // 純粹是漸進增強 —— 真正撐起鎖定那一刻的是下面的 Lock 視覺語彙。
      // clip 而非 display:none：隱藏的控制項不會觸發（同 v6 的作法）。
      '<input type="checkbox" switch data-rs="haptic" tabindex="-1" aria-hidden="true"',
      ' style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;clip:rect(0 0 0 0)">',
      '<button type="button" class="rs-cancel" data-rs="cancel">取消</button>',
      '<div class="rs-stage">',
      '  <div class="rs-mission" data-rs="mission"></div>',
      '  <div class="rs-symbol" data-rs="symbol"></div>',
      '  <div class="rs-frame" data-rs="frame">',
      // 框＝鏡頭。video 住在 .rs-lens 裡被裁成超橢圓，框外只剩背景與星塵。
      // ⚠️ 裁切必須放在 .rs-lens 這個獨立元素上，不能放在 .rs-frame ——
      // 否則光弧的描邊（路徑在 x=1、stroke 2.5）外緣會被切掉。
      '    <div class="rs-lens">',
      '      <video class="rs-video" playsinline muted autoplay></video>',
      '    </div>',
      // 鎖定閃光的專屬層。**不能借用 .rs-lens** —— 它是 opacity:0，而
      // opacity:0 的元素連 box-shadow / background 都不會畫，動畫等於沒播。
      // 2026-08-08 就是這樣把鎖定閃光弄不見的（founder：「合一還不夠爽」）。
      // 星塵核心住在**框裡**（North Star §4：內核 = 星塵靈魂，外框 = 精密掃描框）。
      // 光圈裡是靈魂，框外淨空 —— 這也讓「捕獲」的比喻成立：你被收進儀器裡。
      '    <div class="rs-stardust" data-rs="stardust"></div>',
      '    <div class="rs-flash"></div>',
      // 三個 rect，幾何一字不差：track（框本身）、corners（角括號）、fill（進度）。
      '    <svg class="rs-halo" viewBox="0 0 236 236" aria-hidden="true">',
      '      <rect class="rs-halo-track" x="1" y="1" width="234" height="234" rx="63" ry="63" pathLength="1"/>',
      '      <rect class="rs-halo-corners" x="1" y="1" width="234" height="234" rx="63" ry="63" pathLength="1"/>',
      '      <rect class="rs-halo-fill" data-rs="halo" x="1" y="1" width="234" height="234" rx="63" ry="63" pathLength="1"/>',
      // 目標環（你該在的位置與大小）+ 對位標記（你現在在哪、多大）。
      // 兩者同一個座標系，所以「移進去、調到一樣大」＝ 對位完成。
      '      <circle class="rs-target" cx="118" cy="118" r="' + RETICLE_TARGET_R + '"/>',
      '      <circle class="rs-reticle" data-rs="reticle" cx="118" cy="118" r="' + RETICLE_TARGET_R + '"/>',
      // 衝擊波：合一那一刻從核心往外擴到框、淡出。這是儀器的**回報**，
      // 只播一次；它不參與任何判定，純粹把「抓到了」講出來。
      '      <circle class="rs-wave" cx="118" cy="118" r="' + RETICLE_TARGET_R + '"/>',
      '    </svg>',
      // 揭曉面板 —— 儀器把結果交到你手上的地方。
      // 為什麼在**框裡**：框是整場儀式的舞台，答案就該在你被捕獲的那個位置出現，
      // 而不是等覆蓋層關掉之後、在別的畫面上當一個欄位。
      '    <div class="rs-verdict" data-rs="verdict" aria-live="polite">',
      '      <div class="rs-verdict-band" data-rs="verdict-band"></div>',
      '    </div>',
      '  </div>',
      '  <div class="rs-instruction" data-rs="instruction"><b data-rs="hint-icon"></b><span data-rs="hint-text"></span></div>',
      // 「你剛剛做了什麼」放在**框外**，接在膠囊原本的位置 —— 框內只留答案。
      // 塞進 236px 的框裡會擠成兩行，而且會跟大字搶注意力。
      '  <div class="rs-verdict-fact" data-rs="verdict-fact" hidden>',
      '    <div class="rs-verdict-spec" data-rs="verdict-spec"></div>',
      '    <div class="rs-verdict-quality" data-rs="verdict-quality"></div>',
      '  </div>',
      // 完成鈕：揭曉之後**唯一的出口**（enterReveal 會收起取消鈕）。
      // ⚠️ listener 與 cancel 一樣在注入當下就綁 —— 見下方 addEventListener。
      // 揭曉時只負責把它顯示出來，這樣就算 finalize() 中途出事，人也出得去。
      '  <button type="button" class="rs-done" data-rs="done" hidden>完成</button>',
      // ceremony 層（opt-in，預設 hidden）：按住的手勢 + 沿鈕的進度環。
      // founder 喜歡 takeover 那個手感，但那支的進度是純牆鐘計時。這裡把手勢
      // 留下、把計時器丟掉 —— 進度仍由閘門決定（見 holdSatisfied）。
      '  <div class="rs-hold" data-rs="hold" hidden>',
      '    <div class="rs-hold-btn" data-rs="hold-btn" role="button" tabindex="0" aria-label="按住開始掃描">',
      '      <div class="rs-hold-ring" data-rs="hold-ring"></div>',
      '      <div class="rs-hold-core"></div>',
      '    </div>',
      '    <div class="rs-hold-label" data-rs="hold-label">按住開始</div>',
      '  </div>',
      '  <div class="rs-dots" data-rs="dots">',
      '    <span class="rs-dot" data-rs="dot-light"><i></i>Lighting</span>',
      '    <span class="rs-dot" data-rs="dot-center"><i></i>Centering</span>',
      '    <span class="rs-dot" data-rs="dot-still"><i></i>Stillness</span>',
      '  </div>',
      '  <div class="rs-privacy">本機運算 · 不留影像</div>',
      '</div>',
    ].join('');
    document.body.appendChild(node);

    node.querySelector('[data-rs="cancel"]').addEventListener('click', function () {
      finish(null);
    });
    // ⚠️ 這條在**注入當下**就綁，不是揭曉時才綁。揭曉之後取消鈕會收起來，
    // 完成鈕是唯一出口 —— 綁定不能依賴收尾流程跑完，否則 finalize() 一出事
    // 使用者就被關在覆蓋層裡出不去。揭曉只負責把它 unhide。
    node.querySelector('[data-rs="done"]').addEventListener('click', function () {
      finish(session && session.pendingReading ? session.pendingReading : null);
    });

    // ── ceremony：按住／放開 ──
    // ⚠️ 一樣在注入當下就綁（跟 cancel/done 同理）：綁定不能依賴任何流程跑完。
    // mouseup/touchend 綁在 window 上，手指滑出鈕外再放開也要算放開，
    // 否則進度會卡在「以為還按著」。
    var holdBtn = node.querySelector('[data-rs="hold-btn"]');
    if (holdBtn) {
      holdBtn.addEventListener('mousedown', function () { setHolding(true); });
      holdBtn.addEventListener('touchstart', function (e) {
        e.preventDefault(); // 不要觸發合成滑鼠事件，也不要選字
        setHolding(true);
      }, { passive: false });
    }
    global.addEventListener('mouseup', function () { setHolding(false); });
    global.addEventListener('touchend', function () { setHolding(false); });
    global.addEventListener('touchcancel', function () { setHolding(false); });
    return node;
  }

  function q(sel) {
    var overlay = document.getElementById(OVERLAY_ID);
    return overlay ? overlay.querySelector('[data-rs="' + sel + '"]') : null;
  }

  /** 一次只顯示一個主指令（North Star §4）。 */
  /**
   * 寫入唯一那一條主指令（North Star §4：一次只顯示 1 個）。
   *
   * @param {string} text - 指令文字。
   * @param {string} [icon] - 選填的方向符號；省略時圖示 chip 自動收起（`b:empty`）。
   */
  function setInstruction(text, icon) {
    var t = q('hint-text');
    var i = q('hint-icon');
    if (t) t.textContent = text;
    if (i) i.textContent = icon || '';
    // 沒有圖示時要換成對稱內距，否則文字會左偏（見 .rs-instruction 的註解）。
    // 用 class 標而不是 CSS `:has()` —— 圖示本來就由這裡寫，狀態讓 JS 標最確定，
    // 也不用賭 Safari 版本。
    var pill = q('instruction');
    if (pill) pill.classList.toggle('no-icon', !icon);
  }

  /**
   * 頭部朝向的**真實幾何量測** —— 臉有沒有正對鏡頭。
   *
   * 為什麼需要：`computeFaceBox` 是 landmark 的 min/max 包圍盒，它分不出
   * 「人偏了」和「頭轉了」。轉頭時遠側臉頰被壓縮 → 盒子中心往近側移 →
   * 叫你「向左／向右對齊」；抬低頭時可見範圍上下不對稱 → 中心 y 位移 →
   * 叫你「向上／向下對齊」。**那都是錯的建議**，照做只會更歪。
   *
   * ⚠️ 先前這段註解寫「低頭會壓短高度 → 叫你靠近一點」，**那是錯的**：
   * `size = max(寬, 高)`，壓短高度時寬度還在，size 不會變小。
   * （寫完做反向驗證時算出來的 —— 沒驗就會把一個錯的因果留在檔案裡。）
   * founder 2026-08-09 問「需不需要一行小字叫人正對鏡頭」，底下的真問題就是這個：
   * 我們根本沒量這件事（North Star §5 也把 head pose 列在待補信號裡）。
   *
   * 量法（不新增依賴、不動 FaceMesh 設定）：正臉時鼻尖應該落在兩眼外角的中點上。
   * 轉頭時鼻尖往轉的方向偏、抬低頭時往上下偏，**以兩眼外角距離正規化**，
   * 所以距離遠近不影響這個比值。
   *
   * @param {Array<{x:number,y:number}>} lm - FaceMesh landmarks。
   * @returns {?{yaw:number, pitch:number}} 正規化偏移；點位不足時為 null。
   */
  function headPose(lm) {
    var nose = lm[NOSE_TIP];
    var eyeL = lm[EYE_OUTER_L];
    var eyeR = lm[EYE_OUTER_R];
    if (!nose || !eyeL || !eyeR) return null;
    var span = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
    if (span < 1e-4) return null; // 退化幾何：不猜，回 null
    var midX = (eyeL.x + eyeR.x) / 2;
    var midY = (eyeL.y + eyeR.y) / 2;
    return {
      yaw: (nose.x - midX) / span,
      pitch: (nose.y - midY) / span,
    };
  }

  /**
   * 推導**唯一**那一條主指令。
   *
   * 資料早就在了 —— `onFaceResults` 每幀都算出臉框的中心與大小，先前卻被壓成一個
   * boolean `faceFramed` 就丟掉，所以只能說「把臉放進框裡」。這裡把方向還回來。
   *
   * 優先序：大小 → 垂直 → 水平 → 光線 → 穩定度。一次只回一條，
   * 因為 North Star §4 規定「一次只顯示 1 個主指令」。
   *
   * ⚠️ 水平方向做過鏡像換算：FaceMesh 的 x 在**相機影像**座標系，而畫面上的
   * `<video>` 是 `scaleX(-1)`（照鏡子）。指令必須用**使用者看到的**方向講，
   * 所以比較的是 `1 - centerX`。垂直與遠近沒有這個問題。
   *
   * @param {{lighting:boolean,centering:(boolean|null),stillness:(boolean|null)}} gates
   * @returns {{key:string,text:string,icon:string}}
   */
  function resolveHint(gates) {
    var box = session.faceBox;
    var fresh = box && session.lastFaceAt
      && (performance.now() - session.lastFaceAt) < FACE_STALE_MS;

    if (fresh) {
      // 先講「正對鏡頭」再講位置／大小 —— 順序是這條的重點。
      // 頭轉了的時候包圍盒本身就被扭曲了，這時候的「向左對齊」「靠近一點」
      // 都是錯的建議（見 headPose 的註解）。先把姿勢喬正，其他量測才有意義。
      var pose = session.headPose;
      if (pose && (Math.abs(pose.yaw) > YAW_SQUARE_MAX
        || pose.pitch < PITCH_SQUARE_MIN || pose.pitch > PITCH_SQUARE_MAX)) {
        return { key: 'square', text: '正對鏡頭', icon: '⊕' };
      }
      if (box.size < FACE_SIZE_MIN) return { key: 'closer', text: '靠近一點', icon: '＋' };
      if (box.size > FACE_SIZE_MAX) return { key: 'farther', text: '退遠一點', icon: '－' };
      if (box.centerY > 0.5 + FACE_CENTER_Y_TOL) return { key: 'up', text: '向上對齊', icon: '↑' };
      if (box.centerY < 0.5 - FACE_CENTER_Y_TOL) return { key: 'down', text: '向下對齊', icon: '↓' };
      var displayX = 1 - box.centerX; // 鏡像：改用使用者看到的座標
      if (displayX > 0.5 + FACE_CENTER_X_TOL) return { key: 'left', text: '向左對齊', icon: '←' };
      if (displayX < 0.5 - FACE_CENTER_X_TOL) return { key: 'right', text: '向右對齊', icon: '→' };
    } else if (gates.centering !== true) {
      return { key: 'find', text: '把臉放進框裡', icon: '◎' };
    }

    if (gates.lighting !== true) return { key: 'light', text: '需要多一點光線', icon: '☀' };
    if (gates.stillness !== true) return { key: 'still', text: '再穩一下', icon: '≈' };
    return { key: 'hold', text: '保持穩定', icon: '' };
  }

  /**
   * 套用主指令，並做去抖動。
   *
   * 候選指令必須連續穩定 `HINT_HOLD_MS` 才換掉正在顯示的那一條 —— 否則在門檻邊界上
   * 會上下左右亂跳，讀起來像壞掉（350ms 沿用 takeover `stabilizeHint` 已調過的值）。
   * 第一條指令不等待，立刻顯示。
   *
   * @param {{lighting:boolean,centering:(boolean|null),stillness:(boolean|null)}} gates
   */
  function applyHint(gates) {
    // 🔴 ceremony 模式沒按住時，**停住的原因就是沒按住** —— 這時候還講
    // 「保持穩定」是在指一個不是原因的地方。因果要指對，否則使用者照著做
    // 也不會前進（`docs/PLAYBOOK.md`：進度停住要說得出為什麼）。
    var hint = (session && session.ceremony && !session.holding)
      ? { key: 'hold-to-start', text: '按住開始', icon: '' }
      : resolveHint(gates);
    var now = performance.now();
    if (hint.key !== session.hintPending) {
      session.hintPending = hint.key;
      session.hintPendingAt = now;
    }
    if (hint.key === session.hintShown) return;
    if (session.hintShown !== null && (now - session.hintPendingAt) < HINT_HOLD_MS) return;
    session.hintShown = hint.key;
    setInstruction(hint.text, hint.icon);
  }

  /** 三個微型狀態點 —— 說明進度為什麼停住，而不是讓人乾等。 */
  function setDot(name, pass) {
    var node = q('dot-' + name);
    if (!node) return;
    node.classList.toggle('pass', pass === true);
    node.classList.toggle('fail', pass === false);
  }

  /**
   * 推進 Progress Halo。
   *
   * `pathLength="1"` 把周長正規化成 1，所以 dash 長度就是**走過的弧長比例** ——
   * 換句話說進度沿著框均勻前進。這是不能用 conic-gradient 的原因：conic 掃的是
   * **角度**，套在圓角方形上會變成「邊上跑得快、角落卡住」，那是不誠實的進度。
   *
   * 刻意不下 transition：進度語意是「品質閘門通過才前進」的 pause-not-reset，
   * 停住的時候就該看得出來停住了，補間會把那個事實抹掉（MOTION-DIRECTION 鐵律 1）。
   * 顏色的 transition 另外掛在 CSS 的 stroke 上，不受影響。
   *
   * @param {number} ratio - 0..1。
   */
  function setProgress(ratio) {
    var node = q('halo');
    var p = clamp01(ratio);
    // ceremony 的環跟光弧吃**同一個** p —— 它是 heldMs/budgetMs 的視覺化，
    // 不是另一條計時。兩個環永遠說同一件事。
    var ring = q('hold-ring');
    if (ring) ring.style.setProperty('--rs-hold-p', (p * 100).toFixed(2) + '%');
    if (!node) return;
    if (p >= 1) {
      // 收滿＝實線，不留接縫。用 dash 表示 100% 會在起點留一道縫：
      // dash 1 + gap 1 的週期是 2，偏移 -0.0652 讓第一段從 0.0652 畫到 1.0652，
      // 而路徑在 1.0 就結束 → [0, 0.0652) 落在上一個週期的空隙裡（實測可見）。
      node.setAttribute('stroke-dasharray', 'none');
      node.setAttribute('stroke-dashoffset', '0');
      return;
    }
    node.setAttribute('stroke-dasharray', p + ' 1');
    node.setAttribute('stroke-dashoffset', -HALO_START_OFFSET);
  }

  // ── 量測（逐幀取樣 → evidence）──

  function clamp01(value) {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  function samplerContext() {
    if (!session.ctx) {
      var canvas = document.createElement('canvas');
      canvas.width = SAMP;
      canvas.height = SAMP;
      session.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    return session.ctx;
  }

  /**
   * Samples one video frame into per-frame quality signals. All of it is
   * computed on-device from a 64×64 downscale — no frame ever leaves the page,
   * and nothing is retained beyond the previous frame's luma for the delta.
   *
   * @param {HTMLVideoElement} video - The live preview element.
   * @returns {?{brightness:number, uniformity:number, motion:number,
   *   hasMotion:boolean, detail:number}} Signals, or null when unreadable.
   */
  function sampleFrame(video) {
    if (!video || video.readyState < 2) return null;
    var ctx = samplerContext();
    var data;
    try {
      ctx.drawImage(video, 0, 0, SAMP, SAMP);
      data = ctx.getImageData(0, 0, SAMP, SAMP).data;
    } catch (e) {
      return null; // 相機尚未供幀 / canvas 被污染 —— 這幀不算數
    }

    var luma = new Float32Array(SAMP * SAMP);
    var half = SAMP / 2;
    var quadN = half * half;
    var quad = [0, 0, 0, 0];
    for (var y = 0; y < SAMP; y++) {
      for (var x = 0; x < SAMP; x++) {
        var i = (y * SAMP + x) * 4;
        var l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        luma[y * SAMP + x] = l;
        quad[(y < half ? 0 : 2) + (x < half ? 0 : 1)] += l;
      }
    }

    // 四象限等大 → 象限平均的平均＝整幀平均亮度（順帶拿到均勻度用的離散度）。
    var qm = [quad[0] / quadN, quad[1] / quadN, quad[2] / quadN, quad[3] / quadN];
    var qMean = (qm[0] + qm[1] + qm[2] + qm[3]) / 4;
    var qVar = 0;
    for (var k = 0; k < 4; k++) qVar += (qm[k] - qMean) * (qm[k] - qMean);
    var qSd = Math.sqrt(qVar / 4);

    // 位移：與前一幀的平均 luma 差。第一幀沒有可比對象 → hasMotion=false，不計入。
    var hasMotion = !!session.prevLuma;
    var motion = 0;
    if (hasMotion) {
      var diff = 0;
      for (var m = 0; m < luma.length; m++) diff += Math.abs(luma[m] - session.prevLuma[m]);
      motion = clamp01((diff / luma.length) / MOTION_DIVISOR);
    }
    session.prevLuma = luma;

    // 中央區水平梯度＝Tier B 取景啟發式（中間有五官結構，不是 ML 偵測）。
    var lo = Math.round(SAMP * 0.3);
    var hi = Math.round(SAMP * 0.7);
    var grad = 0;
    var gN = 0;
    for (var gy = lo; gy < hi; gy++) {
      for (var gx = lo; gx < hi - 1; gx++) {
        grad += Math.abs(luma[gy * SAMP + gx + 1] - luma[gy * SAMP + gx]);
        gN++;
      }
    }

    return {
      brightness: clamp01(qMean / 255),
      uniformity: clamp01(1 - qSd / UNIFORMITY_SD_DIVISOR),
      motion: motion,
      hasMotion: hasMotion,
      detail: gN ? clamp01((grad / gN) / DETAIL_DIVISOR) : 0,
    };
  }

  // ── 臉部追蹤（Tier A）──
  // host 頁面已經載了 MediaPipe FaceMesh 就用它：landmark 位移是比整幀 luma 差分
  // 誠實得多的 stillness —— 後者背景有人走過就會算成「你在動」。眨眼節奏也只有
  // 這條路量得到。拿不到 FaceMesh（例如 /decision-alert/ 沒載）就退回畫面啟發式，
  // tier 誠實留 B。

  function faceMeshAvailable() {
    return typeof global.FaceMesh !== 'undefined';
  }

  function computeFaceBox(lm) {
    var minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (var i = 0; i < lm.length; i++) {
      var p = lm[i];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  /**
   * 臉框是否落在容差內。`slack` 放寬倍率：1 = 入鎖用的嚴格容差，
   * `FRAME_RELEASE_SLACK` = 解鎖用的寬鬆容差。
   *
   * @param {number} cx - 臉框中心 x（0..1）。
   * @param {number} cy - 臉框中心 y（0..1）。
   * @param {number} size - 臉框邊長（0..1）。
   * @param {number} slack - 容差放寬倍率。
   * @returns {boolean}
   */
  function withinFrame(cx, cy, size, slack) {
    var sizePad = ((FACE_SIZE_MAX - FACE_SIZE_MIN) / 2) * (slack - 1);
    return size >= FACE_SIZE_MIN - sizePad && size <= FACE_SIZE_MAX + sizePad
      && Math.abs(cx - 0.5) <= FACE_CENTER_X_TOL * slack
      && Math.abs(cy - 0.5) <= FACE_CENTER_Y_TOL * slack;
  }

  /**
   * 取景判定的**遲滯**（Schmitt trigger）。
   *
   * 為什麼需要：先前 `setLocked()` 吃的是每一幀的原始判定，而使用者停在容差邊界時
   * 那個 boolean 會來回翻 —— 鎖定的 flicker/閃光/snap 就跟著連放。
   * **一個到處都在放的高潮就不是高潮了**（founder 2026-08-08：「還不夠」）。
   *
   * 規則不對稱，這是刻意的：
   * - **入鎖要連續**：連 `FRAME_LOCK_STREAK` 次取樣都在嚴格容差內才鎖，
   *   所以那一拍是「你真的停穩了」，不是「你剛好掃過去」。
   * - **解鎖要明顯**：得掉出放寬 `FRAME_RELEASE_SLACK` 倍的容差才解，
   *   小幅呼吸晃動不會把你踢出鎖定。
   *
   * @param {boolean} inTol - 這一幀是否在嚴格容差內。
   * @param {number} cx - 臉框中心 x。
   * @param {number} cy - 臉框中心 y。
   * @param {number} size - 臉框邊長。
   * @returns {boolean} 遲滯後的鎖定狀態。
   */
  function evalFramed(inTol, cx, cy, size) {
    if (session.faceFramed) {
      // 已鎖定：只有明顯出界才放開。
      if (withinFrame(cx, cy, size, FRAME_RELEASE_SLACK)) return true;
      session.framedStreak = 0;
      return false;
    }
    session.framedStreak = inTol ? session.framedStreak + 1 : 0;
    return session.framedStreak >= FRAME_LOCK_STREAK;
  }

  /** 每次推論結果 → 位移、取景、眨眼。只在這裡累積 landmark 樣本。 */
  function onFaceResults(results) {
    if (!session || session.done) return;
    var faces = results && results.multiFaceLandmarks;
    if (!faces || !faces.length) {
      // 臉不見了：位移與眨眼的時間基準都要斷開，空窗不得計入任何視窗。
      setLocked(false); // 臉都不見了就不能還宣稱鎖定
      clearReticle();
      session.faceFramed = false;
      session.framedStreak = 0; // 空窗不得累積進「連續對準」
      session.headPose = null;  // 沒有臉就沒有朝向，不留上一幀的值
      session.faceBox = null;
      session.lastFaceCenter = null;
      session.lastFaceAt = 0;
      session.lastBlinkFeedAt = 0;
      session.prevEyeOpen = 1;
      // 星塵回中性 —— 沒有臉就沒有表情，不該讓粒子停在最後一幀的形狀。
      if (session.stardust && global.TENKI_STARDUST
        && typeof global.TENKI_STARDUST.clearExpression === 'function') {
        global.TENKI_STARDUST.clearExpression();
      }
      return;
    }
    var lm = faces[0];
    var now = performance.now();

    var box = computeFaceBox(lm);
    var centerX = (box.minX + box.maxX) / 2;
    var centerY = (box.minY + box.maxY) / 2;
    var size = Math.max(box.maxX - box.minX, box.maxY - box.minY);

    if (session.lastFaceCenter && session.lastFaceAt) {
      var dt = Math.max(1, now - session.lastFaceAt);
      var dx = centerX - session.lastFaceCenter.x;
      var dy = centerY - session.lastFaceCenter.y;
      var speed = Math.sqrt(dx * dx + dy * dy) / (dt / 1000);
      session.lastStillness = 1 - clamp01(speed / LANDMARK_MOTION_CEILING);
      session.lmAcc.n += 1;
      session.lmAcc.stillness += session.lastStillness;
    }
    session.everSawFace = true;
    // 特徵點數**當場量**，不寫死 —— 寫 468 就是在賭 MediaPipe 的版本與
    // refineLandmarks 設定（開了 refine 會變 478）。揭曉要報的是這次真的拿到幾點。
    session.landmarkCount = lm.length;
    // 頭部朝向：只餵指令，**不進閘門**（見 gatesAdvance 的註解）。
    session.headPose = headPose(lm);
    session.lastFaceCenter = { x: centerX, y: centerY };
    session.lastFaceAt = now;
    // 保留中心與大小 —— 方向指令（resolveHint）需要它們。先前這裡直接壓成
    // 一個 boolean，等於把「往哪邊移」的資訊丟掉，只剩「不對」。
    session.faceBox = { centerX: centerX, centerY: centerY, size: size };
    // ── 取景判定（帶遲滯）──
    // `inTol` 是這一幀的原始判定；`framed` 是**經過遲滯**的鎖定狀態。
    // 兩者分開的理由見 evalFramed()：原始判定在容差邊界會抖，
    // 直接拿去驅動鎖定拍子會讓那一刻變成閃爍的雜訊。
    var inTol = withinFrame(centerX, centerY, size, 1);
    var framed = evalFramed(inTol, centerX, centerY, size);
    // 順序：先 setLocked（它讀 session.faceFramed 判斷邊緣），再更新標記。
    setLocked(framed);
    session.faceFramed = framed;
    updateReticle(session.faceBox, framed);

    // 眼睛開合：眨眼計數與星塵表情共用同一個量，不各算一次。
    var eyeL = Math.abs(lm[159].y - lm[145].y);
    var eyeR = Math.abs(lm[386].y - lm[374].y);
    var eyeOpen = Math.min(1, ((eyeL + eyeR) / 2) / EYE_OPEN_DIVISOR);
    var blinkDetected = eyeOpen < BLINK_CLOSE && session.prevEyeOpen > BLINK_OPEN;
    session.prevEyeOpen = eyeOpen;

    // 眨眼節奏：只餵臉在的幀，dt 上限避免推論卡頓灌大視窗（同 takeover）。
    if (session.blinkCounter) {
      if (session.lastBlinkFeedAt) {
        session.blinkCounter.feed(eyeOpen, Math.min(now - session.lastBlinkFeedAt, 200));
      }
      session.lastBlinkFeedAt = now;
    }

    feedStardust(lm, eyeOpen, blinkDetected);
  }

  /**
   * 把表情量推給星塵粒子系統。
   *
   * landmark 索引與除數全部沿用 `v6/stardust-scan-takeover.js:256-267` 的既有值 ——
   * 那是已經在 founder 手機上調過的一組，換數字等於改星塵手感
   * （MOTION-DIRECTION §4 鎖定 v25.8.2）。
   *
   * @param {Array<{x:number,y:number}>} lm - FaceMesh landmarks。
   * @param {number} eyeOpen - 已正規化的眼睛開合 0..1。
   * @param {boolean} blinkDetected - 本幀是否構成一次眨眼。
   */
  function feedStardust(lm, eyeOpen, blinkDetected) {
    if (!session || !session.stardust) return;
    var S = global.TENKI_STARDUST;
    if (!S || typeof S.setExpression !== 'function') return;
    var mouthOpen = Math.min(1, Math.abs(lm[13].y - lm[14].y) / MOUTH_OPEN_DIVISOR);
    var browTension = Math.max(0, Math.min(1, 1 - Math.abs(lm[105].x - lm[334].x) / BROW_SPAN_DIVISOR));
    S.setExpression({
      mouthOpen: mouthOpen,
      eyeOpen: eyeOpen,
      browTension: browTension,
      blinkDetected: blinkDetected,
    });
    // ⚠️ `setExpression` 照舊餵 —— 那是 takeover 已經調過的手感通道（眨眼、尺度、
    // 滾動），不動它。`feedTone` 不再吃 mouthOpen/browTension：量過之後那兩個在
    // 掃描情境下幾乎是常數，見 feedTone 的說明。
    feedTone();
  }

  /**
   * 讓星塵跟著**這次真的量到的東西**走 —— 而且是**看得出來**地跟著。
   *
   * 🔴 **這不是情緒偵測，也不准被講成情緒偵測。** 我們量到的是位移穩定度與
   * 累積的有效量測（landmark 幾何 + 閘門）。畫面上不會有任何一個字替它貼情緒標籤
   * （CLAUDE.md：禁止醫療診斷措辭；North Star：不放假的讀數）。
   *
   * ⚠️ **2026-08-10 重寫，因為第一版的訊號是死的。** 先前色相吃 `browTension`
   * （兩眉之間的距離比值）與 `mouthOpen`。算過真實情境才發現：
   *   用力皺眉 → 色相只動 **0.69°**；掃描時嘴閉著 → mouthOpen 恆為 ~0.1。
   * founder 實走的一句「顏色好像沒變化？」就是這個。
   * **訊號正規化成 0..1，不代表它會走遍 0..1 —— 要看真實分布。**
   *
   * 改吃 `stillness`：每幀、真 0..1，**而且正是畫面上要求使用者控制的那個量**
   * （「保持穩定」）。使用者做對了，主角就要看得出來 —— 那才是回饋迴圈。
   *
   * - `stillness` → 飽和度 / 漸層收窄 / 粒子收斂 / 亮度（stardust 端的 readout 層）
   * - `stillness` → 色相偏移：**越穩越回到 0**，也就是回到星塵原本的身分
   * - `progress`  → 往 cyanCore 聚焦。用 `heldMs/budgetMs`，而它**只在閘門通過時
   *   才前進** —— 所以那是「累積的有效量測」，不是計時器。
   *
   * 🔴 色相仍然單向（0 → +TONE_LIVE_HUE，不得為負）：負向會把底部的 cyan 轉成綠，
   * 而綠在這個產品裡是 `--good`。這裡用 `1 - still` 當 drive，**結構上出不了負數**。
   *
   * ⚠️ 飽和度**不在這裡餵** —— 由 readout 層單一擁有（`effectiveSat()`）。
   * 兩個地方寫同一個通道就會打架，那個 bug 類別已經咬過三次。
   *
   * ⚠️ 揭曉之後不再受這裡驅動 —— 那時顏色代表的是**結果**，不是當下的你。
   */
  function feedTone() {
    if (!session || session.toneStage !== 'live') return;
    var S = global.TENKI_STARDUST;
    if (!S || typeof S.setTone !== 'function') return;
    var still = session.lastStillness === null ? 0.5 : clamp01(session.lastStillness);
    var progress = session.budgetMs > 0
      ? clamp01(session.heldMs / session.budgetMs)
      : 0;
    if (typeof S.setReadout === 'function') {
      S.setReadout({ stillness: readoutStillness(still), progress: progress });
    }
    S.setTone({
      // 晃動 → 偏離身分；穩住 → 回到身分。單向，不得為負。
      hue: (1 - still) * TONE_LIVE_HUE,
      mix: 0,
    });
  }

  /**
   * 把 stillness 的**實際工作區間**拉伸到完整的 0..1 再交給星塵。
   *
   * 🔴 為什麼不能直接餵原始值：0..1 是它的**定義域**，不是它**會走到**的範圍。
   * founder 實測讀數是 63% / 87% / 93%，而 `LANDMARK_STILL_GATE = 0.5` 是閘門門檻 ——
   * 也就是說真正會發生的區間大約 `0.5 → 0.95`。直接餵原始值等於把一半以上的
   * 視覺預算浪費在永遠不會到達的區段，效果就是 founder 說的「看不出變化」。
   *
   * ⚠️ 低端**錨在閘門門檻上**（不是隨手挑一個數）：閘門不過的那一刻正好是視覺最散的
   * 那一刻，畫面的極值與量測自己的判準對齊。高端 0.95 留一點餘裕 —— 要求使用者
   * 做到 1.00 才給滿分的回饋，那個回饋等於拿不到。
   *
   * 這是「訊號正規化成 0..1 不代表它會走遍 0..1」那一課的第二次應用；
   * 上一次是輸入端（browTension），這次是輸出端的動態範圍。
   *
   * @param {number} still - 原始 stillness 0..1。
   * @returns {number} 拉伸後的 0..1。
   */
  function readoutStillness(still) {
    var span = READOUT_STILL_HI - LANDMARK_STILL_GATE;
    if (span <= 0) return clamp01(still);
    return clamp01((still - LANDMARK_STILL_GATE) / span);
  }

  /**
   * 收束時把顏色交給結果。
   *
   * 有讀數：先閃過 gold（`--gold-secured` = SECURED，跟光弧同一拍），
   * 再落到該次帶位色。**沒有讀數就不准碰 gold** —— 顏色跟文案一樣會宣稱事實。
   *
   * @param {?string} band - `clear` / `neutral` / `strain`；null = 訊號不足。
   */
  function revealTone(band) {
    if (!session) return;
    session.toneStage = 'reveal';
    var S = global.TENKI_STARDUST;
    if (!S || typeof S.setTone !== 'function') return;
    // 🔴 交接點：量測期間飽和度歸 readout，收束之後歸 setTone。
    // 先關掉 readout 再設 tone，否則兩個寫入者會搶同一個通道（`effectiveSat()`）。
    // 收散/聚焦也在這裡停下 —— 揭曉的畫面應該是靜的，不該還有東西在收。
    if (typeof S.clearReadout === 'function') S.clearReadout();
    var target = band && BAND_TONE[band];
    if (!target) {
      // 訊號不足：退掉彩度停在原本的漸層上，不編一個看起來像結果的顏色。
      S.setTone({ hue: 0, sat: 0.75, mix: 0 });
      return;
    }
    S.setTone({ hue: 0, sat: 1.1, toward: HALO_SECURED, mix: TONE_SECURED_MIX });
    session.toneTimer = setTimeout(function () {
      if (!session || session.toneStage !== 'reveal') return;
      S.setTone({ toward: target, mix: TONE_REVEAL_MIX });
    }, TONE_SECURED_MS);
  }

  function startFaceMesh(video) {
    if (!faceMeshAvailable()) return;
    var instance;
    try {
      instance = new global.FaceMesh({
        locateFile: function (file) {
          return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
        },
      });
      instance.setOptions({
        maxNumFaces: 1, refineLandmarks: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      instance.onResults(onFaceResults);
    } catch (e) {
      return; // 初始化失敗 → 安靜退回 tier B，不擋掃描
    }
    session.faceMesh = instance;
    if (global.TENKI_BLINK) {
      session.blinkCounter = global.TENKI_BLINK.createCounter({
        closeBelow: BLINK_CLOSE, openAbove: BLINK_OPEN,
      });
    }
    // 重疊防護：前一次推論還沒回來就不送新的 —— MediaPipe 的影像張量堆積起來
    // 會把 iOS 記憶體吃爆（takeover 踩過，照抄）。
    session.faceTimer = setInterval(function () {
      if (!session || session.done || session.faceBusy) return;
      if (!video || video.readyState < 2 || !session.faceMesh) return;
      session.faceBusy = true;
      session.faceMesh.send({ image: video })
        .then(function () { if (session) session.faceBusy = false; })
        .catch(function () { if (session) session.faceBusy = false; });
    }, FACE_INTERVAL_MS);
  }

  function stopFaceMesh() {
    if (!session) return;
    if (session.faceTimer) { clearInterval(session.faceTimer); session.faceTimer = null; }
    session.faceMesh = null;
    session.faceBusy = false;
  }

  /** 這次掃描是否真的量到臉（決定 tier，不是「有沒有載到 MediaPipe」）。 */
  function landmarksEarned() {
    return session.lmAcc.n >= MIN_LANDMARK_SAMPLES;
  }

  /**
   * Exposure adequacy in 0..1. Both under- and over-exposure fall off; the
   * band between the two gate thresholds is fully adequate.
   *
   * @param {number} brightness - Mean luma normalized to 0..1.
   * @returns {number} Adequacy in 0..1.
   */
  function lightingAdequacy(brightness) {
    if (brightness < BRIGHTNESS_FLOOR) return 0;
    if (brightness < BRIGHTNESS_FULL_MIN) {
      // 斜坡：暗但還量得到 → 給部分分數，讓 confidence 誠實下降。
      return clamp01((brightness - BRIGHTNESS_FLOOR) / (BRIGHTNESS_FULL_MIN - BRIGHTNESS_FLOOR));
    }
    if (brightness > BRIGHTNESS_MAX) {
      return clamp01(1 - (brightness - BRIGHTNESS_MAX) / (1 - BRIGHTNESS_MAX));
    }
    return 1;
  }

  /**
   * Quality gates for one frame. These drive the status dots and whether
   * progress advances — they do NOT filter the evidence average.
   *
   * Centering and stillness come from landmarks once this scan has actually
   * seen a face; until then (or if MediaPipe never delivers) they fall back to
   * the frame heuristics, so a blocked wasm load degrades instead of hanging.
   *
   * @param {{brightness:number, uniformity:number, motion:number,
   *   hasMotion:boolean, detail:number}} frame - Per-frame signals.
   * @returns {{lighting:boolean, centering:?boolean, stillness:?boolean}} Gates.
   */
  function evalGates(frame) {
    var lighting = frame.brightness >= BRIGHTNESS_FULL_MIN
      && frame.brightness <= BRIGHTNESS_MAX
      && frame.uniformity >= UNIFORMITY_MIN;
    if (session.everSawFace) {
      var fresh = session.lastFaceAt
        && (performance.now() - session.lastFaceAt) < FACE_STALE_MS;
      return {
        lighting: lighting,
        centering: fresh ? session.faceFramed === true : false,
        stillness: fresh && session.lastStillness !== null
          ? session.lastStillness >= LANDMARK_STILL_GATE
          : false,
      };
    }
    return {
      lighting: lighting,
      centering: frame.detail >= DETAIL_MIN && lighting,
      stillness: frame.hasMotion ? frame.motion <= MOTION_STILL_MAX : null,
    };
  }

  /**
   * 進度前不前進的判準（pause-not-reset）。
   *
   * Tier A 刻意**不把 lighting 算進來**：landmark tracker 追得動，就代表光線足夠
   * 量測 —— 讓追蹤器自己當「夠不夠亮」的裁判，比一個外加的亮度門檻誠實。光線差的
   * 代價走 `lightingAdequacy` → captureQuality → confidence 下降，而不是不給讀數。
   * Tier B 沒有追蹤器可當裁判，取景啟發式本身就吃光線，所以照舊要求 lighting。
   *
   * @param {{lighting:boolean, centering:?boolean, stillness:?boolean}} gates
   * @returns {boolean} 這一幀是否讓有效取景時間前進。
   */
  // ⚠️ **頭部朝向（headPose）刻意不在這裡。** 它只驅動指令，不擋進度。
  // 理由：那兩個門檻是先驗估計、還沒實機調過（手感調參歸桌機 lane），
  // 一旦進了閘門而門檻抓錯，掃描會完成不了 —— 那是比「偶爾少講一句」嚴重得多的壞法。
  // 先讓它停止給錯建議；要不要收進閘門是下一步、要有實機數據才決定。
  /**
   * ceremony 模式下「使用者正按著」是否成立。
   *
   * 🔴 **非 ceremony 模式永遠回傳 true** —— 這條是整個設計的鎖：
   * `/decision-alert/` 與 Scan 分頁的既有流程一個位元都不受影響，
   * 106 條既有 harness 也因此不必改。手勢是加上去的一層，不是新的必要條件。
   *
   * @returns {boolean} 這一幀是否被「按住」允許前進。
   */
  function holdSatisfied() {
    if (!session || !session.ceremony) return true;
    return session.holding === true;
  }

  /**
   * 記錄按住狀態並更新 ceremony 的視覺。
   *
   * ⚠️ 這裡**只寫狀態與樣式，不碰 heldMs** —— 進度的唯一寫入點在 tick()。
   * 兩個地方都能加進度的話，「按住就一定會前進」會從後門溜回來。
   *
   * @param {boolean} on - 是否正按著。
   */
  function setHolding(on) {
    if (!session || !session.ceremony) return;
    if (session.holding === on) return;
    session.holding = on;
    var wrap = q('hold');
    if (wrap) wrap.classList.toggle('holding', on);
    if (on && global.navigator && typeof global.navigator.vibrate === 'function') {
      // 按下去的那一下觸覺回饋（takeover 原本就有；只有真的支援才播）。
      global.navigator.vibrate(12);
    }
  }

  function gatesAdvance(gates) {
    return session.everSawFace
      ? gates.centering === true && gates.stillness === true
      : gates.lighting === true && gates.centering === true;
  }

  // ── band / confidence（鏡射 domain/src/policies/readiness-band.ts）──

  function captureQuality(evidence) {
    return clamp01(clamp01(evidence.lighting) * 0.6 + clamp01(evidence.uniformity) * 0.4);
  }

  /** Tier B 永遠不宣稱 high —— 取景是推論來的，不是量到的。 */
  function resolveConfidence(evidence) {
    var quality = captureQuality(evidence);
    if (quality >= HIGH_CONFIDENCE_AT && evidence.blinkCadence !== null && evidence.tier === 'A') {
      return 'high';
    }
    return quality >= MODERATE_CONFIDENCE_AT ? 'moderate' : 'low';
  }

  /** 眨眼缺席時把權重併回穩定度 —— 缺的訊號不得自己把帶位推上或推下。 */
  function deriveBand(evidence) {
    var stillness = clamp01(evidence.stillness);
    var quality = captureQuality(evidence);
    var composite = evidence.blinkCadence === null
      ? stillness * (WEIGHT_STILLNESS + WEIGHT_BLINK) + quality * WEIGHT_CAPTURE
      : stillness * WEIGHT_STILLNESS
        + clamp01(evidence.blinkCadence) * WEIGHT_BLINK
        + quality * WEIGHT_CAPTURE;
    if (composite >= CLEAR_AT) return 'clear';
    return composite >= NEUTRAL_AT ? 'neutral' : 'strain';
  }

  // ── 讀數落地 ──

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  /**
   * Blink-cadence regularity for this scan, or null when it cannot be judged.
   * Needs BOTH a long-enough face-tracked window AND a stored enrollment
   * baseline (soul-enroll) — without a baseline there is nothing to be regular
   * against, and guessing one would fabricate the signal. The 0..1 mapping and
   * its thresholds live in blink-cadence.js so they keep a single home.
   *
   * @returns {?number} Regularity in 0..1, or null.
   */
  function blinkRegularity() {
    var B = global.TENKI_BLINK;
    if (!B || !session.blinkCounter || !B.regularity) return null;
    var baseline = B.load();
    if (!baseline) return null;
    var daily = B.cadencePerMin(session.blinkCounter.blinks, session.blinkCounter.windowMs);
    return B.regularity(daily, baseline.cpm);
  }

  /**
   * Averages the accumulated samples into a ReadinessEvidence, or null when
   * nothing measurable was captured. Averaged over EVERY measured frame, not
   * only the ones that passed the gates — filtering would bias the reading up.
   *
   * Stillness has one source per tier and they are never mixed: Tier A reads
   * landmark displacement (the face moved), Tier B reads whole-frame luma delta
   * (something moved). The two are not the same measurement and averaging them
   * together would mean neither.
   *
   * @returns {?Object} ReadinessEvidence, or null.
   */
  function buildEvidence() {
    var acc = session.acc;
    if (!acc.n) return null;
    var tierA = landmarksEarned();
    return {
      stillness: tierA
        ? round3(session.lmAcc.stillness / session.lmAcc.n)
        : round3(acc.stillness / acc.n),
      lighting: round3(acc.lighting / acc.n),
      uniformity: round3(acc.uniformity / acc.n),
      blinkCadence: blinkRegularity(),
      tier: tierA ? 'A' : 'B',
    };
  }

  function saveReading(reading) {
    try {
      localStorage.setItem(READING_STORE_KEY, JSON.stringify(reading));
    } catch (e) { /* Safari 無痕等 —— 讀數單純不留存，不影響本次回傳 */ }
  }

  /** 進入揭示 —— 量測已結束，取消鈕收起（否則會出現「store 有讀數但回傳 null」）。 */
  function enterReveal() {
    session.done = true;
    stopFaceMesh(); // 推論先停，免得收尾期間還在燒 CPU
    stopCamera();   // 量測已完成，相機立刻關掉
    var cancel = q('cancel');
    if (cancel) cancel.hidden = true;
    // 量測結束就沒有「停滯」可言了。不清掉的話，最後一幀剛好閘門沒過時，
    // 收束的 gold 光弧會用 30% 不透明度上場 —— 看起來像失敗，其實是成功。
    var frame = q('frame');
    if (frame) frame.classList.remove('stalled', 'lock-beat');
  }

  /**
   * 把揭曉面板放上來，並停住等使用者自己收下。
   *
   * **不自動關閉**（founder 2026-08-09 拍板）：先前 1.2 秒就消失，等於儀器
   * 把結果丟在地上就走。停著等點，使用者才有「我完成了一件事」的收尾 ——
   * 也呼應 North Star §5「完成時刻不要彈窗式慶祝，是安靜的收束」。
   *
   * @param {string} band - 大字（帶位，或訊號不足時的短語）。
   * @param {{spec:string, quality:string}} fact - 儀器規格行 + 品質行。
   * @param {?Object} reading - 要回傳給呼叫端的讀數；沒有就是 null。
   */
  function showVerdict(band, fact, reading) {
    if (session) session.pendingReading = reading;
    var bandEl = q('verdict-band');
    var factEl = q('verdict-fact');
    var specEl = q('verdict-spec');
    var qualityEl = q('verdict-quality');
    if (bandEl) bandEl.textContent = band;
    if (specEl) specEl.textContent = fact.spec;
    if (qualityEl) qualityEl.textContent = fact.quality;
    var frame = q('frame');
    if (frame) frame.classList.add('revealed');
    // 完成鈕住在 .rs-stage、跟框是兄弟，所以「這一輪有沒有收束成功」得標在
    // overlay 根上。⚠️ 狀態從框身上讀，不另外傳參數 —— 兩個地方各記一次
    // 就會有機會不同調（PLAYBOOK §6：判定只能有一個來源）。
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay && frame) {
      overlay.classList.toggle('secured-run', frame.classList.contains('secured'));
    }
    // 儀器的儀表板收工：指令膠囊與三顆閘門燈都停止報告。
    // 揭曉的畫面上只該有結果，不該還有零件在運轉（North Star §5 的安靜收尾）。
    var instruction = q('instruction');
    if (instruction) instruction.hidden = true;
    var dots = q('dots');
    if (dots) dots.hidden = true;
    if (factEl) factEl.hidden = false;
    var done = q('done');
    if (done) done.hidden = false;
  }

  /**
   * 儀器規格行 —— **這次量測做了什麼**，不是分數。
   *
   * founder 兩次問「怎麼沒有數字」。查證過：決定帶位的 composite 乘 100 會長得
   * 跟 Edge Score 一模一樣但根本不是（Edge Score 是 8 維生理；瀏覽器量不到 HRV，
   * 見 `domain/src/contracts/readiness-reading.ts`）。所以這裡給的是**儀器的規格**。
   *
   * 排版是他點的「儀器規格式」：**先講儀器做了什麼，退讓詞降到第二行**。
   * 先前那版開頭就是「信心中」—— 一句話從自我懷疑開始，再強的數字都撐不起來。
   *
   * ⚠️ **Tier B 一個 landmark 字眼都不能有。** 沒有 MediaPipe 時走的是整幀
   * 啟發式，那條路上根本沒有臉部特徵點；照抄 tier A 的文案就是憑空宣稱一個
   * 不存在的量測。兩條路各講各自真的有的東西。
   *
   * @param {{stillness:number, tier:string}} evidence - 本次掃描的證據。
   * @returns {{spec:string, quality:string}} 第一行規格、第二行品質。
   */
  function verdictFact(evidence) {
    var seconds = (Math.max(500, session.heldMs) / 1000).toFixed(1);
    var spec;
    if (evidence.tier === 'A' && session.landmarkCount > 0) {
      spec = session.landmarkCount + ' 點臉部特徵 · '
        + session.lmAcc.n + ' 幀推論 · ' + seconds + ' 秒';
    } else {
      // Tier B：只有整幀取樣，沒有特徵點。`acc.n` 是真的取樣次數。
      spec = session.acc.n + ' 幀畫面取樣 · ' + seconds + ' 秒';
    }
    var quality = [];
    if (typeof evidence.stillness === 'number') {
      quality.push('穩定度 ' + Math.round(evidence.stillness * 100) + '%');
    }
    quality.push(CONFIDENCE_LABEL[resolveConfidence(evidence)]);
    return { spec: spec, quality: quality.join(' · ') };
  }

  /** 收束：算出讀數 → 存檔 → 揭示 → 等使用者收下。 */
  function finalize() {
    var evidence = buildEvidence();
    enterReveal();
    if (!evidence) {
      giveUp();
      return;
    }
    var reading = {
      band: deriveBand(evidence),
      confidence: resolveConfidence(evidence),
      ts: Date.now(),
      evidence: evidence,
    };
    saveReading(reading);
    // SECURED 拍子：光弧閉合 + 整組轉 gold。只在**真的有讀數**時才下 ——
    // gold 在視覺世界規則裡代表 baseline locked / calibrated，訊號不足那條路
    // （giveUp）不得使用，否則等於用顏色宣稱一個不存在的結果。
    setProgress(1);
    var frame = q('frame');
    if (frame) frame.classList.add('secured'); // 顏色由 CSS 的 .secured 承接
    revealTone(reading.band); // 星塵跟著同一拍走：先 gold，再落到帶位色
    showVerdict(BAND_LABEL[reading.band], verdictFact(evidence), reading);
  }

  /** 訊號不足就說沒有讀數 —— 不用低品質資料湊一個出來。 */
  function giveUp() {
    enterReveal();
    // 不加 .secured：沒有讀數就不准上 gold。失敗更需要被看見，
    // 所以走同一個面板、同樣停著等點，不是一閃而過。
    revealTone(null); // 星塵同理：退彩度，不給一個看起來像結果的顏色
    showVerdict('訊號不足', {
      spec: '這次沒有取得讀數',
      quality: '光線或穩定度不足 · 再試一次',
    }, null);
  }

  /** 取樣迴圈。進度只在光線與取景過關時前進（pause-not-reset）。 */
  function tick() {
    if (!session || session.done) return;
    session.raf = requestAnimationFrame(tick);

    var now = performance.now();

    // 對位標記的插值放在**取樣早退之前** —— 它要跑滿 60fps。
    // 取樣是 66ms 一次、臉部推論是 180ms 一次，兩個都太慢，標記跟著它們動會一格一格。
    renderReticle(session.lastRenderAt ? now - session.lastRenderAt : 16.7);
    session.lastRenderAt = now;

    if (now - session.lastSampleAt < SAMPLE_INTERVAL_MS) return;
    // dt 上限：分頁切走或掉幀的空窗不得灌進有效取景時間。
    var dt = session.lastSampleAt ? Math.min(now - session.lastSampleAt, 250) : 0;
    session.lastSampleAt = now;

    var frame = sampleFrame(session.video);
    if (frame) {
      var gates = evalGates(frame);
      setDot('light', gates.lighting);
      setDot('center', gates.centering);
      setDot('still', gates.stillness);

      if (frame.hasMotion) {
        var acc = session.acc;
        acc.n += 1;
        // Tier B 的 stillness 備援；tier A 落地時 buildEvidence 會改用 landmark。
        acc.stillness += 1 - frame.motion;
        acc.lighting += lightingAdequacy(frame.brightness);
        acc.uniformity += frame.uniformity;
        // 🔴 按住（ceremony 模式）是**必要但不充分**的條件。
        // founder 2026-08-11 選的方向是「真貨穿上戲服」：他喜歡 takeover 那個
        // 按住手勢，但那支的進度是 `progress += dt/8000` —— 純粹的牆鐘時間，
        // 手機蓋在桌上按住 8 秒也會跑到 100%。
        // 這裡把手勢當作**承諾訊號**接進來：放開就暫停，但放著不放也不會前進，
        // 因為進度仍然只在閘門通過時累積。兩個條件都要成立。
        if (gatesAdvance(gates) && holdSatisfied()) session.heldMs += dt;
      }

      // 單一主指令，帶方向（見 resolveHint）。
      applyHint(gates);
      // 讓「進度為什麼停住」看得見：閘門沒過就把光弧壓暗。進度本來就只在閘門
      // 通過時前進（pause-not-reset），這一層只是把既有的因果講出來。
      var frameEl = q('frame');
      if (frameEl) frameEl.classList.toggle('stalled', !(gatesAdvance(gates) && holdSatisfied()));
      setProgress(session.heldMs / session.budgetMs);
    }

    if (session.heldMs >= session.budgetMs) {
      finalize();
      return;
    }
    if (now - session.captureStartedAt >= session.budgetMs * CEILING_FACTOR) {
      if (session.heldMs >= MIN_HELD_MS) finalize();
      else giveUp();
    }
  }

  // ── 相機（拿不到就走 tier B，絕不偽造讀數）──

  function startCamera(videoEl) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve(null);
    }
    return navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(function (stream) {
        videoEl.srcObject = stream;
        var played = videoEl.play();
        return played && played.catch ? played.catch(function () {}).then(function () { return stream; })
                                      : stream;
      })
      .catch(function () { return null; });
  }

  function stopCamera() {
    if (!session || !session.stream) return;
    session.stream.getTracks().forEach(function (track) { track.stop(); });
    session.stream = null;
    var video = document.querySelector('#' + OVERLAY_ID + ' .rs-video');
    if (video) video.srcObject = null;
  }

  /** 理想臉框大小 —— 容差區間的中點，對位標記以它為 1.0 的尺度基準。 */
  var RETICLE_IDEAL_SIZE = (FACE_SIZE_MIN + FACE_SIZE_MAX) / 2;

  /**
   * 量測 → 對位標記的**目標值**（不負責畫，畫在 renderReticle）。
   *
   * 這是「不露臉」之下取代鏡子的東西：標記的**位置就是臉的位置、直徑就是臉的大小**，
   * 使用者把它移進中央的目標環、調到一樣大就完成對位。只有位置與大小，沒有長相 ——
   * 望遠鏡不會給你看目標長什麼樣，它給你看儀器有沒有套住它。
   *
   * ⚠️ **為什麼要拆成目標／繪製兩層**：臉部推論每 `FACE_INTERVAL_MS`(180ms) 才一次
   * ＝ 約 5.5fps。先前平滑與寫入都做在這裡，標記等於用 5.5fps 在動，手機上一格一格。
   * 現在這裡只寫目標，插值交給 rAF 的 `renderReticle()` 跑 60fps —— 量測誠實地慢，
   * 回饋照樣跟手，兩件事不再互相綁架。
   *
   * 鎖定後標記**磁吸到正中心**與目標環合一。磁吸只在量測說對準之後才發生 ——
   * 提前吸就是用動畫假造一個還沒發生的事實。
   *
   * @param {{centerX:number,centerY:number,size:number}} box - 這一幀的臉框。
   * @param {boolean} framed - 是否已落在容差內。
   */
  function updateReticle(box, framed) {
    if (!session) return;

    if (framed) {
      // 磁吸歸位：與目標環合一。
      session.reticleTarget = { x: 118, y: 118, r: RETICLE_TARGET_R };
    } else {
      session.reticleTarget = {
        x: (1 - box.centerX) * 236, // 鏡像：畫面是照鏡子的方向
        y: box.centerY * 236,
        r: Math.max(16, Math.min(100, (box.size / RETICLE_IDEAL_SIZE) * RETICLE_TARGET_R)),
      };
    }

    // 角括號的收斂程度 ＝ 對位誤差。這是「越來越熱」的頻道，
    // 與標記的「你在哪裡」互補，兩個報告不同的事。
    //
    // ratio：以容差為 1.0 的尺度，三軸取最寬鬆的那一個（哪一項最差就聽哪一項）。
    // ratio ≤ 1 就是 framed。除以 ERR_RATIO_SPAN 讓「剛好進容差」對應 err=0.5
    // ＝ 舊的固定 scale(1.07)，鎖定瞬間再由 .locked 收到 scale(1) —— 連續且不跳。
    var ratio = Math.max(
      Math.abs(box.centerX - 0.5) / FACE_CENTER_X_TOL,
      Math.abs(box.centerY - 0.5) / FACE_CENTER_Y_TOL,
      Math.abs(box.size - RETICLE_IDEAL_SIZE) / ((FACE_SIZE_MAX - FACE_SIZE_MIN) / 2)
    );
    var err = clamp01(ratio / ERR_RATIO_SPAN);
    var frame = q('frame');
    if (frame) {
      frame.classList.add('tracking');
      frame.style.setProperty('--rs-err', err.toFixed(3));
    }
  }

  /**
   * 每一幀把對位標記朝目標推進一步。由 `tick()` 的 rAF 呼叫（60fps）。
   *
   * ⚠️ **只寫 `transform`，不寫 `cx/cy/r`**（MOTION-DIRECTION §2 鐵律「每幀只寫
   * transform/opacity」）。circle 固定畫在中心、半徑固定 `RETICLE_TARGET_R`，
   * 位移與大小全部由 transform 表達 —— 改幾何屬性會逼 SVG 每幀重新柵格化，
   * 而這支覆蓋層同時還扛著相機解碼 + MediaPipe + WebGL。
   *
   * `dt` 正規化：EWMA 的 α 是為固定步長調的，掉幀時要按實際時間補償，
   * 否則卡頓那幾幀標記會落後一大截然後突然追上。
   *
   * @param {number} dtMs - 距上一次繪製的毫秒數。
   */
  function renderReticle(dtMs) {
    if (!session) return;
    var t = session.reticleTarget;
    if (!t) return;
    var node = q('reticle');
    if (!node) return;

    var s = session.reticle;
    if (!s) {
      // 第一次看到臉：直接就位，不從中心滑過去（那會假裝它一路追蹤過來）。
      session.reticle = s = { x: t.x, y: t.y, r: t.r };
    } else {
      var a = session.reticleSnapUntil && performance.now() < session.reticleSnapUntil
        ? RETICLE_SNAP_SMOOTH   // 鎖定磁吸：一段更果斷的收束
        : RETICLE_SMOOTH;
      // 以 60fps 為基準做步長補償，並夾住上限避免掉幀時一步跳到底。
      var k = Math.min(1, a * Math.min(dtMs, 100) / (1000 / 60));
      s.x += (t.x - s.x) * k;
      s.y += (t.y - s.y) * k;
      s.r += (t.r - s.r) * k;
    }
    node.style.transform = 'translate(' + (s.x - 118).toFixed(2) + 'px,'
      + (s.y - 118).toFixed(2) + 'px) scale(' + (s.r / RETICLE_TARGET_R).toFixed(4) + ')';
  }

  /** 對位標記歸零 —— 臉不見了就收掉，不留一個上一幀的幽靈在框裡。 */
  function clearReticle() {
    if (session) {
      session.reticle = null;
      session.reticleTarget = null;
      session.reticleSnapUntil = 0;
    }
    var frame = q('frame');
    if (frame) {
      frame.classList.remove('tracking');
      frame.style.removeProperty('--rs-err');
    }
  }

  /**
   * 鎖定狀態轉換 —— MOTION-DIRECTION §4 的 **Lock 鎖定**：
   * 短促 flicker（極速運算感）→ 瞬間 snap → 靜止 + 輝光。
   *
   * 這一刀存在的理由：`faceFramed` 由 false 翻成 true 是一個**真的狀態轉換**，
   * 而先前什麼都不發生 —— 使用者感覺不到自己做對了。
   *
   * 只在**邊緣**觸發（false→true），不是每幀都放；否則會變成持續閃爍的雜訊。
   *
   * @param {boolean} framed - 這一幀臉是否落在框內且大小合適。
   */
  function setLocked(framed) {
    if (!session || framed === session.faceFramed) return;
    var frame = q('frame');
    if (!frame) return;

    if (!framed) {
      frame.classList.remove('locked', 'lock-beat');
      if (session.stardust && global.TENKI_STARDUST
        && typeof global.TENKI_STARDUST.dim === 'function') {
        global.TENKI_STARDUST.dim();
      }
      return;
    }

    frame.classList.add('locked');
    // 磁吸窗：這段時間內 renderReticle 改用更果斷的收束係數，
    // 讓標記**看得見地被拉進**中心，而不是慢慢飄過去。
    // 只在這裡開窗 —— 磁吸必須發生在量測說對準之後，提前吸就是假造事實。
    session.reticleSnapUntil = performance.now() + RETICLE_SNAP_MS;
    // reflow 讓 animation 能重播（同一個 class 連續加兩次不會重跑）
    frame.classList.remove('lock-beat');
    void frame.offsetWidth;
    frame.classList.add('lock-beat');
    if (session.stardust && global.TENKI_STARDUST
      && typeof global.TENKI_STARDUST.brighten === 'function') {
      global.TENKI_STARDUST.brighten();
    }
    fireLockHaptic();
  }

  /**
   * 鎖定的觸感，best-effort。
   *
   * ⚠️ **iOS Safari 網頁完全不能震**（`navigator.vibrate` 是靜默 no-op，PLAYBOOK §6），
   * 所以在 founder 的 iPhone 上這裡多半什麼都不會發生 —— 真正撐起那一刻的是上面的
   * Lock 視覺語彙。這兩行是給 Android，以及萬一 iOS 的 switch 觸感真的有效。
   */
  function fireLockHaptic() {
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (_) { /* 無聲失敗即可 */ }
    }
    try {
      var sw = q('haptic');
      if (sw && sw.hasAttribute('switch')) sw.checked = !sw.checked;
    } catch (_) { /* 未公開行為，失敗不影響任何事 */ }
  }

  // ── 星塵核心（North Star §4「內核 = 星塵靈魂」）──

  /**
   * 這個節點現在看得見嗎。
   *
   * `offsetParent` 對 `position:fixed` 會回 null（誤判），所以再問一次 CSS ——
   * 星塵的 host 就有可能是 fixed 全屏層。
   *
   * @param {HTMLElement} node
   * @returns {boolean}
   */
  function isVisible(node) {
    if (!node || !node.isConnected) return false;
    var cs = global.getComputedStyle ? global.getComputedStyle(node) : null;
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /**
   * 這次掃描要不要放星塵，以及要不要**跟現任持有者借**。
   *
   * ⚠️ 這裡曾經有一條我自己寫錯的規則（2026-08-10 founder 實走抓到）：
   * 「`isMounted()` 為真就一律不放」。理由寫的是「第二個 WebGL context 疊在
   * 相機 + MediaPipe 上是 iOS 的 OOM 區」—— **理由對，結論錯。**
   * `stardust.js` 在 DOM ready 時會 `autoMount()` 綁到 `#universe`，而 v6 的
   * `#universe` 住在平常 `visibility:hidden` 的 takeover 裡 ——
   * **於是 /v3/ 上有一顆沒人看得到的星塵球一直在燒 GPU，還佔著唯一的綁定**，
   * 掃描框永遠拿不到（連帶 `feedStardust()` 整條也是死的）。
   * 而 `/decision-alert/` 沒有 `#universe`，所以那個入口一直是好的 ——
   * 同一支掃描在兩個入口長得不一樣，就是這個原因。
   *
   * 正確做法是**交接**而不是並存：把唯一那個借過來，收尾再還回去。
   * 任何時刻仍然只有一個 context 活著，原本那條 OOM 顧慮完整保住。
   *
   * 三種情況仍然不放，而且都不是失敗：
   * 1. 沒有 three.js / 沒載 stardust.js —— 那頁只有極簡精密框，功能不受影響。
   * 2. 現任持有者**看得見**（takeover 正在跑）—— 那是真的在用，不能搶。
   * 3. 使用者開了「減少動態」—— 星塵是連續漂移，最誠實的靜態終態就是不出現
   *    （MOTION-DIRECTION 鐵律 3）。
   *
   * @returns {boolean} 是否成功掛上。
   */
  function mountStardust() {
    var S = global.TENKI_STARDUST;
    if (!S || typeof S.mount !== 'function') return false;
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

    var host = q('stardust');
    if (!host) return false;

    if (typeof S.isMounted === 'function' && S.isMounted()) {
      // 借之前一定要先問到 host —— `destroy()` 會把 container 設成 null，
      // 拆完就沒有人記得該還給誰了。
      var info = typeof S.hostInfo === 'function' ? S.hostInfo() : null;
      if (!info || isVisible(info.node)) return false; // 真的在用 → 不搶
      try {
        S.unmount();
      } catch (_) {
        return false; // 拆不掉就不硬搶，維持原狀比壞掉好
      }
      session.borrowedFrom = info;
    }

    // fitContainer：畫布跟著掃描框走，而不是視窗。三個既有的 #universe 頁面
    // 不傳這個旗標，走原本的 viewport 路徑，一個像素都不會變。
    if (!S.mount(host, { fitContainer: true })) {
      returnStardust(); // 借了卻掛不上 → 立刻還回去，不能把頁面留在沒有星塵的狀態
      return false;
    }
    if (typeof S.playEntrance === 'function') S.playEntrance();
    return true;
  }

  /**
   * 把借來的綁定還給原主。**借了就一定要還** —— 不還的話 v6 的 takeover
   * 下次啟動時會是一顆空的 `#universe`。
   */
  function returnStardust() {
    if (!session || !session.borrowedFrom) return;
    var info = session.borrowedFrom;
    session.borrowedFrom = null;
    var S = global.TENKI_STARDUST;
    if (!S || typeof S.mount !== 'function') return;
    try {
      // 用原本的掛法還回去：`#universe` 走 viewport 路徑（fitContainer:false），
      // 還錯了等於偷偷改了那一頁的星塵尺寸。
      S.mount(info.node, { fitContainer: info.fitContainer });
    } catch (_) { /* 還不回去不該擋住掃描收尾 */ }
  }

  /** 還掉 WebGL context。每次掃描結束都要做 —— 瀏覽器對同時存活的 context 有上限。 */
  function unmountStardust() {
    if (!session) return;
    var borrowed = session.borrowedFrom;
    if (!session.stardust && !borrowed) return;
    session.stardust = false;
    var S = global.TENKI_STARDUST;
    if (!S) return;
    try {
      if (typeof S.clearExpression === 'function') S.clearExpression();
      if (typeof S.clearTone === 'function') S.clearTone();
      if (typeof S.clearReadout === 'function') S.clearReadout();
      if (typeof S.unmount === 'function') S.unmount();
    } catch (_) { /* 拆卸失敗不該擋住掃描收尾 */ }
    returnStardust();
  }

  // ── 生命週期 ──

  function finish(reading) {
    if (!session) return;
    var resolve = session.resolve;
    if (session.raf) cancelAnimationFrame(session.raf);
    // gold → 帶位色那個延遲還可能在飛。session 馬上就要變 null，
    // 讓它落在一個已經拆掉的星塵上沒有意義，還會讓下一輪繼承到上一輪的顏色。
    if (session.toneTimer) clearTimeout(session.toneTimer);
    stopFaceMesh();
    stopCamera();
    unmountStardust();
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('open');
    session = null;
    resolve(reading);
  }

  /**
   * 開始一次讀數掃描。
   *
   * @param {{mission?: 'daily'|'decision'|'refresh', symbol?: string}} [options]
   *   mission 決定文案與時間預算；symbol 只在 decision 來意時顯示（你正要決策的標的）。
   * @returns {Promise<Object|null>} ReadinessReading，使用者取消則為 null。
   */
  function begin(options) {
    var opts = options || {};
    var mission = MISSIONS[opts.mission] ? opts.mission : 'daily';
    if (session) return Promise.resolve(null); // 同時只允許一次掃描

    var overlay = ensureOverlay();
    q('mission').textContent = MISSIONS[mission].label;
    q('symbol').textContent = mission === 'decision' && opts.symbol ? opts.symbol : '';
    setInstruction('正在啟動相機⋯');
    ['light', 'center', 'still'].forEach(function (name) { setDot(name, null); });
    q('cancel').hidden = false; // 上一輪揭示時收起過
    // 上一輪的揭曉面板要收乾淨：膠囊回來、完成鈕收起，否則第二次掃描一開場
    // 就頂著上一次的結果（overlay 是 hide 不是 remove）。
    var instructionEl = q('instruction');
    if (instructionEl) instructionEl.hidden = false;
    var doneEl = q('done');
    if (doneEl) doneEl.hidden = true;
    var dotsEl = q('dots');
    if (dotsEl) dotsEl.hidden = false;
    var factResetEl = q('verdict-fact');
    if (factResetEl) factResetEl.hidden = true;
    // overlay 是 hide 不是 remove，所以上一輪的 SECURED 狀態會留著 —— 必須清掉，
    // 否則第二次掃描一開場就頂著金框，等於還沒量就宣稱鎖定了。
    var frameEl = q('frame');
    if (frameEl) {
      frameEl.classList.remove('secured', 'locked', 'lock-beat', 'stalled', 'tracking', 'revealed');
      frameEl.style.removeProperty('--rs-err');
    }
    // 對位標記回到中心的預設位置，不留上一輪的殘影。
    var reticleEl = q('reticle');
    if (reticleEl) reticleEl.style.transform = '';
    setProgress(0);
    // ceremony 層：opt-in。沒開就整塊留在 hidden，既有流程逐位元組不變。
    var holdWrap = q('hold');
    if (holdWrap) {
      holdWrap.hidden = opts.ceremony !== true;
      holdWrap.classList.remove('holding');
    }
    overlay.classList.remove('secured-run'); // 上一輪的收束標記不得留到這一輪
    overlay.classList.add('open');

    return new Promise(function (resolve) {
      session = {
        resolve: resolve, mission: mission, symbol: opts.symbol || null,
        stream: null, raf: null, startedAt: Date.now(),
        video: null, ctx: null, prevLuma: null, done: false,
        acc: { n: 0, stillness: 0, lighting: 0, uniformity: 0 },
        heldMs: 0, budgetMs: MISSIONS[mission].budgetSec * 1000,
        captureStartedAt: 0, lastSampleAt: 0,
        // 臉部追蹤（tier 由實際量到的 landmark 樣本數決定，不是由「有沒有載到
        // MediaPipe」決定 —— 載到但整場沒看到臉，那就不是 Tier A）。
        faceMesh: null, faceTimer: null, faceBusy: false,
        everSawFace: false, faceFramed: false, faceBox: null,
        reticle: null, reticleTarget: null, reticleSnapUntil: 0, lastRenderAt: 0,
        framedStreak: 0, pendingReading: null, headPose: null,
        lastFaceCenter: null, lastFaceAt: 0, lastStillness: null,
        blinkCounter: null, lastBlinkFeedAt: 0, prevEyeOpen: 1,
        lmAcc: { n: 0, stillness: 0 }, landmarkCount: 0,
        // ceremony：按住手勢當承諾訊號（見 holdSatisfied）。opt-in，預設關。
        ceremony: opts.ceremony === true, holding: false,
        stardust: false,
        // 借來的星塵綁定（`{node, fitContainer}`）。非 null 就代表**欠著一次歸還**。
        borrowedFrom: null,
        // 顏色現在歸誰驅動：'live' = 當下的臉，'reveal' = 這次的結果。
        // 兩邊搶同一個通道就會閃爍，所以只有一個階段能寫。
        toneStage: 'live', toneTimer: null,
        // 主指令去抖動狀態：shown 為 null 代表「還沒顯示過」→ 第一條不等待。
        hintShown: null, hintPending: null, hintPendingAt: 0,
      };
      var video = overlay.querySelector('.rs-video');
      startCamera(video).then(function (stream) {
        if (!session) return; // 啟動中被取消
        session.stream = stream;
        if (!stream) {
          // 無相機時不假造讀數 —— 讓使用者看到事實後自行離開。
          setInstruction('沒有相機 · 無法取得讀數');
          return;
        }
        session.video = video;
        session.captureStartedAt = performance.now();
        setInstruction('保持穩定');
        startFaceMesh(video); // host 有 MediaPipe 就升到 Tier A；沒有就純畫面啟發式
        // 星塵在相機起來之後才掛 —— 沒有相機就沒有掃描，也就不需要內核。
        // 表情由既有的 onFaceResults 餵（見 feedStardust），不另開相機或第二個 FaceMesh。
        session.stardust = mountStardust();
        tick();
      });
    });
  }

  /** 這個環境是否可能取得讀數（無相機 API 時 UI 不該給掃描入口）。 */
  function isAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  global.TENKI_READINESS_SCAN = {
    begin: begin,
    isAvailable: isAvailable,
    MISSIONS: MISSIONS,
    STORE_KEY: READING_STORE_KEY,
    /**
     * 🔴 對外只為了**可驗證性**：進度的門有兩道（`gatesAdvance` 與這道），
     * 而 harness 的環境沒有相機，取樣段根本不會跑 —— 只驗 UI 狀態的話，
     * 把這個函式改成永遠回 true（＝按住不再是條件、退回 takeover 那個病）
     * 也**不會有任何一條紅**。2026-08-11 反向驗證當場抓到。
     *
     * 純函式、無副作用，讀 session 的 ceremony/holding 兩個欄位。
     * @returns {boolean} 這一幀是否被「按住」允許前進。
     */
    holdSatisfied: holdSatisfied,
  };
})(window);
