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
check('flat signal rejected (bpm null)', r.bpm === null);

// sub-threshold amplitude (clean but tiny) → rejected by the amplitude gate
const tiny = [];
for (let i = 0; i < 300; i++) tiny.push(128 + 0.4 * Math.sin(2 * Math.PI * 1.2 * (i / 30)));
r = ppg.estimateBpm(tiny, 30);
check('sub-threshold amplitude rejected', r.bpm === null);

r = ppg.estimateBpm(synth(72, 30, 2, 5, 0), 30);
check('too-short signal rejected', r.bpm === null);

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
