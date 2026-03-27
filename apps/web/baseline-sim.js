/**
 * baseline-sim.js — Simulated 7-day Baseline (21 scans)
 *
 * Provides statistical baseline + ANS/Stress calculators for PR99 TEI
 * when no real historical data exists yet.
 *
 * Reference ranges (healthy adult resting):
 *   HR:  60-75 BPM | HRV: 40-65 ms RMSSD | RR: 12-18 BrPM
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
            hrvNightMean: 45,
            hrvBaseline: [42, 58],
            stress: null,
            bodyBattery: 78,
            bb24h: [90, 95, 92, 85, 72, 55, 42, 48, 62, 70, 75, 78]
        },

        /** Generate noisy metrics for simulation */
        generateMetrics: function (noiseLevel) {
            var noise = noiseLevel || 3;
            var s = this.stats;
            return {
                hrBpm: s.hr.mean + (Math.random() - 0.5) * 2 * noise,
                hrvRmssdMs: s.hrv.mean + (Math.random() - 0.5) * 2 * (noise * 2),
                rrBrpm: s.rr.mean + (Math.random() - 0.5) * 2 * (noise * 0.5)
            };
        },

        /** Welford-compatible baseline object */
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
        },

        /** Generate simulated 24hr Body Battery with noise */
        generateBB24h: function () {
            var base = [90, 95, 92, 85, 72, 55, 42, 48, 62, 70, 75, 78];
            return base.map(function (v) {
                return v + Math.round((Math.random() - 0.5) * 4);
            });
        },

        /**
         * Stress from live rPPG (Garmin Firstbeat approximation).
         * HRV low + HR high = high stress.
         *   0-25: Rest | 26-50: Low | 51-75: Medium | 76-100: High
         */
        calculateStress: function (hr, hrv) {
            var hrvZ = (hrv - this.stats.hrv.mean) / this.stats.hrv.std;
            var hrZ  = (hr - this.stats.hr.mean) / this.stats.hr.std;
            var raw = 50 - hrvZ * 20 + hrZ * 15;
            return Math.max(0, Math.min(100, Math.round(raw)));
        },

        /**
         * ANS balance (SNS/PNS).
         * SNS (sympathetic): HR positive, HRV negative
         * PNS (parasympathetic): HRV positive, slow RR positive
         */
        calculateANS: function (hr, hrv, rr) {
            var hrvZ = (hrv - this.stats.hrv.mean) / this.stats.hrv.std;
            var hrZ  = (hr - this.stats.hr.mean) / this.stats.hr.std;
            var rrZ  = (rr - this.stats.rr.mean) / this.stats.rr.std;

            var pnsRaw = 0.5 + hrvZ * 0.15 - rrZ * 0.08;
            var pns = Math.max(0.15, Math.min(0.85, pnsRaw));
            var sns = 1 - pns;

            return {
                sns: Math.round(sns * 100),
                pns: Math.round(pns * 100),
                label: pns > 0.6 ? 'Parasympathetic dominant (cool)' :
                       sns > 0.6 ? 'Sympathetic dominant (warm)' : 'Balanced'
            };
        }
    };

    global.TENKI_BASELINE_SIM = BASELINE_SIM;
})(window);
