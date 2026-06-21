/**
 * TENKI CORE — Soul Scan pre-camera onboarding.
 *
 * Three panels (Establish → Why Baseline Matters → Secure Access) layered above
 * the scan #stage. On "Enable Camera" it fades out and hands off to the existing
 * capture FSM via window.TENKI_ENROLL.begin(), so the camera request still fires
 * inside the user gesture. Fully self-contained — the scan FSM is untouched.
 */
(() => {
  'use strict';

  const ob = document.getElementById('onboarding');
  if (!ob) return;

  const panels = {
    establish: document.getElementById('ob-establish'),
    why: document.getElementById('ob-why'),
    secure: document.getElementById('ob-secure'),
  };
  const restartBtn = document.getElementById('restart');

  // hide the scan's Restart affordance until the camera flow actually begins
  if (restartBtn) restartBtn.style.display = 'none';

  /** Cross-fade to a named panel. */
  function show(name) {
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('active', key === name);
    });
    if (name === 'why') startResonance();
  }

  // ── Panel 2 carousel ──────────────────────────────────────────────────────
  const CARDS = [
    {
      title: 'Personal Resonance',
      body: 'Your unique baseline acts as a reference point, letting TENKI detect even subtle shifts in your patterns over time — for a clearer, more personal read on where you stand, while keeping your privacy first.',
    },
    {
      title: 'Private by Design',
      body: 'Every calculation runs on-device. Your facial data and signals never leave this phone — no cloud, no account, no exceptions.',
    },
    {
      title: 'Clarity Over Time',
      body: 'As TENKI learns your steady state, your daily readiness signal sharpens — turning small day-to-day shifts into an at-a-glance sense of clarity.',
    },
  ];
  let card = 0;
  const titleEl = document.getElementById('ob-card-title');
  const bodyEl = document.getElementById('ob-card-body');
  const dots = Array.from(document.querySelectorAll('#ob-why .ob-dot'));

  function renderCard(i) {
    titleEl.style.opacity = '0';
    bodyEl.style.opacity = '0';
    setTimeout(() => {
      titleEl.textContent = CARDS[i].title;
      bodyEl.textContent = CARDS[i].body;
      titleEl.style.opacity = '1';
      bodyEl.style.opacity = '1';
    }, 200);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  }

  // ── Resonance graphic — mirrored standing-wave interference lattice ────────
  const rc = document.getElementById('resonance');
  const rctx = rc ? rc.getContext('2d') : null;
  let resonRAF = null;
  const STRANDS = [
    { amp: 30, freq: 2.4, speed: 0.9, hue: '0,240,255' },
    { amp: 46, freq: 1.6, speed: 0.6, hue: '51,153,255' },
    { amp: 18, freq: 3.4, speed: 1.3, hue: '120,220,255' },
  ];

  function drawResonance(t) {
    if (!rctx) return;
    const W = rc.width, H = rc.height, cy = H / 2;
    rctx.clearRect(0, 0, W, H);
    rctx.globalCompositeOperation = 'lighter';

    // central bright band (the calm steady-state axis)
    const band = rctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, 'rgba(0,240,255,0)');
    band.addColorStop(0.5, 'rgba(180,250,255,0.9)');
    band.addColorStop(1, 'rgba(0,240,255,0)');
    rctx.fillStyle = band;
    rctx.fillRect(0, cy - 1.1, W, 2.2);

    const ph = t / 1000;
    for (const s of STRANDS) {
      for (const dir of [1, -1]) { // top + mirrored bottom
        rctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const env = Math.sin((x / W) * Math.PI); // taper to zero at both ends
          const y = cy + dir * env * s.amp *
            Math.sin((x / W) * Math.PI * 2 * s.freq + ph * s.speed);
          if (x === 0) rctx.moveTo(x, y); else rctx.lineTo(x, y);
        }
        rctx.strokeStyle = `rgba(${s.hue},0.5)`;
        rctx.lineWidth = 1.6;
        rctx.shadowColor = `rgba(${s.hue},0.9)`;
        rctx.shadowBlur = 10;
        rctx.stroke();
      }
    }
    rctx.shadowBlur = 0;

    // resonance nodes — glowing dots gliding along the brightest strand
    const lead = STRANDS[1];
    for (let i = 0; i < 7; i++) {
      const fx = ((i / 6) + (ph * 0.05)) % 1;
      const x = fx * W;
      const env = Math.sin(fx * Math.PI);
      const y = cy + env * lead.amp * Math.sin(fx * Math.PI * 2 * lead.freq + ph * lead.speed);
      const r = 2 + env * 2.4;
      const g = rctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, 'rgba(220,250,255,0.95)');
      g.addColorStop(1, 'rgba(51,153,255,0)');
      rctx.fillStyle = g;
      rctx.beginPath();
      rctx.arc(x, y, r * 4, 0, Math.PI * 2);
      rctx.fill();
    }
    rctx.globalCompositeOperation = 'source-over';
  }

  function startResonance() {
    if (resonRAF || !rctx) return;
    const tick = (t) => { drawResonance(t); resonRAF = requestAnimationFrame(tick); };
    resonRAF = requestAnimationFrame(tick);
  }
  function stopResonance() {
    if (resonRAF) { cancelAnimationFrame(resonRAF); resonRAF = null; }
  }

  // ── Handoff to the camera capture FSM ──────────────────────────────────────
  function handoff() {
    ob.classList.add('gone');
    stopResonance();
    if (restartBtn) restartBtn.style.display = '';
    setTimeout(() => { ob.style.display = 'none'; }, 600);
    if (window.TENKI_ENROLL && typeof window.TENKI_ENROLL.begin === 'function') {
      window.TENKI_ENROLL.begin();
    }
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  document.getElementById('ob-begin-cal').addEventListener('click', () => show('why'));
  document.getElementById('ob-next').addEventListener('click', () => {
    if (card < CARDS.length - 1) { card += 1; renderCard(card); }
    else { show('secure'); }
  });
  document.getElementById('ob-enable-cam').addEventListener('click', handoff);
  document.getElementById('ob-privacy').addEventListener('click', () => {
    // gentle acknowledgement — re-emphasise the three guarantees
    const pts = document.querySelectorAll('#ob-secure .ob-num');
    pts.forEach((n, i) => {
      setTimeout(() => {
        n.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
          { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' },
        );
      }, i * 90);
    });
  });
})();
