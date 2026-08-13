/**
 * reliability.js — 量測重複性自測（儀器自測，不是讀數）
 *
 * 🔴 這一頁存在的理由只有一個：**Edge Score 是 z 分數，分母是使用者自己的標準差。**
 * 如果同一天連掃三次的離散度，跟跨天的離散度差不多大，那 z 分數量到的就是
 * 量測噪音，不是狀態 —— 分數會看起來很有意義，實際上是隨機的。
 * 所以再現性不是品質項目，它決定 Edge Score 到底成不成立。
 *
 * ⚠️ 這是三種「準」裡唯一不需要外部裝置就能量的：
 *   ① 量測本身（幾何/像素統計）是確定性計算，沒有準不準的問題
 *   ② 效度（推論的狀態對不對）需要 ground truth —— 目前一個都沒有，量不了
 *   ③ 再現性 —— 就是這一頁
 *
 * 🔴 **本頁不得長得像讀數**：不顯示帶位、不下「儀器很準」這種結論、
 * 缺資料時顯示「未取得」而不是補一個數字。
 *
 * 量測完全複用 `readiness-scan.js`，這裡不寫任何新的量測程式碼。
 */
(function (global) {
    'use strict';

    /** 一輪自測要幾次有效掃描。少於這個數就不算離散度。 */
    var RUNS_PER_SESSION = 3;

    /**
     * 每次掃描之間的「放開」秒數。
     *
     * 🔴 這段不是禮貌，是方法學：背靠背連掃會共用姿勢與光線，量到的離散度
     * 會**低估**真實噪音 —— 那會讓儀器看起來比實際可靠，是最糟的偏誤方向。
     * 放開再重新取像，每一次才是獨立的一次 acquisition。
     */
    var RELEASE_SEC = 15;

    /** 本機累積紀錄（環形緩衝）。只存純量，不存影像也不存 landmark。 */
    var STORE_KEY = 'tenki.reliability.runs.v1';
    var STORE_MAX = 60;

    /**
     * person-signal composite —— **委派給 `baseline-store.js`**。
     *
     * ⚠️ 這裡原本自己抄了一份 domain 的實作。加上日常掃描也要算同一個量之後，
     * 那會變成三個來源 —— 所以鏡像收斂到 `baseline-store.js` 一支，
     * 由 harness 拿同一組輸入比對它與 domain。這支只負責轉呼叫。
     *
     * @param {{stillness:number, blinkCadence:?number}} evidence
     * @returns {number} 0..1
     */
    function personSignalComposite(evidence) {
        return window.TENKI_BASELINE_STORE.personSignalComposite(evidence);
    }

    function clamp01(v) {
        var n = Number(v);
        if (!isFinite(n)) return 0;
        return Math.min(1, Math.max(0, n));
    }

    /**
     * 樣本標準差（n−1）。
     *
     * @param {number[]} xs
     * @returns {?number} 少於 2 筆回 null —— 不是 0。一筆資料的離散度不是零，是未知。
     */
    function stdDev(xs) {
        if (!xs || xs.length < 2) return null;
        var mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
        var ss = xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0);
        return Math.sqrt(ss / (xs.length - 1));
    }

    /** @returns {?number} 全距；少於 2 筆回 null。 */
    function range(xs) {
        if (!xs || xs.length < 2) return null;
        return Math.max.apply(null, xs) - Math.min.apply(null, xs);
    }

    // ── 本機紀錄 ──

    function loadRuns() {
        try {
            var raw = JSON.parse(global.localStorage.getItem(STORE_KEY));
            return Array.isArray(raw) ? raw : [];
        } catch (e) { return []; }
    }

    function saveRuns(runs) {
        try {
            global.localStorage.setItem(STORE_KEY, JSON.stringify(runs.slice(-STORE_MAX)));
        } catch (e) { /* 無痕模式：這一輪照樣看得到，只是不累積 */ }
    }

    /** 本地日界（`YYYY-MM-DD`）—— 跨天比較用。 */
    function dayKey(ts) {
        var d = new Date(ts);
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + m + '-' + day;
    }

    /**
     * 跨天離散度：每天取該天的平均 composite，再算這些日平均的離散度。
     *
     * @param {Array} runs
     * @returns {{days:number, sd:?number, range:?number}}
     */
    function betweenDay(runs) {
        var byDay = {};
        runs.forEach(function (r) {
            if (typeof r.composite !== 'number') return;
            var k = dayKey(r.ts);
            (byDay[k] = byDay[k] || []).push(r.composite);
        });
        var means = Object.keys(byDay).map(function (k) {
            var xs = byDay[k];
            return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
        });
        return { days: means.length, sd: stdDev(means), range: range(means) };
    }

    // ── DOM ──

    function el(id) { return document.getElementById(id); }
    function fmt(n, digits) {
        return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toFixed(digits);
    }

    var session = null; // { results: [], index }

    function renderRows() {
        var body = el('rl-rows');
        if (!body) return;
        body.innerHTML = '';
        for (var i = 0; i < RUNS_PER_SESSION; i += 1) {
            var r = session && session.results[i];
            var row = document.createElement('div');
            row.className = 'rl-row';
            var state = !r ? '待測'
                : (r.reading === null ? '未取得' : fmt(r.composite, 3));
            // 🔴 掃描失敗時顯示「未取得」而不是 0 或補一個數字 ——
            // 一次沒量到就是沒量到，補值會直接污染離散度。
            row.innerHTML =
                '<span class="rl-k">第 ' + (i + 1) + ' 次</span>' +
                '<span class="rl-v" data-rl="run' + (i + 1) + '">' + state + '</span>' +
                '<span class="rl-meta">' +
                (r && r.reading ? ('tier ' + r.reading.evidence.tier + ' · ' + r.reading.confidence) : '') +
                '</span>';
            body.appendChild(row);
        }
    }

    function renderSummary() {
        var valid = (session ? session.results : [])
            .filter(function (r) { return r && r.reading !== null; })
            .map(function (r) { return r.composite; });

        var enough = valid.length >= RUNS_PER_SESSION;
        // 🔴 有效次數不足就不給數字。半套資料算出來的離散度會被當成結論。
        el('rl-within-sd').textContent = enough ? fmt(stdDev(valid), 4) : '未取得';
        el('rl-within-range').textContent = enough ? fmt(range(valid), 4) : '未取得';
        el('rl-valid').textContent = valid.length + ' / ' + RUNS_PER_SESSION;

        var bd = betweenDay(loadRuns());
        el('rl-days').textContent = String(bd.days);
        // 跨天要 ≥2 天才有對照；只有一天時不假裝算得出來。
        el('rl-between-sd').textContent = bd.days >= 2 ? fmt(bd.sd, 4) : '未取得';

        var verdict = el('rl-verdict');
        if (bd.days >= 2 && enough) {
            var w = stdDev(valid);
            var b = bd.sd;
            verdict.textContent = (w !== null && b !== null && w > 0)
                ? ('跨天離散度 ÷ 同場離散度 = ' + fmt(b / w, 2))
                : '未取得';
        } else {
            verdict.textContent = '還不能比 —— 需要至少 2 個不同日子的紀錄';
        }
    }

    function setStatus(text) {
        var node = el('rl-status');
        if (node) node.textContent = text;
    }

    /** 放開倒數 —— 讓下一次是獨立的一次取像。 */
    function releaseCountdown(sec) {
        return new Promise(function (resolve) {
            var left = sec;
            setStatus('放下手機或看別處 ' + left + ' 秒，讓下一次是獨立的一次取像');
            var t = setInterval(function () {
                left -= 1;
                if (left <= 0) {
                    clearInterval(t);
                    setStatus('準備下一次⋯');
                    resolve();
                    return;
                }
                setStatus('放下手機或看別處 ' + left + ' 秒，讓下一次是獨立的一次取像');
            }, 1000);
        });
    }

    function runOnce(index) {
        var S = global.TENKI_READINESS_SCAN;
        setStatus('第 ' + (index + 1) + ' 次量測中⋯');
        return S.begin({ mission: 'daily' }).then(function (reading) {
            var composite = reading ? personSignalComposite(reading.evidence) : null;
            session.results[index] = { reading: reading, composite: composite };
            if (reading) {
                var runs = loadRuns();
                runs.push({
                    ts: reading.ts,
                    composite: composite,
                    tier: reading.evidence.tier,
                    confidence: reading.confidence,
                });
                saveRuns(runs);
            }
            renderRows();
            renderSummary();
            return reading;
        });
    }

    function start() {
        var S = global.TENKI_READINESS_SCAN;
        if (!S || !S.begin) {
            setStatus('掃描模組沒載到 —— 無法量測');
            return;
        }
        if (!S.isAvailable()) {
            // 沒有相機就據實說，不跑一輪假的。
            setStatus('這個環境沒有相機 —— 無法量測');
            return;
        }
        el('rl-start').disabled = true;
        session = { results: [] };
        renderRows();
        renderSummary();

        var chain = Promise.resolve();
        for (var i = 0; i < RUNS_PER_SESSION; i += 1) {
            (function (idx) {
                chain = chain
                    .then(function () { return idx > 0 ? releaseCountdown(RELEASE_SEC) : null; })
                    .then(function () { return runOnce(idx); });
            })(i);
        }
        chain.then(function () {
            setStatus('這一輪結束。想累積跨天對照的話，明天再跑一次。');
            el('rl-start').disabled = false;
        }).catch(function (e) {
            setStatus('中斷：' + (e && e.message ? e.message : '未知原因'));
            el('rl-start').disabled = false;
        });
    }

    function init() {
        renderRows();
        renderSummary();
        var btn = el('rl-start');
        if (btn) btn.addEventListener('click', start);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 對外只為了 harness 可驗證性（純函式，無副作用）。
    global.TENKI_RELIABILITY = {
        personSignalComposite: personSignalComposite,
        stdDev: stdDev,
        range: range,
        RUNS_PER_SESSION: RUNS_PER_SESSION,
        STORE_KEY: STORE_KEY,
    };
})(window);
