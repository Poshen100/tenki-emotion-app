/**
 * @module features/finger-baseline/copy
 * @description Every user-facing string on the finger HRV baseline screen.
 *
 * Collected here so the compliance rules can be asserted against them
 * directly — the same arrangement `features/devices/copy.ts` uses.
 *
 * Three rules this copy is held to:
 *   1. No medical or diagnostic framing (CLAUDE.md hard rule).
 *   2. Nothing claims a capability that does not exist yet. While the camera
 *      capture layer is unwired, the screen says so rather than offering a
 *      button that pretends to scan.
 *   3. Skipping is offered with its real cost stated, not hidden and not
 *      dramatised.
 */

/** Why this step exists, in the user's terms. */
export const FINGER_BASELINE_COPY = {
  kicker: 'PRECISION · 精密校準',
  title: '建立心律變異基線',

  /**
   * The reason, without naming a mechanism the user cannot verify. Says what
   * the finger adds that the face scan cannot, and why the length is what it
   * is.
   */
  why: '臉部掃描讀得到心率，但讀不到逐拍之間的細微間隔。手指貼著鏡頭能讀到，而那是你的準備度讀數裡份量最重的一項。',

  /** The ask. 90 seconds is the measured point of diminishing returns. */
  duration: '需要 90 秒，過程中手指輕放在後鏡頭上、保持不動。',

  /** What the system does with the extra time — the honest differentiator. */
  precisionNote: '這 90 秒同時在量另一件事：這支手機量你有多穩。知道了它，之後小於量測誤差的變化就不會被當成狀態改變。',

  /** Privacy, stated as a property of the design rather than a promise. */
  privacy: '影像不留存。每一幀在本機化簡成數值後就丟棄。',

  startLabel: '開始校準',
  skipLabel: '稍後再做',

  /**
   * The cost of skipping. Neither hidden nor dramatised — the user is told
   * which part of the reading goes missing, and that it can be done later.
   */
  skipCost: '略過的話，你的準備度讀數會少掉心律變異這一項，其餘照常。隨時可以回來做。',

  /**
   * Shown while no camera capture module exists. ⚠️ Do not replace this with a
   * working-looking button before the capture layer is real — a flow that
   * pretends to measure is worse than one that says it cannot.
   */
  unwiredNotice: '這個版本還沒有相機擷取模組，無法開始校準。',
} as const;
