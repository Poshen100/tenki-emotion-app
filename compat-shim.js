/**
 * compat-shim.js — CDN Compatibility Safety Net
 * Ensures critical global dependencies exist before app.js runs.
 * Prevents stardust animation failure from CDN version changes.
 *
 * Must be loaded AFTER CDN scripts, BEFORE app.js.
 */
(function () {
    'use strict';

    // ── Lucide Safety Net ──
    // lucide@latest on unpkg may point to a version with changed API.
    // app.js line 2 calls lucide.createIcons() synchronously — if it throws,
    // the entire app fails and Three.js stardust never initializes.
    if (typeof window.lucide === 'undefined' || typeof window.lucide.createIcons !== 'function') {
        console.warn('[TENKI compat] lucide.createIcons not available — loading pinned v0.263.1');

        // Immediately provide a stub so app.js line 2 doesn't crash
        if (!window.lucide) window.lucide = {};
        if (!window.lucide.createIcons) {
            window.lucide.createIcons = function () {};
        }

        // Load pinned working version asynchronously for icon rendering later
        var lucideScript = document.createElement('script');
        lucideScript.src = 'https://unpkg.com/lucide@0.263.1/dist/umd/lucide.min.js';
        lucideScript.crossOrigin = 'anonymous';
        lucideScript.onload = function () {
            console.info('[TENKI compat] lucide v0.263.1 loaded, re-rendering icons');
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) { /* ignore */ }
            }
        };
        document.head.appendChild(lucideScript);
    }

    // ── Three.js Safety Net ──
    // SRI hash mismatch on CDN would prevent THREE from loading.
    // If THREE is missing, app.initThree() will crash.
    if (typeof window.THREE === 'undefined') {
        console.warn('[TENKI compat] THREE.js not loaded — loading fallback from jsdelivr');
        var threeScript = document.createElement('script');
        threeScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
        threeScript.crossOrigin = 'anonymous';
        document.head.appendChild(threeScript);
    }

    // ── MediaPipe Safety Net ──
    if (typeof window.FaceMesh === 'undefined') {
        console.warn('[TENKI compat] FaceMesh not loaded, simulation mode will be used');
    }
})();
