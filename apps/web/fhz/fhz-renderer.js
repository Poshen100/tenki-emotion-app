/**
 * FHZ Renderer — DOM Construction & Updates
 * Builds the full-screen FHZ overlay inline. No external HTML templates.
 * Depends: TENKI_FHZ_PURPOSES, TENKI_FHZ_SM
 */
(function (global) {
  'use strict';

  var root = null;
  var els = {};

  var STATE_LABELS = {
    NOT_DETECTED: { en: 'PLACE FINGER', zh: '請將手指覆蓋鏡頭' },
    ALIGNING:     { en: 'ALIGNING',     zh: '對準中⋯保持不動' },
    STABILIZING:  { en: 'STABILIZING',  zh: '穩定中⋯即將就緒' },
    READY:        { en: 'READY',        zh: '就緒！可以開始掃描' },
  };

  function icon(name, extra) {
    return '<span class="ferrari-icon' + (extra ? ' ' + extra : '') + '">' + name + '</span>';
  }

  function buildDOM() {
    if (root) return root;

    root = document.createElement('div');
    root.className = 'fhz-screen';
    root.id = 'fhz-screen';

    var purposes = global.TENKI_FHZ_PURPOSES;
    var purposeTabsHTML = '';
    if (purposes) {
      purposes.PURPOSE_ORDER.forEach(function (key) {
        var p = purposes.PURPOSES[key];
        purposeTabsHTML +=
          '<div class="fhz-purpose-tab" data-purpose="' + key + '" style="color:' + p.color + '">' +
            icon(p.icon) +
            '<span class="fhz-purpose-label">' + p.labelZh + '</span>' +
          '</div>';
      });
    }

    root.innerHTML =
      '<div class="fhz-header">' +
        '<button class="fhz-back" id="fhz-back">' + icon('arrow_back') + '</button>' +
        '<span class="fhz-title">FINGER HEAT ZONE</span>' +
        '<span class="fhz-spacer"></span>' +
      '</div>' +
      '<div class="fhz-purpose-bar" id="fhz-purpose-bar">' + purposeTabsHTML + '</div>' +
      '<div class="fhz-camera-panel">' +
        '<video class="fhz-camera-video" id="fhz-video" autoplay playsinline muted></video>' +
        '<div class="fhz-roi-ring" id="fhz-roi-ring" data-state="NOT_DETECTED"></div>' +
      '</div>' +
      '<div class="fhz-state-label" id="fhz-state-label" data-state="NOT_DETECTED">' +
        '<div class="fhz-state-en" id="fhz-state-en">PLACE FINGER</div>' +
        '<div class="fhz-state-zh" id="fhz-state-zh">請將手指覆蓋鏡頭</div>' +
      '</div>' +
      '<div class="fhz-meters">' +
        '<div class="fhz-meter">' +
          '<span class="fhz-meter-label">COVERAGE</span>' +
          '<div class="fhz-meter-track"><div class="fhz-meter-fill fhz-fill-coverage" id="fhz-bar-coverage"></div></div>' +
          '<span class="fhz-meter-value" id="fhz-val-coverage">0</span>' +
        '</div>' +
        '<div class="fhz-meter">' +
          '<span class="fhz-meter-label">STABILITY</span>' +
          '<div class="fhz-meter-track"><div class="fhz-meter-fill fhz-fill-stability" id="fhz-bar-stability"></div></div>' +
          '<span class="fhz-meter-value" id="fhz-val-stability">0</span>' +
        '</div>' +
        '<div class="fhz-meter">' +
          '<span class="fhz-meter-label">SQI</span>' +
          '<div class="fhz-meter-track"><div class="fhz-meter-fill fhz-fill-sqi" id="fhz-bar-sqi"></div></div>' +
          '<span class="fhz-meter-value" id="fhz-val-sqi">0</span>' +
        '</div>' +
      '</div>' +
      '<div class="fhz-checklist" id="fhz-checklist">' +
        '<div class="fhz-check-item" id="fhz-chk-camera">' + icon('videocam') + ' Camera focused</div>' +
        '<div class="fhz-check-item" id="fhz-chk-finger">' + icon('fingerprint') + ' Finger covered</div>' +
        '<div class="fhz-check-item" id="fhz-chk-stable">' + icon('timer') + ' Stable 3 sec</div>' +
        '<div class="fhz-check-item" id="fhz-chk-sqi">' + icon('verified') + ' SQI passed</div>' +
      '</div>' +
      '<div class="fhz-action-bar">' +
        '<button class="fhz-commit-btn" id="fhz-commit-btn" disabled>' +
          icon('play_arrow') + ' BEGIN SCAN' +
        '</button>' +
      '</div>';

    document.body.appendChild(root);

    els.video      = root.querySelector('#fhz-video');
    els.roiRing    = root.querySelector('#fhz-roi-ring');
    els.stateLabel = root.querySelector('#fhz-state-label');
    els.stateEn    = root.querySelector('#fhz-state-en');
    els.stateZh    = root.querySelector('#fhz-state-zh');
    els.barCov     = root.querySelector('#fhz-bar-coverage');
    els.barStab    = root.querySelector('#fhz-bar-stability');
    els.barSqi     = root.querySelector('#fhz-bar-sqi');
    els.valCov     = root.querySelector('#fhz-val-coverage');
    els.valStab    = root.querySelector('#fhz-val-stability');
    els.valSqi     = root.querySelector('#fhz-val-sqi');
    els.chkCamera  = root.querySelector('#fhz-chk-camera');
    els.chkFinger  = root.querySelector('#fhz-chk-finger');
    els.chkStable  = root.querySelector('#fhz-chk-stable');
    els.chkSqi     = root.querySelector('#fhz-chk-sqi');
    els.commitBtn  = root.querySelector('#fhz-commit-btn');
    els.backBtn    = root.querySelector('#fhz-back');
    els.purposeBar = root.querySelector('#fhz-purpose-bar');

    return root;
  }

  function show() {
    if (!root) buildDOM();
    root.style.display = '';
    void root.offsetHeight;
    root.classList.add('fhz-visible');
  }

  function hide() {
    if (!root) return;
    root.classList.remove('fhz-visible');
    setTimeout(function () {
      if (root) root.style.display = 'none';
    }, 400);
  }

  function updateMeters(metrics) {
    if (!els.barCov) return;
    var cov = Math.round(metrics.coverage);
    var stab = Math.round(metrics.stability);
    var sqi = Math.round(metrics.sqi);
    els.barCov.style.width  = cov + '%';
    els.barStab.style.width = stab + '%';
    els.barSqi.style.width  = sqi + '%';
    els.valCov.textContent  = cov;
    els.valStab.textContent = stab;
    els.valSqi.textContent  = sqi;
  }

  function updateState(state) {
    if (!els.roiRing) return;
    var label = STATE_LABELS[state] || STATE_LABELS.NOT_DETECTED;
    els.roiRing.setAttribute('data-state', state);
    els.stateLabel.setAttribute('data-state', state);
    els.stateEn.textContent = label.en;
    els.stateZh.textContent = label.zh;
    els.commitBtn.disabled = (state !== 'READY');
  }

  function updateChecklist(checks) {
    if (!els.chkCamera) return;
    toggleCheck(els.chkCamera, checks.cameraFocused);
    toggleCheck(els.chkFinger, checks.fingerCovered);
    toggleCheck(els.chkStable, checks.stable3Sec);
    toggleCheck(els.chkSqi,    checks.sqiPassed);
  }

  function toggleCheck(el, pass) {
    if (pass) {
      el.classList.add('fhz-check-pass');
    } else {
      el.classList.remove('fhz-check-pass');
    }
  }

  function updatePurpose(purposeId) {
    if (!els.purposeBar) return;
    var tabs = els.purposeBar.querySelectorAll('.fhz-purpose-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-purpose') === purposeId) {
        tabs[i].classList.add('fhz-purpose-active');
      } else {
        tabs[i].classList.remove('fhz-purpose-active');
      }
    }
  }

  function getElements() {
    return els;
  }

  global.TENKI_FHZ_RENDERER = {
    buildDOM: buildDOM,
    show: show,
    hide: hide,
    updateMeters: updateMeters,
    updateState: updateState,
    updateChecklist: updateChecklist,
    updatePurpose: updatePurpose,
    getElements: getElements,
  };
})(window);
