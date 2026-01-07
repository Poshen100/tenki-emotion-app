// math-worker.js — TENKI v50 Math Worker

const MATH_CONFIG = {
  HR_BAND_LOW: 0.7,
  HR_BAND_HIGH: 4.0,
  RR_BAND_LOW: 0.1,
  RR_BAND_HIGH: 0.8,
  FPS: 30
};

function bandpass(signal) {
  // 先回傳原 signal（之後可換成真正的 filter）
  return signal.slice();
}

function calcHR(signalBuffer, fps) {
  if (signalBuffer.length < 30) return null;
  const signal = signalBuffer.map(s => s.signal);
  const filtered = bandpass(signal);

  const peaks = [];
  for (let i = 1; i < filtered.length - 1; i++) {
    if (filtered[i] > filtered[i - 1] && filtered[i] > filtered[i + 1]) {
      peaks.push(i);
    }
  }
  if (peaks.length < 2) return null;

  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
  const hr = (fps * 60) / avgInterval;
  return Math.max(40, Math.min(200, hr));
}

function calcHRV(signalBuffer, fps) {
  if (signalBuffer.length < 30) return null;
  const signal = signalBuffer.map(s => s.signal);
  const filtered = bandpass(signal);

  const peaks = [];
  for (let i = 1; i < filtered.length - 1; i++) {
    if (filtered[i] > filtered[i - 1] && filtered[i] > filtered[i + 1]) {
      peaks.push(i);
    }
  }
  if (peaks.length < 3) return null;

  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi_ms = (peaks[i] - peaks[i - 1]) / fps * 1000;
    intervals.push(ibi_ms);
  }

  let sumSq = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i - 1];
    sumSq += diff * diff;
  }
  const rmssd = Math.sqrt(sumSq / (intervals.length - 1));
  return Math.max(5, Math.min(200, rmssd));
}

function calcRR(signalBuffer, fps) {
  if (signalBuffer.length < 30) return null;
  const signal = signalBuffer.map(s => s.signal);
  const filtered = bandpass(signal);

  let peakCount = 0;
  for (let i = 1; i < filtered.length - 1; i++) {
    if (filtered[i] > filtered[i - 1] && filtered[i] > filtered[i + 1]) {
      peakCount++;
    }
  }
  const seconds = signalBuffer.length / fps;
  const rr = (peakCount / seconds) * 60;
  return Math.max(6, Math.min(40, rr));
}

function calcSQS(signalBuffer, env) {
  // 先給一個超簡單版：只看光線與動作
  let penalty = 0;

  if (env.roi_luma_mean < 60) penalty += 20;
  if (env.roi_luma_mean < 30) penalty += 20;
  if (env.motion > 0.5) penalty += 20;
  if (env.motion > 1.0) penalty += 20;

  const sqs = Math.max(0, 100 - penalty);
  let grade = "A";
  if (sqs < 60) grade = "D";
  else if (sqs < 75) grade = "C";
  else if (sqs < 90) grade = "B";

  return { sqs: Math.round(sqs), grade };
}

self.onmessage = function (event) {
  const { type, payload } = event.data;

  if (type === "COMPUTE_METRICS") {
    const { signalBuffer, envMetrics } = payload;
    if (!signalBuffer || signalBuffer.length < 30) {
      self.postMessage({
        type: "COMPUTE_ERROR",
        payload: { reason: "INSUFFICIENT_SIGNAL" }
      });
      return;
    }

    const hr = calcHR(signalBuffer, MATH_CONFIG.FPS);
    const hrv = calcHRV(signalBuffer, MATH_CONFIG.FPS);
    const rr = calcRR(signalBuffer, MATH_CONFIG.FPS);
    const sqsRes = calcSQS(signalBuffer, envMetrics || { roi_luma_mean: 80, motion: 0 });

    self.postMessage({
      type: "METRICS_COMPUTED",
      payload: {
        hr_bpm: hr,
        hrv_rmssd_ms: hrv,
        rr_brpm: rr,
        sqs: sqsRes.sqs,
        sqs_grade: sqsRes.grade,
        timestamp: Date.now()
      }
    });
  }
};

