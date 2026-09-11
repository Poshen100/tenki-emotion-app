/**
 * @module features/finger-baseline/copy
 * @description Every user-facing string on the finger pulse-anchor screen.
 *
 * Collected here so the compliance rules can be asserted against them
 * directly — the same arrangement `features/devices/copy.ts` uses.
 *
 * Four rules this copy is held to:
 *   1. No medical or diagnostic framing (CLAUDE.md hard rule).
 *   2. Nothing claims a capability that does not exist yet. While the camera
 *      capture layer is unwired, the screen says so rather than offering a
 *      button that pretends to scan.
 *   3. Skipping is offered with its real cost stated, not hidden and not
 *      dramatised.
 *   4. 🔴 Nothing here calls a camera reading HRV, and nothing calls one
 *      capture a baseline. A camera produces pulse-rate variability, which is
 *      a different quantity from a chest strap's HRV and is gated separately
 *      (docs/PHONE-PPG.md); a baseline is a distribution across days
 *      (`packages/engine/src/biometric/pulse-anchor.ts`). Both claims were in
 *      this file and both were wrong.
 *   5. 🔴 No autonomic claim of any kind — no sympathetic/parasympathetic
 *      score, no balance, no "stress level". `findForbiddenAutonomicClaims`
 *      in `domain/contracts/regulation-evidence.ts` is asserted against every
 *      line here.
 */

/** Why this step exists, in the user's terms. */
export const FINGER_BASELINE_COPY = {
  kicker: 'PULSE ANCHOR · 指尖脈搏校準',
  title: '建立你的脈搏錨點',

  /**
   * The reason, without naming a mechanism the user cannot verify. Says what
   * the finger adds that the face scan cannot — and stops there. The old
   * version said "逐拍之間的細微間隔 … 份量最重的一項", which was an HRV
   * claim the camera does not support.
   */
  why: '讓光透過你的指尖。相機讀得到指尖血流的節律，比臉部掃描讀到的心率乾淨得多 —— 而那是你的準備度讀數裡的一項。',

  /** The ask. */
  duration: '需要 90 秒，過程中手指輕放在後鏡頭上、保持不動。',

  /**
   * What one capture is, and what it is not. This card used to promise a
   * measurement-noise floor; that mechanism is HRV-specific and is shelved
   * (docs/PHONE-PPG.md §10), so the card now says the thing that is true.
   */
  precisionNote: '一次校準得到的是一個脈搏參考值，不是基線。基線要多次、跨幾天才成形 —— 畫面會照實告訴你現在到哪一階。',

  /**
   * What the camera can and cannot do. Said here rather than left to be
   * assumed — and stated precisely, because the previous version ("相機讀不到
   * 逐拍之間的間隔") was simply false: a camera does recover beat intervals.
   * What it recovers is pulse-rate variability, which is not HRV.
   */
  limits: '相機推得回拍與拍之間的間隔，但那是脈搏間期變化 —— 跟手錶或胸帶的心律變異是兩個量，不能直接比。呼吸率要另一套擷取流程，這個版本不報。',

  /** Privacy, stated as a property of the design rather than a promise. */
  privacy: '影像不留存。每一幀在本機化簡成數值後就丟棄。',

  startLabel: '開始校準',
  skipLabel: '稍後再做',

  /**
   * The cost of skipping. Neither hidden nor dramatised — the user is told
   * which part of the reading goes missing, and that it can be done later.
   */
  skipCost: '略過的話，你的準備度讀數裡「心率穩定度」那一項會少一個比較的基準，其餘照常。隨時可以回來做。',

  /**
   * What this is evidence OF. 🔴 Never "your nervous system" — a phone cannot
   * measure sympathetic or parasympathetic activity, and this line exists to
   * occupy the space where that claim would otherwise get written.
   */
  notADiagnosis: '這是你自己的脈搏節律紀錄，不是對身體狀況的判斷，也讀不到你的神經。',

  /**
   * Shown while no camera capture module exists. ⚠️ Do not replace this with a
   * working-looking button before the capture layer is real — a flow that
   * pretends to measure is worse than one that says it cannot.
   */
  unwiredNotice: '這個版本還沒有相機擷取模組，無法開始校準。',
} as const;
