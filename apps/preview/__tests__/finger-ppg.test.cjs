/**
 * Headless tests for the pure DSP + baseline core of finger-ppg.js.
 * Run: node apps/preview/__tests__/finger-ppg.test.cjs
 *
 * The browser capture controller (getUserMedia/torch) is NOT covered here — it
 * needs a real phone camera + finger to verify on-device.
 */
const ppg = require('../finger-ppg.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name);
  }
}

/** Synthetic green-channel PPG: DC 128 + clean sine at the given bpm. */
function synth(bpm, fps, secs, amp) {
  const n = Math.round(fps * secs);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    out.push(128 + amp * Math.sin(2 * Math.PI * (bpm / 60) * t));
  }
  return out;
}

/** PPG at bpm plus deterministic interference: slow drift + high-freq ripple. */
function synthNoisy(bpm, fps, secs, amp) {
  const n = Math.round(fps * secs);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const drift = 3 * Math.sin(2 * Math.PI * 0.2 * t); // 12 bpm — below band
    const ripple = 1.2 * Math.sin(2 * Math.PI * 5 * t); // 300 bpm — above band
    out.push(128 + amp * Math.sin(2 * Math.PI * (bpm / 60) * t) + drift + ripple);
  }
  return out;
}

console.log('estimateBpm — periodic signals');
let r = ppg.estimateBpm(synth(72, 30, 8, 5, 0), 30);
check('72 bpm clean within ±3', r.bpm !== null && Math.abs(r.bpm - 72) <= 3);
check('72 bpm confidence >= 0.5', r.confidence >= 0.5);

r = ppg.estimateBpm(synth(60, 30, 8, 4, 0), 30);
check('60 bpm clean within ±3', r.bpm !== null && Math.abs(r.bpm - 60) <= 3);

r = ppg.estimateBpm(synthNoisy(90, 30, 10, 5), 30);
check('90 bpm with drift+ripple within ±5', r.bpm !== null && Math.abs(r.bpm - 90) <= 5);

console.log('estimateBpm — quality gate rejects junk');
r = ppg.estimateBpm(new Array(240).fill(128), 30);
check('flat signal rejected (bpm null)', r.bpm === null && r.reason === 'flat');

// real fingertip PPG AC is tiny (esp. when red-saturated): a small but clean,
// periodic signal must be ACCEPTED — the periodicity gate, not amplitude, is king.
const small = [];
for (let i = 0; i < 300; i++) small.push(128 + 0.3 * Math.sin(2 * Math.PI * (66 / 60) * (i / 30)));
r = ppg.estimateBpm(small, 30);
check('small-amplitude clean PPG accepted ~66', r.bpm !== null && Math.abs(r.bpm - 66) <= 3);

r = ppg.estimateBpm(synth(72, 30, 2, 5, 0), 30);
check('too-short signal rejected', r.bpm === null && r.reason === 'short');

console.log('baseline — Welford + maturity');
let b = ppg.createFingerBaseline();
check('starts new / count 0', b.maturity === 'new' && b.count === 0);
[70, 72, 68, 71, 69].forEach(function (v, i) {
  b = ppg.updateFingerBaseline(b, v, i + 1);
});
check('count 5 after 5 scans', b.count === 5);
check('mean ~70', Math.abs(b.mean - 70) < 1.0);
check('std > 0 with spread', b.std > 0);
check('maturity ready at 5', b.maturity === 'ready');
check('building at 1 scan', ppg.fingerMaturity(1) === 'building');
check('mature at 15 scans', ppg.fingerMaturity(15) === 'mature');

console.log('assessStability — cross-window lock');
// build a (bpm,t) history from an array, one sample per `step` ms
function hist(bpms, step) {
  step = step || 1000;
  return bpms.map(function (b, i) { return { bpm: b, t: i * step }; });
}

// real pulse (from on-device sim): tight spread → locks, median ~ true rate
let s = ppg.assessStability(hist([54, 54, 60, 62, 49, 52, 56, 53, 57, 55]));
check('stable real pulse locks', s.locked === true);
check('locked median is plausible HR ~55', Math.abs(s.bpm - 55) <= 4);
check('locked spread within tolerance', s.spread <= 5);

// broadband noise: best-lag jumps around → never locks
s = ppg.assessStability(hist([114, 50, 53, 56, 51, 62, 57, 253, 253, 253]));
check('jumpy noise does NOT lock', s.locked === false);

// too few samples → not locked even if tight
s = ppg.assessStability(hist([60, 61]));
check('insufficient samples not locked', s.locked === false);

// enough samples but crammed into < min span → not locked
s = ppg.assessStability(hist([60, 61, 60, 62, 61], 300));
check('too-short time span not locked', s.locked === false);

// a single wild outlier must NOT block the lock — the median cluster wins
// (this is the on-device fix: occasional 253-bpm noise windows used to poison it)
s = ppg.assessStability(hist([58, 59, 58, 120, 59, 58]));
check('single wild outlier still locks (robust)', s.locked === true && Math.abs(s.bpm - 59) <= 2);

// median (not mean) is used for the recorded value → robust within a locked window
s = ppg.assessStability(hist([58, 59, 60, 61, 62]));
check('locked value is the median', s.locked === true && s.bpm === 60);

// empty / missing history degrades gracefully
s = ppg.assessStability([]);
check('empty history not locked', s.locked === false && s.bpm === null);

console.log('assessStability — noise-contaminated streams (on-device cases)');
// the exact on-device failure: persistent real ~50 bpm with occasional 253 bpm
// noise windows. round-3 max−min spread never locked; the robust cluster does.
s = ppg.assessStability(hist([50, 52, 48, 253, 51, 50, 49, 253, 52], 500));
check('real pulse + occasional 253 noise locks ~50', s.locked === true && Math.abs(s.bpm - 50) <= 3);
check('locked spread is the tight inlier spread', s.spread <= 5);

// half the windows are garbage → no confident majority cluster → no lock
s = ppg.assessStability(hist([50, 253, 49, 14, 52, 253, 48, 200, 51], 500));
check('half-noise does NOT lock', s.locked === false);

// nothing periodic → scattered best-lags → no lock
s = ppg.assessStability(hist([114, 50, 253, 56, 14, 253, 57, 200, 253], 500));
check('pure noise does NOT lock', s.locked === false);

console.log('assessStability — physiological plausibility bound');
// on-device weak-contact failure: a PERFECTLY stable garbage cluster at the
// MAX_BPM boundary (257 bpm, spread ±0). A resting-HR tool must never record it.
s = ppg.assessStability(hist([257, 257, 257, 257, 257, 257]));
check('stable but impossible 257 does NOT lock', s.locked === false);

// a stable mid-high noise cluster (e.g. 181) is still implausible for resting HR
s = ppg.assessStability(hist([181, 181, 180, 182, 181, 181]));
check('stable implausible 181 does NOT lock', s.locked === false);

// a plausible resting pulse at the same stability still locks (band is the only diff)
s = ppg.assessStability(hist([70, 71, 69, 70, 72, 70]));
check('stable plausible 70 locks', s.locked === true && Math.abs(s.bpm - 70) <= 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
