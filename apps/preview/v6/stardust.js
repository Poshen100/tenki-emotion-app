/**
 * stardust.js — Three.js 8000-particle stardust soul animation (v6 preview fork)
 *
 * Forked from apps/web/stardust.js (which is FROZEN per CLAUDE.md) so the v6
 * preview can harden the scan ceremony without touching the web prototype.
 * Core visual identity (colors, 8000 count, Fibonacci distribution, drift,
 * rolling, breathing, expression API) is preserved byte-for-byte in feel.
 *
 * v6 additions (no visual-identity change):
 *   - Freeze resilience: WebGL context-loss/restore handling (the big one —
 *     without preventDefault a lost context never restores → permanent freeze),
 *     pause/resume on tab visibility, render wrapped so a transient error can't
 *     kill the rAF loop.
 *   - Frame-rate-independent drift throttle (was "assume 60fps").
 *   - playEntrance(): smooth big→small scale-in for the scan entrance.
 *
 * Requires: THREE.js (r128+)
 */
(function (global) {
    'use strict';

    if (typeof THREE === 'undefined') {
        console.warn('[TENKI stardust] THREE.js not loaded, skipping');
        return;
    }

    var PARTICLE_COUNT = 8000;
    var PARTICLE_SIZE = 0.088;
    var scene, camera, renderer, cloud, material;
    /** When true, canvas/camera track the container box rather than the viewport. */
    var fitContainer = false;

    /** @returns {{w:number,h:number}} the drawing size for the current mount. */
    function viewSize() {
        if (fitContainer && container && container.clientWidth > 0 && container.clientHeight > 0) {
            return { w: container.clientWidth, h: container.clientHeight };
        }
        return { w: window.innerWidth, h: window.innerHeight };
    }
    var container = null;
    var mounted = false;      // one binding at a time (see mount())
    var animFrame = null;
    var running = false;
    var contextLost = false;
    var lostTimer = null;     // watchdog: rebuild if a lost context never restores
    var lastDriftT = -1;      // time-based drift throttle (seconds)
    var entranceStart = -1;   // big→small scale-in start time (seconds); <0 = idle
    var clock = new THREE.Clock();

    // v25.8.2 feel-preserving micro-tune knobs (P1)
    var ROLL_CFG = {
        x: 0.013,         // forward tumble axis
        y: 0.0065,        // depth spin
        z: 0.0015,        // side wobble
        pulseFreq: 0.20,  // speed breathing
        pulseAmp: 0.00058
    };

    // Entrance scale-in: ball starts a touch larger and eases down to rest.
    var ENTRANCE = { from: 1.5, dur: 1.2 }; // 1.5× → 1.0× over 1.2s (easeOutCubic)

    // Per-particle drift data (organic movement)
    var basePositions = null;   // Original Fibonacci positions
    var driftSeeds = null;      // Random seeds per particle (Float32Array × 4: freqX, freqY, freqZ, amplitude)
    var baseColors = null;      // Original color values for shimmer
    var hueBand = null;         // 每顆粒子的色帶索引（bloom 用），建構時算一次

    // Expression sync state
    var expr = { mouthOpen: 0, eyeOpen: 1, blinkFlash: 0, browTension: 0.5, active: false };

    // ── Tone layer (2026-08-10) ───────────────────────────────────────────
    // founder asked for "更多層次色彩變化, 每次掃描都感應使用者變色", and picked
    // "keep the identity, layer the variation on top" over replacing the palette.
    //
    // 🔴 The v25.8.2 look is a locked asset (CLAUDE.md). The lock is honoured by a
    // structural property, not by good intentions: **at default values this layer
    // is an identity transform**, so every page that never calls setTone() —
    // story.html, soul-enroll.html, the v6 takeover — renders byte-for-byte what
    // it renders today. `toneIdle` short-circuits the work entirely.
    //
    // What varies is a *rotation of the whole cyan→purple→pink gradient*, never a
    // swap of the palette: the relationships between the three stops survive, so
    // the ball still reads as the same ball.
    var tone = { hue: 0, sat: 1, mix: 0, r: 0, g: 0, b: 0 };       // smoothed, applied
    var toneTarget = { hue: 0, sat: 1, mix: 0, r: 0, g: 0, b: 0 }; // requested
    /** EWMA factor per recolour tick (~20fps). Slow enough that colour never snaps. */
    var TONE_SMOOTH = 0.12;
    /** Below this the smoothed tone counts as "off" and the fast path is taken. */
    var TONE_EPS = 0.002;
    /** Hue-rotation matrix, recomputed once per tick (not per particle). */
    var toneMat = null;

    // ── Readout layer (2026-08-10, second pass) ───────────────────────────
    // founder 實走：「顏色好像沒變化？」＋「不要只是還不錯，我要的是棒透了」。
    //
    // 第一版的色調吃 `browTension` / `mouthOpen` —— 算過之後那兩個在掃描情境下
    // **幾乎是常數**（用力皺眉只讓色相動 0.69°；嘴閉著 mouthOpen 恆為 ~0.1）。
    // 訊號正規化成 0..1 不代表它會**走遍** 0..1，我當初沒查真實分布。
    //
    // 這一層改吃 `stillness` —— 每幀、真 0..1，而且**正是我們要求使用者控制的那個量**
    // （畫面上寫著「保持穩定」，主角卻對它毫無反應，那就是「還不錯」與「棒透了」的差距）。
    // 外加 `progress`（累積的有效量測，不是計時器）。
    //
    // 🔴 一樣用結構守住鎖定資產：**沒呼叫 setReadout 就完全 inert**，
    // story / soul-enroll / v6 takeover 逐位元組不變。
    var readout = { active: false, still: 0.5, prog: 0, sStill: 0.5, sProg: 0 };
    /** EWMA per animation frame. 比 tone 稍快 —— 這是回饋迴圈，慢了就感覺不到因果。 */
    var READOUT_SMOOTH = 0.08;
    /**
     * 🔴 **粒子漂移不再當作回饋通道。**
     *
     * 量過才知道：漂移振幅是 0.02–0.07，而球半徑是 2.5 ——
     * ×1.35 vs ×0.55 的位移差只有**半徑的 1.44%，在手機上約 2.2px**。
     * founder 三次回報「看不出變化」，這是主因之一。
     * **倍率聽起來很大不代表看得見。** 收散改由整體尺度承擔（見下），
     * 那個才有絕對幅度。這裡保留一點點，只當作質感而不是訊號。
     */
    var READOUT_DRIFT_HI = 1.15;
    var READOUT_DRIFT_LO = 0.85;
    /**
     * 🔴 **bloom：每顆粒子各自的色相散幅 —— 這是「更多層次色彩變化」的主通道。**
     *
     * ⚠️ 上一版是反過來的（`focus`：越穩越收成單一 cyanActive）。
     * 算出來在 founder 實測的穩定度下，球的彩度跨度只剩 **36（77%）/ 4（93%）**，
     * 而正常握穩就是 85–95% —— **整場掃描幾乎都是單一青色**。
     * 他從第一天要的是「更多層次色彩變化」，我卻把顏色抽乾了。**優化錯了東西。**
     *
     * 現在是散開：穩住 → 靈魂**展開**得更豐富。
     * **顏色永遠不會變少** —— bloom=0 時仍是完整的基礎漸層。
     *
     * 上限由主色守則決定，不是手感挑的：
     * **色相散太開，整顆的平均色會趨近灰，而灰就是 `--zone-neutral`（Neutral 帶位）。**
     * ⚠️ 0.28 之所以過得了關，靠的是另外兩件事一起做（founder 2026-08-11「再多一點」）：
     *   ① 飽和度**下限**提到 1.20 —— 瓶頸一直在低飽和端，提高下限才買得到 bloom 空間
     *      （satLo 0.95 時 bloom 0.28 只有 ΔE 21.3 ❌；satLo 1.20 → 26.1 ✅）
     *   ② 色帶混入方位角（螺旋）—— 底色與色帶不再一一對應，平均色更不容易趨灰，
     *      主色 ΔE 反而從 26.1 升到 **32.7**
     * 現行彩度跨度 89–205。
     */
    var READOUT_BLOOM_MAX = 0.28;
    /**
     * hueRot：整場掃描的色相旅程，由 progress 驅動 —— 10 秒之間球走過一段色相。
     * 🔴 **0.20 是硬上限**，而且是這一組參數裡唯一沒有餘裕的：
     * 0.24 → 主色撞 coral ΔE 15.3 ❌、0.28 → 7.0 ❌。提高飽和度也買不動它
     * （它動的是平均色的**色相**，不是彩度）。
     */
    var READOUT_HUEROT_MAX = 0.20;
    /** 色帶數：bloom 的量化粒度。每 tick 只建這麼多個矩陣。 */
    var HUE_BANDS = 16;
    /**
     * 飽和度範圍。
     *
     * 🔴 **下限 1.20 是買 bloom 空間用的，不是為了好看。** 主色趨灰的瓶頸一直在
     * **低飽和端** —— 平均色的彩度不夠就會逼近 `--zone-neutral #64748B`
     * （那個色代表「Neutral 帶位」）。satLo 0.95 時 bloom 只能到 0.20；
     * 提到 1.20 之後 bloom 0.28 才過得了關。
     *
     * ⚠️ **上限 1.55 對守則零成本**：守則卡的是低飽和端，提高上限不影響它，
     * 卻直接買到更多彩度跨度。所以上下限是兩個不同用途的旋鈕。
     *
     * ⚠️ 飽和度本身不是可讀的通道（additive 混色會壓掉同色系差異），
     * 它在這裡的作用是**讓 bloom 有空間**，不是自己當視覺訊號。
     */
    var READOUT_SAT_LO = 1.20;
    var READOUT_SAT_HI = 1.55;
    /**
     * stillness 帶來的整體尺度：晃動時脹大、穩住時收成一顆核。
     * 0.86–1.18 ≈ 32%，在 300px 的球上約 48px —— 跟先前 6%（9px）差一個量級。
     */
    var READOUT_SCALE_LO = 0.86;
    var READOUT_SCALE_HI = 1.18;
    /**
     * 總尺度上限。`exprScale`（眼開合 × 嘴開合，0.8–1.56）會跟這裡相乘，
     * 不夾住的話晃動端可能脹出掃描框。夾在今天實際會到的上限，
     * **保證這一刀不會讓球比現在更大**。
     */
    var READOUT_SCALE_CAP = 1.56;
    /** 進度帶來的亮度提升 —— 累積的有效量測越多，球越實。 */
    var READOUT_PROG_LIFT = 0.10;
    /** stillness 帶來的亮度範圍（原本只有 ±0.06，看不出來）。 */
    var READOUT_OPACITY_SWING = 0.18;

    /**
     * Bind the stardust to a container element and start rendering.
     *
     * Single-binding by design: a second live WebGL context alongside
     * getUserMedia + MediaPipe is the iOS WebKit OOM zone (the reason
     * soul-enroll.html releases this context before its own scan). Callers
     * therefore have to cope with a refused mount — `/preview/readiness-scan.js`
     * checks the return value and simply skips its stardust layer when a host
     * page (v6) already owns the binding.
     *
     * @param {HTMLElement} [el] - Container to render into. Defaults to
     *   `#universe`, which keeps the historical auto-init behaviour for
     *   `/preview/v6/`, `/preview/story.html` and `/preview/soul-enroll.html`.
     * @param {{fitContainer?: boolean}} [opts] - `fitContainer:true` sizes the
     *   canvas and camera from the container box instead of the viewport, so the
     *   sphere can live *inside* a small frame (North Star SS4: the soul belongs
     *   in the aperture). **Opt-in on purpose**: the three historical `#universe`
     *   hosts keep the viewport path byte-for-byte, because the stardust feel is
     *   a locked asset (CLAUDE.md) and must not shift as a side effect.
     * @returns {boolean} true when this call took ownership of the binding.
     */
    function mount(el, opts) {
        if (mounted) return false;
        var node = el || document.getElementById('universe');
        if (!node) return false;

        container = node;
        fitContainer = !!(opts && opts.fitContainer);
        mounted = true;

        // Fade-in to prevent black flash
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.6s ease';

        createRenderer();
        buildScene();
        start();

        // Fade in after first render
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (container) container.style.opacity = '1';
            });
        });

        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);
        return true;
    }

    /** @returns {boolean} whether the stardust currently owns a container. */
    function isMounted() {
        return mounted;
    }

    function createRenderer() {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        var vs0 = viewSize();
        renderer.setSize(vs0.w, vs0.h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // ── Freeze fix: a lost GL context must be preventDefault()-ed or the
        // browser will never restore it, leaving the ball frozen forever. ──
        var cv = renderer.domElement;
        cv.addEventListener('webglcontextlost', onContextLost, false);
        cv.addEventListener('webglcontextrestored', onContextRestored, false);
    }

    function buildScene() {
        scene = new THREE.Scene();
        var vs1 = viewSize();
        camera = new THREE.PerspectiveCamera(75, vs1.w / vs1.h, 0.1, 1000);
        camera.position.z = 5;

        // Fibonacci sphere distribution
        var geometry = new THREE.BufferGeometry();
        var positions = new Float32Array(PARTICLE_COUNT * 3);
        var colors = new Float32Array(PARTICLE_COUNT * 3);
        var phi = Math.PI * (3 - Math.sqrt(5));
        var topColor = new THREE.Color(0xFF66CC);   // Pink
        var midColor = new THREE.Color(0x9966FF);   // Purple
        var botColor = new THREE.Color(0x00CCFF);   // Cyan

        // Per-particle drift seeds: each particle gets unique freq and amplitude
        basePositions = new Float32Array(PARTICLE_COUNT * 3);
        driftSeeds = new Float32Array(PARTICLE_COUNT * 4);
        hueBand = new Uint8Array(PARTICLE_COUNT);
        baseColors = new Float32Array(PARTICLE_COUNT * 3);

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
            var radius = Math.sqrt(1 - y * y);
            var theta = phi * i;
            var r = 2.5;
            var idx = i * 3;

            positions[idx]     = Math.cos(theta) * radius * r;
            positions[idx + 1] = y * r;
            positions[idx + 2] = Math.sin(theta) * radius * r;

            // Store base positions for drift calculation
            basePositions[idx]     = positions[idx];
            basePositions[idx + 1] = positions[idx + 1];
            basePositions[idx + 2] = positions[idx + 2];

            // Generate unique drift seeds per particle
            var si = i * 4;
            driftSeeds[si]     = 0.3 + Math.random() * 0.7;   // freqX: 0.3-1.0
            driftSeeds[si + 1] = 0.2 + Math.random() * 0.8;   // freqY: 0.2-1.0
            driftSeeds[si + 2] = 0.4 + Math.random() * 0.6;   // freqZ: 0.4-1.0
            driftSeeds[si + 3] = 0.02 + Math.random() * 0.05; // amplitude: 0.02-0.07 (tighter sphere)

            // Color gradient: bot cyan → mid purple → top pink
            var normalizedY = (y + 1) / 2;
            var mixed = new THREE.Color();
            if (normalizedY > 0.5) {
                mixed.copy(midColor).lerp(topColor, (normalizedY - 0.5) * 2);
            } else {
                mixed.copy(botColor).lerp(midColor, normalizedY * 2);
            }
            colors[idx] = mixed.r;
            colors[idx + 1] = mixed.g;
            colors[idx + 2] = mixed.b;

            // Store base colors for shimmer
            baseColors[idx] = mixed.r;
            baseColors[idx + 1] = mixed.g;
            baseColors[idx + 2] = mixed.b;

            // 色帶索引：bloom 要讓**每顆粒子有自己的色相偏移**，但不能每顆算一次
            // 三角函數。量化成 HUE_BANDS 個色帶（建構時算一次），每個 tick 只建
            // HUE_BANDS 個矩陣，每顆粒子照它的色帶取用 ——
            // per-particle 成本仍是 9 次乘法，跟今天一樣（MOTION-DIRECTION §2）。
            //
            // 🔴 **色帶同時吃高度與方位角（螺旋），不只吃高度。**
            // 只吃高度時顏色只在上下方向變，是一條單純的漸層；混入方位角之後
            // 顏色也繞著球轉，同一高度的粒子會落在不同色帶 —— 那才是「層次」。
            // ⚠️ 這也讓底色與色帶**不再一一對應**，所以守門員必須改掃
            // base × band 的所有組合（見 preview-scan-stardust.mjs）。
            // 意外的好處：混合之後整顆的平均色更不容易趨灰，主色 ΔE 反而變好。
            var azimuth = (Math.atan2(positions[idx + 2], positions[idx]) / (Math.PI * 2)) + 0.5;
            var bandT = (normalizedY * 0.62 + azimuth * 0.38) % 1;
            hueBand[i] = Math.min(HUE_BANDS - 1, Math.floor(bandT * HUE_BANDS));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Soft radial gradient sprite texture
        var spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = 32;
        spriteCanvas.height = 32;
        var ctx = spriteCanvas.getContext('2d');
        var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.24, 'rgba(255,255,255,0.90)');
        grad.addColorStop(0.56, 'rgba(255,255,255,0.40)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);

        var tex = new THREE.Texture(spriteCanvas);
        tex.needsUpdate = true;

        material = new THREE.PointsMaterial({
            size: PARTICLE_SIZE,
            map: tex,
            transparent: true,
            opacity: 0.92,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        cloud = new THREE.Points(geometry, material);
        scene.add(cloud);
    }

    function start() {
        if (running) return;
        running = true;
        lastDriftT = -1;
        animFrame = requestAnimationFrame(animate);
    }

    function stop() {
        running = false;
        if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    }

    function onContextLost(e) {
        // Critical: preventDefault lets the browser restore the context later.
        e.preventDefault();
        contextLost = true;
        stop();
        // Watchdog: some mobile browsers never fire 'restored' after an OOM loss,
        // which would leave the ball frozen forever — rebuild ourselves if so.
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = setTimeout(function () { if (contextLost) rebuild(); }, 2500);
        console.warn('[TENKI stardust] WebGL context lost — awaiting restore/rebuild');
    }

    function onContextRestored() {
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        // Full rebuild (fresh renderer + scene) — guarantees recovery regardless of
        // whether the GL driver kept our resources. Same scene, so visually identical.
        rebuild();
        console.warn('[TENKI stardust] WebGL context restored — rebuilt');
    }

    // Tear down the dead renderer/canvas and recreate everything from retained CPU
    // data, then resume. Visual identity is unchanged (same geometry/colours/material).
    function rebuild() {
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        // Unmounted while a retry was in flight: stay down. Without this the
        // catch below would re-arm the 2500ms timer forever against a null
        // container, quietly burning a timer for the life of the page.
        if (!mounted || !container) return;
        try {
            if (renderer) {
                var old = renderer.domElement;
                try { renderer.dispose(); } catch (_) {}
                if (old) {
                    old.removeEventListener('webglcontextlost', onContextLost, false);
                    old.removeEventListener('webglcontextrestored', onContextRestored, false);
                    if (old.parentNode) old.parentNode.removeChild(old);
                }
            }
        } catch (_) {}
        renderer = null;
        running = false;
        try {
            contextLost = false;
            createRenderer();
            buildScene();
            start();
            playEntrance();
            console.warn('[TENKI stardust] rebuilt after context loss');
        } catch (e) {
            // GPU still unavailable — back off and retry.
            contextLost = true;
            if (lostTimer) clearTimeout(lostTimer);
            lostTimer = setTimeout(rebuild, 2500);
            console.warn('[TENKI stardust] rebuild failed, retrying:', e && e.message);
        }
    }

    function onVisibility() {
        if (document.hidden) stop();
        else if (!contextLost) start();
    }

    function animate() {
        if (!running) return;
        animFrame = requestAnimationFrame(animate);

        var t = clock.getElapsedTime();

        // Auto-decay blink flash
        expr.blinkFlash *= 0.82;

        stepReadout();

        if (cloud) {
            // ── Per-particle organic drift ──
            var posAttr = cloud.geometry.getAttribute('position');
            var colAttr = cloud.geometry.getAttribute('color');
            var pos = posAttr.array;
            var col = colAttr.array;

            // Drift intensity scales with expression (more emotional → more particle chaos)
            var driftMult = 0.95;
            if (expr.active) {
                driftMult += expr.mouthOpen * 0.48 + expr.browTension * 0.28;
            }
            // Readout: 你越穩，粒子越安定。這是「保持穩定」那句指令的回饋迴圈 ——
            // 使用者做對了，主角要看得出來。(founder 2026-08-10 放寬了漂移的鎖)
            if (readout.active) {
                driftMult *= READOUT_DRIFT_HI + (READOUT_DRIFT_LO - READOUT_DRIFT_HI) * readout.sStill;
            }

            // Throttle drift to ~20fps by ELAPSED TIME (was: assume 60fps), so the
            // cadence — and the feel — stays the same whether render is 60 or 30fps.
            if (lastDriftT < 0 || t - lastDriftT >= 0.05) {
                lastDriftT = t;

                // Tone: ease toward the requested values, then build the 3×3 once
                // for the whole cloud. Per particle this costs 9 multiplies —
                // the same order as the shimmer that is already here, and it
                // touches only the colour buffer (MOTION-DIRECTION §2: no layout).
                stepTone();
                var toned = !toneIdle();
                var m = toned ? toneMat : null;

                // ── Readout 的顏色：bloom（散開）+ hueRot（旅程）──
                //
                //   bloom  —— 你越穩，每顆粒子的色相散得越開，靈魂**展開**得更豐富
                //   hueRot —— 累積的有效量測越多，整場色相走過一段旅程
                //
                // ⚠️ 上一版是反過來的（收成單一青色），結果在正常握穩的 85–95%
                //    穩定度下整場都是單色 —— founder 要的是「更多層次色彩變化」。
                //    **現在顏色永遠不會變少**：bloom=0 時仍是完整的基礎漸層。
                //
                // 每顆粒子要有自己的色相偏移，但不能每顆算三角函數：
                // 量化成 HUE_BANDS 個色帶，每 tick 建 HUE_BANDS 個矩陣，
                // 每顆粒子照 `hueBand[i]` 取用 —— per-particle 仍是 9 次乘法。
                var bloomed = readout.active
                    && (readout.sStill > 0.001 || readout.sProg > 0.001);
                if (bloomed) buildBandMats();
                var mixAmt = tone.mix;
                var tr = tone.r, tg = tone.g, tb = tone.b;

                for (var i = 0; i < PARTICLE_COUNT; i++) {
                    var idx = i * 3;
                    var si = i * 4;

                    var fx = driftSeeds[si];
                    var fy = driftSeeds[si + 1];
                    var fz = driftSeeds[si + 2];
                    var amp = driftSeeds[si + 3] * driftMult;

                    // Each particle floats with its own unique sine pattern
                    pos[idx]     = basePositions[idx]     + Math.sin(t * fx + i * 0.01) * amp;
                    pos[idx + 1] = basePositions[idx + 1] + Math.cos(t * fy + i * 0.013) * amp;
                    pos[idx + 2] = basePositions[idx + 2] + Math.sin(t * fz + i * 0.017) * amp * 0.8;

                    var br = baseColors[idx];
                    var bg = baseColors[idx + 1];
                    var bb = baseColors[idx + 2];

                    // 🔴 **矩陣只能套一次。** bandMats 已經含了色相旋轉與飽和度，
                    // 若這裡再套一次 toneMat 就是雙重飽和 + 雙重色相。
                    // 所以兩者是**互斥**的：bloom 活著就由它擁有這一步，
                    // 否則才走全域的 toneMat（收束時 readout 已被 clear，走這條）。
                    if (bloomed) {
                        var bo = hueBand[i] * 9;
                        var pr = bandMats[bo] * br + bandMats[bo + 1] * bg + bandMats[bo + 2] * bb;
                        var pg = bandMats[bo + 3] * br + bandMats[bo + 4] * bg + bandMats[bo + 5] * bb;
                        var pb = bandMats[bo + 6] * br + bandMats[bo + 7] * bg + bandMats[bo + 8] * bb;
                        br = pr; bg = pg; bb = pb;
                    } else if (toned) {
                        var rr = m[0] * br + m[1] * bg + m[2] * bb;
                        var gg = m[3] * br + m[4] * bg + m[5] * bb;
                        var bbv = m[6] * br + m[7] * bg + m[8] * bb;
                        br = rr; bg = gg; bb = bbv;
                    }
                    // 往當下的目標色收（收束時的 gold / 帶位色）。兩條路都要做。
                    if (mixAmt > 0) {
                        br += (tr - br) * mixAmt;
                        bg += (tg - bg) * mixAmt;
                        bb += (tb - bb) * mixAmt;
                    }

                    // Subtle color shimmer: gentle hue shift over time
                    var shimmer = 0.025 * Math.sin(t * 0.5 + i * 0.003);
                    col[idx]     = Math.max(0, Math.min(1, br + shimmer));
                    col[idx + 1] = Math.max(0, Math.min(1, bg + shimmer * 0.6));
                    col[idx + 2] = Math.max(0, Math.min(1, bb - shimmer * 0.3));
                }
                posAttr.needsUpdate = true;
                colAttr.needsUpdate = true;
            }

            // ── v25.8.2 Rolling Rotation (accumulating increment = natural tumble) ──
            // Forward roll: X-axis is the main rolling axis, with gentle Y/Z precession
            var rotSpeedX = ROLL_CFG.x;
            var rotSpeedY = ROLL_CFG.y;
            var rotSpeedZ = ROLL_CFG.z;
            var rollPulse = Math.sin(t * ROLL_CFG.pulseFreq) * ROLL_CFG.pulseAmp;
            if (expr.active) {
                // Emotion active: brow tension → faster rolling (agitation)
                rotSpeedX += expr.browTension * 0.00195;
                // Mouth open → slightly faster (excitement/arousal)
                rotSpeedY += expr.mouthOpen * 0.00095;
                // Add wobble on other axes for dramatic expression
                rotSpeedZ += expr.browTension * 0.00042;
            }
            cloud.rotation.x += rotSpeedX + rollPulse;
            cloud.rotation.y += rotSpeedY + Math.sin(t * 0.13) * 0.00037;
            cloud.rotation.z += rotSpeedZ + Math.sin(t * 0.16) * 0.00020;

            // ── v25.8.2 Per-particle Expression Scaling (updateParticleSync) ──
            // Each particle individually scales based on expression:
            // eyeScale: eyes closed → particles contract (0.8×), eyes open → expand (1.2×)
            // mouthExpansion: mouth open → particles spread outward (up to 1.3×)
            var eyeScale = 0.8 + (expr.eyeOpen * 0.4);
            var mouthExpansion = 1 + (expr.mouthOpen * 0.3);
            var exprScale = eyeScale * mouthExpansion;

            // Breathing: period ~4s, combines with expression scale
            var breath = 1 + Math.sin(t * 1.571) * 0.02;

            // Smooth big→small entrance (easeOutCubic), multiplies the rest.
            var entScale = 1;
            if (entranceStart >= 0) {
                var p = (t - entranceStart) / ENTRANCE.dur;
                if (p >= 1) { entranceStart = -1; }
                else {
                    var e = 1 - Math.pow(1 - Math.max(0, p), 3);
                    entScale = ENTRANCE.from - (ENTRANCE.from - 1) * e;
                }
            }

            // Readout: 晃動時脹大、穩住時收成一顆核。
            // ⚠️ 這一段承擔的是先前交給「粒子漂移」的工作 —— 那個的位移差只有 2.2px，
            // 這裡是整體尺度 32%（300px 的球上約 48px），差一個量級。
            var readoutScale = readout.active
                ? READOUT_SCALE_HI + (READOUT_SCALE_LO - READOUT_SCALE_HI) * readout.sStill
                : 1;

            var totalScale = breath * exprScale * entScale * readoutScale;
            // 夾住上限 —— exprScale 最大到 1.56，相乘後可能脹出掃描框。
            // 夾在今天實際會到的值，保證這一刀不會讓球比現在更大。
            if (readout.active && entranceStart < 0 && totalScale > READOUT_SCALE_CAP) {
                totalScale = READOUT_SCALE_CAP;
            }
            cloud.scale.set(totalScale, totalScale, totalScale);
        }

        // Blink flash → brief opacity dip (abstract "blink" via particle opacity)
        if (material) {
            var op = 0.9;
            if (expr.active) {
                op -= expr.blinkFlash * 0.35;
                // Emotional intensity subtly shifts particle brightness
                op += (expr.browTension - 0.5) * 0.05;
            }
            if (readout.active) {
                // 眨眼是**真的量到的離散事件**，值得一道看得見的脈衝而不只是變暗一點。
                // 先前只有 −0.35 的凹陷，在深色背景上幾乎看不出來。
                op += expr.blinkFlash * 0.55;
                // 越穩越亮。範圍從 ±0.06 拉到 ±0.18 —— 前者在 additive 混色下看不出來。
                op += (readout.sStill - 0.5) * READOUT_OPACITY_SWING * 2;
                // 累積的有效量測越多，球越實。
                op += readout.sProg * READOUT_PROG_LIFT;
            }
            material.opacity = Math.max(0.4, Math.min(1.0, op));
        }

        // Guard render so a transient GL hiccup can't kill the loop.
        try {
            renderer.render(scene, camera);
        } catch (err) {
            console.warn('[TENKI stardust] render skipped:', err && err.message);
        }
    }

    function onResize() {
        if (!camera || !renderer) return;
        var vs = viewSize();
        camera.aspect = vs.w / vs.h;
        camera.updateProjectionMatrix();
        renderer.setSize(vs.w, vs.h);
    }

    /** Play the smooth big→small scale-in (call when the ball becomes visible). */
    function playEntrance() {
        entranceStart = clock.getElapsedTime();
        if (!contextLost) start();
    }

    /** Dim the stardust (during scan completion) */
    function dim() {
        if (container) container.style.opacity = '0.3';
    }

    /** Brighten the stardust */
    function brighten() {
        if (container) container.style.opacity = '1';
    }

    /**
     * Tear the stardust down completely and release the WebGL context, leaving
     * the module ready for a fresh `mount()`.
     *
     * Previously this was a one-way door: it disposed the renderer but left
     * `renderer`/`container` set, left the canvas in the DOM, never forced the
     * context loss, and — because it removes the contextlost/restored listeners
     * — also removed the only path that could have rebuilt (`rebuild()` hangs
     * off those listeners). A later `playEntrance()` would then `start()` a rAF
     * loop against a disposed renderer, surviving only on the try/catch in
     * `animate()`. A scan overlay opens and closes repeatedly, so a re-mountable
     * teardown that actually returns the context is required; browsers cap live
     * contexts (~16) and drop the oldest, which on iOS shows up as the ball
     * silently freezing.
     *
     * Listener removal must happen before `forceContextLoss()` — that call
     * fires `webglcontextlost`, and our handler would otherwise arm the
     * 2500ms rebuild watchdog against a renderer we are in the middle of
     * throwing away.
     */
    function destroy() {
        if (!mounted && !renderer) return;
        stop();
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (renderer) {
            var cv = renderer.domElement;
            if (cv) {
                cv.removeEventListener('webglcontextlost', onContextLost, false);
                cv.removeEventListener('webglcontextrestored', onContextRestored, false);
                if (cv.parentNode) cv.parentNode.removeChild(cv);
            }
            try { renderer.forceContextLoss(); } catch (_) { /* not fatal */ }
            renderer.dispose();
        }
        renderer = null;
        scene = null;
        camera = null;
        fitContainer = false;
        cloud = null;
        material = null;
        if (container) {
            container.style.opacity = '';
            container.style.transition = '';
            container = null;
        }
        contextLost = false;
        entranceStart = -1;
        mounted = false;
        // Tone is per-session, not per-module: a borrowed context handed back to
        // its original host must not arrive still wearing the scan's colour.
        tone.hue = 0; tone.sat = 1; tone.mix = 0; tone.r = 0; tone.g = 0; tone.b = 0;
        toneTarget.hue = 0; toneTarget.sat = 1; toneTarget.mix = 0;
        toneTarget.r = 0; toneTarget.g = 0; toneTarget.b = 0;
        toneMat = null;
        clearReadout(); // 同理：借出去的 context 還回原主時不該還帶著上一輪的讀出狀態
    }

    // ── Tone: pure helpers ────────────────────────────────────────────────
    // Kept side-effect free on purpose so they can be unit-verified directly
    // (known input → known output) instead of only through a rendered frame,
    // which the sandbox cannot produce (three.js is CDN-blocked).

    /** Rec.709 luma weights — the axis both hue rotation and saturation pivot on. */
    var LUM_R = 0.213, LUM_G = 0.715, LUM_B = 0.072;

    /**
     * Combined saturation + hue-rotation matrix, row-major 9-vector.
     *
     * Same construction as SVG `feColorMatrix` (`saturate` ∘ `hueRotate`), so the
     * result matches what a designer would get from a CSS filter. Composing the
     * two here means the per-particle inner loop stays a single 3×3 multiply.
     *
     * @param {number} hueTurns - Hue rotation in turns (1 = 360°).
     * @param {number} sat - Saturation multiplier (1 = unchanged, 0 = greyscale).
     * @returns {Array<number>} 9 coefficients, row-major.
     */
    function toneMatrix(hueTurns, sat) {
        var a = hueTurns * Math.PI * 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        // hueRotate
        var h = [
            LUM_R + c * (1 - LUM_R) - s * LUM_R,
            LUM_G - c * LUM_G - s * LUM_G,
            LUM_B - c * LUM_B + s * (1 - LUM_B),
            LUM_R - c * LUM_R + s * 0.143,
            LUM_G + c * (1 - LUM_G) + s * 0.140,
            LUM_B - c * LUM_B - s * 0.283,
            LUM_R - c * LUM_R - s * (1 - LUM_R),
            LUM_G - c * LUM_G + s * LUM_G,
            LUM_B + c * (1 - LUM_B) + s * LUM_B
        ];
        if (sat === 1) return h;
        // saturate
        var q = [
            LUM_R + (1 - LUM_R) * sat, LUM_G - LUM_G * sat, LUM_B - LUM_B * sat,
            LUM_R - LUM_R * sat, LUM_G + (1 - LUM_G) * sat, LUM_B - LUM_B * sat,
            LUM_R - LUM_R * sat, LUM_G - LUM_G * sat, LUM_B + (1 - LUM_B) * sat
        ];
        // h · q
        var o = new Array(9);
        for (var r = 0; r < 3; r++) {
            for (var k = 0; k < 3; k++) {
                o[r * 3 + k] = h[r * 3] * q[k] + h[r * 3 + 1] * q[3 + k] + h[r * 3 + 2] * q[6 + k];
            }
        }
        return o;
    }

    /**
     * @returns {boolean} whether the smoothed tone is close enough to "off" to skip.
     *
     * ⚠️ 必須把 readout 的飽和度算進來 —— 否則 readout 活著、但 tone 三個值都在
     * 預設值時會走快捷路徑，飽和度就靜默失效了。
     */
    function toneIdle() {
        return Math.abs(tone.hue) < TONE_EPS
            && Math.abs(effectiveSat() - 1) < TONE_EPS
            && tone.mix < TONE_EPS;
    }

    /**
     * 目前生效的飽和度。
     *
     * 🔴 **飽和度只能有一個寫入者**（PLAYBOOK §6：判定/呈現只能有一個來源 ——
     * 這個 bug 類別已經咬過我三次）。所以規則寫死在這裡：
     * **readout 活著的時候由 readout 擁有，否則由 setTone 擁有。**
     * 量測中 readiness-scan 只餵 `stillness`、不餵 `sat`；
     * 收束時它先 `clearReadout()` 再 `setTone({sat})`，交接點明確。
     */
    function effectiveSat() {
        return readout.active
            ? READOUT_SAT_LO + (READOUT_SAT_HI - READOUT_SAT_LO) * readout.sStill
            : tone.sat;
    }

    /** Ease the applied tone toward the requested one and rebuild the matrix. */
    function stepTone() {
        tone.hue += (toneTarget.hue - tone.hue) * TONE_SMOOTH;
        tone.sat += (toneTarget.sat - tone.sat) * TONE_SMOOTH;
        tone.mix += (toneTarget.mix - tone.mix) * TONE_SMOOTH;
        tone.r += (toneTarget.r - tone.r) * TONE_SMOOTH;
        tone.g += (toneTarget.g - tone.g) * TONE_SMOOTH;
        tone.b += (toneTarget.b - tone.b) * TONE_SMOOTH;
        toneMat = toneIdle() ? null : toneMatrix(tone.hue, effectiveSat());
    }

    /**
     * Colour the cloud from whatever the caller actually measured.
     *
     * 🔴 **Defaults are an identity transform.** A page that never calls this
     * renders exactly what it renders today — that is how the locked v25.8.2
     * look survives this feature (CLAUDE.md).
     *
     * ⚠️ This module makes no claim about *what* the values mean. It rotates a
     * gradient; naming the signal is the caller's job, and the caller must only
     * feed it things it genuinely measured.
     *
     * @param {{hue?:number, sat?:number, toward?:string, mix?:number}} [data]
     *   `hue` in turns (±0.5), `sat` multiplier, `toward` a CSS colour to pull
     *   toward (resolve `var(--token)` before passing it — this runs per frame
     *   and must not touch the cascade), `mix` 0..1 how far to pull.
     */
    function setTone(data) {
        var d = data || {};
        if (d.hue !== undefined) toneTarget.hue = Math.max(-0.5, Math.min(0.5, d.hue));
        if (d.sat !== undefined) toneTarget.sat = Math.max(0, Math.min(3, d.sat));
        if (d.mix !== undefined) toneTarget.mix = Math.max(0, Math.min(1, d.mix));
        if (d.toward !== undefined) {
            try {
                var c = new THREE.Color(d.toward);
                toneTarget.r = c.r; toneTarget.g = c.g; toneTarget.b = c.b;
            } catch (_) { /* unparseable colour: keep the previous target */ }
        }
    }

    /** HUE_BANDS 個 3×3（row-major，連續存放），每 tick 重建一次。 */
    var bandMats = new Float32Array(HUE_BANDS * 9);

    /**
     * 目前的散幅與旅程。抽出來當單一來源 —— `readoutState()` 與繪製迴圈
     * 都要用同一組值，各算一次就是下一個會漂移的鏡射。
     *
     * @returns {{bloom:number, rot:number}} turn 為單位。
     */
    function bloomRot() {
        if (!readout.active) return { bloom: 0, rot: 0 };
        return {
            bloom: readout.sStill * READOUT_BLOOM_MAX,
            rot: readout.sProg * READOUT_HUEROT_MAX,
        };
    }

    /**
     * 建 HUE_BANDS 個色帶矩陣。每個色帶 = 全場旋轉 + 它自己在漸層上的散幅偏移。
     *
     * 散幅以漸層中點為軸對稱展開（`band - 中點`），所以**整顆球的平均色相
     * 不會被 bloom 推走** —— 推走的話主色會漂到別的語意色上。
     */
    function buildBandMats() {
        var br = bloomRot();
        var sat = effectiveSat();
        var mid = (HUE_BANDS - 1) / 2;
        for (var b = 0; b < HUE_BANDS; b++) {
            var h = br.rot + ((b - mid) / mid) * (br.bloom / 2);
            var mm = toneMatrix(h, sat);
            var o = b * 9;
            for (var k = 0; k < 9; k++) bandMats[o + k] = mm[k];
        }
    }

    /** Ease the readout toward the requested values (per animation frame). */
    function stepReadout() {
        if (!readout.active) return;
        readout.sStill += (readout.still - readout.sStill) * READOUT_SMOOTH;
        readout.sProg += (readout.prog - readout.sProg) * READOUT_SMOOTH;
    }

    /**
     * 把**這次量測真正量到的東西**接到球身上，讓它成為一個讀出裝置。
     *
     * 🔴 這是回饋迴圈，不是裝飾：畫面上叫使用者「保持穩定」，
     * 那麼「穩住了沒有」就必須在主角身上看得出來。
     *
     * - `stillness` → 飽和度 / 漸層寬度 / 粒子漂移 / 亮度（**越穩越收攏、越純、越亮**）
     * - `progress`  → 往 cyanCore 聚焦 + 尺度收緊（**累積的有效量測**，不是計時器）
     *
     * ⚠️ 呼叫這支就代表這一頁**接受星塵會隨量測收散**（founder 2026-08-10 放寬）。
     * 不呼叫的頁面完全 inert，逐位元組維持 v25.8.2。
     *
     * @param {{stillness?: number, progress?: number}} [data] 兩者皆 0..1。
     */
    function setReadout(data) {
        var d = data || {};
        readout.active = true;
        if (d.stillness !== undefined) {
            readout.still = Math.max(0, Math.min(1, d.stillness));
        }
        if (d.progress !== undefined) {
            readout.prog = Math.max(0, Math.min(1, d.progress));
        }
    }

    /** 關掉讀出層，回到 inert（掃描結束時呼叫）。 */
    function clearReadout() {
        readout.active = false;
        readout.still = 0.5; readout.prog = 0;
        readout.sStill = 0.5; readout.sProg = 0;
    }

    /**
     * 目前套用中的讀出量（已平滑）。給 harness 驗「通道真的有動」用 ——
     * 渲染結果在容器裡看不到（three.js 被沙箱擋），但這些數字看得到。
     *
     * @returns {{active:boolean, stillness:number, progress:number, sat:number,
     *   bloom:number, rot:number, scale:number, drift:number}}
     */
    function readoutState() {
        return {
            active: readout.active,
            stillness: readout.sStill,
            progress: readout.sProg,
            sat: effectiveSat(),
            // bloom / rot / scale 是主通道，**harness 靠它們驗「使用者看不看得出來」**
            // （顏色散得多開、走過多少色相、球脹縮的比例）。
            bloom: bloomRot().bloom,
            rot: bloomRot().rot,
            scale: readout.active
                ? READOUT_SCALE_HI + (READOUT_SCALE_LO - READOUT_SCALE_HI) * readout.sStill
                : 1,
            drift: READOUT_DRIFT_HI + (READOUT_DRIFT_LO - READOUT_DRIFT_HI) * readout.sStill,
        };
    }

    /** Return to the resting palette. Smoothed, like every other tone change. */
    function clearTone() {
        toneTarget.hue = 0;
        toneTarget.sat = 1;
        toneTarget.mix = 0;
    }

    /**
     * Who currently owns the binding, and how it was mounted.
     *
     * Needed because `destroy()` nulls `container`: a caller that wants to
     * *borrow* the single context has to capture the host before tearing it
     * down, or it has nothing to give back.
     *
     * @returns {?{node: HTMLElement, fitContainer: boolean}} null when unmounted.
     */
    function hostInfo() {
        return container ? { node: container, fitContainer: fitContainer } : null;
    }

    /** Set expression data from FaceMesh pipeline */
    function setExpression(data) {
        expr.active = true;
        if (data.mouthOpen !== undefined) expr.mouthOpen = data.mouthOpen;
        if (data.eyeOpen !== undefined) expr.eyeOpen = data.eyeOpen;
        if (data.browTension !== undefined) expr.browTension = data.browTension;
        if (data.blinkDetected) expr.blinkFlash = 1;
    }

    /** Clear expression state (face lost or face sync stopped) */
    function clearExpression() {
        expr.active = false;
        expr.mouthOpen = 0;
        expr.eyeOpen = 1;
        expr.blinkFlash = 0;
        expr.browTension = 0.5;
    }

    // Auto-init when DOM ready. Unchanged behaviour: pages that ship a
    // `#universe` (v6 / story / soul-enroll) get bound automatically; pages
    // without one (e.g. /decision-alert/) are simply left alone, and whoever
    // wants the stardust there calls mount() with their own container.
    function autoMount() { mount(null); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
    } else {
        autoMount();
    }

    global.TENKI_STARDUST = {
        mount: mount,
        unmount: destroy,
        isMounted: isMounted,
        dim: dim,
        brighten: brighten,
        destroy: destroy,
        playEntrance: playEntrance,
        setExpression: setExpression,
        clearExpression: clearExpression,
        hostInfo: hostInfo,
        setTone: setTone,
        clearTone: clearTone,
        setReadout: setReadout,
        clearReadout: clearReadout,
        readoutState: readoutState,
        // Exported for direct unit verification — the rendered frame is not
        // reachable in the sandbox (three.js is CDN-blocked), but this is.
        toneMatrix: toneMatrix
    };
})(window);
