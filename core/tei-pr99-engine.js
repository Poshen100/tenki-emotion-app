/**
 * TEI PR99 Engine (Total Energy Index - Percentile Rank)
 * 
 * Normalizes HRV/SDNN/RMSSD across different devices (Camera, Garmin, Apple Watch)
 * into a single unified 1-99 Percentile Rank (PR).
 * 
 * Defines the 4-State Bio-Risk Zones for Traders:
 * - Peak (80-99): Overconfidence risk
 * - Optimal (55-79): Rational execution
 * - Neutral (35-54): Neutral
 * - Degraded (1-34): Pause trading
 */

const TEI_PR99_Engine = {
    // Mock internal baseline data (in a real app, this comes from IndexedDB/HealthKit)
    _userBaseline: {
        rolling7DayAvg: 45, // ms
        rolling21DayAvg: 42, // ms
        min: 25,
        max: 65,
        stdDev: 8
    },

    /**
     * Convert raw HRV (RMSSD or SDNN) to a PR99 score
     * @param {number} rawHRV - The raw HRV value in ms
     * @param {string} source - 'camera', 'ble', 'apple', 'garmin'
     * @returns {number} Score from 1 to 99
     */
    calculatePR: function (rawHRV, source = 'camera') {
        if (!rawHRV) return 0;

        // In a real implementation, we would adjust calculation based on source
        // e.g. Garmin RMSSD vs Apple SDNN vs Camera rPPG.
        // For this prototype, we use a standard bell curve approximation based on the 21-day baseline.

        const mean = this._userBaseline.rolling21DayAvg;
        const stdDev = this._userBaseline.stdDev;

        // Z-score
        const z = (rawHRV - mean) / stdDev;

        // Approximate CDF for Normal Distribution to get Percentile
        const pr = Math.round(this._normalCDF(z) * 100);

        // Clamp to 1-99
        return Math.max(1, Math.min(99, pr));
    },

    /**
     * Get the Bio-Risk Zone for a given PR score
     * @param {number} prScore - Percentile Rank (1-99)
     * @returns {Object} Zone configuration (name, color, alert)
     */
    getZone: function (prScore) {
        if (prScore >= 80) {
            return {
                id: 'peak',
                name: 'Peak',
                label: 'Peak',
                color: 'var(--rp-yellow)',
                gradientOuter: 'conic-gradient(from 0deg, #ff8c69 0%, #ff5500 25%, #ffd600 50%, #ff5500 75%, #ff8c69 100%)',
                gradientInner: 'conic-gradient(from 0deg, rgba(255,140,105,0.4) 0%, rgba(255,85,0,0.4) 50%, rgba(255,140,105,0.4) 100%)',
                description: 'High energy alert. Overconfidence risk — double-check trades.',
                action: 'double-check',
                vibration: 'pulse'
            };
        } else if (prScore >= 55) {
            return {
                id: 'optimal',
                name: 'Optimal',
                label: 'Optimal',
                color: 'var(--rp-cyan)',
                gradientOuter: 'conic-gradient(from 0deg, #00ffcc 0%, #00d4ff 25%, #4cc9f0 50%, #00d4ff 75%, #00ffcc 100%)',
                gradientInner: 'conic-gradient(from 0deg, rgba(0,255,204,0.4) 0%, rgba(76,201,240,0.4) 50%, rgba(0,255,204,0.4) 100%)',
                description: 'Flow state. Ideal for rational execution.',
                action: 'execute',
                vibration: 'none'
            };
        } else if (prScore >= 35) {
            return {
                id: 'neutral',
                name: 'Neutral',
                label: 'Neutral',
                color: 'var(--rp-text-secondary)',
                gradientOuter: 'conic-gradient(from 0deg, #6b7280 0%, #9ca3af 25%, #d1d5db 50%, #9ca3af 75%, #6b7280 100%)',
                gradientInner: 'conic-gradient(from 0deg, rgba(107,114,128,0.4) 0%, rgba(209,213,219,0.4) 50%, rgba(107,114,128,0.4) 100%)',
                description: 'Neutral state. Take A+ setups only with 50% position.',
                action: 'caution',
                vibration: 'mild'
            };
        } else {
            return {
                id: 'degraded',
                name: 'Degraded',
                label: 'Degraded',
                color: 'var(--rp-violet)',
                gradientOuter: 'conic-gradient(from 0deg, #7b68ee 0%, #9f7aea 25%, #c084fc 50%, #9f7aea 75%, #7b68ee 100%)',
                gradientInner: 'conic-gradient(from 0deg, rgba(123,104,238,0.4) 0%, rgba(192,132,252,0.4) 50%, rgba(123,104,238,0.4) 100%)',
                description: 'Low energy. Pause trading. Recommend 3-min breath calibration.',
                action: 'pause',
                vibration: 'guide'
            };
        }
    },

    // Approximation of the Normal Cumulative Distribution Function
    _normalCDF: function (z) {
        return 0.5 * (1 + this._erf(z / Math.sqrt(2)));
    },

    // Error function approximation
    _erf: function (x) {
        const sign = (x >= 0) ? 1 : -1;
        x = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }
};

window.TEI_PR99_Engine = TEI_PR99_Engine;
