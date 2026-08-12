/**
 * baseline-store.js — 個人基線樣本的**唯一讀寫入口**。
 *
 * 🔴 **為什麼是時間序列，不是四個純量**（founder 2026-08-12 拍板）：
 * 之前只存 `{mean, std, n}`（Welford 那四個數字），那足夠算 z 分數，但**永遠**
 * 做不到品質加權與條件配對 —— 而且已經流失的歷史補不回來。存序列的成本是每次
 * 掃描五個純量，換來的是之後可以把底層換成加權經驗百分位而介面不變。
 *
 * 🔴 **Measurement Profile 分池是這支檔案的核心**（founder 2026-08-12）：
 *
 * > 不能把 2 秒臉部掃描與 60 秒深度掃描放進同一個百分位池裡比較。
 *
 * 今天已經有兩種量測條件，而它們的長度差三倍：
 *
 * | profile | 哪裡 | 長度 |
 * |---|---|---|
 * | `face_enroll_neutral_3s` | enrollment 的 neutral_capture | 3.6s |
 * | `face_scan_10s` | 日常掃描 | ~10s |
 *
 * 短窗的 stillness 平均本來就比長窗離散（樣本少、雜訊沒被平均掉）。混池會
 * **系統性灌大標準差 → 分數全體往 50 收，而且看起來完全正常** —— 比明顯壞掉
 * 危險得多。`docs/EDGE-SCORE-DEFINITION.md` §5.1 原本把這件事寫成「一個誠實的
 * 限制」，那是寫錯了：它不是限制，是不該混。
 *
 * ⚠️ **不預先發明沒有 code 的 profile。** 兩種就是兩種；等真的有 60 秒 PPG
 * 流程再加。（尤其不加 `trader_pre_decision` —— 那會把產品拉回 `SYSTEM.md`
 * 明文禁止的 "trading tool" 框架。）
 *
 * 純資料層：無 DOM、無量測、不決定任何顯示。
 */
