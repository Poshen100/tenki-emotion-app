/**
 * baseline-sim.js — Simulated 7-day baseline (21 scans)
 * Provides mock biometric data for demo/testing when no real scans exist.
 */
(function (global) {
    'use strict';

    var BASELINE_SIM = {
        stats: {
            hr:  { mean: 68, std: 6.2 },
            hrv: { mean: 48, std: 12.5 },
            rr:  { mean: 14.5, std: 2.1 },
            sampleCount: 21,
            windowDays: 7
        },

        garmin: {
            connected: true,
            deviceName: 'Forerunner 265',
            hrvStatus: 'Balanced',
            bodyBattery: 78,
            bb24h: [90, 95, 92, 85, 72, 55, 42, 48, 62, 70, 75, 78]
        },

        /** Generate a simulated scan metric with noise */
        generateMetrics: function (noiseLevel) {
            var noise = noiseLevel || 3;
            var stats = this.stats;
            return {
                hrBpm: stats.hr.mean + (Math.random() - 0.5) * 2 * noise,
                hrvRmssdMs: stats.hrv.mean + (Math.random() - 0.5) * 2 * (noise * 2),
                rrBrpm: stats.rr.mean + (Math.random() - 0.5) * 2 * (noise * 0.5)
            };
        },

        /** Build a BaselineData-compatible object */
        toBaselineData: function () {
            return {
                windowDays: this.stats.windowDays,
                hrMean: this.stats.hr.mean,
                hrStd: this.stats.hr.std,
                hrvMean: this.stats.hrv.mean,
                hrvStd: this.stats.hrv.std,
                rrMean: this.stats.rr.mean,
                rrStd: this.stats.rr.std,
                sampleCount: this.stats.sampleCount
            };
        }
    };

    global.TENKI_BASELINE_SIM = BASELINE_SIM;
})(window);
