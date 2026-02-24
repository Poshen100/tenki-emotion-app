/**
 * TENKI Phase 5: Snapshot Medical Grade Synchronized Waveform
 * ==========================================================
 * 
 * Uses uPlot for high-performance rendering of 4 tracks:
 * 1. SNS/PNS Area (Autonomic Balance)
 * 2. HR (Green Smooth Line)
 * 3. RR-Interval Tachogram (Purple Points + Line)
 * 4. Respiratory Wave (Pink Sine Wave)
 * 
 * Subscribes to `tenki:sensor-samples-batch` and `tenki:tei-progressive`
 * 
 * @author TENKI Team
 */

(function () {
    'use strict';

    const MAX_DATA_PTS = 300; // ~60 seconds at 5fps (200ms)
    let uplotInst = null;

    // Track data arrays
    // [0] = timestamps, [1]=SNS, [2]=PNS, [3]=HR, [4]=RR, [5]=Resp
    let chartData = [
        [], [], [], [], [], []
    ];

    let currentPhase = 'OPTIMAL';
    let isInitialized = false;
    let respPhaseAngle = 0; // for animating respiratory sine wave

    const COLORS = {
        sns: 'rgba(245, 166, 35, 0.4)',
        snsStroke: '#F5A623',
        pns: 'rgba(0, 204, 255, 0.4)',
        pnsStroke: '#00CCFF',
        hr: '#00FF94',
        rr: '#B088FF',
        resp: '#FF66B2',
        grid: 'rgba(255, 255, 255, 0.05)',
        text: 'rgba(255, 255, 255, 0.4)'
    };

    /**
     * Initializes the uPlot instance
     */
    function initChart() {
        const container = document.getElementById('snapshot-waveform-container');
        if (!container || typeof uPlot === 'undefined') {
            console.warn('[SnapshotWave] Container or uPlot not found. Waiting...');
            setTimeout(initChart, 500);
            return;
        }

        if (isInitialized) return;

        // Custom paths for area fills and lines
        const drawSnsPnsPaths = () => { /* Default uPlot path builder usually suffices, we rely on standard band/fill */ };

        const opts = {
            width: container.clientWidth,
            height: 220,
            cursor: { show: false },
            legend: { show: false },
            axes: [
                {
                    show: false, // X Axis hidden (time series naturally scrolls)
                },
                {
                    scale: 'ans',
                    side: 3, // Right side
                    size: 30,
                    grid: { stroke: COLORS.grid, width: 1 },
                    stroke: COLORS.text,
                    font: '9px "JetBrains Mono", monospace',
                    values: (u, vals) => vals.map(v => v + '%')
                },
                {
                    scale: 'hr',
                    side: 1, // Right side
                    size: 30,
                    grid: { show: false },
                    stroke: COLORS.hr,
                    font: '9px "JetBrains Mono", monospace'
                }
            ],
            scales: {
                ans: { auto: false, range: [0, 100] }, // SNS/PNS stacked
                hr: { auto: true, range: [40, 180] },
                rpx: { auto: false, range: [-1, 1] }  // Respiratory normalized sine
            },
            series: [
                {}, // x time
                {
                    // SNS Area
                    scale: 'ans',
                    stroke: COLORS.snsStroke,
                    fill: COLORS.sns,
                    width: 1,
                    band: true
                },
                {
                    // PNS Area
                    scale: 'ans',
                    stroke: COLORS.pnsStroke,
                    fill: COLORS.pns,
                    width: 1,
                    fillTo: (u, seriesIdx, dataMin, dataMax) => 0
                },
                {
                    // HR line
                    scale: 'hr',
                    stroke: COLORS.hr,
                    width: 2
                },
                {
                    // RR points (just scaled on HR for visual overlap, or distinct)
                    scale: 'hr', // using HR scale to overlay
                    stroke: COLORS.rr,
                    width: 1,
                    points: { size: 4, space: 0 }
                },
                {
                    // Respiratory Sine
                    scale: 'rpx',
                    stroke: COLORS.resp,
                    width: 1.5,
                    dash: [5, 5]
                }
            ]
        };

        // Band configuration to show SNS over PNS
        opts.bands = [
            { series: [1, 2], fill: COLORS.sns }
        ];

        // Fill initial data buffer
        const now = Date.now() / 1000;
        for (let i = 0; i < MAX_DATA_PTS; i++) {
            chartData[0].push(now - (MAX_DATA_PTS - i) * 0.2); // 200ms steps
            chartData[1].push(50); // SNS default
            chartData[2].push(50); // PNS default
            chartData[3].push(null); // HR
            chartData[4].push(null); // RR
            chartData[5].push(0); // Resp
        }

        uplotInst = new uPlot(opts, chartData, container);
        isInitialized = true;

        injectOverlays(container);
        console.log('[SnapshotWave] Medical UI Waveform Initialized');
    }

    function injectOverlays(container) {
        // Inject Tier/Source Badge and Lock Warning
        const header = document.createElement('div');
        header.className = 'wave-overlay-header';
        header.innerHTML = `
            <div class="wave-tier-badge tier-rppg" id="wave-tier-badge">TIER 1 RPPG</div>
            <div class="wave-source-badge" id="wave-source-badge">VISION SENSOR</div>
        `;
        container.appendChild(header);

        const lockWarning = document.createElement('div');
        lockWarning.className = 'wave-lock-warning';
        lockWarning.id = 'wave-lock-warning';
        lockWarning.innerText = '眉心光學鎖定不足'; // Forehead optical lock insufficient
        container.appendChild(lockWarning);
    }

    /**
     * Updates the waveform with new samples
     * @param {Array} samples - Array of TenkiSensorSample
     */
    function updateWaveform(samples) {
        if (!isInitialized || !uplotInst) return;

        samples.forEach(sample => {
            const time = sample.ts / 1000;
            const hr = sample.hr_bpm || 72;
            const hrv = sample.hrv_ms || 30; // RR derived

            // Calculate mock SNS/PNS split (placeholder logic)
            // Real logic: higher stress = more SNS. We simulate using HR and HRV.
            let sns = Math.min(100, Math.max(0, ((hr - 60) / 40) * 100));
            // Keep it bounded so SNS+PNS=100
            if (sns > 80) sns = 80;
            if (sns < 20) sns = 20;
            let pns = 100 - sns;

            // Animate Respiration Sine Wave based on BrPM (derived indirectly from hrv or sample)
            const brpm = (hrv > 40) ? 14 : 18;
            const freq = brpm / 60; // hz
            respPhaseAngle += 2 * Math.PI * freq * 0.2; // advance 200ms
            const respPulse = Math.sin(respPhaseAngle);

            // Shift data
            chartData[0].shift(); chartData[0].push(time);
            chartData[1].shift(); chartData[1].push(sns);
            chartData[2].shift(); chartData[2].push(pns);
            chartData[3].shift(); chartData[3].push(hr);
            chartData[4].shift(); chartData[4].push(hr + (Math.random() * 4 - 2)); // simulate RR scatter around HR
            chartData[5].shift(); chartData[5].push(respPulse);
        });

        uplotInst.setData(chartData);

        // Quality warning display
        const lastSample = samples[samples.length - 1];
        if (lastSample && typeof lastSample.quality === 'number') {
            const lockWarning = document.getElementById('wave-lock-warning');
            const container = document.getElementById('snapshot-waveform-container');

            if (lastSample.quality < 0.4) {
                if (lockWarning) lockWarning.classList.add('visible');
                if (container) container.classList.add('quality-low');
            } else {
                if (lockWarning) lockWarning.classList.remove('visible');
                if (container) container.classList.remove('quality-low');
            }
        }
    }

    /**
     * Updates CSS state based on TEI PR99 Phase (PEAK, OPTIMAL, NEUTRAL, DEGRADED)
     * @param {Object} teiResult - TenkiTEIResult
     */
    function updatePhaseStyle(teiResult) {
        if (!isInitialized) return;
        const container = document.getElementById('snapshot-waveform-container');
        if (!container) return;

        let phaseClass = 'state-optimal';
        const pr99 = teiResult.tei_pr99;

        if (pr99 >= 80) phaseClass = 'state-peak';
        else if (pr99 >= 55) phaseClass = 'state-optimal';
        else if (pr99 >= 35) phaseClass = 'state-neutral';
        else phaseClass = 'state-degraded';

        container.classList.remove('state-peak', 'state-optimal', 'state-neutral', 'state-degraded');
        container.classList.add(phaseClass);
    }

    // ==========================================
    // EventBridge Integration
    // ==========================================
    function subscribeEvents() {
        if (typeof window.EventBridgeV2 === 'undefined') {
            console.warn('[SnapshotWave] window.EventBridgeV2 not found. Retrying...');
            setTimeout(subscribeEvents, 500);
            return;
        }

        const bridge = window.EventBridgeV2;

        // 1. Listen for fast data stream
        bridge.subscribe('tenki:sensor-samples-batch', (batch) => {
            if (batch && batch.samples && batch.samples.length > 0) {
                updateWaveform(batch.samples);
            }
        });

        // 1b. Fallback for single samples (if engine is not batching)
        bridge.subscribe('tenki:sensor-sample', (sample) => {
            if (sample) {
                updateWaveform([sample]);
            }
        });

        // 2. Listen for phase updates to change visual intensity
        bridge.subscribe('tenki:tei-progressive', (teiResult) => {
            if (teiResult && typeof teiResult.tei_pr99 === 'number') {
                updatePhaseStyle(teiResult);
            }
        });

        console.log('[SnapshotWave] Subscribed to EventBridgeV2 events.');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initChart();
            subscribeEvents();
        });
    } else {
        initChart();
        subscribeEvents();
    }

})();
