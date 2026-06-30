/**
 * TENKI CORE — Soul Scan pre-camera onboarding (cinematic 5-step arc).
 *
 * A single living orb + dashed baseline travels through five narrative beats:
 *   1 Welcome      — "Calibrate Your Emotional Radar"
 *   2 Radar        — see where you are relative to your baseline (Expansion/Contraction)
 *   3 Reframe      — "You're not the problem. Your state is." (turning-point mark)
 *   4 Calibration  — hold-to-calibrate pulls the orb back up to baseline (felt, not told)
 *   5 Secure       — privacy guarantees → Enable Camera → hands off to the scan FSM
 *
 * On "Enable Camera" it fades out and hands off to the existing capture FSM via
 * window.TENKI_ENROLL.begin(), so the camera request still fires inside the user
 * gesture. The scan FSM is untouched. GSAP drives the orb choreography; the page
 * degrades gracefully (instant positioning) when GSAP or reduced-motion applies.
 */
(() => {
  'use strict';

  const ob = document.getElementById('onboarding');
  if (!ob) return;

  const restartBtn = document.getElementById('restart');
  // hide the scan's Restart affordance until the camera flow actually begins
  if (restartBtn) restartBtn.style.display = 'none';

  const HAS_GSAP = typeof window.gsap !== 'undefined';
  const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOTAL = 5;

  // ── Elements ────────────────────────────────────────────────────────────
  const panels = Array.from(ob.querySelectorAll('.ob-panel'));
  const orb = document.getElementById('ob-orb');
  const beam = document.getElementById('ob-beam');
  const baseline = document.getElementById('ob-baseline');
  const axisTop = document.getElementById('ob-axis-top');
  const axisBot = document.getElementById('ob-axis-bot');
  const progress = document.getElementById('ob-progress');
  const dots = Array.from(document.getElementById('ob-dots').children);
  const progressLbl = document.getElementById('ob-progress-lbl');
  const hint = document.getElementById('ob-hint');

  // Steps 2 (Radar) and 3 (Reframe) are pure narration — they auto-advance as
  // timed transitions (ms) rather than gating on a button. Reframe gets a longer
  // beat so the line lands. Timers respect prefers-reduced-motion (tap to advance).
  const AUTO = { 2: 3600, 3: 4200 };
  let autoTimer = null;

  // Orb vertical offset (px) from the baseline, per step.
  const ORB_REST = 0;        // at baseline
  const ORB_RADAR = 128;     // below baseline (Contraction side), clear of the axis label
  const ORB_CAL_START = 150; // well below — waiting to be pulled back

  let current = 0;
  let busy = false;

  // ── Low-level motion helpers (GSAP or instant fallback) ──────────────────

  /** Moves the orb (and beam) to a vertical offset from baseline. */
  function orbTo(y, animate) {
    if (HAS_GSAP && animate && !REDUCE) {
      window.gsap.to([orb, beam], { y: y, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
    } else {
      const t = 'translateY(' + y + 'px)';
      orb.style.transform = t;
      beam.style.transform = t;
    }
  }

  function fade(el, on) {
    if (el) el.style.opacity = on ? '1' : '0';
  }

  // ── Scene state per step ─────────────────────────────────────────────────
  // Each step decides which scene elements are visible and where the orb sits.
  const SCENES = {
    1: { baseline: true, axis: false, orb: true, beam: false, warm: false, orbY: ORB_REST },
    2: { baseline: true, axis: true, orb: true, beam: false, warm: false, orbY: ORB_RADAR },
    3: { baseline: false, axis: false, orb: false, beam: false, warm: false, orbY: ORB_REST },
    4: { baseline: true, axis: false, orb: true, beam: true, warm: true, orbY: ORB_CAL_START },
    5: { baseline: false, axis: false, orb: false, beam: false, warm: false, orbY: ORB_REST },
  };

  function applyScene(n) {
    const s = SCENES[n];
    ob.classList.toggle('warm', s.warm);
    fade(baseline, s.baseline);
    fade(axisTop, s.axis);
    fade(axisBot, s.axis);
    fade(beam, s.beam);
    fade(orb, s.orb);
    // Animate the orb only when it stays on-screen between steps; otherwise jump
    // while hidden so the next reveal starts from the right place.
    const wasVisible = SCENES[current] && SCENES[current].orb;
    orbTo(s.orbY, s.orb && wasVisible);
  }

  // ── Auto-advance (waiting transition) for narration steps ────────────────
  function clearAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    dots.forEach((d) => d.classList.remove('counting', 'run'));
  }

  function armAutoAdvance(n) {
    clearAuto();
    hint.classList.add('show');
    if (REDUCE || !AUTO[n]) return; // a11y: no timed motion — the hint + tap advances
    const dot = dots[n - 1];
    if (dot) {
      dot.style.setProperty('--dwell', AUTO[n] + 'ms');
      dot.classList.add('counting');
      // double rAF so the fill transition runs from scaleX(0)
      requestAnimationFrame(() => requestAnimationFrame(() => dot.classList.add('run')));
    }
    autoTimer = setTimeout(() => { if (current === n) showStep(n + 1); }, AUTO[n]);
  }

  // ── Step navigation ──────────────────────────────────────────────────────
  function showStep(n) {
    if (busy || n < 1 || n > TOTAL) return;
    busy = true;
    clearAuto();

    panels.forEach((p) => p.classList.toggle('active', Number(p.dataset.step) === n));

    progress.classList.add('show');
    dots.forEach((d, i) => d.classList.toggle('on', i === n - 1));
    progressLbl.textContent = 'Step ' + n + ' of ' + TOTAL;

    applyScene(n);
    current = n;

    if (n === 4) armCalibration();

    if (n === 2 || n === 3) armAutoAdvance(n);
    else hint.classList.remove('show');

    setTimeout(() => { busy = false; }, 520);
  }

  // ── Step 4: hold-to-calibrate ────────────────────────────────────────────
  const holdBtn = document.getElementById('ob-hold-cta');
  const holdFill = document.getElementById('ob-hold-fill');
  const holdLabel = document.getElementById('ob-hold-label');
  const HOLD_MS = 1700;
  let holdTween = null;
  let holdTimer = null;
  let calibrated = false;

  function completeCalibration() {
    if (calibrated) return;
    calibrated = true;
    holdLabel.textContent = 'Calibrated';
    // brief settle at baseline, then advance to Secure Access
    setTimeout(() => showStep(5), 460);
  }

  /** Builds (or rebuilds) the hold interaction for the Calibration step. */
  function armCalibration() {
    calibrated = false;
    holdLabel.textContent = 'Hold to calibrate';
    if (HAS_GSAP && !REDUCE) {
      if (holdTween) holdTween.kill();
      window.gsap.set(holdFill, { scaleX: 0 });
      holdTween = window.gsap.timeline({ paused: true, onComplete: completeCalibration })
        .to(holdFill, { scaleX: 1, duration: HOLD_MS / 1000, ease: 'none' }, 0)
        .to([orb, beam], { y: ORB_REST, duration: HOLD_MS / 1000, ease: 'power2.out' }, 0);
    } else {
      holdFill.style.transition = 'none';
      holdFill.style.transform = 'scaleX(0)';
    }
  }

  function holdStart(e) {
    if (current !== 4 || calibrated) return;
    if (e && e.cancelable) e.preventDefault();
    holdLabel.textContent = 'Calibrating…';
    if (HAS_GSAP && !REDUCE && holdTween) {
      holdTween.play();
    } else {
      // Fallback: CSS-driven fill + timed completion.
      holdFill.style.transition = 'transform ' + HOLD_MS + 'ms linear';
      holdFill.style.transform = 'scaleX(1)';
      if (!REDUCE) orbTo(ORB_REST, true);
      holdTimer = setTimeout(completeCalibration, HOLD_MS);
    }
  }

  function holdCancel() {
    if (current !== 4 || calibrated) return;
    holdLabel.textContent = 'Hold to calibrate';
    if (HAS_GSAP && !REDUCE && holdTween) {
      holdTween.reverse();
    } else {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      holdFill.style.transition = 'transform 320ms ease';
      holdFill.style.transform = 'scaleX(0)';
      orbTo(ORB_CAL_START, true);
    }
  }

  // ── Handoff to the camera capture FSM ────────────────────────────────────
  function handoff() {
    clearAuto();
    ob.classList.add('gone');
    if (restartBtn) restartBtn.style.display = '';
    setTimeout(() => { ob.style.display = 'none'; }, 600);
    if (window.TENKI_ENROLL && typeof window.TENKI_ENROLL.begin === 'function') {
      window.TENKI_ENROLL.begin();
    }
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  document.getElementById('ob-welcome-cta').addEventListener('click', () => showStep(2));
  document.getElementById('ob-enable-cam').addEventListener('click', handoff);

  // Radar (2) and Reframe (3) have no button — tapping anywhere on the panel skips
  // ahead immediately (and is the way forward under prefers-reduced-motion).
  document.getElementById('ob-radar').addEventListener('click', () => { if (current === 2) showStep(3); });
  document.getElementById('ob-reframe').addEventListener('click', () => { if (current === 3) showStep(4); });

  holdBtn.addEventListener('pointerdown', holdStart);
  holdBtn.addEventListener('pointerup', holdCancel);
  holdBtn.addEventListener('pointerleave', holdCancel);
  holdBtn.addEventListener('pointercancel', holdCancel);

  const privacy = document.getElementById('ob-privacy');
  if (privacy) {
    privacy.addEventListener('click', () => {
      const pts = document.querySelectorAll('#ob-secure .ob-num');
      pts.forEach((nEl, i) => {
        setTimeout(() => {
          nEl.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
            { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' },
          );
        }, i * 90);
      });
    });
  }

  // ── Init: reveal step 1's scene on a tick so transitions play ────────────
  orbTo(ORB_REST, false);
  requestAnimationFrame(() => requestAnimationFrame(() => showStep(1)));
})();
