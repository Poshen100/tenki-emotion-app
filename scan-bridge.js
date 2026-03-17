/**
 * scan-bridge.js — v4.3 Bridge between v51.1 scan system and results page
 *
 * Self-contained: directly handles fingerprint click → results page.
 * Does NOT depend on app.js for event dispatch.
 *
 * Flow:
 *   1. User taps #scan-trigger-wrapper (fingerprint button)
 *   2. This script shows #results-page overlay
 *   3. Calls TENKI_SCAN_UX.start() → builds DOM via TENKI_RESULTS.init()
 *   4. 62-second progressive scan runs with EWMA animation
 */
(function (global) {
    'use strict';

    var isResultsOpen = false;

    // ─── Resolve dependencies lazily (in case load order varies) ───
    function getScanUX()  { return global.TENKI_SCAN_UX; }
    function getAudio()   { return global.TENKI_AUDIO; }
    function getStardust() { return global.TENKI_STARDUST; }

    // ─── Direct fingerprint click handler ───
    document.addEventListener('DOMContentLoaded', function () {
        var scanTrigger = document.getElementById('scan-trigger-wrapper');
        if (scanTrigger) {
            scanTrigger.addEventListener('click', function () {
                console.info('[BRIDGE] Fingerprint tapped');
                showResultsPage();
            });
            // Also handle touchend for immediate response on mobile
            scanTrigger.addEventListener('touchend', function (e) {
                e.preventDefault();
                console.info('[BRIDGE] Fingerprint touched');
                showResultsPage();
            });
        } else {
            console.warn('[BRIDGE] #scan-trigger-wrapper not found');
        }
    });

    // ─── Also listen for custom events (backward compat) ───
    document.addEventListener('scan:complete', function () {
        showResultsPage();
    });
    document.addEventListener('tenki:scanDone', function () {
        showResultsPage();
    });

    // ─── Fallback: observe dashboard-layer becoming visible ───
    var dashboardLayer = document.getElementById('dashboard-layer');
    if (dashboardLayer) {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.attributeName === 'class' && dashboardLayer.classList.contains('show')) {
                    dashboardLayer.classList.remove('show');
                    dashboardLayer.style.display = 'none';
                    showResultsPage();
                    break;
                }
            }
        });
        observer.observe(dashboardLayer, { attributes: true, attributeFilter: ['class'] });
    }

    function showResultsPage() {
        if (isResultsOpen) return;

        var resultsPage = document.getElementById('results-page');
        if (!resultsPage) {
            console.error('[BRIDGE] #results-page not found');
            return;
        }

        isResultsOpen = true;
        console.info('[BRIDGE] Showing results page');

        // Dim the stardust soul
        var stardust = getStardust();
        if (stardust && stardust.dim) stardust.dim();

        // Dim the universe background
        var universe = document.getElementById('universe');
        if (universe) universe.classList.add('dimmed');

        // Hide v51.1 HUD
        var hudLayer = document.getElementById('hud-layer');
        if (hudLayer) hudLayer.classList.add('hidden-ui');

        // Hide v51.1 dashboard if it's open
        if (dashboardLayer) {
            dashboardLayer.classList.remove('show');
            dashboardLayer.style.display = 'none';
        }

        // Show results overlay
        resultsPage.classList.remove('hidden');
        void resultsPage.offsetHeight; // force reflow
        resultsPage.classList.add('fade-in');

        // Init audio on user gesture (iOS requirement)
        var audio = getAudio();
        if (audio) audio.init();

        // Start scan UX (this calls TENKI_RESULTS.init() → buildDOM)
        var scanUX = getScanUX();
        if (scanUX) {
            scanUX.start();
            console.info('[BRIDGE] Scan UX started');
        } else {
            console.warn('[BRIDGE] TENKI_SCAN_UX not available — trying TENKI_RESULTS directly');
            var results = global.TENKI_RESULTS;
            if (results) {
                results.init();
                results.showWarmup();
            }
        }
    }

    // ─── Close button handler ───
    document.addEventListener('click', function (e) {
        if (e.target && (e.target.id === 'results-close-btn' || e.target.closest('#results-close-btn'))) {
            closeResultsPage();
        }
    });

    function closeResultsPage() {
        if (!isResultsOpen) return;
        isResultsOpen = false;

        var scanUX = getScanUX();
        if (scanUX) scanUX.stop();

        var resultsPage = document.getElementById('results-page');
        if (resultsPage) {
            resultsPage.classList.remove('fade-in');
            setTimeout(function () {
                resultsPage.classList.add('hidden');
            }, 500);
        }

        // Restore stardust
        var stardust = getStardust();
        if (stardust && stardust.brighten) stardust.brighten();

        // Restore universe
        var universe = document.getElementById('universe');
        if (universe) universe.classList.remove('dimmed');

        // Restore v51.1 HUD
        var hudLayer = document.getElementById('hud-layer');
        if (hudLayer) hudLayer.classList.remove('hidden-ui');
    }

    global.TENKI_BRIDGE = {
        showResults: showResultsPage,
        closeResults: closeResultsPage
    };
})(window);
