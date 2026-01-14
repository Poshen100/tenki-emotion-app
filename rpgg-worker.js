// rpgg-worker.js (skeleton)

let mode = "lock"; // "lock" | "spectrum"
let frames = [];   // { t:number, meanG:number }

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function computeMetrics(){
  // TODO(next chunk): bandpass + peak detect + IBI filtering + RMSSD + quality
  const n = frames.length;

  return {
    ok: true,
    mode,
    quality: 0,
    bpm: null,
    rmssd: null,
    nIbiUsable: 0,
    gate: {
      qualityPass: false,
      ibiPass: false
    },
    debug: { nFrames: n }
  };
}

self.onmessage = (e) => {
  const msg = e.data || {};

  if (msg.type === "setMode") {
    mode = msg.mode || mode;
    self.postMessage({ type: "ack", mode });
    return;
  }

  if (msg.type === "pushFrame") {
    if (typeof msg.t === "number" && typeof msg.meanG === "number") {
      frames.push({ t: msg.t, meanG: msg.meanG });
      // keep last 90s max (safety)
      const tMin = msg.t - 90000;
      while (frames.length && frames[0].t < tMin) frames.shift();
    }
    return;
  }

  if (msg.type === "reset") {
    frames = [];
    self.postMessage({ type: "reset_ok" });
    return;
  }

  if (msg.type === "compute") {
    const metrics = computeMetrics();
    self.postMessage({ type: "metrics", metrics });
    return;
  }
};
