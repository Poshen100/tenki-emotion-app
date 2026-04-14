/**
 * TENKI CORE — Baseline Onboarding Integration Layer
 * ====================================================
 * Integrates the 6-step baseline onboarding into the main web prototype.
 * 
 * Flow:
 *   First visit (no baseline) → Show onboarding overlay → Complete → Main app
 *   Return visit (has baseline) → Skip onboarding → Main app
 * 
 * 5 UX Standards:
 *   1. 掃描前就讓使用者知道成功條件
 *   2. 掃描中只顯示 1 個主狀態
 *   3. 任何失敗都要可解釋
 *   4. 結果頁要講人話
 *   5. 成功後立即感受到之後評估更準
 * 
 * Storage: localStorage('tenki_baseline_established')
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'tenki_baseline_established';
    var BASELINE_DATA_KEY = 'tenki_baseline_data_v3';

    function needsOnboarding() {
        try { return !localStorage.getItem(STORAGE_KEY); } catch (e) { return true; }
    }

    function markBaselineComplete(baselineData) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), version: 3, established: true }));
            if (baselineData) localStorage.setItem(BASELINE_DATA_KEY, JSON.stringify(baselineData));
        } catch (e) { console.warn('[TENKI] Failed to persist baseline:', e); }
    }

    // ─── State ───
    var state = {
        currentStep: 0,
        sensorChoice: 'finger',
        readinessInterval: null,
        scanInterval: null,
        ppgAnimFrame: null,
        scanTimeRemaining: 30,
        scanDuration: 30,
        readinessSimStep: 0,
        baseline: { hr: { mean: 0, std: 0 }, hrv: { mean: 0, std: 0 }, rr: { mean: 0, std: 0 } },
    };

    var STEPS = ['onb-step-intro', 'onb-step-sensor', 'onb-step-readiness', 'onb-step-scan', 'onb-step-result', 'onb-step-next'];

    // ═══════════════════════════════════════
    //  HTML Template
    // ═══════════════════════════════════════
    function createOnboardingDOM() {
        var overlay = document.createElement('div');
        overlay.id = 'tenki-baseline-onboarding';
        overlay.className = 'onb-overlay';
        overlay.innerHTML = getOnboardingHTML();
        document.body.appendChild(overlay);
        void overlay.offsetHeight;
        overlay.classList.add('onb-visible');
        return overlay;
    }

    function getOnboardingHTML() {
        return '<div class="onb-container">' +
            /* Step dots */
            '<div class="onb-dots">' +
                '<div class="onb-dot onb-dot-active" data-step="0"></div>' +
                '<div class="onb-dot" data-step="1"></div>' +
                '<div class="onb-dot" data-step="2"></div>' +
                '<div class="onb-dot" data-step="3"></div>' +
                '<div class="onb-dot" data-step="4"></div>' +
                '<div class="onb-dot" data-step="5"></div>' +
            '</div>' +

            /* ─── Step 1: Intro ─── */
            '<div class="onb-step onb-step-visible" id="onb-step-intro">' +
                '<div class="onb-step-inner">' +
                    '<div class="onb-particle-bg" id="onb-particles"></div>' +
                    '<div class="onb-icon onb-icon-pulse">🧠</div>' +
                    '<h1 class="onb-title">TENKI 先學你，再評估你</h1>' +
                    '<p class="onb-body">接下來約 60 秒，TENKI 會學習你目前的心率、心率變異和呼吸節奏。<br>這不是測驗，只是建立屬於你的「正常狀態」參考。</p>' +
                    '<p class="onb-subtext">完成之後，每次掃描都會用你自己的基線來理解你</p>' +
                    '<button class="onb-btn-primary" id="onb-btn-start">開始建立基線</button>' +
                    '<button class="onb-btn-ghost" id="onb-btn-learn">為什麼需要基線？</button>' +
                    '<div class="onb-learn-more onb-hidden" id="onb-learn-more">' +
                        '<p>每個人的心率、呼吸節奏都不同。TENKI 需要先知道「你的正常」在哪裡，才能在後續掃描中告訴你「今天跟平常比起來如何」。</p>' +
                        '<p>這就像量身高體重一樣 — 是基本參考，不是分數。</p>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* ─── Step 2: Sensor Choice ─── */
            '<div class="onb-step" id="onb-step-sensor">' +
                '<div class="onb-step-inner">' +
                    '<h1 class="onb-title">選擇你的建立方式</h1>' +
                    '<p class="onb-body">兩種方式都會建立同樣的基線</p>' +
                    '<div class="onb-sensor-cards">' +
                        '<div class="onb-sensor-card onb-sensor-selected" id="onb-sensor-finger">' +
                            '<div class="onb-sensor-icon">👆</div>' +
                            '<div class="onb-sensor-info"><h3>手指快速建立</h3><p>將手指輕放在後鏡頭上</p><span class="onb-sensor-time">約 30 秒</span></div>' +
                            '<div class="onb-check">✓</div>' +
                        '</div>' +
                        '<div class="onb-sensor-card" id="onb-sensor-face">' +
                            '<div class="onb-sensor-icon">🙂</div>' +
                            '<div class="onb-sensor-info"><h3>臉部自然建立 <span class="onb-beta">Beta</span></h3><p>面對前鏡頭，自然呼吸</p><span class="onb-sensor-time">約 60 秒</span></div>' +
                            '<div class="onb-check">✓</div>' +
                        '</div>' +
                    '</div>' +
                    '<button class="onb-btn-primary" id="onb-btn-sensor-next">下一步</button>' +
                '</div>' +
            '</div>' +

            /* ─── Step 3: Readiness Check ─── */
            /* UX#1: 掃描前就讓使用者知道成功條件 */
            '<div class="onb-step" id="onb-step-readiness">' +
                '<div class="onb-step-inner">' +
                    '<h1 class="onb-title">準備檢查</h1>' +
                    '<p class="onb-body">在開始之前，確認環境和位置都準備好了</p>' +
                    '<div class="onb-instructions" id="onb-instructions">' +
                        '<div class="onb-inst"><span class="onb-inst-num">1</span><span>將食指或中指的指腹完整覆蓋後鏡頭</span></div>' +
                        '<div class="onb-inst"><span class="onb-inst-num">2</span><span>手指要輕放，不要用力按壓</span></div>' +
                        '<div class="onb-inst"><span class="onb-inst-num">3</span><span>保持手機穩定，盡量不要晃動</span></div>' +
                    '</div>' +
                    '<div class="onb-success-cond">✅ 手指到位 + 光線充足 + 保持穩定 = 可以開始</div>' +
                    '<div class="onb-meters">' +
                        '<div class="onb-meter"><span class="onb-meter-label">覆蓋率</span><div class="onb-meter-bar"><div class="onb-meter-fill" id="onb-m-coverage"></div></div><span class="onb-meter-status" id="onb-s-coverage">—</span></div>' +
                        '<div class="onb-meter"><span class="onb-meter-label">光線</span><div class="onb-meter-bar"><div class="onb-meter-fill" id="onb-m-brightness"></div></div><span class="onb-meter-status" id="onb-s-brightness">—</span></div>' +
                        '<div class="onb-meter"><span class="onb-meter-label">穩定度</span><div class="onb-meter-bar"><div class="onb-meter-fill" id="onb-m-stability"></div></div><span class="onb-meter-status" id="onb-s-stability">—</span></div>' +
                        '<div class="onb-meter"><span class="onb-meter-label">信號品質</span><div class="onb-meter-bar"><div class="onb-meter-fill" id="onb-m-sqi"></div></div><span class="onb-meter-status" id="onb-s-sqi">—</span></div>' +
                    '</div>' +
                    /* UX#3: 失敗可解釋 — 這裡的 msg 會顯示人話，如「光線不足」 */
                    '<div class="onb-readiness-msg" id="onb-readiness-msg">正在偵測...</div>' +
                    '<button class="onb-btn-primary" id="onb-btn-scan" disabled>等待就緒...</button>' +
                '</div>' +
            '</div>' +

            /* ─── Step 4: Calibration Scan ─── */
            /* UX#2: 掃描中只顯示 1 個主狀態 */
            '<div class="onb-step" id="onb-step-scan">' +
                '<div class="onb-step-inner onb-scan-inner">' +
                    '<h1 class="onb-title onb-scan-title" id="onb-scan-title">正在學習你的節奏</h1>' +
                    '<div class="onb-ring-container">' +
                        '<svg class="onb-ring-svg" viewBox="0 0 200 200">' +
                            '<circle class="onb-ring-bg" cx="100" cy="100" r="88"/>' +
                            '<circle class="onb-ring-progress" id="onb-ring-progress" cx="100" cy="100" r="88" stroke-dasharray="553" stroke-dashoffset="553"/>' +
                        '</svg>' +
                        '<div class="onb-ring-center">' +
                            '<div class="onb-timer" id="onb-timer">30</div>' +
                            '<div class="onb-timer-unit">秒</div>' +
                        '</div>' +
                    '</div>' +
                    /* Single status message — no technical numbers */
                    '<div class="onb-scan-status" id="onb-scan-status">準備中...</div>' +
                    /* PPG waveform gives liveness feedback without numbers */
                    '<div class="onb-ppg-container">' +
                        '<canvas id="onb-ppg-canvas" width="280" height="50"></canvas>' +
                    '</div>' +
                    '<p class="onb-scan-note">請保持不動，TENKI 正在聆聽你的心跳</p>' +
                '</div>' +
            '</div>' +

            /* ─── Step 5: Baseline Result ─── */
            /* UX#4: 結果頁講人話 */
            '<div class="onb-step" id="onb-step-result">' +
                '<div class="onb-step-inner">' +
                    '<div class="onb-result-icon" id="onb-result-icon">✓</div>' +
                    '<h1 class="onb-title">基線已建立</h1>' +
                    '<p class="onb-body">這是你的目前基線，不是好壞分數。<br>TENKI 已經學到你的心率、呼吸和壓力的「正常範圍」。</p>' +
                    '<p class="onb-subtext">從現在開始，每次掃描都是跟你自己比較</p>' +
                    '<div class="onb-metrics">' +
                        '<div class="onb-metric"><div class="onb-metric-label">你的心率範圍</div><div class="onb-metric-value" id="onb-val-hr">— BPM</div></div>' +
                        '<div class="onb-metric"><div class="onb-metric-label">你的心率變異</div><div class="onb-metric-value" id="onb-val-hrv">— ms</div></div>' +
                        '<div class="onb-metric"><div class="onb-metric-label">你的呼吸節奏</div><div class="onb-metric-value" id="onb-val-rr">— 次/分</div></div>' +
                    '</div>' +
                    '<div class="onb-confidence"><span class="onb-conf-dot"></span><span id="onb-confidence-text">數據品質：良好</span></div>' +
                    '<button class="onb-btn-primary" id="onb-btn-continue">繼續</button>' +
                '</div>' +
            '</div>' +

            /* ─── Step 6: Next Action ─── */
            /* UX#5: 成功後立即感受到之後每次評估更準 */
            '<div class="onb-step" id="onb-step-next">' +
                '<div class="onb-step-inner">' +
                    '<h1 class="onb-title">準備好了</h1>' +
                    '<p class="onb-body">每次掃描都會讓 TENKI 更懂你。<br>基線會隨著你的數據累積而越來越精準。</p>' +
                    '<div class="onb-encourage">你的第一個基線已經建立 — 現在可以開始你的第一次掃描了</div>' +
                    '<div class="onb-actions">' +
                        '<button class="onb-action onb-action-primary" id="onb-action-scan">' +
                            '<span class="onb-action-icon">🔍</span>' +
                            '<div><h3>開始第一次掃描</h3><p>用你剛建立的基線，看看現在的狀態</p></div>' +
                        '</button>' +
                        '<button class="onb-action" id="onb-action-trader">' +
                            '<span class="onb-action-icon">📈</span>' +
                            '<div><h3>Trader Mode 前檢查</h3><p>確認你的決策準備度</p></div>' +
                        '</button>' +
                        '<button class="onb-action" id="onb-action-explore">' +
                            '<span class="onb-action-icon">🧭</span>' +
                            '<div><h3>先逛逛</h3><p>探索 TENKI 的各項功能</p></div>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* Disclaimer */
            '<div class="onb-disclaimer">TENKI 提供的所有指標僅供個人健康參考，不構成醫療診斷或金融建議。你的生理數據只儲存在你的裝置上。</div>' +
        '</div>';
    }

    // ═══════════════════════════════════════
    //  Navigation
    // ═══════════════════════════════════════
    function goToStep(idx) {
        if (idx < 0 || idx >= STEPS.length) return;
        var cur = document.getElementById(STEPS[state.currentStep]);
        if (cur) { cur.classList.remove('onb-step-visible'); cur.classList.add('onb-step-exit'); setTimeout(function () { cur.classList.remove('onb-step-exit'); }, 500); }
        state.currentStep = idx;
        var next = document.getElementById(STEPS[idx]);
        if (next) setTimeout(function () { next.classList.add('onb-step-visible'); }, 50);
        updateDots(idx);
        onStepEnter(idx);
    }

    function updateDots(active) {
        var dots = document.querySelectorAll('.onb-dot');
        dots.forEach(function (d, i) {
            d.classList.remove('onb-dot-active', 'onb-dot-done');
            if (i === active) d.classList.add('onb-dot-active');
            else if (i < active) d.classList.add('onb-dot-done');
        });
    }

    function onStepEnter(idx) {
        if (idx === 0) initParticles();
        if (idx === 2) startReadinessCheck();
        if (idx === 3) startScan();
        if (idx === 4) showResult();
    }

    // ═══════════════════════════════════════
    //  Step 2: Sensor Selection
    // ═══════════════════════════════════════
    function selectSensor(type) {
        state.sensorChoice = type;
        state.scanDuration = type === 'finger' ? 30 : 60;
        state.scanTimeRemaining = state.scanDuration;
        var f = document.getElementById('onb-sensor-finger');
        var c = document.getElementById('onb-sensor-face');
        if (type === 'finger') { f.classList.add('onb-sensor-selected'); c.classList.remove('onb-sensor-selected'); }
        else { c.classList.add('onb-sensor-selected'); f.classList.remove('onb-sensor-selected'); }
    }

    // ═══════════════════════════════════════
    //  Step 3: Readiness Check
    //  UX#1: 掃描前就讓使用者知道成功條件
    //  UX#3: 任何失敗都可解釋（人話）
    // ═══════════════════════════════════════
    function startReadinessCheck() {
        state.readinessSimStep = 0;
        if (state.readinessInterval) clearInterval(state.readinessInterval);
        ['coverage', 'brightness', 'stability', 'sqi'].forEach(function (k) { updateMeter(k, 0, '—'); });
        var btn = document.getElementById('onb-btn-scan');
        if (btn) { btn.disabled = true; btn.textContent = '等待就緒...'; }
        state.readinessInterval = setInterval(function () { state.readinessSimStep++; simReadiness(state.readinessSimStep); }, 400);
    }

    function simReadiness(step) {
        var p = Math.min(step / 10, 1);
        var cov = easeOut(Math.min(p * 1.3, 1));
        var bri = 0.3 + easeOut(Math.min(p * 1.2, 1)) * 0.5;
        var stb = easeOut(Math.min(p * 1.0, 1)) * 0.9;
        var sqi = Math.min(100, Math.round(cov * 40 + bri * 20 + stb * 40));

        updateMeter('coverage', cov * 100, icon(cov, 0.85, 0.60));
        updateMeter('brightness', bri * 100, icon(bri, 0.50, 0.30));
        updateMeter('stability', stb * 100, icon(stb, 0.70, 0.50));
        updateMeter('sqi', sqi, icon(sqi / 100, 0.55, 0.40));

        var msg = document.getElementById('onb-readiness-msg');
        /* UX#3: Human-readable failure messages */
        if (cov < 0.60) { msg.textContent = '請將手指完整覆蓋鏡頭'; msg.style.color = '#FF3B30'; }
        else if (bri < 0.30) { msg.textContent = '光線不足，請移動到亮一點的地方'; msg.style.color = '#FF3B30'; }
        else if (stb < 0.50) { msg.textContent = '偵測到晃動，請保持靜止'; msg.style.color = '#F5A623'; }
        else if (cov >= 0.85 && stb >= 0.70 && bri >= 0.50 && sqi >= 55) {
            msg.textContent = '準備就緒，可以開始';
            msg.style.color = '#34C759';
            var btn = document.getElementById('onb-btn-scan');
            if (btn) { btn.disabled = false; btn.textContent = '開始掃描'; }
            clearInterval(state.readinessInterval);
        } else { msg.textContent = '幾乎到位了...'; msg.style.color = '#F5A623'; }
    }

    function updateMeter(id, pct, ic) {
        var fill = document.getElementById('onb-m-' + id);
        var st = document.getElementById('onb-s-' + id);
        if (fill) {
            fill.style.width = Math.min(100, pct) + '%';
            fill.className = 'onb-meter-fill';
            if (pct >= 75) fill.classList.add('onb-fill-green');
            else if (pct >= 45) fill.classList.add('onb-fill-yellow');
            else if (pct > 0) fill.classList.add('onb-fill-red');
        }
        if (st) st.textContent = ic;
    }

    function icon(v, g, y) { return v >= g ? '✅' : v >= y ? '⚠️' : '❌'; }
    function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

    // ═══════════════════════════════════════
    //  Step 4: Calibration Scan
    //  UX#2: 掃描中只顯示 1 個主狀態
    //  No technical numbers, just: status + timer + PPG waveform
    // ═══════════════════════════════════════
    function startScan() {
        state.scanTimeRemaining = state.scanDuration;
        var timer = document.getElementById('onb-timer');
        var status = document.getElementById('onb-scan-status');
        var ring = document.getElementById('onb-ring-progress');
        var circ = 2 * Math.PI * 88;
        if (timer) timer.textContent = state.scanDuration;

        startPPGWave();

        if (state.scanInterval) clearInterval(state.scanInterval);
        state.scanInterval = setInterval(function () {
            state.scanTimeRemaining--;
            if (timer) timer.textContent = Math.max(0, state.scanTimeRemaining);
            var prog = 1 - (state.scanTimeRemaining / state.scanDuration);
            if (ring) ring.style.strokeDashoffset = circ * (1 - prog);

            /* UX#2: Single human-readable status */
            var r = state.scanTimeRemaining / state.scanDuration;
            if (r > 0.85) { setStatus(status, '偵測中...', '#00B4D8'); }
            else if (r > 0.6) { setStatus(status, '讀取到心跳了', '#00B4D8'); }
            else if (r > 0.35) { setStatus(status, '很好，保持不動', '#34C759'); }
            else if (r > 0.15) { setStatus(status, '穩定中...', '#34C759'); }
            else if (r > 0) { setStatus(status, '快好了，再堅持一下', '#F5A623'); }

            simBaseline(prog);

            if (state.scanTimeRemaining <= 0) {
                clearInterval(state.scanInterval);
                stopPPGWave();
                setStatus(status, '掃描完成 ✓', '#34C759');
                setTimeout(function () { goToStep(4); }, 1200);
            }
        }, 1000);
    }

    function setStatus(el, text, color) {
        if (!el) return;
        el.textContent = text;
        el.style.color = color;
    }

    /* ── PPG Waveform Animation ──
       Shows a soft heartbeat-like wave that gives liveness feedback
       without showing any numbers. This is the "finger on camera" visual. */
    function startPPGWave() {
        var canvas = document.getElementById('onb-ppg-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var data = [];
        var t = 0;

        function drawFrame() {
            t += 0.08;
            /* Simulate PPG-like signal */
            var val = 0.5
                + 0.28 * Math.sin(t * 1.8)
                + 0.12 * Math.sin(t * 3.6 + 0.5)
                + 0.06 * Math.sin(t * 5.4 + 1.2)
                + (Math.random() - 0.5) * 0.04;
            data.push(val);
            if (data.length > w / 2) data.shift();

            ctx.clearRect(0, 0, w, h);

            /* Draw the waveform */
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,180,216,0.7)';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            for (var i = 0; i < data.length; i++) {
                var x = (i / data.length) * w;
                var y = h * (1 - data[i]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            /* Glow effect */
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,180,216,0.15)';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            for (var j = 0; j < data.length; j++) {
                var x2 = (j / data.length) * w;
                var y2 = h * (1 - data[j]);
                if (j === 0) ctx.moveTo(x2, y2);
                else ctx.lineTo(x2, y2);
            }
            ctx.stroke();

            state.ppgAnimFrame = requestAnimationFrame(drawFrame);
        }
        drawFrame();
    }

    function stopPPGWave() {
        if (state.ppgAnimFrame) { cancelAnimationFrame(state.ppgAnimFrame); state.ppgAnimFrame = null; }
    }

    function simBaseline(prog) {
        var hr = 68 + Math.random() * 8;
        var hrv = 40 + Math.random() * 15;
        var rr = 14 + Math.random() * 4;
        var a = 0.15;
        if (prog < 0.1) {
            state.baseline.hr = { mean: hr, std: 0 };
            state.baseline.hrv = { mean: hrv, std: 0 };
            state.baseline.rr = { mean: rr, std: 0 };
        } else {
            state.baseline.hr.mean = state.baseline.hr.mean * (1 - a) + hr * a;
            state.baseline.hr.std = Math.abs(hr - state.baseline.hr.mean) * 0.5;
            state.baseline.hrv.mean = state.baseline.hrv.mean * (1 - a) + hrv * a;
            state.baseline.rr.mean = state.baseline.rr.mean * (1 - a) + rr * a;
        }
    }

    // ═══════════════════════════════════════
    //  Step 5: Baseline Result
    //  UX#4: 結果頁講人話
    // ═══════════════════════════════════════
    function showResult() {
        var hr = state.baseline.hr, hrv = state.baseline.hrv, rr = state.baseline.rr;
        animateVal('onb-val-hr', 0, Math.round(hr.mean), 'BPM', 800);
        animateVal('onb-val-hrv', 0, Math.round(hrv.mean), 'ms', 800);
        animateVal('onb-val-rr', 0, Math.round(rr.mean), '次/分', 800);

        /* Sync with existing TENKI simulation baseline */
        if (global.TENKI_BASELINE_SIM && global.TENKI_BASELINE_SIM.stats) {
            global.TENKI_BASELINE_SIM.stats.hr.mean = Math.round(hr.mean);
            global.TENKI_BASELINE_SIM.stats.hrv.mean = Math.round(hrv.mean);
        }

        markBaselineComplete({
            hr: { mean: Math.round(hr.mean), std: Math.round(hr.std) },
            hrv: { mean: Math.round(hrv.mean) },
            rr: { mean: Math.round(rr.mean) },
            ts: Date.now()
        });
    }

    function animateVal(id, from, to, unit, dur) {
        var el = document.getElementById(id);
        if (!el) return;
        var start = performance.now();
        function tick(now) {
            var p = Math.min((now - start) / dur, 1);
            var e = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(from + (to - from) * e) + ' ' + unit;
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ═══════════════════════════════════════
    //  Dismiss & Enter Main App
    // ═══════════════════════════════════════
    function dismissOnboarding(triggerScan) {
        var overlay = document.getElementById('tenki-baseline-onboarding');
        if (overlay) {
            overlay.classList.remove('onb-visible');
            overlay.classList.add('onb-exit');
            setTimeout(function () {
                overlay.remove();
                if (triggerScan) {
                    var startBtn = document.getElementById('start-btn');
                    if (startBtn) startBtn.click();
                }
            }, 600);
        }
    }

    // ═══════════════════════════════════════
    //  Particles
    // ═══════════════════════════════════════
    function initParticles() {
        var c = document.getElementById('onb-particles');
        if (!c || c.querySelector('canvas')) return;
        var canvas = document.createElement('canvas');
        canvas.width = 390; canvas.height = 844;
        canvas.style.width = '100%'; canvas.style.height = '100%';
        c.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        var ps = [];
        for (var i = 0; i < 35; i++) {
            ps.push({ x: Math.random() * 390, y: Math.random() * 844, r: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
                a: Math.random() * 0.4 + 0.1, ph: Math.random() * Math.PI * 2 });
        }
        function draw() {
            ctx.clearRect(0, 0, 390, 844);
            ps.forEach(function (p) {
                p.x += p.vx; p.y += p.vy; p.ph += 0.02;
                if (p.x < 0) p.x = 390; if (p.x > 390) p.x = 0;
                if (p.y < 0) p.y = 844; if (p.y > 844) p.y = 0;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,180,216,' + (p.a * (0.7 + 0.3 * Math.sin(p.ph))) + ')';
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        draw();
    }

    // ═══════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════
    function bindEvents() {
        on('onb-btn-start', function () { goToStep(1); });
        on('onb-btn-learn', function () { var el = document.getElementById('onb-learn-more'); if (el) el.classList.toggle('onb-hidden'); });
        on('onb-sensor-finger', function () { selectSensor('finger'); });
        on('onb-sensor-face', function () { selectSensor('face'); });
        on('onb-btn-sensor-next', function () { goToStep(2); });
        on('onb-btn-scan', function () { goToStep(3); });
        on('onb-btn-continue', function () { goToStep(5); });
        on('onb-action-scan', function () { dismissOnboarding(true); });
        on('onb-action-trader', function () { dismissOnboarding(true); });
        on('onb-action-explore', function () { dismissOnboarding(false); });
    }

    function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }

    // ═══════════════════════════════════════
    //  Init
    // ═══════════════════════════════════════
    function init() {
        if (!needsOnboarding()) return;
        createOnboardingDOM();
        bindEvents();
        initParticles();
    }

    global.TENKI_BASELINE_ONBOARDING = {
        init: init,
        reset: function () { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(BASELINE_DATA_KEY); } catch (e) {} location.reload(); },
        needsOnboarding: needsOnboarding,
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

})(typeof window !== 'undefined' ? window : this);
