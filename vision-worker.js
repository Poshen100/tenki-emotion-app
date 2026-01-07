// vision-worker.js  — TENKI v50 Vision Worker

const VISION_CONFIG = {
  ROI_SIZE: 50,
  ROI_COLOR_CHANNELS: 3,
  BUFFER_SIZE: 450,
  FPS_TARGET: 30
};

let signalBuffer = [];
let roiCoordinates = { x: 0, y: 0 };
let frameCount = 0;
let lastTimestamp = Date.now();
let fpsActual = 0;

// 簡化版 ROI（若未整合 MediaPipe faceBox，就先用整個影像）
function extractROI(imageData, faceBox) {
  const width = imageData.width;
  const height = imageData.height;

  let x, y, w, h;
  if (faceBox && faceBox.width) {
    x = faceBox.x;
    y = faceBox.y;
    w = faceBox.width;
    h = faceBox.height;
  } else {
    // 沒有臉資料就用畫面中心附近
    w = width * 0.4;
    h = height * 0.3;
    x = (width - w) / 2;
    y = (height - h) * 0.3;
  }

  roiCoordinates.x = x + w * 0.5;
  roiCoordinates.y = y + h * 0.35;

  const roiSize = VISION_CONFIG.ROI_SIZE;
  const roiX = Math.max(0, Math.floor(roiCoordinates.x - roiSize / 2));
  const roiY = Math.max(0, Math.floor(roiCoordinates.y - roiSize / 2));

  const roi = {
    x: roiX,
    y: roiY,
    width: Math.min(roiSize, width - roiX),
    height: Math.min(roiSize, height - roiY),
    data: null,
    stats: {}
  };

  const roiPixels = [];
  const pixels = imageData.data;
  const stride = width * 4;

  for (let row = 0; row < roi.height; row++) {
    for (let col = 0; col < roi.width; col++) {
      const pixelIdx = (roiY + row) * stride + (roiX + col) * 4;
      roiPixels.push({
        r: pixels[pixelIdx],
        g: pixels[pixelIdx + 1],
        b: pixels[pixelIdx + 2],
        a: pixels[pixelIdx + 3]
      });
    }
  }

  roi.data = roiPixels;

  let sumLuma = 0;
  let sumLumaSq = 0;
  let saturatedCount = 0;

  roiPixels.forEach(pixel => {
    const luma = pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114;
    sumLuma += luma;
    sumLumaSq += luma * luma;
    if (luma > 250) saturatedCount++;
  });

  roi.stats.luma_mean = sumLuma / roiPixels.length;
  roi.stats.luma_std = Math.sqrt(
    sumLumaSq / roiPixels.length - roi.stats.luma_mean ** 2
  );
  roi.stats.sat_ratio = saturatedCount / roiPixels.length;

  return roi;
}

function generateRPPG(roi) {
  if (!roi || !roi.data) return null;

  let r_sum = 0,
    g_sum = 0,
    b_sum = 0;
  roi.data.forEach(pixel => {
    r_sum += pixel.r;
    g_sum += pixel.g;
    b_sum += pixel.b;
  });

  const count = roi.data.length;
  const g = (g_sum / count) / 255;
  const r = (r_sum / count) / 255;
  const b = (b_sum / count) / 255;

  const signal = g * 1.5 - (r + b) * 0.5;
  return signal;
}

self.onmessage = function (event) {
  const { type, payload } = event.data;

  if (type === "FRAME_DATA") {
    const { imageData, faceBox, timestamp, frameId } = payload;

    frameCount++;
    const now = Date.now();
    if (now - lastTimestamp >= 1000) {
      fpsActual = frameCount;
      frameCount = 0;
      lastTimestamp = now;
    }

    const roi = extractROI(imageData, faceBox);
    if (!roi) return;

    const ppgSignal = generateRPPG(roi);
    if (ppgSignal == null) return;

    signalBuffer.push({
      timestamp,
      signal: ppgSignal,
      roiMetrics: roi.stats,
      frameId
    });

    if (signalBuffer.length > VISION_CONFIG.BUFFER_SIZE) {
      signalBuffer.shift();
    }

    if (frameId % 5 === 0) {
      self.postMessage({
        type: "VISION_STATUS",
        payload: {
          fps: fpsActual,
          signalBufferSize: signalBuffer.length,
          roiMetrics: roi.stats,
          frameId,
          timestamp
        }
      });
    }
  } else if (type === "GET_SIGNAL_BUFFER") {
    self.postMessage({
      type: "SIGNAL_BUFFER",
      payload: {
        buffer: signalBuffer.slice(-VISION_CONFIG.BUFFER_SIZE),
        size: signalBuffer.length,
        timestamp: Date.now()
      }
    });
  } else if (type === "RESET") {
    signalBuffer = [];
    frameCount = 0;
    lastTimestamp = Date.now();
    self.postMessage({ type: "RESET_ACK" });
  }
};

