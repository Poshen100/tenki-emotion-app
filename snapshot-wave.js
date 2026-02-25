/**
 * TENKI — Snapshot Waveform Engine (Pure Canvas 2D)
 * ==================================================
 * Four-track biometric waveform in #snapshot-waveform-container.
 * Zero dependencies — uses only Canvas 2D API.
 *
 * Tracks:
 *  1. ANS (SNS orange-red + PNS cyan-blue area chart, midline = balance)
 *  2. HR  (green smooth curve, cardinal spline interpolation)
 *  3. RR  (purple tachogram scatter + connecting line)
 *  4. Resp (pink-purple sine wave derived from rr_brpm)
 *
 * Features:
 *  - SQI < 0.7 → grayscale filter + warning text
 *  - Tier badge (BLE = green Tier-1, rPPG = yellow Tier-3)
 *  - TEI modulation (PEAK=smooth 100% sat, DEGRADED=jitter+40% sat)
 *  - Demo mode (auto-activates 10s after load if no real data)
 *  - 30fps requestAnimationFrame loop
 *
 * @version 1.0.0
 * @author  TENKI Core Team
 */

(function (global) {
    'use strict';

    // ── Constants ──
    const WINDOW_SEC = 30;
    const SAMPLE_INTERVAL_MS = 200;
    const MAX_POINTS = Math.ceil(WINDOW_SEC * 1000 / SAMPLE_INTERVAL_MS); // 150
    const TARGET_FPS = 30;
    const FRAME_MS = 1000 / TARGET_FPS;
    const CANVAS_H = 220;
    const DEMO_DELAY_MS = 10_000;

    // Track layout (fraction of canvas height)
    const TRACKS = [
        { name: 'ANS', top: 0.00, height: 0.28 },
        { name: 'HR', top: 0.30, height: 0.22 },
        { name: 'RR', top: 0.55, height: 0.18 },
        { name: 'Resp', top: 0.76, height: 0.20 },
    ];

    // Colors
    const C = {
        snsArea: 'rgba(255, 120, 80, 0.35)',
        snsLine: '#ff8c69',
        pnsArea: 'rgba(76, 201, 240, 0.35)',
        pnsLine: '#4cc9f0',
        hrLine: '#00FF88',
        hrGlow: 'rgba(0, 255, 136, 0.3)',
        rrDot: '#B088FF',
        rrLine: 'rgba(176, 136, 255, 0.5)',
        respLine: '#FF66B2',
        respGlow: 'rgba(255, 102, 178, 0.2)',
        grid: 'rgba(255, 255, 255, 0.04)',
        text: 'rgba(255, 255, 255, 0.35)',
        textDim: 'rgba(255, 255, 255, 0.2)',
        sqiWarn: 'rgba(255, 68, 68, 0.9)',
    };

    // ── Cardinal Spline Helper ──
    function cardinalSpline(points, tension, numOfSeg) {
        if (points.length < 4) return points;
        tension = tension != null ? tension : 0.5;
        numOfSeg = numOfSeg || 16;
        const pts = points.slice();
        pts.unshift(points[1], points[0]);
        pts.push(points[points.length - 2], points[points.length - 1]);
        const res = [];
        for (let i = 2; i < pts.length - 4; i += 2) {
            for (let t = 0; t <= numOfSeg; t++) {
                const tt = t / numOfSeg;
                const t2 = tt * tt;
                const t3 = t2 * tt;
                const s = (1 - tension) / 2;
                const c1 = 2 * t3 - 3 * t2 + 1;
                const c2 = t3 - 2 * t2 + tt;
                const c3 = -2 * t3 + 3 * t2;
                const c4 = t3 - t2;
                const x = c1 * pts[i] + c2 * s * (pts[i + 2] - pts[i - 2]) +
                    c3 * pts[i + 2] + c4 * s * (pts[i + 4] - pts[i]);
                const y = c1 * pts[i + 1] + c2 * s * (pts[i + 3] - pts[i - 1]) +
                    c3 * pts[i + 3] + c4 * s * (pts[i + 5] - pts[i + 1]);
                res.push(x, y);
            }
        }
        return res;
    }

    // ── WaveformEngine Class ──

    class WaveformEngine {
        constructor(container) {
            if (!container) return;
            this._container = container;
            this._canvas = document.createElement('canvas');
            this._canvas.style.cssText = 'width:100%;height:' + CANVAS_H + 'px;display:block;border-radius:16px;';
            container.appendChild(this._canvas);
            this._ctx = this._canvas.getContext('2d');

            // DPR scaling
            this._dpr = window.devicePixelRatio || 1;
            this._resize();
            window.addEventListener('resize', () => this._resize());

            // Data buffers (sliding window 30s)
            this._buffers = {
                timestamps: [],
                hr: [],
                hrv: [],
                rr: [],
                sns: [],
                pns: [],
                quality: [],
            };

            // State
            this._source = 'rppg';
            this._teiPR99 = 50;
            this._lastQuality = 1.0;
            this._raf = null;
            this._lastFrame = 0;
            this._realDataReceived = false;
            this._demoTimer = null;
            this._demoRunning = false;
            this._demoPhase = 0;

            // Start render loop
            this._loop = this._loop.bind(this);
            this._raf = requestAnimationFrame(this._loop);

            // Schedule demo mode
            this._demoTimer = setTimeout(() => {
                if (!this._realDataReceived) {
                    this._startDemo();
                }
            }, DEMO_DELAY_MS);
        }

        // ── Public API ──

        push(dataPoint) {
            // dataPoint: { ts, hr, hrv, rr, sns, pns, quality, source, tei_pr99 }
            this._realDataReceived = true;
            if (this._demoRunning) this._stopDemo();

            const b = this._buffers;
            b.timestamps.push(dataPoint.ts || Date.now());
            b.hr.push(dataPoint.hr ?? 72);
            b.hrv.push(dataPoint.hrv ?? 42);
            b.rr.push(dataPoint.rr ?? 16);
            b.sns.push(dataPoint.sns ?? 48);
            b.pns.push(dataPoint.pns ?? 52);
            b.quality.push(dataPoint.quality ?? 1.0);

            if (dataPoint.source) this._source = dataPoint.source;
            if (dataPoint.tei_pr99 != null) this._teiPR99 = dataPoint.tei_pr99;
            this._lastQuality = dataPoint.quality ?? 1.0;

            // Trim to window
            while (b.timestamps.length > MAX_POINTS) {
                Object.keys(b).forEach(k => b[k].shift());
            }
        }

        destroy() {
            if (this._raf) cancelAnimationFrame(this._raf);
            if (this._demoTimer) clearTimeout(this._demoTimer);
            this._stopDemo();
        }

        // ── Resize ──

        _resize() {
            const rect = this._container.getBoundingClientRect();
            const w = rect.width || 340;
            this._w = w;
            this._h = CANVAS_H;
            this._canvas.width = w * this._dpr;
            this._canvas.height = CANVAS_H * this._dpr;
            this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        }

        // ── Main Render Loop (30fps) ──

        _loop(ts) {
            this._raf = requestAnimationFrame(this._loop);
            if (ts - this._lastFrame < FRAME_MS) return;
            this._lastFrame = ts;
            this._render();
        }

        _render() {
            const ctx = this._ctx;
            const w = this._w, h = this._h;
            const b = this._buffers;
            const n = b.timestamps.length;

            // Clear
            ctx.clearRect(0, 0, w, h);

            // Background
            ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
            ctx.fillRect(0, 0, w, h);

            // Grid lines
            this._drawGrid(ctx, w, h);

            // SQI gating
            if (this._lastQuality < 0.7) {
                this._applySQIFilter(ctx, w, h);
            }

            // TEI modulation setup
            const teiMod = this._getTEIMod();

            if (n >= 2) {
                this._drawTrack1_ANS(ctx, w, h, b, n, teiMod);
                this._drawTrack2_HR(ctx, w, h, b, n, teiMod);
                this._drawTrack3_RR(ctx, w, h, b, n, teiMod);
                this._drawTrack4_Resp(ctx, w, h, b, n, teiMod);
            }

            // Overlays
            this._drawTierBadge(ctx);
            this._drawTrackLabels(ctx, h);

            // SQI warning text on top
            if (this._lastQuality < 0.7) {
                this._drawSQIWarning(ctx, w, h);
            }
        }

        // ── Grid ──

        _drawGrid(ctx, w, h) {
            ctx.strokeStyle = C.grid;
            ctx.lineWidth = 1;
            // Horizontal grid lines at track boundaries
            for (const track of TRACKS) {
                const y = Math.round(track.top * h) + 0.5;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            // Vertical grid (every 5 seconds = 25 points)
            const step = w / 6;
            for (let i = 1; i < 6; i++) {
                const x = Math.round(i * step) + 0.5;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
        }

        // ── Track 1: ANS (SNS + PNS area) ──

        _drawTrack1_ANS(ctx, w, h, b, n, mod) {
            const track = TRACKS[0];
            const top = track.top * h;
            const th = track.height * h;
            const mid = top + th / 2;

            ctx.save();
            ctx.globalAlpha = mod.saturation;

            // SNS area (above midline)
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const val = (b.sns[i] - 50) / 50; // -1 to 1
                const y = mid - val * (th / 2) * 0.8 + (mod.jitter ? (Math.random() - 0.5) * mod.jitter : 0);
                if (i === 0) ctx.moveTo(x, mid);
                ctx.lineTo(x, Math.max(top, y));
            }
            ctx.lineTo(w, mid);
            ctx.closePath();
            ctx.fillStyle = C.snsArea;
            ctx.fill();

            // SNS line
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const val = (b.sns[i] - 50) / 50;
                const y = mid - val * (th / 2) * 0.8;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = C.snsLine;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // PNS area (below midline)
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const val = (b.pns[i] - 50) / 50;
                const y = mid + val * (th / 2) * 0.8 + (mod.jitter ? (Math.random() - 0.5) * mod.jitter : 0);
                if (i === 0) ctx.moveTo(x, mid);
                ctx.lineTo(x, Math.min(top + th, y));
            }
            ctx.lineTo(w, mid);
            ctx.closePath();
            ctx.fillStyle = C.pnsArea;
            ctx.fill();

            // PNS line
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const val = (b.pns[i] - 50) / 50;
                const y = mid + val * (th / 2) * 0.8;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = C.pnsLine;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Balance midline
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = C.textDim;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(w, mid);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.restore();
        }

        // ── Track 2: HR (cardinal spline) ──

        _drawTrack2_HR(ctx, w, h, b, n, mod) {
            const track = TRACKS[1];
            const top = track.top * h;
            const th = track.height * h;
            const pad = 4;

            // Normalize HR
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < n; i++) {
                if (b.hr[i] < min) min = b.hr[i];
                if (b.hr[i] > max) max = b.hr[i];
            }
            const range = max - min || 10;

            // Build point array for spline
            const pts = [];
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const y = top + pad + ((max - b.hr[i]) / range) * (th - pad * 2)
                    + (mod.jitter ? (Math.random() - 0.5) * mod.jitter : 0);
                pts.push(x, y);
            }

            // Cardinal spline interpolation
            const spline = pts.length >= 8 ? cardinalSpline(pts, 0.4, 6) : pts;

            ctx.save();
            ctx.globalAlpha = mod.saturation;

            // Glow
            ctx.shadowColor = C.hrGlow;
            ctx.shadowBlur = 10;
            ctx.strokeStyle = C.hrLine;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < spline.length; i += 2) {
                if (i === 0) ctx.moveTo(spline[0], spline[1]);
                else ctx.lineTo(spline[i], spline[i + 1]);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Crisp overlay
            ctx.globalAlpha = 0.5 * mod.saturation;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < spline.length; i += 2) {
                if (i === 0) ctx.moveTo(spline[0], spline[1]);
                else ctx.lineTo(spline[i], spline[i + 1]);
            }
            ctx.stroke();

            ctx.restore();
        }

        // ── Track 3: RR Tachogram (scatter + line) ──

        _drawTrack3_RR(ctx, w, h, b, n, mod) {
            const track = TRACKS[2];
            const top = track.top * h;
            const th = track.height * h;
            const pad = 4;

            // RR intervals from HRV (ms) → approximate RR in ms
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < n; i++) {
                const rr = 60000 / (b.hr[i] || 72); // ms per beat
                if (rr < min) min = rr;
                if (rr > max) max = rr;
            }
            const range = max - min || 100;

            ctx.save();
            ctx.globalAlpha = mod.saturation;

            // Connect line
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const rr = 60000 / (b.hr[i] || 72);
                const y = top + pad + ((max - rr) / range) * (th - pad * 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = C.rrLine;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Scatter dots
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const rr = 60000 / (b.hr[i] || 72);
                const y = top + pad + ((max - rr) / range) * (th - pad * 2)
                    + (mod.jitter ? (Math.random() - 0.5) * mod.jitter : 0);
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = C.rrDot;
                ctx.fill();
            }

            ctx.restore();
        }

        // ── Track 4: Respiratory (sine wave from rr_brpm) ──

        _drawTrack4_Resp(ctx, w, h, b, n, mod) {
            const track = TRACKS[3];
            const top = track.top * h;
            const th = track.height * h;
            const mid = top + th / 2;
            const amp = (th / 2) * 0.7;

            ctx.save();
            ctx.globalAlpha = mod.saturation;

            // Gradient fill under curve
            const grad = ctx.createLinearGradient(0, top, 0, top + th);
            grad.addColorStop(0, 'rgba(255, 102, 178, 0.15)');
            grad.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(0, mid);
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const rrBrpm = b.rr[i] || 16;
                const period = 1 / rrBrpm; // minutes per breath
                const phase = (i * SAMPLE_INTERVAL_MS / 1000) / (period * 60) * Math.PI * 2;
                const y = mid - Math.sin(phase) * amp * 0.8
                    + (mod.jitter ? (Math.random() - 0.5) * mod.jitter * 0.5 : 0);
                ctx.lineTo(x, y);
            }
            // Fill area
            ctx.lineTo(w, mid);
            ctx.lineTo(0, mid);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Line
            ctx.shadowColor = C.respGlow;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * w;
                const rrBrpm = b.rr[i] || 16;
                const period = 1 / rrBrpm;
                const phase = (i * SAMPLE_INTERVAL_MS / 1000) / (period * 60) * Math.PI * 2;
                const y = mid - Math.sin(phase) * amp * 0.8;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = C.respLine;
            ctx.lineWidth = 1.8;
            ctx.lineJoin = 'round';
            ctx.stroke();

            ctx.restore();
        }

        // ── SQI Filter ──

        _applySQIFilter(ctx, w, h) {
            // Draw a semi-transparent overlay to simulate desaturation
            ctx.save();
            ctx.globalCompositeOperation = 'saturation';
            ctx.fillStyle = 'hsl(0, 0%, 50%)';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        _drawSQIWarning(ctx, w, h) {
            ctx.save();
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = C.sqiWarn;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 500);
            ctx.fillText('⚠ SIGNAL QUALITY LOW', w / 2, h / 2);
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText('Move finger closer to lens · Stay still', w / 2, h / 2 + 16);
            ctx.restore();
        }

        // ── Tier Badge ──

        _drawTierBadge(ctx) {
            const src = this._source || 'rppg';
            const isBLE = src.toLowerCase().includes('ble') || src.toLowerCase().includes('rr');
            const label = isBLE ? 'Tier-1 BLE RR' : 'Tier-3 rPPG';
            const color = isBLE ? '#00FF94' : '#FFD93D';
            const bg = isBLE ? 'rgba(0, 255, 148, 0.15)' : 'rgba(255, 217, 61, 0.15)';

            ctx.save();
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            const tw = ctx.measureText(label).width;
            const px = 8, py = 8, pad = 5;

            // Badge bg
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.roundRect(px, py, tw + pad * 2, 16, 4);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Badge text
            ctx.fillStyle = color;
            ctx.textBaseline = 'middle';
            ctx.fillText(label, px + pad, py + 8);
            ctx.restore();
        }

        // ── Track Labels ──

        _drawTrackLabels(ctx, h) {
            ctx.save();
            ctx.font = '7px "JetBrains Mono", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textBaseline = 'top';
            const labels = ['SNS/PNS', 'HR', 'RR', 'RESP'];
            for (let i = 0; i < TRACKS.length; i++) {
                const y = TRACKS[i].top * h + 3;
                ctx.fillText(labels[i], this._w - ctx.measureText(labels[i]).width - 6, y);
            }
            ctx.restore();
        }

        // ── TEI Modulation ──

        _getTEIMod() {
            const tei = this._teiPR99;
            if (tei >= 80) {
                // PEAK: smooth, full saturation
                return { saturation: 1.0, jitter: 0 };
            } else if (tei >= 55) {
                // OPTIMAL: slight
                return { saturation: 0.9, jitter: 0 };
            } else if (tei >= 35) {
                // NEUTRAL: mild desaturation
                return { saturation: 0.7, jitter: 1 };
            } else {
                // DEGRADED: jitter + desaturated
                return { saturation: 0.4, jitter: 2 };
            }
        }

        // ── Demo Mode (simulated sinus rhythm) ──

        _startDemo() {
            if (this._demoRunning) return;
            this._demoRunning = true;
            this._demoPhase = 0;
            console.log('[SnapshotWave] No real data after 10s — starting demo mode 🎭');

            this._demoInterval = setInterval(() => {
                if (!this._demoRunning) return;
                this._demoPhase += 0.2;
                const t = this._demoPhase;

                this.push({
                    ts: Date.now(),
                    hr: 72 + Math.sin(t * 0.3) * 3 + (Math.random() - 0.5) * 1.5,
                    hrv: 42 + Math.sin(t * 0.2) * 8 + (Math.random() - 0.5) * 3,
                    rr: 16 + Math.sin(t * 0.15) * 2 + (Math.random() - 0.5) * 0.5,
                    sns: 48 + Math.sin(t * 0.4) * 6 + (Math.random() - 0.5) * 2,
                    pns: 52 + Math.sin(t * 0.35 + 1) * 5 + (Math.random() - 0.5) * 2,
                    quality: 0.85 + Math.sin(t * 0.1) * 0.1,
                    source: 'demo',
                    tei_pr99: 55 + Math.sin(t * 0.08) * 15,
                });

                // Also feed TEI to SpectrumEngine if available
                if (global.SpectrumEngine) {
                    global.SpectrumEngine.apply(Math.round(55 + Math.sin(t * 0.08) * 15));
                }
            }, SAMPLE_INTERVAL_MS);
        }

        _stopDemo() {
            this._demoRunning = false;
            if (this._demoInterval) {
                clearInterval(this._demoInterval);
                this._demoInterval = null;
            }
        }
    }

    // ============================================================
    // Auto-init & EventBridge Wiring
    // ============================================================

    let _engine = null;

    function init() {
        const container = document.getElementById('snapshot-waveform-container');
        if (!container) {
            console.warn('[SnapshotWave] #snapshot-waveform-container not found, retrying…');
            setTimeout(init, 1000);
            return;
        }

        // Clear any old content (uPlot etc.)
        container.innerHTML = '';
        _engine = new WaveformEngine(container);
        global.TenkiWaveformEngine = _engine;

        console.log('[SnapshotWave] WaveformEngine initialized ✓');

        // ── Subscribe to EventBridgeV2 ──
        _wireEvents();
    }

    function _wireEvents() {
        // EventBridgeV2 (priority)
        function tryV2() {
            if (global.EventBridgeV2) {
                global.EventBridgeV2.addEventListener('tenki:sensor-samples-batch', (e) => {
                    const { samples } = e.detail || {};
                    if (!Array.isArray(samples) || !_engine) return;
                    samples.forEach(s => {
                        _engine.push({
                            ts: s.ts || Date.now(),
                            hr: s.hr_bpm,
                            hrv: s.hrv_ms,
                            rr: s.rr_brpm ?? 16,
                            sns: s.sns ?? 48,
                            pns: s.pns ?? 52,
                            quality: s.quality ?? 1.0,
                            source: s.source || 'rppg',
                        });
                    });
                });

                global.EventBridgeV2.addEventListener('tenki:tei-progressive', (e) => {
                    const d = e.detail || e;
                    if (d.tei_pr99 != null && _engine) {
                        _engine._teiPR99 = d.tei_pr99;
                    }
                });

                console.log('[SnapshotWave] EventBridgeV2 subscribed ✓');
                return true;
            }
            return false;
        }

        if (!tryV2()) {
            // Retry up to 30 times
            let attempts = 0;
            const retryId = setInterval(() => {
                if (tryV2() || ++attempts >= 30) clearInterval(retryId);
            }, 500);
        }

        // Legacy EventBridge fallback
        if (typeof EventBridge !== 'undefined') {
            try {
                EventBridge.on('tei:updated', (d) => {
                    if (!_engine || !d) return;
                    _engine.push({
                        ts: Date.now(),
                        hr: d.hr ?? d.hr_bpm,
                        hrv: d.hrv ?? d.hrv_ms,
                        rr: d.rr ?? 16,
                        sns: d.sns ?? 48,
                        pns: d.pns ?? 52,
                        quality: d.quality ?? d.sqi ?? 1.0,
                        source: d.source || 'rppg',
                        tei_pr99: d.tei ?? d.tei_pr99,
                    });
                });
            } catch (e) { }
        }

        // DOM event fallbacks
        document.addEventListener('tei:update', (e) => {
            const d = e.detail || {};
            if (!_engine) return;
            _engine.push({
                ts: Date.now(),
                hr: d.hr ?? 72,
                hrv: d.hrv ?? 42,
                rr: d.rr ?? 16,
                sns: d.sns ?? 48,
                pns: d.pns ?? 52,
                quality: d.quality ?? 1.0,
                source: d.source || 'rppg',
                tei_pr99: d.tei,
            });
        });
        document.addEventListener('tei:updated', (e) => {
            const d = e.detail || {};
            if (!_engine) return;
            if (d.tei != null) _engine._teiPR99 = d.tei;
        });

        // Also wire TenkiEngine waveform stream
        if (global.TenkiEngine && typeof global.TenkiEngine.onWaveformData === 'function') {
            global.TenkiEngine.onWaveformData((d) => {
                if (_engine) _engine.push(d);
            });
        }
    }

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 200);
    }

    // Export
    global.WaveformEngine = WaveformEngine;

})(typeof window !== 'undefined' ? window : globalThis);
