/**
 * results-components.js — Enhanced Results Page Components
 *
 * This file layers on top of results-renderer.js to add:
 * 1. Mini sparkline waveform rendering in bento cards
 * 2. Enhanced stress gradient bar
 * 3. Mock data injection (debug mode) for testing without camera
 * 4. Event bridge listening for scan updates
 *
 * ⚠️ Does NOT modify any locked files.
 * ⚠️ Only reads from global state / DOM / events.
 *
 * @version 1.0.0
 */
(function (global) {
    'use strict';

    /* ═══════════════════════════════════════
       §1  Constants & Configuration
       ═══════════════════════════════════════ */

    var COLORS = {
        hr:      '#FF453A',
        hrv:     '#34C759',
        rr:      '#00B4D8',
        stress:  '#F5A623',
        sns:     '#FF453A',
        pns:     '#34C759',
        optimal: '#00B4D8',
        peak:    '#F5A623',
        neutral: '#8E8E93',
        degraded:'#5E3A87'
    };

    var MOCK_DATA = {
        tei: 72,
        hr: 68,
        hrv: 52,
        rr: 14,
        stress: 25,
        snsPercent: 38,
        bodyBattery: 78,
        sqi: 88
    };

    // 24 hourly BB values (midnight → now)
    var BB_HOURLY = [
        90, 92, 95, 93, 88, 83, 75, 68, 60, 55, 48, 42,
        38, 42, 48, 55, 60, 65, 70, 72, 68, 62, 58, 78
    ];

    /* ═══════════════════════════════════════
       §2  Sparkline Waveform Manager
       ═══════════════════════════════════════ */

    var sparklines = {};
    var sparklineTimers = {};

    /**
     * Initialize sparklines for bento card canvases.
     * Called once the results page DOM is built.
     */
    function initSparklines() {
        var mapping = [
            { id: 'sparkline-hr',  color: COLORS.hr,  base: MOCK_DATA.hr,  variance: 4 },
            { id: 'sparkline-hrv', color: COLORS.hrv, base: MOCK_DATA.hrv, variance: 6 },
            { id: 'sparkline-rr',  color: COLORS.rr,  base: MOCK_DATA.rr,  variance: 1.5 }
        ];

        mapping.forEach(function (cfg) {
            var canvas = document.getElementById(cfg.id);
            if (!canvas || sparklines[cfg.id]) return;

            // Use existing TENKI_Sparkline if available
            if (global.TENKI_Sparkline) {
                sparklines[cfg.id] = new global.TENKI_Sparkline(canvas, {
                    color: cfg.color,
                    maxPoints: 40,
                    lineWidth: 1.5
                });

                // Seed with initial data for visual richness
                for (var i = 0; i < 20; i++) {
                    var noise = (Math.random() - 0.5) * cfg.variance * 2;
                    sparklines[cfg.id].push(cfg.base + noise);
                }

                // Start rolling update
                sparklineTimers[cfg.id] = setInterval(function (sl, base, v) {
                    var noise = (Math.random() - 0.5) * v * 2;
                    sl.push(base + noise);
                }.bind(null, sparklines[cfg.id], cfg.base, cfg.variance), 350);
            }
        });
    }

    function destroySparklines() {
        Object.keys(sparklineTimers).forEach(function (key) {
            clearInterval(sparklineTimers[key]);
        });
        sparklineTimers = {};
        sparklines = {};
    }

    /* ═══════════════════════════════════════
       §3  Stress Gradient Bar Enhancement
       ═══════════════════════════════════════ */

    /**
     * Replace the segmented stress bar with a continuous gradient bar
     * matching the mockup design.
     */
    function enhanceStressBar(stressValue) {
        var stressCard = document.querySelector('.results-bento-card:nth-child(4)');
        if (!stressCard) return;

        // Find existing stress segments container
        var existing = stressCard.querySelector('.stress-segments');
        if (!existing) return;

        // Check if already enhanced
        if (stressCard.querySelector('.rp-stress-gradient')) return;

        // Create gradient bar overlay
        var wrapper = document.createElement('div');
        wrapper.className = 'rp-stress-gradient';

        var fill = document.createElement('div');
        fill.className = 'rp-stress-gradient-fill';
        fill.style.width = Math.min(stressValue, 100) + '%';
        wrapper.appendChild(fill);

        // Insert after the existing segments
        existing.style.display = 'none';
        existing.parentNode.insertBefore(wrapper, existing.nextSibling);
    }

    /* ═══════════════════════════════════════
       §4  ANS Balance Label Enhancement
       ═══════════════════════════════════════ */

    function enhanceAnsLabels(snsPercent) {
        var ansSection = document.querySelector('.ans-section');
        if (!ansSection) return;

        var existingLabels = ansSection.querySelector('.ans-labels');
        if (!existingLabels) return;

        // Check if already enhanced
        if (ansSection.querySelector('.rp-ans-label-row')) return;

        var pnsPercent = 100 - snsPercent;

        // Create enhanced label row
        var row = document.createElement('div');
        row.className = 'rp-ans-label-row';
        row.innerHTML =
            '<span class="rp-ans-pct-sns">' + snsPercent + '%</span>' +
            '<span class="rp-ans-name-sns">SNS</span>' +
            '<span class="rp-ans-name-pns">PNS</span>' +
            '<span class="rp-ans-pct-pns">' + pnsPercent + '%</span>';

        // Replace the existing labels
        existingLabels.style.display = 'none';
        existingLabels.parentNode.insertBefore(row, existingLabels.nextSibling);
    }

    /* ═══════════════════════════════════════
       §5  Event Bridge — Listen for scan updates
       ═══════════════════════════════════════ */

    function setupEventBridge() {
        // Method A: Listen for custom events (preferred)
        document.addEventListener('tenki:scan-update', function (e) {
            if (!e.detail) return;
            var d = e.detail;

            // Update sparkline bases if values change
            if (d.hr && sparklines['sparkline-hr']) {
                sparklines['sparkline-hr'].push(d.hr + (Math.random() - 0.5) * 4);
            }
            if (d.hrv && sparklines['sparkline-hrv']) {
                sparklines['sparkline-hrv'].push(d.hrv + (Math.random() - 0.5) * 6);
            }
            if (d.rr && sparklines['sparkline-rr']) {
                sparklines['sparkline-rr'].push(d.rr + (Math.random() - 0.5) * 1.5);
            }
            if (typeof d.stress === 'number') {
                enhanceStressBar(d.stress);
            }
            if (typeof d.sns === 'number') {
                enhanceAnsLabels(d.sns);
            }
        });

        // Method B: MutationObserver — detect when results page becomes visible
        var resultsPage = document.getElementById('results-page');
        if (resultsPage) {
            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                    if (m.type === 'attributes' && m.attributeName === 'class') {
                        var el = m.target;
                        if (el.classList.contains('fade-in') && !el.classList.contains('hidden')) {
                            // Results page is now visible — initialize enhancements
                            setTimeout(function () {
                                initSparklines();
                                enhanceStressBar(MOCK_DATA.stress);
                                enhanceAnsLabels(MOCK_DATA.snsPercent);
                            }, 500);
                        }
                        if (el.classList.contains('hidden')) {
                            destroySparklines();
                        }
                    }
                });
            });
            observer.observe(resultsPage, { attributes: true, attributeFilter: ['class'] });
        }
    }

    /* ═══════════════════════════════════════
       §6  Debug Mode — Force results page
       ═══════════════════════════════════════ */

    /**
     * In debug mode, pressing Shift+R forces the results page open with mock data.
     * This bypasses the camera requirement for desktop testing.
     */
    function setupDebugMode() {
        document.addEventListener('keydown', function (e) {
            // Shift+R to force results page with mock data
            if (e.shiftKey && e.key === 'R') {
                e.preventDefault();
                forceResultsPage();
            }
        });
    }

    function forceResultsPage() {
        // Check if RENDERER is available (from results-renderer.js)
        if (!global.RENDERER) {
            console.warn('[results-components] RENDERER not available');
            return;
        }

        console.log('[results-components] Force-showing results page with mock data');

        // Initialize the results page
        global.RENDERER.init();

        // Show with mock data
        global.RENDERER.showWarmup();

        setTimeout(function () {
            global.RENDERER.updateAll({
                tei: MOCK_DATA.tei,
                hr: MOCK_DATA.hr,
                hrv: MOCK_DATA.hrv,
                rr: MOCK_DATA.rr,
                stress: MOCK_DATA.stress,
                snsPercent: MOCK_DATA.snsPercent,
                bodyBattery: MOCK_DATA.bodyBattery,
                sqi: MOCK_DATA.sqi,
                bbHourly: BB_HOURLY,
                zone: 'optimal',
                scanMode: 'DEEP SCAN · 60s',
                coachText: '保持專注，信任你的策略判斷，目前的生理狀態顯示你已處於最佳交易區間。',
                garminConnected: true,
                garminDevice: 'Garmin Forerunner'
            });

            // Initialize enhancements after DOM is built
            setTimeout(function () {
                initSparklines();
                enhanceStressBar(MOCK_DATA.stress);
                enhanceAnsLabels(MOCK_DATA.snsPercent);
            }, 600);
        }, 100);

        setTimeout(function () {
            global.RENDERER.showComplete();
        }, 400);
    }

    /* ═══════════════════════════════════════
       §7  Initialization
       ═══════════════════════════════════════ */

    function init() {
        setupEventBridge();
        setupDebugMode();
        console.log('[results-components] v1.0.0 loaded — Shift+R for debug mode');
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for external access
    global.RESULTS_COMPONENTS = {
        initSparklines: initSparklines,
        destroySparklines: destroySparklines,
        forceResultsPage: forceResultsPage,
        enhanceStressBar: enhanceStressBar,
        enhanceAnsLabels: enhanceAnsLabels,
        MOCK_DATA: MOCK_DATA
    };

})(window);
