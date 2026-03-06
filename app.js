/**
 * TENKI App — 主流程控制器
 * 
 * Landing → Camera → Scan → Results
 * 
 * 這個檔案替換原有的 app.js (原版已備份在 apps/web/)
 */

document.addEventListener('DOMContentLoaded', () => {
    const audio = new TenkiAudio();
    const haptics = new TenkiHaptics(audio);
    const renderer = new ResultsRenderer();

    const scanUX = new ScanUX({
        audio, haptics, renderer,
        baseline: BaselineSim,
    });

    const startBtn = document.getElementById('start-btn');
    const landing = document.getElementById('landing');
    const resultsPage = document.getElementById('results-page');
    const camera = document.getElementById('camera');

    // 音效開關
    const soundBtn = document.getElementById('sound-toggle');
    let soundOn = true;
    soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        audio.setEnabled(soundOn);
        soundBtn.textContent = soundOn ? '🔊' : '🔇';
    });

    startBtn.addEventListener('click', async () => {
        // Init audio (requires user gesture)
        audio.init();

        // 請求相機
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: false,
            });
            camera.srcObject = stream;
            await camera.play();
        } catch (err) {
            alert('需要前鏡頭權限才能掃描。請在設定中允許相機存取。');
            return;
        }

        // 過場動畫: landing 淡出
        landing.classList.add('fade-out');
        setTimeout(() => {
            landing.classList.add('hidden');
            resultsPage.classList.remove('hidden');
            resultsPage.classList.add('fade-in');
        }, 400);

        // 啟動 rPPG 引擎
        // (rpgg.js 的 callback 會在每次偵測到心率時觸發)
        if (typeof startRppg === 'function') {
            startRppg(camera, (data) => {
                // data from rpgg.js: { hr, hrv, rr, sqi, ... }
                scanUX.onRppgData({
                    hr: data.hr || data.heartRate || 68,
                    hrv: data.hrv || data.hrvRmssd || 50,
                    rr: data.rr || data.respiratoryRate || 14,
                    sqi: data.sqi || data.signalQuality || 75,
                });
            });
        } else {
            // rPPG 引擎不可用 → 用模擬數據 (demo mode)
            console.warn('rPPG engine not available, using simulated data');
            setInterval(() => {
                scanUX.onRppgData({
                    hr: 68 + (Math.random() - 0.5) * 8,
                    hrv: 50 + (Math.random() - 0.5) * 15,
                    rr: 14 + (Math.random() - 0.5) * 3,
                    sqi: 85 + (Math.random() - 0.5) * 10,
                });
            }, 500);
        }

        // 啟動掃描 UX
        scanUX.start();
    });
});
