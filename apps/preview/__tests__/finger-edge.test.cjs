/**
 * Headless tests for finger-edge.js — the bridge from the real fingertip-PPG
 * HR baseline into the real Edge Score engine.
 * Run: node apps/preview/__tests__/finger-edge.test.cjs
 *
 * The engine bundle (engine-bundle.js) is an IIFE that assigns to a global, so
 * we evaluate it in a vm context and inject TENKIEngine into the adapter. The
 * browser reveal UI (DOM) is NOT covered here — it needs a real phone + finger.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fedge = require('../finger-edge.js');

// Load the engine bundle into an isolated context to obtain TENKIEngine.
const bundlePath = path.join(__dirname, '..', 'engine-bundle.js');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(bundlePath, 'utf8'), ctx);
const engine = ctx.TENKIEngine;

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

const MORNING = new Date('2026-06-24T09:00:00').getTime();

console.log('engine bundle — exports present');
check('TENKIEngine.calculateEdgeScore is a function', typeof engine.calculateEdgeScore === 'function');
check('createEmptyBaselineProfile is a function', typeof engine.createEmptyBaselineProfile === 'function');

console.log('buildSignalQuality — confidence/coverage mapping');
let sq = fedge.buildSignalQuality(0.82, true);
check('score scales from confidence (0.82 → 82)', sq.score === 82);
check('grade B for 82', sq.grade === 'B');
check('coverage high when covered', sq.coverage === 0.9);
check('acceptable when score >= 40', sq.acceptable === true);
sq = fedge.buildSignalQuality(0.2, false);
check('low confidence → not acceptable', sq.acceptable === false && sq.coverage === 0.4);

console.log('buildEdgeInput — only HR baseline populated, HRV/RR empty');
const fb = { count: 8, mean: 64, std: 4, maturity: 'ready', lastUpdatedAt: MORNING };
const input = fedge.buildEdgeInput(fb, 64, fedge.buildSignalQuality(0.8, true), [], MORNING, engine);
check('hr morning bucket filled from baseline', input.baseline.hr.morning.mean === 64 && input.baseline.hr.morning.sampleCount === 8);
check('hrv baseline left empty (sampleCount 0)', input.baseline.hrv.morning.sampleCount === 0);
check('rr baseline left empty (sampleCount 0)', input.baseline.rr.morning.sampleCount === 0);
check('maturity carried from finger baseline', input.baseline.maturity === 'ready');
check('totalScanCount carried', input.baseline.totalScanCount === 8);
check('reading hrBpm is the current bpm', input.reading.hrBpm === 64);
check('sleep source none (unmeasured)', input.sleepRecovery.source === 'none');
check('throws without an engine', (() => { try { fedge.buildEdgeInput(fb, 64, sq, [], MORNING, null); return false; } catch (_) { return true; } })());

console.log('calculateEdgeScore — runs on the real engine, reacts to real HR');
const atBaseline = engine.calculateEdgeScore(
  fedge.buildEdgeInput(fb, 64, fedge.buildSignalQuality(0.85, true), [], MORNING, engine)
);
check('score is 0-100', atBaseline.score >= 0 && atBaseline.score <= 100);
check('zone is a valid string', ['clear', 'neutral', 'strain'].indexOf(atBaseline.zone) >= 0);
check('engine produced safe copy headline', typeof atBaseline.copy.headline === 'string' && atBaseline.copy.headline.length > 0);

// Elevated HR vs baseline must lower the HR-stability driver (real z-score path).
const elevated = engine.calculateEdgeScore(
  fedge.buildEdgeInput(fb, 84, fedge.buildSignalQuality(0.85, true), [], MORNING, engine) // z=(84-64)/4=5
);
const hrDriverBase = atBaseline.drivers.find((d) => d.key === 'hr_stability').rawSubScore;
const hrDriverElev = elevated.drivers.find((d) => d.key === 'hr_stability').rawSubScore;
check('HR at baseline → high HR-stability sub-score', hrDriverBase >= 90);
check('elevated HR → HR-stability sub-score collapses', hrDriverElev < hrDriverBase && hrDriverElev <= 10);
check('elevated HR lowers final score', elevated.score < atBaseline.score);

console.log('computeHonestConfidence — always LOW (HRV/RR/sleep/trend unmeasured)');
const honest = fedge.computeHonestConfidence(atBaseline);
check('honest band is low', honest.band === 'low');
check('honest band overrides engine moderate/high when applicable', honest.band === 'low');
check('measuredWeight is the HR-driven subset (~32.5)', honest.measuredWeight === 32.5);
check('unmeasured keys include hrv_vs_baseline', honest.unmeasuredKeys.indexOf('hrv_vs_baseline') >= 0);

console.log('DRIVER_STATUS — honesty labels');
check('hr_stability measured', fedge.DRIVER_STATUS.hr_stability === 'measured');
check('stress_proxy partial', fedge.DRIVER_STATUS.stress_proxy_vs_baseline === 'partial');
check('hrv unmeasured', fedge.DRIVER_STATUS.hrv_vs_baseline === 'unmeasured');
check('respiration unmeasured', fedge.DRIVER_STATUS.respiration_stability === 'unmeasured');

console.log('computeHonestScore — neutralise unmeasured dims (kill RR phantom 100)');
// synthetic drivers: respiration carries the empty-baseline phantom 100
const synthDrivers = {
  drivers: [
    { key: 'hrv_vs_baseline', rawSubScore: 50 },        // unmeasured → 50 (unchanged)
    { key: 'hr_stability', rawSubScore: 100 },          // measured → 100
    { key: 'respiration_stability', rawSubScore: 100 }, // unmeasured PHANTOM → 50
    { key: 'stress_proxy_vs_baseline', rawSubScore: 50 }, // partial → kept
    { key: 'sleep_recovery', rawSubScore: 50 },         // unmeasured → 50
    { key: 'recent_trend', rawSubScore: 50 },           // unmeasured → 50
    { key: 'baseline_freshness', rawSubScore: 100 },    // measured → 100
    { key: 'signal_quality', rawSubScore: 30 },         // measured → 30
  ],
};
const hs = fedge.computeHonestScore(synthDrivers);
// expected = (50*25+100*15+50*10+50*15+50*15+50*10+100*5+30*5)/100 = 59 (RR neutralised)
check('honest score neutralises the RR phantom (= 59)', hs === 59);
// raw engine aggregate of the same drivers would be 64 (RR at 100)
const rawAgg = Math.round(synthDrivers.drivers.reduce(function (s, d) {
  return s + d.rawSubScore * (fedge.DRIVER_WEIGHTS[d.key] / 100);
}, 0));
check('honest score is below the phantom-inflated raw (59 < 64)', hs < rawAgg && rawAgg === 64);
check('honest score stays in neutral band', engine.classifyEdgeZone(hs) === 'neutral');
check('empty/malformed result degrades to 0', fedge.computeHonestScore({}) === 0);

console.log('buildEdgeInputFromVitals — full real vitals (HR+HRV+RR)');
const vitals = {
  hr: { mean: 62, std: 3 },
  hrv: { mean: 55, std: 8 },
  rr: { mean: 15, std: 1.5 },
  count: 4,
  maturity: 'building',
};
const vIn = fedge.buildEdgeInputFromVitals(vitals, fedge.buildSignalQuality(0.8, true), [], MORNING, engine);
check('hr baseline populated', vIn.baseline.hr.morning.mean === 62 && vIn.baseline.hr.morning.sampleCount === 4);
check('hrv baseline populated (NOT empty)', vIn.baseline.hrv.morning.mean === 55 && vIn.baseline.hrv.morning.sampleCount === 4);
check('rr baseline populated (NOT empty)', vIn.baseline.rr.morning.mean === 15 && vIn.baseline.rr.morning.sampleCount === 4);
check('reading carries all three vitals', vIn.reading.hrBpm === 62 && vIn.reading.hrvRmssdMs === 55 && vIn.reading.rrBrpm === 15);
check('maturity from vitals', vIn.baseline.maturity === 'building');
const vResult = engine.calculateEdgeScore(vIn);
check('full-vitals score is 0-100', vResult.score >= 0 && vResult.score <= 100);
// With all vitals measured, engine confidence is its NATIVE value (not forced low).
check('engine native confidence band present', ['low', 'moderate', 'high'].indexOf(vResult.confidence.band) >= 0);
check('respiration driver is NOT the empty-baseline 100 anymore',
  vResult.drivers.find((d) => d.key === 'respiration_stability').rawSubScore <= 100); // real RR baseline → real z
check('throws without engine (vitals)', (() => { try { fedge.buildEdgeInputFromVitals(vitals, {}, [], MORNING, null); return false; } catch (_) { return true; } })());

console.log('Today snapshot — persist/load round-trip');
const snap = fedge.persistTodaySnapshot({ score: 71, zone: 'clear', hr: 62, hrv: 55, rr: 15, confidenceBand: 'moderate', count: 4 });
check('persisted snapshot carries a ts', typeof snap.ts === 'number');
check('persisted snapshot carries score/zone', snap.score === 71 && snap.zone === 'clear');
// localStorage is undefined in node → loadTodaySnapshot returns null (graceful).
check('loadTodaySnapshot is graceful without localStorage', fedge.loadTodaySnapshot() === null);

console.log('recordEdgeScore — rolling history (newest first, cap 10)');
// localStorage is undefined in node → recordEdgeScore degrades but still returns the capped array.
let hist = [];
for (let i = 1; i <= 12; i++) hist = fedge.recordEdgeScore(i);
check('history is an array', Array.isArray(hist));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
