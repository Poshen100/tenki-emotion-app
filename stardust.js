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
 * Requires: THREE.js (r128+)
 */
(function (global) {
    'use strict';

    if (typeof THREE === 'undefined') {
        console.warn('[TENKI stardust] THREE.js not loaded, skipping');
        return;
    }

    var PARTICLE_COUNT = 8000;
    var PARTICLE_SIZE = 0.08;
    var scene, camera, renderer, cloud, material;
    var animFrame = null;
    var clock = new THREE.Clock();

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

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
            var radius = Math.sqrt(1 - y * y);
            var theta = phi * i;
            var r = 2.5;
            var idx = i * 3;

            positions[idx]     = Math.cos(theta) * radius * r;
            positions[idx + 1] = y * r;
            positions[idx + 2] = Math.sin(theta) * radius * r;

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
        grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
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
            // Rotation — speed increases with brow tension
            var rotSpeed = 0.05;
            if (expr.active) rotSpeed += expr.browTension * 0.04;
            cloud.rotation.y = t * rotSpeed;
            cloud.rotation.x = Math.sin(t * 0.03) * 0.1;

            // Breathing scale + mouth open expansion
            var breath = 1 + Math.sin(t * 0.5) * 0.02;
            if (expr.active) {
                breath += expr.mouthOpen * 0.12;
            }
            cloud.scale.set(breath, breath, breath);
        }

        // Blink flash → brief opacity dip
        if (material) {
            var op = 0.9;
            if (expr.active) op -= expr.blinkFlash * 0.35;
            material.opacity = Math.max(0.4, op);
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
