/**
 * TENKI Audio Engine
 * 
 * 所有音效在客戶端即時合成 (Web Audio API)
 * 不需要任何音檔 — 零額外請求
 * 
 * 設計原則:
 * - 溫暖自然 (C5-G5 主音域)
 * - 極低音量 (gain 0.03-0.08)
 * - 永遠 fade in/out (不突然)
 * - 間隔 ≥ 3 秒
 */

class TenkiAudio {
    constructor() {
        this.ctx = null;  // lazy init (需要 user gesture)
        this.lastPlayTime = 0;
        this.minInterval = 3000; // ms
        this.enabled = true;
        this.masterGain = null;
    }

    /** 必須在 user gesture (tap/click) 後調用 */
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);

        // 建立 reverb (convolution)
        this._buildReverb();
    }

    async _buildReverb() {
        // 合成簡易 impulse response (不需要額外檔案)
        const sr = this.ctx.sampleRate;
        const len = sr * 0.4; // 400ms reverb tail
        const buf = this.ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.1));
            }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = buf;
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.3;
        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
    }

    _canPlay() {
        if (!this.enabled || !this.ctx) return false;
        const now = Date.now();
        if (now - this.lastPlayTime < this.minInterval) return false;
        this.lastPlayTime = now;
        return true;
    }

    /** 掃描開始: C5 鐘聲 */
    playScanStart() {
        if (!this._canPlay()) return;
        this._bell(523.25, 0.06, 0.3);  // C5
    }

    /** 數據首次到達: A5 三角波 ding */
    playDataArrive() {
        if (!this._canPlay()) return;
        this._ding(880, 0.04, 0.08);  // A5
    }

    /** 精度升級: 每次升 100 cent */
    playPhaseUpgrade(phase) {
        if (!this._canPlay()) return;
        const freqs = [880, 932, 988, 1047]; // A5, A#5, B5, C6
        const freq = freqs[Math.min(phase, freqs.length - 1)];
        this._ding(freq, 0.05, 0.15);
    }

    /** 掃描完成: C5+E5+G5 和弦 */
    playScanComplete() {
        this.lastPlayTime = 0; // override interval for completion
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this._tone(523.25, now, 0.5, 0.06, 'sine');     // C5
        this._tone(659.25, now + 0.02, 0.5, 0.05, 'sine'); // E5
        this._tone(783.99, now + 0.04, 0.5, 0.04, 'sine'); // G5
    }

    /** 低頻 tick (木魚感) */
    playTick() {
        if (!this.ctx) return;
        // 不受 interval 限制
        this._ding(800, 0.03, 0.03);
    }

    /** 持續呼吸背景音 (開始/停止) */
    startBreathBg() {
        if (!this.ctx || this.breathOsc) return;
        this.breathOsc = this.ctx.createOscillator();
        this.breathGain = this.ctx.createGain();
        this.breathOsc.type = 'sine';
        this.breathOsc.frequency.value = 60; // 超低頻, 幾乎聽不到
        this.breathGain.gain.value = 0.015;
        this.breathOsc.connect(this.breathGain);
        this.breathGain.connect(this.masterGain);
        this.breathOsc.start();
        // LFO: gain 慢波動 (呼吸感)
        this._breathLFO();
    }

    _breathLFO() {
        if (!this.breathGain) return;
        const now = this.ctx.currentTime;
        // 4 秒週期 (15 BrPM)
        this.breathGain.gain.setValueAtTime(0.01, now);
        this.breathGain.gain.linearRampToValueAtTime(0.02, now + 2);
        this.breathGain.gain.linearRampToValueAtTime(0.01, now + 4);
        this._breathTimer = setTimeout(() => this._breathLFO(), 4000);
    }

    stopBreathBg() {
        if (this.breathOsc) {
            this.breathOsc.stop();
            this.breathOsc = null;
            clearTimeout(this._breathTimer);
        }
    }

    /** Sub-bass pulse — iOS 觸感替代方案 */
    playSubBassPulse() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 20; // 20Hz — 體感振動頻率
        g.gain.setValueAtTime(0.15, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.03);
    }

    // ─── 內部工具 ───

    _bell(freq, gain, dur) {
        const now = this.ctx.currentTime;
        this._tone(freq, now, dur, gain, 'sine');
        this._tone(freq * 2, now, dur * 0.7, gain * 0.3, 'sine'); // overtone
        this._tone(freq * 3, now, dur * 0.4, gain * 0.15, 'sine'); // 2nd overtone
    }

    _ding(freq, gain, dur) {
        this._tone(freq, this.ctx.currentTime, dur, gain, 'triangle');
    }

    _tone(freq, startTime, dur, gain, type) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        // Envelope: 50ms attack, body, 60% release
        const attack = 0.05;
        const release = dur * 0.6;
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(gain, startTime + attack);
        g.gain.setValueAtTime(gain, startTime + dur - release);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        osc.connect(g);
        g.connect(this.masterGain);
        // 也送 reverb
        if (this.reverb) g.connect(this.reverb);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.1);
    }

    setEnabled(v) { this.enabled = v; }
}
