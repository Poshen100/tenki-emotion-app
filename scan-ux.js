/**
 * 5-Phase Progressive Scan Controller
 * 
 * 串接: rPPG engine → EWMA smoothing → results renderer → audio/haptics
 * 
 * Phase 0: WARMUP  (0-2s)   → 無數字, 校準中
 * Phase 1: GLIMPSE (2-4s)   → 初步 TEI (高噪聲)
 * Phase 2: QUICK   (4-17s)  → 15 組心率, 收斂中
 * Phase 3: STANDARD(17-32s) → 30 組心率, 穩定中
 * Phase 4: DEEP    (32-62s) → 60 組心率, 最高精度
 * COMPLETE: 鎖定
 */

class ScanUX {
    constructor({ audio, haptics, renderer, baseline }) {
        this.audio = audio;
        this.haptics = haptics;
        this.renderer = renderer;
        this.baseline = baseline;

        this.phase = -1; // not started
        this.elapsed = 0;
        this.ewma = { tei: 0, hr: 0, hrv: 0, rr: 0, stress: 0, sns: 50, sqi: 0 };
        this.alpha = 0.05;
        this.histories = { hr: [], hrv: [], rr: [] };
        this.locked = false;
        this.timer = null;
        this.updateTimer = null;
        this.lastPhaseUpgrade = -1;
    }

    /** 啟動掃描 (在 user gesture callback 中調用) */
    start() {
        this.phase = 0;
        this.elapsed = 0;
        this.locked = false;
        this.ewma = { tei: 0, hr: 0, hrv: 0, rr: 0, stress: 0, sns: 50, sqi: 0 };
        this.histories = { hr: [], hrv: [], rr: [] };

        this.audio.init();
        this.audio.playScanStart();
        this.audio.startBreathBg();
        this.haptics.lightTap();

        this.renderer.showWarmup();

        // 每秒計時
        this.timer = setInterval(() => this._tick(), 1000);
        // 每 350ms EWMA 更新
        this.updateTimer = setInterval(() => this._updateMetrics(), 350);
    }

    /** 接收 rPPG 原始數據 (每次心率檢測回調) */
    onRppgData(data) {
        // data = { hr, hrv, rr, sqi, confidence }
        this._latestRaw = data;
    }

    _tick() {
        this.elapsed++;
        const prev = this.phase;

        // Phase transitions
        if (this.elapsed < 2) this.phase = 0;
        else if (this.elapsed < 4) this.phase = 1;
        else if (this.elapsed < 17) this.phase = 2;
        else if (this.elapsed < 32) this.phase = 3;
        else if (this.elapsed < 62) this.phase = 4;
        else {
            this._complete();
            return;
        }

        // Phase upgrade 事件
        if (this.phase > prev && this.phase > 0) {
            this.audio.playPhaseUpgrade(this.phase);
            this.haptics.phaseUp();
            this.lastPhaseUpgrade = this.elapsed;
        }

        this.renderer.updateBadge(this.phase, this.elapsed);
        this.renderer.updatePhaseDots(this.phase);
    }

    _updateMetrics() {
        if (this.locked || this.phase < 1) return;

        const raw = this._latestRaw;
        if (!raw) return;

        const noise = [0, 12, 6, 3, 1, 0][this.phase] || 0;
        const n = () => (Math.random() - 0.5) * noise;

        // EWMA 更新
        const e = this.ewma;
        e.hr = this._ewma(e.hr, raw.hr + n(), 40, 200);
        e.hrv = this._ewma(e.hrv, raw.hrv + n(), 5, 200);
        e.rr = this._ewma(e.rr, raw.rr + n() * 0.5, 6, 30);
        e.sqi = this._ewma(e.sqi, raw.sqi + n() * 0.3, 0, 100);

        // 從基線計算衍生指標
        e.stress = this.baseline.calculateStress(e.hr, e.hrv, e.rr);
        const ans = this.baseline.calculateANS(e.hr, e.hrv, e.rr);
        e.sns = ans.sns;

        // TEI PR99 (使用 TenkiEngine)
        if (typeof TenkiEngine !== 'undefined') {
            const result = TenkiEngine.ingestDailyScan({
                deviceType: 'face_rppg',
                sqs: { grade: e.sqi > 85 ? 'A' : e.sqi > 70 ? 'B' : 'C', total: Math.round(e.sqi) },
                metrics: { hrBpm: e.hr, hrvRmssdMs: e.hrv, rrBrpm: e.rr },
            });
            if (result && result.tei) {
                e.tei = this._ewma(e.tei, result.tei.total, 1, 99);
            }
        } else {
            // Fallback: 簡化 TEI 計算
            e.tei = this._simpleTEI(e.hr, e.hrv, e.rr);
        }

        // 推入歷史 (sparkline 用)
        this.histories.hr.push(e.hr);
        this.histories.hrv.push(e.hrv);
        this.histories.rr.push(e.rr);
        // 限制 40 點
        for (const k of ['hr', 'hrv', 'rr']) {
            if (this.histories[k].length > 40) this.histories[k].shift();
        }

        // 渲染
        this.renderer.updateAll(e, this.histories, ans, this.phase);
    }

    _complete() {
        this.locked = true;
        clearInterval(this.timer);
        clearInterval(this.updateTimer);
        this.audio.stopBreathBg();
        this.audio.playScanComplete();
        this.haptics.complete();
        this.renderer.showComplete(this.ewma);
    }

    _ewma(current, target, min, max) {
        if (current === 0) return Math.max(min, Math.min(max, target));
        const v = current * (1 - this.alpha) + target * this.alpha;
        return Math.max(min, Math.min(max, v));
    }

    /** Fallback TEI: z-score → percentile → weighted composite */
    _simpleTEI(hr, hrv, rr) {
        const b = this.baseline.stats;
        const zHR = b.hr.std > 0 ? -(hr - b.hr.mean) / b.hr.std : 0;
        const zHRV = b.hrv.std > 0 ? (hrv - b.hrv.mean) / b.hrv.std : 0;
        const zRR = b.rr.std > 0 ? -(rr - b.rr.mean) / b.rr.std : 0;
        const toP = (z) => {
            const c = Math.max(-3.5, Math.min(3.5, z));
            const a1 = .254829592, a2 = -.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = .3275911;
            const s = c < 0 ? -1 : 1, x = Math.abs(c) / Math.sqrt(2), t = 1 / (1 + p * x);
            const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return Math.max(1, Math.min(99, Math.round(.5 * (1 + s * y) * 100)));
        };
        return Math.round(toP(zHRV) * 0.5 + toP(zHR) * 0.3 + toP(zRR) * 0.2);
    }

    destroy() {
        clearInterval(this.timer);
        clearInterval(this.updateTimer);
        this.audio.stopBreathBg();
    }
}
