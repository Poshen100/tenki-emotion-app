/**
 * preview-drift.mjs — /drift/（Drift Alert）的守門。
 *
 * 這支守兩件**機器守得住、自律守不住**的事：
 *
 * 1. **鏡射不准漂移。** `apps/preview/drift.js` 是
 *    `packages/engine/src/intelligence/` 的手抄鏡射，而這個 repo 為
 *    「鏡射漂移」付過三次學費（PLAYBOOK §6：同一筆決策，一頁 100%、
 *    另一頁 0%）。前兩次同檔 grep 得到，第三次跨檔沒人會想到去對照。
 *    → 這裡**逐一比對兩邊的常數值**，以及 copy 層的每一句長文案。
 *    改了 TS 沒改 preview（或反過來）當場紅。
 *
 * 2. **誠實分支真的走得到。** 這一頁的賣點不是「+17」，是
 *    「證據不足時閉嘴」與「校準後沒有改變也照實說」。那兩條分支最容易
 *    在改版時被悄悄改掉（改成鼓勵、改成給個預設數字），所以直接對它們下斷言。
 *
 * 另外守一條方向紅線：drift 的**主畫面一個字都不准講方向**
 * （above/below/higher/lower）—— docs/DECISION-INTELLIGENCE.md §2。
 *
 * Run:  node scripts/preview-drift.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const chromium = await getChromium();
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

let pass = 0;
let fail = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`}`);
}

function checkTruthy(name, value, detail = '') {
  value ? pass++ : fail++;
  console.log(`${value ? '✓' : '✗'} ${name}${value ? '' : `\n    ${detail}`}`);
}

// ═══════════════════════════════════════════════════
// 1. 鏡射常數比對
//
// ⚠️ 用 regex 讀 TS 是刻意的：這裡要比的是**字面常數**，而字面常數
//    regex 讀得準。需要解析後才知道真值的東西（var() 鏈、計算式）
//    才必須用瀏覽器問 —— 那是 preview-token-scale.mjs 的工作。
// ═══════════════════════════════════════════════════

const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

const TS = {
  evidence: read('packages/engine/src/intelligence/evidence.ts'),
  drift: read('packages/engine/src/intelligence/drift.ts'),
  calibration: read('packages/engine/src/intelligence/calibration.ts'),
  twin: read('packages/engine/src/intelligence/twin.ts'),
  copy: read('packages/engine/src/intelligence/copy.ts'),
};
const MIRROR = read('apps/preview/drift.js');

/** 第二組鏡射：讀數歷史（domain ↔ preview）。 */
const HISTORY_TS = read('domain/src/contracts/readiness-history.ts');
const HISTORY_MIRROR = read('apps/preview/readiness-history.js');
const SCAN = read('apps/preview/readiness-scan.js');
const PAGES_LOADING_SCAN = [
  'apps/preview/decision-alert.html',
  'apps/preview/v6/index.html',
  'apps/preview/drift-alert.html',
];

/**
 * 抓 `NAME = 123` 形式的數字常數（TS 可能有型別註記，數字可能有 _ 分隔）。
 * @param {string} src
 * @param {string} name
 * @returns {number|null}
 */
function scalarConst(src, name) {
  const m = src.match(new RegExp(`\\b${name}\\b[^=\\n]*=\\s*([0-9][0-9_.]*)`));
  return m ? Number(m[1].replace(/_/g, '')) : null;
}

/**
 * 抓 `NAME = { a: 1, b: 2 }` 裡的 key → number。
 * @param {string} src
 * @param {string} name
 * @returns {Record<string, number>|null}
 */
