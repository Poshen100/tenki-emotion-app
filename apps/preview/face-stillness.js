/**
 * face-stillness.js — landmark 位移穩定度的**唯一來源**。
 *
 * 🔴 為什麼要獨立成一支：`readiness-scan.js`（日常掃描）與 `soul-enroll.js`
 * （臉部基線建立）都要算「這個人有多靜」，而它們原本算的**不是同一個量**：
 *
 * | | 中心怎麼取 | 位移速度 |
 * |---|---|---|
 * | readiness-scan | bbox 中心 `(min+max)/2` | `1 − speed/0.35` |
 * | soul-enroll | 質心（所有點平均） | 完全沒有，只有整幀 luma 差分 |
 *
 * `readiness-scan.js` 自己的註解早就警告過這件事（「不能借用 `MOTION_STILL_MAX`
 * —— 那是 soul-enroll 給整幀 luma 差分調的尺度，跟 landmark 位移不是同一種量」）。
 *
 * ⚠️ **而 Edge Score 是 z 分數：分母是使用者自己的標準差。** 如果基線是用一種尺度
 * 建的、今天的讀數是用另一種尺度量的，分數會看起來很正常而**默默是錯的** ——
 * 那比明顯壞掉危險得多。所以兩邊必須吃同一支。
 *
 * 純函式 + 一個顯式的 tracker，無 DOM、無 I/O。
 */
(function (global) {
    'use strict';

    /**
     * 位移速度達此值 ＝ 判定「完全沒有在靜止」→ stillness 讀 0。
     * 沿用 takeover 已經調過的 HOLD STILL 門檻，單位是 normalized 座標／秒。
     */
    var LANDMARK_MOTION_CEILING = 0.35;

    function clamp01(v) {
        return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    /**
     * 臉部包圍盒。
     *
     * ⚠️ 用 **bbox 而不是質心**：質心會被密集區（例如嘴唇與眼周的點特別多）拉偏，
     * 而且轉頭時遠側被壓縮的效應在兩者上不一樣。要兩邊可比就得挑定一種。
     *
     * @param {Array<{x:number,y:number}>} lm - MediaPipe 特徵點。
     * @returns {?{minX:number,minY:number,maxX:number,maxY:number}} 沒有點時回 null。
     */
    function faceBox(lm) {
        if (!lm || !lm.length) return null;
        var minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (var i = 0; i < lm.length; i++) {
            var p = lm[i];
            if (!p) continue;
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    /**
     * 包圍盒中心與大小。
     *
     * @param {{minX:number,minY:number,maxX:number,maxY:number}} box
     * @returns {{x:number,y:number,size:number}}
     */
    function boxCenter(box) {
        return {
            x: (box.minX + box.maxX) / 2,
            y: (box.minY + box.maxY) / 2,
            size: Math.max(box.maxX - box.minX, box.maxY - box.minY),
        };
    }

    /**
     * 由前後兩個中心與時間差算 stillness。
     *
     * @param {{x:number,y:number}} prev - 前一次的中心。
     * @param {{x:number,y:number}} cur - 這一次的中心。
     * @param {number} dtMs - 兩次之間的毫秒數（會夾到 ≥1，避免除以 0）。
     * @returns {number} 0..1，1 = 完全靜止。
     */
    function stillnessBetween(prev, cur, dtMs) {
        var dt = Math.max(1, dtMs);
        var dx = cur.x - prev.x;
        var dy = cur.y - prev.y;
        var speed = Math.sqrt(dx * dx + dy * dy) / (dt / 1000);
        return 1 - clamp01(speed / LANDMARK_MOTION_CEILING);
    }

    /**
     * 有狀態的追蹤器 —— 餵特徵點，回這一幀的 stillness。
     *
     * 🔴 **第一幀回 `null` 而不是 1**：沒有前一幀就算不出位移，那是「未知」不是
     * 「完全靜止」。回 1 會讓每次掃描的第一幀都灌一個滿分進平均。
     *
     * @returns {{feed:function, reset:function, mean:function, count:function}}
     */
    function createTracker() {
        var last = null;
        var lastAt = 0;
        var sum = 0;
        var n = 0;
        return {
            /**
             * @param {Array} lm - 特徵點。
             * @param {number} nowMs - 這一幀的時間戳。
             * @returns {?number} 這一幀的 stillness；第一幀或無臉時 null。
             */
            feed: function (lm, nowMs) {
                var box = faceBox(lm);
                if (!box) return null;
                var c = boxCenter(box);
                var value = null;
                // ⚠️ 條件是 `last !== null`，**不是 `last && lastAt`**。
                // 舊寫法用 `lastAt` 當有沒有前一幀的旗標，而 `lastAt === 0` 是
                // falsy —— 時間戳剛好是 0 的那一幀會被當成「沒有前一幀」，
                // 它之後那一筆量測整個被丟掉。正式站餵的是真時鐘所以踩不到，
                // 但測試餵 0 起算時當場少一筆（2026-08-12 寫連續性測試時抓到）。
                // 「只在特定輸入下才錯」的判斷式遲早會咬人。
                if (last !== null) {
                    value = stillnessBetween(last, c, nowMs - lastAt);
                    sum += value;
                    n += 1;
                }
                last = { x: c.x, y: c.y };
                lastAt = nowMs;
                return value;
            },
            reset: function () { last = null; lastAt = 0; sum = 0; n = 0; },
            /**
             * 忘掉「上一幀在哪」，但**保留已累積的平均**。
             *
             * 🔴 給「同一次量測分成好幾段、中間有空窗」用的。沒有這個的話，
             * 續接後的第一幀會拿現在的位置去跟空窗前的位置相減 —— 那段時間
             * 根本沒在看，算出來的位移是**憑空的**。
             *
             * ⚠️ 而且它不會長得像壞掉：`stillnessBetween` 會用很大的 dt 去除，
             * 速度算出來很小 → stillness 逼近 1 → **默默灌了一個假滿分進平均**。
             * 那正是最難發現的一種錯。
             */
            breakContinuity: function () { last = null; lastAt = 0; },
            /** @returns {?number} 至今的平均 stillness；一筆都沒有時 null，不是 0。 */
            mean: function () { return n > 0 ? sum / n : null; },
            /** @returns {number} 已累積的幀數。 */
            count: function () { return n; },
        };
    }

    global.TENKI_FACE_STILLNESS = {
        LANDMARK_MOTION_CEILING: LANDMARK_MOTION_CEILING,
        faceBox: faceBox,
        boxCenter: boxCenter,
        stillnessBetween: stillnessBetween,
        createTracker: createTracker,
    };
})(window);
