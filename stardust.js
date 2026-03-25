/**
 * stardust.js — Three.js 8000-particle stardust soul animation
 *
 * Extracted from v25.8.2 app.js initThree().
 * Fibonacci sphere, Pink→Purple→Cyan gradient, additive blending.
 * Persistent background behind landing + results pages.
 *
 * v4.5: Expression sync — mouth open / eye blink / brow tension
 *       modulate particle scale, opacity, and rotation speed.
 *       Core visual identity (colors, particle count, distribution) unchanged.
 *
 * v5.0: Organic drift — per-particle random offsets create natural,
 *       free-spirited movement. Color shimmer adds living gradient.
 *       Breathing sync and expression API fully preserved.
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
    var PARTICLE_SIZE = 0.09;
    var scene, camera, renderer, cloud, material;
    var animFrame = null;
    var clock = new THREE.Clock();

    // Per-particle drift data (organic movement)
    var basePositions = null;   // Original Fibonacci positions
    var driftSeeds = null;      // Random seeds per particle (Float32Array × 4: freqX, freqY, freqZ, amplitude)
    var baseColors = null;      // Original color values for shimmer

    // Expression sync state
    var expr = { mouthOpen: 0, eyeOpen: 1, blinkFlash: 0, browTension: 0.5, active: false };

    function init() {
        var container = document.getElementById('universe');
        if (!container) return;

        // Fade-in to prevent black flash
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.6s ease';

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

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
        grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);

        var tex = new THREE.Texture(spriteCanvas);
        tex.needsUpdate = true;

        material = new THREE.PointsMaterial({
            size: PARTICLE_SIZE,
            map: tex,
            transparent: true,
            opacity: 0.9,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        cloud = new THREE.Points(geometry, material);
        scene.add(cloud);

        // Start animation
        animate();

        // Fade in after first render
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                container.style.opacity = '1';
            });
        });

        // Handle resize
        window.addEventListener('resize', onResize);
    }

    function animate() {
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
            var driftMult = 1.0;
            if (expr.active) {
                driftMult += expr.mouthOpen * 0.5 + expr.browTension * 0.3;
            }

            // Update every 3rd frame for performance (still 20fps drift at 60fps render)
            var frameCount = Math.round(t * 60);
            if (frameCount % 3 === 0) {
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
            var rotSpeedX = 0.0024;   // Forward rolling main axis (slower for meditative feel)
            var rotSpeedY = 0.0012;   // Gentle spin for depth
            var rotSpeedZ = 0.0004;   // Subtle side tumble
            var rollPulse = Math.sin(t * 0.22) * 0.0005; // Softer natural acceleration/slowdown
            if (expr.active) {
                // Emotion active: brow tension → faster rolling (agitation)
                rotSpeedX += expr.browTension * 0.003;
                // Mouth open → slightly faster (excitement/arousal)
                rotSpeedY += expr.mouthOpen * 0.0015;
                // Add wobble on other axes for dramatic expression
                rotSpeedZ += expr.browTension * 0.0007;
            }
            cloud.rotation.x += rotSpeedX + rollPulse;
            cloud.rotation.y += rotSpeedY + Math.sin(t * 0.15) * 0.0004;
            cloud.rotation.z += rotSpeedZ + Math.sin(t * 0.18) * 0.0003;

            // ── v25.8.2 Per-particle Expression Scaling (updateParticleSync) ──
            // Each particle individually scales based on expression:
            // eyeScale: eyes closed → particles contract (0.8×), eyes open → expand (1.2×)
            // mouthExpansion: mouth open → particles spread outward (up to 1.3×)
            var eyeScale = 0.8 + (expr.eyeOpen * 0.4);
            var mouthExpansion = 1 + (expr.mouthOpen * 0.3);
            var exprScale = eyeScale * mouthExpansion;

            // Breathing: period ~4s, combines with expression scale
            var breath = 1 + Math.sin(t * 1.571) * 0.02;
            var totalScale = breath * exprScale;
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

        renderer.render(scene, camera);
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /** Dim the stardust (during scan completion) */
    function dim() {
        var el = document.getElementById('universe');
        if (el) el.style.opacity = '0.3';
    }

    /** Brighten the stardust */
    function brighten() {
        var el = document.getElementById('universe');
        if (el) el.style.opacity = '1';
    }

    function destroy() {
        if (animFrame) cancelAnimationFrame(animFrame);
        window.removeEventListener('resize', onResize);
        if (renderer) renderer.dispose();
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

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.TENKI_STARDUST = {
        dim: dim,
        brighten: brighten,
        destroy: destroy,
        setExpression: setExpression,
        clearExpression: clearExpression
    };
})(window);
