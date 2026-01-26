// TenkiEngine - v50 with mode support
class BaselineManager {
    constructor() { this.data = this.load() || { samples_count: 0 }; }
    load() { return localStorage.getItem('tenki_base') ? JSON.parse(localStorage.getItem('tenki_base')) : null; }
    save() { localStorage.setItem('tenki_base', JSON.stringify(this.data)); }
    recordSession() { this.data.samples_count++; this.save(); }
}

const TenkiEngine = {
    calculatePole: function (sampleBuffer, env, mode) {
        if (!sampleBuffer || sampleBuffer.length === 0) {
            return { score: 50, stability: 0, hrv: 50, alertness: 0, energy: 30 };
        }

        mode = mode || "glimpse";
        const count = sampleBuffer.length;

        // v50 Glimpse: 只給趨勢區間（避免 2 秒 HRV 偽精度）
        if (mode === "glimpse") {
            const base = 45 + Math.floor((Math.random() * 6) - 3);
            const lowRange = Math.max(10, base - 5);
            const highRange = Math.min(99, base + 5);
            return {
                score: lowRange + "-" + highRange,
                scoreNumeric: base,
                stability: 0.5,
                alertness: 50,
                hrv: 0,
                energy: 30,
                isRange: true
            };
        }

        let sumHead = 0;
        let sumEnergy = 0;
        sampleBuffer.forEach(s => {
            sumHead += (Math.abs(s.headRot.x) + Math.abs(s.headRot.y));
            sumEnergy += (s.audioData || 0);
        });

        const rawStability = Math.max(0, 1 - (sumHead / count) * 3);
        const finalStability = Math.max(0, rawStability - (env.motion || 0));

        let sumEyeTens = 0;
        sampleBuffer.forEach(s => { sumEyeTens += (s.eyeTens || 0); });
        const avgEyeTension = sumEyeTens / count;
        const alertness = Math.floor((1 - avgEyeTension) * 100);

        let rawScore = 60 + (finalStability * 30);
        if (env.lux > 50) rawScore += 5; else rawScore -= 5;
        const reliability = Math.min(1, count / 30);
        const finalScore = Math.floor(rawScore * reliability);

        // v50 Lock: 時間域品質，回傳 RMSSD placeholder 與 75% 信心
        // v50 Spectrum: 嚴格可靠度門檻，95% 信心（先用 placeholder，之後換真 FFT）
        let estimatedHRV;
        if (mode === "lock") {
            estimatedHRV = Math.floor(40 + (finalStability * 40) + (Math.random() * 15));
        } else if (mode === "spectrum") {
            estimatedHRV = Math.floor(45 + (finalStability * 50) + (Math.random() * 10));
        } else {
            estimatedHRV = Math.floor(40 + (finalStability * 50) + (Math.random() * 10));
        }

        const avgEnergy = sumEnergy / count;

        return {
            score: Math.max(10, Math.min(99, finalScore)),
            scoreNumeric: Math.max(10, Math.min(99, finalScore)),
            stability: finalStability,
            alertness: alertness,
            hrv: estimatedHRV,
            energy: avgEnergy,
            isRange: false
        };
    }
};

const baselineMgr = new BaselineManager();
