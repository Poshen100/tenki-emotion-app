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

    // Expression sync state
    var expr = { mouthOpen: 0, eyeOpen: 1, blinkFlash: 0, browTension: 0.5, active: false };

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

            // Throttle drift to ~20fps by ELAPSED TIME (was: assume 60fps), so the
            // cadence — and the feel — stays the same whether render is 60 or 30fps.
            if (lastDriftT < 0 || t - lastDriftT >= 0.05) {
                lastDriftT = t;
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

                    // Subtle color shimmer: gentle hue shift over time
                    var shimmer = 0.025 * Math.sin(t * 0.5 + i * 0.003);
                    col[idx]     = Math.max(0, Math.min(1, baseColors[idx]     + shimmer));
                    col[idx + 1] = Math.max(0, Math.min(1, baseColors[idx + 1] + shimmer * 0.6));
                    col[idx + 2] = Math.max(0, Math.min(1, baseColors[idx + 2] - shimmer * 0.3));
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

            var totalScale = breath * exprScale * entScale;
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
        clearExpression: clearExpression
    };
})(window);
