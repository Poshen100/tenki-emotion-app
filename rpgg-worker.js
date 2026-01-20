// rpgg-worker.js - rPPG Signal Processing Worker
// Bandpass filtering + Peak detection + RMSSD calculation

let bufT = [];
let bufX = [];
let lastMetrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0 };

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length); }
function std(arr) {
    const m = mean(arr);
    const v = mean(arr.map(x => (x - m) * (x - m)));
    return Math.sqrt(Math.max(0, v));
}

function biquadCoeffs(type, fc, Q, fs) {
    const w0 = 2 * Math.PI * (fc / fs);
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Q);

    let b0, b1, b2, a0, a1, a2;
    if (type === "lowpass") {
        b0 = (1 - cosw0) / 2; b1 = 1 - cosw0; b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
    } else if (type === "highpass") {
        b0 = (1 + cosw0) / 2; b1 = -(1 + cosw0); b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
    } else {
        // fallback: passthrough
        b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
    }

    return {
        b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
        a1: a1 / a0, a2: a2 / a0
    };
}

function applyBiquad(x, c) {
    let y = new Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const x0 = x[i];
        const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        y[i] = y0;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
    }
    return y;
}

function detrend(x) {
    const m = mean(x);
    return x.map(v => v - m);
}

function estimateFs(tMs) {
    if (tMs.length < 3) return 30;
    const d = [];
    for (let i = 1; i < tMs.length; i++) d.push((tMs[i] - tMs[i - 1]) / 1000);
    const md = mean(d);
    return Math.max(10, Math.min(60, 1 / Math.max(1e-6, md)));
}

function findPeaks(x, fs) {
    // simple local-max peaks with adaptive threshold + refractory
    const s = std(x);
    const thr = Math.max(1e-6, 0.6 * s);
    const minDist = Math.floor(fs * 0.32); // ~190 BPM max
    let peaks = [];
    let last = -1e9;

    for (let i = 1; i < x.length - 1; i++) {
        if (i - last < minDist) continue;
        const isPeak = x[i] > x[i - 1] && x[i] > x[i + 1] && x[i] > thr;
        if (isPeak) {
            peaks.push(i);
            last = i;
        }
    }
    return peaks;
}

function rmssdFromPeaks(tMs, peaks) {
    if (peaks.length < 4) return { bpm: null, rmssd: null, ibi: [], nIbiUsable: 0 };

    const ibi = [];
    for (let i = 1; i < peaks.length; i++) {
        ibi.push(tMs[peaks[i]] - tMs[peaks[i - 1]]); // ms
    }

    // Count usable IBI (valid range: 300-1500ms = 40-200 BPM)
    const usableIbi = ibi.filter(interval => interval >= 300 && interval <= 1500);
    const nIbiUsable = usableIbi.length;

    const meanIbi = mean(usableIbi.length > 0 ? usableIbi : ibi);
    const bpm = 60000 / Math.max(1e-6, meanIbi);

    const diffs = [];
    for (let i = 1; i < usableIbi.length; i++) {
        const d = usableIbi[i] - usableIbi[i - 1];
        diffs.push(d);
    }
    const rmssd = diffs.length > 0 ? Math.sqrt(mean(diffs.map(v => v * v))) : null;

    return { bpm, rmssd, ibi, nIbiUsable };
}

function qualityScore({ fs, peaks, rmssd, bpm, x }) {
    // heuristics: enough peaks + plausible bpm + plausible rmssd + enough amplitude
    let q = 0;
    const n = peaks.length;

    if (n >= 6) q += 0.35;
    else if (n >= 4) q += 0.20;

    if (bpm && bpm >= 45 && bpm <= 160) q += 0.25;
    if (rmssd && rmssd >= 5 && rmssd <= 180) q += 0.20;

    const amp = std(x);
    if (amp > 0.003) q += 0.20; // depends on your ROI scale

    // clamp
    q = Math.max(0, Math.min(1, q));
    return q;
}

function compute(windowMs) {
    // keep last windowMs
    const now = bufT.length ? bufT[bufT.length - 1] : 0;
    const cut = now - windowMs;
    let i0 = 0;
    while (i0 < bufT.length && bufT[i0] < cut) i0++;
    const t = bufT.slice(i0);
    const x0 = bufX.slice(i0);
    if (t.length < 90) return null;

    const fs = estimateFs(t);

    // detrend + bandpass (HP 0.7Hz, LP 3.0Hz)
    let x = detrend(x0);
    const hp = biquadCoeffs("highpass", 0.7, 0.707, fs);
    const lp = biquadCoeffs("lowpass", 3.0, 0.707, fs);
    x = applyBiquad(x, hp);
    x = applyBiquad(x, lp);

    // normalize (optional)
    const s = std(x);
    if (s > 1e-9) x = x.map(v => v / s);

    const peaks = findPeaks(x, fs);
    const { bpm, rmssd, nIbiUsable } = rmssdFromPeaks(t, peaks);
    const quality = qualityScore({ fs, peaks, rmssd, bpm, x });

    return { bpm, rmssd, quality, nPeaks: peaks.length, nIbiUsable };
}

self.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === "reset") {
        bufT = [];
        bufX = [];
        lastMetrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0, nIbiUsable: 0 };
        self.postMessage({ type: "metrics", ...lastMetrics });
        return;
    }

    if (msg.type === "sample") {
        // msg: {t, x}
        bufT.push(msg.t);
        bufX.push(msg.x);
        // cap buffer (keep 90s)
        const capMs = 90000;
        const cut = msg.t - capMs;
        while (bufT.length && bufT[0] < cut) { bufT.shift(); bufX.shift(); }
        return;
    }

    if (msg.type === "compute") {
        // msg: {windowMs}
        const res = compute(msg.windowMs || 30000);
        if (!res) return;
        lastMetrics = res;
        self.postMessage({ type: "metrics", ...res });
    }
};
