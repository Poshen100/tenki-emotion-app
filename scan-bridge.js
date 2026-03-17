/**
 * scan-bridge.js — v4.2 Bridge between v51.1 scan system and results page
 *
 * Listens for the v51.1 fingerprint scan completion events and
 * transitions the UI from the stardust scanning page to the
 * v4.2 results overlay.
 *
 * Does NOT modify any v51.1 code — purely additive event listener.
 */
(function (global) {
    'use strict';

    var scanUX = global.TENKI_SCAN_UX;
    var audio = global.TENKI_AUDIO;
    var stardust = global.TENKI_STARDUST;
    var resultsPage = document.getElementById('results-page');
    var hudLayer = document.getElementById('hud-layer');
    var dashboardLayer = document.getElementById('dashboard-layer');
    var universe = document.getElementById('universe');
    var isResultsOpen = false;

    // ─── Listen for v51.1 scan:complete event (dispatched by app.js) ───
    document.addEventListener('scan:complete', function () {
        showResultsPage();
    });

    // ─── Also hook into the fingerprint button completion ───
    // The v51.1 app.js dispatches 'tenki:scanDone' or sets dashboard visible
    document.addEventListener('tenki:scanDone', function () {
        showResultsPage();
    });

    // ─── Fallback: observe dashboard-layer becoming visible ───
    var observer = null;
    if (dashboardLayer) {
        observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.attributeName === 'class' && dashboardLayer.classList.contains('show')) {
                    // Dashboard is being shown by v51.1 — intercept and show results page instead
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
        if (isResultsOpen || !resultsPage) return;
        isResultsOpen = true;

        // Dim the stardust soul
        if (stardust && stardust.dim) stardust.dim();

        // Hide v51.1 HUD
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

        // Init audio on interaction
        if (audio) audio.init();

        // Start scan UX
        if (scanUX) scanUX.start();
    }

    // ─── Close button handler ───
    document.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'results-close-btn') {
            closeResultsPage();
        }
    });

    function closeResultsPage() {
        if (!isResultsOpen) return;
        isResultsOpen = false;

        // Stop scan
        if (scanUX) scanUX.stop();

        // Hide results
        resultsPage.classList.remove('fade-in');
        setTimeout(function () {
            resultsPage.classList.add('hidden');
        }, 500);

        // Restore stardust
        if (stardust && stardust.brighten) stardust.brighten();

        // Restore v51.1 HUD
        if (hudLayer) hudLayer.classList.remove('hidden-ui');
    }

    global.TENKI_BRIDGE = {
        showResults: showResultsPage,
        closeResults: closeResultsPage
    };
})(window);
