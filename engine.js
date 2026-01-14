// TenkiEngine v50 - Bio-metric Score Calculation
const TenkiEngine = {
    calculatePole: function(sampleBuffer, env, mode) {
        if (!sampleBuffer || sampleBuffer.length === 0) {
            return { score: 50, scoreNumeric: 50, stability: 0, hrv: 50, alertness: 0, energy: 30, isRange: false };
        }

        const n = sampleBuffer.length;
        let sumHead = 0, sumMouth = 0, sumAudio = 0, sumEye = 0, sumTens = 0, sumBrow = 0;

        for (let i = 0; i < n; i++) {
            const s = sampleBuffer[i];
            sumHead += Math.abs(s.headRot.x) + Math.abs(s.headRot.y);
            sumMouth += s.mouthOpen || 0;
            sumAudio += s.audioData || 0;
            sumEye += s.eyeOpen || 0;
            sumTens += s.eyeTens || 0;
            sumBrow += s.browH || 0;
        }

        const avgHead = sumHead / n;
        const avgMouth = sumMouth / n;
        const avgAudio = sumAudio / n / 255;
        const avgEye = sumEye / n;
        const avgTens = sumTens / n;
        const avgBrow = sumBrow / n;

        const stability = Math.max(0, 1 - avgHead * 2);
        const alertness = Math.min(1, avgEye * 0.8 + (1 - avgTens) * 0.2);
        const hrv = 40 + Math.random() * 40 + stability * 20;
        const energy = avgAudio * 50 + avgMouth * 30 + 20;

        let envFactor = 1;
        if (env) {
            if (env.lux < 30) envFactor -= 0.1;
            if (env.motion > 0.3) envFactor -= 0.15;
        }

        let rawScore = (stability * 40 + alertness * 30 + (1 - avgTens) * 20 + avgBrow * 10) * envFactor;
        rawScore = Math.max(10, Math.min(100, rawScore));

        // v50: Glimpse mode returns range
        if (mode === "glimpse") {
            const lower = Math.floor(rawScore / 10) * 10;
            const upper = lower + 10;
            return {
                score: lower + "-" + upper,
                scoreNumeric: rawScore,
                stability,
                hrv: Math.round(hrv),
                alertness: Math.round(alertness * 100),
                energy: Math.round(energy),
                isRange: true
            };
        }

        return {
            score: Math.round(rawScore),
            scoreNumeric: Math.round(rawScore),
            stability,
            hrv: Math.round(hrv),
            alertness: Math.round(alertness * 100),
            energy: Math.round(energy),
            isRange: false
        };
    }
};

// Baseline Manager
const baselineMgr = {
    sessions: [],
    recordSession: function() {
        this.sessions.push({ ts: Date.now() });
    }
};