function objectConst(src, name) {
  const start = src.search(new RegExp(`\\b${name}\\b[^=\\n]*=\\s*\\{`));
  if (start === -1) return null;
  const open = src.indexOf('{', start);
  const close = src.indexOf('}', open);
  const body = src.slice(open + 1, close);
  const out = {};
  for (const [, key, value] of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([0-9][0-9_.]*)/g)) {
    out[key] = Number(value.replace(/_/g, ''));
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * 抓 `NAME = 'text'` 形式的字串常數。localStorage 的 key 是 persisted
 * contract —— 它漂移的後果是既有紀錄讀不到，比數字漂移更難發現。
 * @param {string} src
 * @param {string} name
 * @returns {string|null}
 */
function stringConst(src, name) {
  const m = src.match(new RegExp(`\\b${name}\\b[^=\\n]*=\\s*'([^']+)'`));
  return m ? m[1] : null;
}

const SCALARS = [
  ['MS_PER_DAY', TS.evidence],
  ['REFERENCE_WINDOW_DAYS', TS.drift],
  ['MIN_MEANINGFUL_STD', TS.drift],
  ['AT_REFERENCE_POINTS', TS.drift],
  ['MIN_MEANINGFUL_SHIFT', TS.calibration],
  ['SHIFT_STD_FRACTION', TS.calibration],
  ['TWIN_MATCH_THRESHOLD', TS.twin],
];

const OBJECTS = [
  ['DRIFT_EVIDENCE_REQUIREMENT', TS.drift],
  ['DRIFT_Z_THRESHOLDS', TS.drift],
  ['DRIFT_ABSOLUTE_THRESHOLDS', TS.drift],
  ['CALIBRATION_EVIDENCE_REQUIREMENT', TS.calibration],
  ['TWIN_EVIDENCE_REQUIREMENT', TS.twin],
  ['TWIN_FEATURE_WEIGHTS', TS.twin],
];

console.log('── 鏡射常數 ──');
for (const [name, src] of SCALARS) {
  const fromTs = scalarConst(src, name);
  const fromMirror = scalarConst(MIRROR, name);
  checkTruthy(
    `${name} 兩邊都讀得到`,
    fromTs !== null && fromMirror !== null,
    `ts=${fromTs} mirror=${fromMirror}（抓不到通常表示常數改名或改寫法，harness 要跟著改）`
  );
  check(`${name} 值一致`, fromMirror, fromTs);
}
for (const [name, src] of OBJECTS) {
  const fromTs = objectConst(src, name);
  const fromMirror = objectConst(MIRROR, name);
  checkTruthy(
    `${name} 兩邊都讀得到`,
    fromTs !== null && fromMirror !== null,
    `ts=${JSON.stringify(fromTs)} mirror=${JSON.stringify(fromMirror)}`
  );
  check(`${name} 值一致`, fromMirror, fromTs);
}

// ── copy 層：TS 的每一句長文案都要在鏡射裡逐字出現 ──
//
// ⚠️ **這條只涵蓋單引號字面**。copy.ts 有幾句活在 template literal 裡
//    （`${resemblance} ${outcome} This is not a forecast…`），這裡抓不到 ——
//    反向驗證時把 no_clear_shift 那句改成「Almost there — try again」，
//    這條**沒有紅**，是下面的瀏覽器斷言抓到的。所以兩層都要留：
//    字面比對守「一模一樣」，瀏覽器斷言守「意思沒被改掉」。
console.log('\n── 鏡射文案 ──');
const tsSentences = [...TS.copy.matchAll(/'([^'\\\n]{20,})'/g)].map((m) => m[1]);
checkTruthy(`copy.ts 抓得到長文案（抓到 ${tsSentences.length} 句）`, tsSentences.length >= 10);
const missing = tsSentences.filter((s) => !MIRROR.includes(s));
check('每一句都出現在 drift.js', missing, []);

// ── 那條「不准講 prediction」的紅線 ──
checkTruthy('兩邊都用 forecast 當否認句', TS.copy.includes('not a forecast') && MIRROR.includes('not a forecast'));
checkTruthy(
  '兩邊的文案都沒有 "not a prediction"',
  !TS.copy.includes("not a prediction —") && !MIRROR.includes('not a prediction'),
  'PROHIBITED_VOCABULARY 用 substring 比對 predict，誠實的否認會被當成被禁的宣稱一起擋掉'
);

// ═══════════════════════════════════════════════════
// 1b. 讀數歷史的鏡射與接線
//
// 這一組守的是「讀數真的在累積」。它壞掉的樣子特別安靜：
// 頁面照跑、掃描照給讀數，只有歷史一直是空的 —— 而依賴歷史的三個支柱
// 要好幾天之後才會有人發現它們永遠說「證據不足」。
// ═══════════════════════════════════════════════════

console.log('\n── 讀數歷史：鏡射 ──');
for (const name of ['READINESS_HISTORY_SCHEMA', 'READINESS_HISTORY_MAX']) {
  check(`${name} 值一致`, scalarConst(HISTORY_MIRROR, name), scalarConst(HISTORY_TS, name));
}
const keyFromTs = stringConst(HISTORY_TS, 'READINESS_HISTORY_KEY');
checkTruthy('READINESS_HISTORY_KEY 讀得到', keyFromTs !== null, `ts=${keyFromTs}`);
check('READINESS_HISTORY_KEY 值一致', stringConst(HISTORY_MIRROR, 'READINESS_HISTORY_KEY'), keyFromTs);
checkTruthy(
  '歷史沒有挪用「當下讀數」那把 key',
  keyFromTs !== 'tenki.readiness.reading.v1',
  '挪用 persisted key ＝ 讓既有紀錄靜默壞掉'
);

console.log('\n── 讀數歷史：接線 ──');
checkTruthy(
  'saveReading 有把讀數送進歷史',
  /function saveReading[\s\S]{0,400}recordInHistory\(reading\)/.test(SCAN),
  '掃描存了「當下讀數」卻沒有 append，歷史就永遠是空的'
);
checkTruthy(
  'readiness-scan.js 沒有自己寫第二份歷史',
  !SCAN.includes(keyFromTs),
  `readiness-scan.js 直接碰 ${keyFromTs} ＝ 又生出第二個來源（PLAYBOOK §6）`
);
for (const page of PAGES_LOADING_SCAN) {
  const html = read(page);
  // 🔴 只認 <script> 標籤，不認**提到**檔名的地方。第一版用 indexOf(檔名)，
  //    兩個頁面都紅 —— 因為 decision-alert.html:809 與 v6/index.html:5269
  //    的**註解**裡就寫著 readiness-scan.js，比真正的標籤還早出現。
  //    那不是順序錯了，是斷言在量別的東西。
  const historyAt = html.search(/<script[^>]+readiness-history\.js/);
  const scanAt = html.search(/<script[^>]+readiness-scan\.js/);
  checkTruthy(`${page} 載入了 readiness-history.js`, historyAt !== -1);
  // drift-alert.html 不載 readiness-scan.js（它沒有掃描），只要有 history 就好。
  if (scanAt !== -1) {
    checkTruthy(
      `${page} 的 history 排在 scan 之前`,
      historyAt !== -1 && historyAt < scanAt,
      `history@${historyAt} scan@${scanAt} —— saveReading 會呼叫它，順序反了就記不到`
    );
  }
}

// ═══════════════════════════════════════════════════
// 2. 瀏覽器實走
// ═══════════════════════════════════════════════════

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const file = join(repoRoot, clean);
  if (!file.startsWith(repoRoot) || !existsSync(file)) {
    res.writeHead(404).end('nf');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'text/plain' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${base}/apps/preview/drift-alert.html`, { waitUntil: 'domcontentloaded' });

const text = (sel) => page.locator(sel).innerText();
const pickScenario = (label) => page.getByRole('button', { name: new RegExp(label) }).first().click();

console.log('\n── 預設情境（大幅偏移）──');
check('主標是偏移，不是分數', await text('#drift-headline'), 'Your state is shifting');
check('讀數是算出來的 +17', (await text('#drift-figure')).split('\n')[0], '+17');
check(
  '證據行講樣本數與信心',
  await text('#drift-evidence'),
  'Based on 28 comparable sessions · Confidence: High'
);
check('決策分身講歷史不講未來', (await text('#twin-body')).includes('not a forecast'), true);

console.log('\n── 🔴 方向紅線：主畫面一個字都不准講方向 ──');
for (const scenario of ['大幅偏移', '偏移中', '在常態內', '零變異']) {
  await pickScenario(scenario);
  const surface = [
    await text('#drift-headline'),
    await text('#drift-body'),
    await text('#drift-figure'),
  ].join(' ');
  checkTruthy(`${scenario}：沒有 above/below/higher/lower`, !/\b(above|below|higher|lower)\b/i.test(surface), surface);
}

console.log('\n── 🔴 證據不足時閉嘴 ──');
await pickScenario('證據不足');
check('改成「還在建立你的 baseline」', await text('#drift-headline'), 'Building your baseline');
// 5 = minSamples 8 − 這個情境的 3 筆歷史。數字是算出來的，改情境就會跟著變。
check('講還差幾次，不是給個數字', await text('#drift-figure'), '5\nmore comparable sessions needed');
checkTruthy(
  '事件鏈不收錄引擎拒絕宣稱的東西',
  !(await text('#chain')).includes('Distance from baseline'),
  await text('#chain')
);
checkTruthy(
  '決策分身也閉嘴',
  (await text('#twin-headline')) === 'Building your decision twins',
  await text('#twin-headline')
);

console.log('\n── 🔴 零變異：不做它做不到的正規化 ──');
await pickScenario('零變異');
await page.locator('#xray-toggle').click();
check('normalized distance 明說用不了', await text('#xray-z'), 'not usable');
checkTruthy('證據 X 光說明理由', (await text('#xray-reasons')).includes('barely varied'), await text('#xray-reasons'));
check('信心被壓到 Moderate', await text('#xray-confidence'), 'Moderate');

console.log('\n── 🔴 校準後「沒有明顯改變」是結果，不是失敗 ──');
await pickScenario('大幅偏移');
await page.getByRole('button', { name: '沒有明顯改變' }).click();
await page.locator('#calibrate-btn').click();
await page.locator('#calib-card').waitFor({ state: 'visible', timeout: 15000 });
check('判定是 no clear shift', await text('#calib-headline'), 'No clear shift yet');
// 前後讀數是一對，不准被拆成「大的 82 + 小的 → 83」。
check('前後讀數維持同一級', await text('#calib-figure'), '82 → 83');
checkTruthy('文案講「不是失敗」', (await text('#calib-body')).includes('not a failure'), await text('#calib-body'));
checkTruthy(
  '沒有被改寫成鼓勵',
  !/try again|keep going|almost/i.test(await text('#calib-body')),
  await text('#calib-body')
);
checkTruthy('事件鏈記下這一筆', (await text('#chain')).includes('no clear shift'), await text('#chain'));

console.log('\n── 校準有改變時，「7 次裡 5 次」是算出來的 ──');
await page.getByRole('button', { name: '往常態靠回去' }).click();
check('判定是 calibration response', await text('#calib-headline'), 'Calibration response');
checkTruthy(
  '比較句帶真實的分母',
  (await text('#calib-body')).includes('Similar in 5 of your last 7 sessions.'),
  await text('#calib-body')
);

console.log('\n── 🔴 真實累積：沒有資料時不編 ──');
check('空狀態明說還沒有資料', await text('#real-headline'), '還沒有你的資料');
checkTruthy(
  '空狀態講 PWA / 分頁 localStorage 不共用',
  (await text('#real-body')).includes('不共用'),
  await text('#real-body')
);

console.log('\n── 🔴 真實累積：分布是算出來的 ──');
const seeded = await browser.newPage({ viewport: { width: 390, height: 844 } });
await seeded.addInitScript(() => {
  const rows = [];
  // 🔴 用**本地**時間組時間戳，一天兩筆（09:00 / 21:00），跨 20 天。
  //    第一版用 UTC 起點 + 每 12 小時，容器（UTC）數到 20 天、
  //    別的時區會數到 21 —— 那是一條會隨 runner 時區飄的斷言。
  //    這樣寫還順便證明「天數 ≠ 樣本數」。
  for (let i = 0; i < 40; i++) {
    const day = Math.floor(i / 2);
    const hour = i % 2 === 0 ? 9 : 21;
    rows.push({
      schema: 1,
      ts: new Date(2026, 7, 1 + day, hour, 0, 0).getTime(),
      // stillness 刻意窄、lighting 刻意寬 —— 斷言要能分辨這兩者，
      // 才證明 span 是算的而不是印死的。
      stillness: 0.6 + (i % 2) * 0.1,
      lighting: 0.2 + (i % 9) * 0.08,
      uniformity: 0.7,
      blinkCadence: i % 3 === 0 ? null : 0.5,
      tier: 'A',
      band: 'neutral',
      confidence: 'moderate',
    });
  }
  rows.push({ schema: 99, ts: 1, stillness: 0.5 });
  localStorage.setItem('tenki.readiness.history.v1', JSON.stringify(rows));
});
await seeded.goto(`${base}/apps/preview/drift-alert.html`, { waitUntil: 'domcontentloaded' });

const realText = await seeded.locator('#real-card').innerText();
// 40 筆、20 天 —— 同一個斷言同時證明「天數不是樣本數」。
checkTruthy('報出掃描次數與天數', /40 次掃描 · 20 天/.test(realText), realText.split('\n')[1]);

const spanOf = async (signal) => {
  const row = await seeded.locator(`.dist-row[data-signal="${signal}"] .dist-nums`).innerText();
  return Number(row.match(/span ([0-9.]+)/)[1]);
};
check('窄訊號的 span 是窄的', await spanOf('stillness'), 0.1);
checkTruthy(
  '寬訊號的 span 明顯更大（span 不是印死的）',
  (await spanOf('lighting')) > (await spanOf('stillness')) * 4,
  `lighting=${await spanOf('lighting')} stillness=${await spanOf('stillness')}`
);
checkTruthy(
  '眨眼只算有量到的那些（40 筆裡 26 筆）',
  (await seeded.locator('.dist-row[data-signal="blinkCadence"] .dist-name').innerText()).includes('n=26'),
  await seeded.locator('.dist-row[data-signal="blinkCadence"] .dist-name').innerText()
);
checkTruthy(
  '讀不動的列有說出來，不是無聲丟掉',
  realText.includes('1 stored rows were unreadable'),
  realText
);
await seeded.close();

console.log('\n── 版面與執行時期 ──');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
checkTruthy(`390px 下沒有橫向溢出（多出 ${overflow}px）`, overflow <= 1);
check('沒有 runtime error', errors, []);

await browser.close();
server.close();

console.log(`\n══════════ preview-drift ══════════\n ${pass} passed, ${fail} failed\n═══════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);
