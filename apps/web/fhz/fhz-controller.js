/**
 * FHZ Controller — Main Integrator
 * Manages camera stream (rear-facing), device motion, 10Hz tick loop.
 * Exposes TENKI_FHZ.open() / TENKI_FHZ.close() as public API.
 */
(function (global) {
  'use strict';

  var SM       = null;
  var METRICS  = null;
  var RENDERER = null;
  var PURPOSES = null;

  var stream       = null;
  var tickTimer    = null;
  var motionBound  = null;
  var currentState = 'NOT_DETECTED';
  var stableFor    = 0;
  var lastStableTs = 0;
  var activePurpose = 'HEALTH_RESET';
  var isOpen       = false;

  function ensureDeps() {
    SM       = global.TENKI_FHZ_SM;
    METRICS  = global.TENKI_FHZ_METRICS;
    RENDERER = global.TENKI_FHZ_RENDERER;
    PURPOSES = global.TENKI_FHZ_PURPOSES;
  }

  function startCamera() {
    var els = RENDERER.getElements();
    var video = els.video;
    if (!video) return Promise.reject(new Error('No video element'));

    var constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    };

    return navigator.mediaDevices.getUserMedia(constraints).then(function (s) {
      stream = s;
      video.srcObject = s;
      video.classList.add('fhz-camera-active');
      console.info('[FHZ] Camera started (rear-facing)');
    });
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    var els = RENDERER.getElements();
    if (els.video) {
      els.video.srcObject = null;
      els.video.classList.remove('fhz-camera-active');
    }
  }

  function startMotion() {
    motionBound = function (e) {
      var acc = e.accelerationIncludingGravity;
      if (!acc) return;
      METRICS.pushMotion({ x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 });
    };

    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function (perm) {
        if (perm === 'granted') {
          window.addEventListener('devicemotion', motionBound);
        }
      }).catch(function () {
        console.warn('[FHZ] DeviceMotion permission denied');
      });
    } else {
      window.addEventListener('devicemotion', motionBound);
    }
  }

  function stopMotion() {
    if (motionBound) {
      window.removeEventListener('devicemotion', motionBound);
      motionBound = null;
    }
  }

  function tick() {
    var els = RENDERER.getElements();
    var metrics = METRICS.computeMetrics(els.video);

    var now = Date.now();
    if (metrics.stability > SM.THRESHOLDS.STABILITY_READY) {
      if (!lastStableTs) lastStableTs = now;
      stableFor = (now - lastStableTs) / 1000;
    } else {
      lastStableTs = 0;
      stableFor = 0;
    }
    metrics.stableFor = stableFor;

    var newState = SM.transition(currentState, metrics);
    if (newState !== currentState) {
      currentState = newState;
      console.info('[FHZ] State → ' + currentState);
    }

    RENDERER.updateMeters(metrics);
    RENDERER.updateState(currentState);
    RENDERER.updateChecklist(SM.computeChecklist(metrics));
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, 100);
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function selectPurpose(purposeId) {
    if (!PURPOSES || !PURPOSES.PURPOSES[purposeId]) return;
    activePurpose = purposeId;
    RENDERER.updatePurpose(purposeId);
    console.info('[FHZ] Purpose → ' + purposeId);
  }

  function commitToScan() {
    if (currentState !== 'READY') return;

    console.info('[FHZ] Committing to scan with purpose: ' + activePurpose);

    var evt = new CustomEvent('tenki:fhz-commit', {
      detail: { purpose: activePurpose, state: currentState },
    });
    document.dispatchEvent(evt);

    close();

    var bridge = global.TENKI_BRIDGE;
    if (bridge && bridge.showResults) {
      bridge.showResults();
    }
  }

  function open(opts) {
    if (isOpen) return;
    isOpen = true;

    ensureDeps();
    METRICS.reset();
    currentState = 'NOT_DETECTED';
    stableFor = 0;
    lastStableTs = 0;

    RENDERER.buildDOM();
    RENDERER.updateState(currentState);

    var purpose = (opts && opts.purpose) || 'HEALTH_RESET';
    selectPurpose(purpose);

    RENDERER.show();
    bindEvents();

    startMotion();
    startCamera().catch(function (err) {
      console.warn('[FHZ] Camera failed:', err.message || err);
    });
    startTick();

    console.info('[FHZ] Opened');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    stopTick();
    stopCamera();
    stopMotion();
    RENDERER.hide();
    unbindEvents();

    console.info('[FHZ] Closed');
  }

  var boundHandlers = {};

  function bindEvents() {
    var els = RENDERER.getElements();

    boundHandlers.back = function () { close(); };
    if (els.backBtn) els.backBtn.addEventListener('click', boundHandlers.back);

    boundHandlers.commit = function () { commitToScan(); };
    if (els.commitBtn) els.commitBtn.addEventListener('click', boundHandlers.commit);

    boundHandlers.purposeClick = function (e) {
      var tab = e.target.closest('.fhz-purpose-tab');
      if (!tab) return;
      var pid = tab.getAttribute('data-purpose');
      if (pid) selectPurpose(pid);
    };
    if (els.purposeBar) els.purposeBar.addEventListener('click', boundHandlers.purposeClick);
  }

  function unbindEvents() {
    var els = RENDERER.getElements();
    if (els.backBtn && boundHandlers.back)
      els.backBtn.removeEventListener('click', boundHandlers.back);
    if (els.commitBtn && boundHandlers.commit)
      els.commitBtn.removeEventListener('click', boundHandlers.commit);
    if (els.purposeBar && boundHandlers.purposeClick)
      els.purposeBar.removeEventListener('click', boundHandlers.purposeClick);
    boundHandlers = {};
  }

  global.TENKI_FHZ = {
    open: open,
    close: close,
    getState: function () { return currentState; },
    getPurpose: function () { return activePurpose; },
  };
})(window);
