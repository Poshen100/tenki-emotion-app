/**
 * FHZ Metrics — MVP Mock
 * Computes coverage, stability, SQI from camera + device motion.
 * Replace computeMetrics() with real rPPG in Phase 1.
 */
(function (global) {
  'use strict';

  var motionBuffer = [];
  var MOTION_WINDOW = 20; // ~1s at 20Hz

  function sampleCenterBrightness(videoEl) {
    if (!videoEl || videoEl.readyState < 2) return 0;
    try {
      var canvas = document.createElement('canvas');
      var w = 64, h = 64;
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      var vw = videoEl.videoWidth || 320;
      var vh = videoEl.videoHeight || 240;
      var sx = (vw - vw * 0.4) / 2;
      var sy = (vh - vh * 0.4) / 2;
      ctx.drawImage(videoEl, sx, sy, vw * 0.4, vh * 0.4, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;
      var sum = 0;
      for (var i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      var avg = sum / (data.length / 4);
      // Finger on lens = dark / red-dominant frame
      // avg < 80 = high coverage; avg > 160 = low coverage
      var coverage = Math.max(0, Math.min(100, (180 - avg) * 1.2));
      return coverage;
    } catch (e) {
      return 0;
    }
  }

  function pushMotion(accel) {
    motionBuffer.push(accel);
    if (motionBuffer.length > MOTION_WINDOW) motionBuffer.shift();
  }

  function computeMotionStability() {
    if (motionBuffer.length < 5) return 0;
    var magnitudes = [];
    for (var i = 0; i < motionBuffer.length; i++) {
      var a = motionBuffer[i];
      magnitudes.push(Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z));
    }
    var sum = 0;
    for (var j = 0; j < magnitudes.length; j++) sum += magnitudes[j];
    var mean = sum / magnitudes.length;
    var variance = 0;
    for (var k = 0; k < magnitudes.length; k++) {
      variance += (magnitudes[k] - mean) * (magnitudes[k] - mean);
    }
    variance /= magnitudes.length;
    // Low variance = high stability
    var stability = Math.max(0, Math.min(100, 100 - variance * 80));
    return stability;
  }

  function computeMetrics(videoEl) {
    var coverage = sampleCenterBrightness(videoEl);
    var stability = computeMotionStability();
    var sqi = Math.max(
      0,
      Math.min(100, coverage * 0.5 + stability * 0.5 + (Math.random() - 0.5) * 6)
    );
    return { coverage: coverage, stability: stability, sqi: sqi };
  }

  function reset() {
    motionBuffer.length = 0;
  }

  global.TENKI_FHZ_METRICS = {
    computeMetrics: computeMetrics,
    pushMotion: pushMotion,
    reset: reset,
  };
})(window);