(function (global) {
    'use strict';

    var STORE_KEY = 'tenki.baseline.samples.v1';

    /**
     * 舊的單筆種子（2026-08-12 上線，同日被本檔取代）。
     * 只用來遷移，之後不再寫入。
     */
    var LEGACY_SEED_KEY = 'tenki.baseline.seed.v1';

    /**
     * 環形緩衝上限。
     *
     * 半年份的每日掃描。超過就丟最舊的 —— 這同時是引擎那套
     * `MAX_SAMPLE_COUNT 100` + `DECAY_FACTOR 0.95` 想達成的效果（軟性滾動窗口），
     * 但在序列上做更直接：拿今天跟一個已經不存在的你比，本來就不該發生。
     */
    var MAX_SAMPLES = 180;

    /** 已知的量測條件。值會寫進 localStorage，改名等於丟掉舊資料。 */
    var PROFILES = {
        ENROLL_NEUTRAL: 'face_enroll_neutral_3s',
        DAILY_SCAN: 'face_scan_10s',
    };

    function isProfile(p) {
        return p === PROFILES.ENROLL_NEUTRAL || p === PROFILES.DAILY_SCAN;
    }

    function isFiniteNumber(v) {
        return typeof v === 'number' && isFinite(v);
    }

    function clamp01(v) {
        var n = Number(v);
        if (!isFinite(n)) return 0;
        return Math.min(1, Math.max(0, n));
    }

    /**
     * person-signal composite —— **一筆樣本的 `composite` 是什麼**，由這裡定義。
     *
     * ⚠️ **這是 `domain/src/policies/baseline-score.ts` 的鏡像。**
     * domain 是 TypeScript、preview 是無建置的 vanilla JS，沒辦法直接 import，
     * 所以只能鏡像 —— 而鏡像就是兩個來源（PLAYBOOK §6 已知 bug 類別）。
     * 沿用 repo 既有處理法（`readiness-scan.js` 的 BAND_TONE 鏡像 tokens.css）：
     * **由 harness 拿同一組輸入比對兩邊結果**，改任一邊而不改另一邊就會紅。
     *
     * ⚠️ 放在這支檔案是為了讓 preview 側只剩**一份**鏡像：`reliability.js` 與
     * `readiness-scan.js` 都委派過來。先前 reliability 自己抄了一份，再抄第二份
     * 就是三個來源。
     *
     * 🔴 只吃「人」的訊號。lighting/uniformity 是房間不是人，拿它排名等於
     * 「房間暗一點你的分數就低」—— 環境只能決定 confidence
     * （見 `docs/EDGE-SCORE-DEFINITION.md` §3.1）。
     *
     * ⚠️ 與 `readiness-scan.js` 的 `deriveBand()` **不是同一個量**：那支算的是
     * 冷啟動用的**絕對** composite，它**有**把 captureQuality 算進去，因為那條
     * 路上沒有基線可比、品質差就該讓帶位保守一點。兩個尺度不得互換。
     *
     * @param {{stillness:number, blinkCadence:?number}} evidence
     * @returns {number} 0..1
     */
    function personSignalComposite(evidence) {
        var stillness = clamp01(evidence.stillness);
        if (evidence.blinkCadence === null || evidence.blinkCadence === undefined) {
            return stillness;
        }
        return stillness * 0.6 + clamp01(evidence.blinkCadence) * 0.4;
    }

    /**
     * 本地日期鍵 `YYYY-MM-DD`。
     *
     * ⚠️ 刻意用**本地**時區而不是 UTC：使用者感受到的「今天」是本地的，
     * 而 UTC 會讓晚上的掃描算成隔天（台灣 UTC+8，20:00 之後就跨日了）。
     *
     * @param {number} ts - 毫秒時間戳。
     * @returns {string}
     */
    function dayKey(ts) {
        var d = new Date(ts);
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }

    function readRaw() {
        try {
            var s = global.localStorage.getItem(STORE_KEY);
            if (!s) return [];
            var parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return []; // 無痕 / 壞掉的 JSON：當成沒有歷史，不擲錯
        }
    }

    function writeRaw(list) {
        try {
            global.localStorage.setItem(STORE_KEY, JSON.stringify(list));
            return true;
        } catch (e) {
            return false; // Safari 無痕：這一輪照常顯示，只是不留存
        }
    }

    /** 只保留形狀正確的樣本 —— 壞掉的一筆不該污染整條序列。 */
    function isValidSample(s) {
        return !!s
            && isProfile(s.profile)
            && isFiniteNumber(s.ts)
            && isFiniteNumber(s.composite);
    }

    /**
     * 把舊的單筆種子搬成一筆 `face_enroll_neutral_3s` 樣本。
     *
     * 冪等：已經有同 profile 同日的樣本就不重複搬。搬完不刪舊 key
     * （使用者可能在兩個分頁間切換舊版），但之後不再讀它以外的用途。
     *
     * @param {Array} list - 現有序列（會被就地修改）。
     * @returns {boolean} 是否真的搬了東西。
     */
    function migrateLegacySeed(list) {
        var raw;
        try {
            raw = global.localStorage.getItem(LEGACY_SEED_KEY);
        } catch (e) {
            return false;
        }
        if (!raw) return false;
        var seed;
        try {
            seed = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!seed || !isFiniteNumber(seed.composite)) return false;
        var ts = isFiniteNumber(seed.at) ? seed.at : Date.now();
        var key = dayKey(ts);
        for (var i = 0; i < list.length; i++) {
            if (list[i].profile === PROFILES.ENROLL_NEUTRAL && dayKey(list[i].ts) === key) {
                return false;
            }
        }
        list.push({
            ts: ts,
            profile: PROFILES.ENROLL_NEUTRAL,
            composite: seed.composite,
            quality: null,
            tier: null,
        });
        return true;
    }

    /**
     * 全部樣本（已遷移、已清洗、依時間排序）。
     *
     * @returns {Array<{ts:number, profile:string, composite:number,
     *   quality:?number, tier:?string}>}
     */
    function allSamples() {
        var list = readRaw().filter(isValidSample);
        if (migrateLegacySeed(list)) {
            list.sort(function (a, b) { return a.ts - b.ts; });
            writeRaw(list);
            return list;
        }
        list.sort(function (a, b) { return a.ts - b.ts; });
        return list;
    }

    /**
     * 某一個量測條件的樣本。
     *
     * 🔴 **這是分池的閘門。** 呼叫端拿不到別的 profile 的樣本 —— 想混池就得
     * 明確地自己 concat 兩次呼叫的結果，而那會在 code review 裡看得見。
     *
     * @param {string} profile - `PROFILES` 之一。
     * @returns {Array} 該 profile 的樣本，時間排序。
     */
    function samplesFor(profile) {
        if (!isProfile(profile)) return [];
        return allSamples().filter(function (s) { return s.profile === profile; });
    }

    /**
     * 寫入一筆樣本。
     *
     * 🔴 **同 profile 同一天只留一筆**（後寫的覆蓋先寫的）。連續掃描共用姿勢、
     * 光線與情緒狀態 —— 把它們當成獨立樣本會灌爆分母，讓標準差看起來比真實的
     * 日間變異大。這跟 `/preview/reliability.html` 要求每次之間放開 15 秒是
     * **同一個方法學理由**，不是節流。
     *
     * ⚠️ 覆蓋而不是忽略：當天最後一次掃描通常是條件最好的那次（使用者已經
     * 學會怎麼對位）。
     *
     * @param {{profile:string, composite:number, quality:(?number),
     *   tier:(?string), ts:(number|undefined)}} sample
     * @returns {boolean} 是否寫入成功（形狀錯誤或無痕模式會是 false）。
     */
    function appendSample(sample) {
        if (!sample || !isProfile(sample.profile) || !isFiniteNumber(sample.composite)) {
            return false;
        }
        var ts = isFiniteNumber(sample.ts) ? sample.ts : Date.now();
        var entry = {
            ts: ts,
            profile: sample.profile,
            composite: Math.round(sample.composite * 1e4) / 1e4,
            quality: isFiniteNumber(sample.quality) ? Math.round(sample.quality * 1e4) / 1e4 : null,
            tier: typeof sample.tier === 'string' ? sample.tier : null,
        };
        var list = allSamples();
        var key = dayKey(ts);
        var replaced = false;
        for (var i = 0; i < list.length; i++) {
            if (list[i].profile === entry.profile && dayKey(list[i].ts) === key) {
                list[i] = entry;
                replaced = true;
                break;
            }
        }
        if (!replaced) list.push(entry);
        list.sort(function (a, b) { return a.ts - b.ts; });
        if (list.length > MAX_SAMPLES) list = list.slice(list.length - MAX_SAMPLES);
        return writeRaw(list);
    }

    /**
     * 某一個量測條件的統計量。
     *
     * ⚠️ 標準差是**樣本標準差（n−1）**，與 `reliability.js` 的 `stdDev` 同一個
     * 定義。少於 2 筆時 `std` 是 `null`（未知），**不是 0** —— 一筆資料的離散度
     * 不是零。
     *
     * @param {string} profile - `PROFILES` 之一。
     * @returns {?{mean:number, std:?number, sampleCount:number, distinctDays:number}}
     *   一筆都沒有時 null。
     */
    function statsFor(profile) {
        var xs = samplesFor(profile);
        if (!xs.length) return null;
        var values = xs.map(function (s) { return s.composite; });
        var mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        var std = null;
        if (values.length >= 2) {
            var ss = values.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0);
            std = Math.sqrt(ss / (values.length - 1));
        }
        var days = {};
        for (var i = 0; i < xs.length; i++) days[dayKey(xs[i].ts)] = 1;
        return {
            mean: mean,
            std: std,
            sampleCount: values.length,
            distinctDays: Object.keys(days).length,
        };
    }

    /** 測試用：清空序列（不動 legacy key）。 */
    function clear() {
        try {
            global.localStorage.removeItem(STORE_KEY);
            return true;
        } catch (e) {
            return false;
        }
    }

    global.TENKI_BASELINE_STORE = {
        STORE_KEY: STORE_KEY,
        LEGACY_SEED_KEY: LEGACY_SEED_KEY,
        MAX_SAMPLES: MAX_SAMPLES,
        PROFILES: PROFILES,
        dayKey: dayKey,
        personSignalComposite: personSignalComposite,
        allSamples: allSamples,
        samplesFor: samplesFor,
        appendSample: appendSample,
        statsFor: statsFor,
        clear: clear,
    };
})(window);
