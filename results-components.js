/* =====================================================================
   results-components.js
   Results page bridge + dynamic component alignments (no engine edits)
   ===================================================================== */
(function (global) {
    'use strict';

    var POLL_MS = 450;
    var pollTimer = null;
    var observer = null;
    var lastBbHash = '';

    var state = {
        tei: 72,
        hr: 68,
        hrv: 52,
        rr: 14,
        stress: 25,
        sns: 38,
        pns: 62,
        bodyBattery: 78,
        bbSeries: null
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function asNumber(value) {
        var n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function toInt(value, fallback) {
        var n = parseInt(value, 10);
        return Number.isFinite(n) ? n : fallback;
    }

    function parsePercentText(value) {
        if (!value) return 0;
        var n = parseFloat(String(value).replace('%', ''));
        return Number.isFinite(n) ? n : 0;
    }

    function formatClock(totalSec) {
        if (!Number.isFinite(totalSec)) return null;
        var safe = Math.max(0, Math.floor(totalSec));
        var mm = String(Math.floor(safe / 60)).padStart(2, '0');
        var ss = String(safe % 60).padStart(2, '0');
        return mm + ':' + ss;
    }

    function hexToRgb(hex) {
        var clean = hex.replace('#', '');
        var value = clean.length === 3
            ? clean.split('').map(function (ch) { return ch + ch; }).join('')
            : clean;
        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16)
        };
    }

    function rgbToHex(rgb) {
        var r = clamp(Math.round(rgb.r), 0, 255).toString(16).padStart(2, '0');
        var g = clamp(Math.round(rgb.g), 0, 255).toString(16).padStart(2, '0');
        var b = clamp(Math.round(rgb.b), 0, 255).toString(16).padStart(2, '0');
        return '#' + r + g + b;
    }

    function mixColor(a, b, t) {
        var aa = hexToRgb(a);
        var bb = hexToRgb(b);
        var mix = {
            r: aa.r + (bb.r - aa.r) * t,
            g: aa.g + (bb.g - aa.g) * t,
            b: aa.b + (bb.b - aa.b) * t
        };
        return rgbToHex(mix);
    }

    function darken(hex, amount) {
        var rgb = hexToRgb(hex);
        var f = clamp(1 - amount, 0, 1);
        return rgbToHex({ r: rgb.r * f, g: rgb.g * f, b: rgb.b * f });
    }

    function isResultsVisible() {
        var root = document.getElementById('results-page');
        if (!root) return false;
        return !root.classList.contains('hidden');
    }

    function readNumericText(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        return toInt(el.textContent, fallback);
    }

    function readBbSeriesFromDom() {
        var chart = document.getElementById('bb-chart');
        if (!chart) return null;

        var bars = chart.querySelectorAll('.bb-bar');
        if (!bars.length) return null;

        var chartHeight = chart.getBoundingClientRect().height || 80;
        var values = [];

        bars.forEach(function (bar) {
            var h = parseFloat(bar.style.height);
            if (!Number.isFinite(h)) {
                var px = parseFloat(global.getComputedStyle(bar).height);
                h = Number.isFinite(px) ? (px / chartHeight) * 100 : null;
            }
            if (Number.isFinite(h)) {
                values.push(clamp(Math.round(h), 5, 100));
            }
        });

        return values.length ? values : null;
    }

    function readSnapshotFromDom() {
        return {
            tei: readNumericText('tei-display', state.tei),
            hr: readNumericText('bento-hr', state.hr),
            hrv: readNumericText('bento-hrv', state.hrv),
            rr: readNumericText('bento-rr', state.rr),
            stress: readNumericText('bento-stress', state.stress),
            sns: readNumericText('ans-sns-pct', state.sns),
            pns: readNumericText('ans-pns-pct', state.pns),
            bodyBattery: readNumericText('bb-value', state.bodyBattery),
            bbSeries: readBbSeriesFromDom()
        };
    }

    function ensureReadyClass() {
        var root = document.getElementById('results-page');
        if (!root) return;
        if (!root.classList.contains('rp-ready')) {
            root.classList.add('rp-ready');
        }
    }

    function ensureBottomSpacer() {
        var content = document.querySelector('#results-page .results-content');
        if (!content) return;
        if (content.querySelector('.rp-bottom-spacer')) return;

        var spacer = document.createElement('div');
        spacer.className = 'rp-bottom-spacer';
        content.appendChild(spacer);
    }

    function ensureStressTrack() {
        var segments = document.getElementById('stress-segments');
        if (!segments || !segments.parentElement) return null;

        var parent = segments.parentElement;
        var existing = parent.querySelector('.rp-stress-track');
        if (existing) return existing;

        var track = document.createElement('div');
        track.className = 'rp-stress-track';

        var fill = document.createElement('div');
        fill.className = 'rp-stress-fill';
        track.appendChild(fill);

        parent.insertBefore(track, segments.nextSibling);
        return track;
    }

    function updateStress(stress) {
        var safe = clamp(Math.round(stress), 0, 100);
        var track = ensureStressTrack();
        if (track) {
            var fill = track.querySelector('.rp-stress-fill');
            if (fill) fill.style.width = safe + '%';
        }

        var pct = document.getElementById('stress-pct');
        if (pct) pct.textContent = safe + '%';
    }

    function to24Points(series) {
        if (!Array.isArray(series) || !series.length) return null;
        if (series.length === 24) return series.slice(0, 24);

        var out = [];
        var maxIdx = series.length - 1;

        for (var i = 0; i < 24; i++) {
            var pos = (i / 23) * maxIdx;
            var lo = Math.floor(pos);
            var hi = Math.min(lo + 1, maxIdx);
            var t = pos - lo;
            var value = series[lo] + (series[hi] - series[lo]) * t;
            out.push(clamp(Math.round(value), 5, 100));
        }

        return out;
    }

    function defaultBbSeries(score) {
        var bb = [];
        var anchor = clamp(score || 78, 35, 95);

        for (var i = 0; i < 24; i++) {
            var phase = i / 23;
            var trend = 86 - phase * 34;
            var wave = Math.sin(i * 0.72) * 8 + Math.cos(i * 0.19) * 4;
            var drift = i > 18 ? -(i - 18) * 1.8 : 0;
            var value = trend + wave + drift;
            bb.push(clamp(Math.round(value), 20, 96));
        }

        bb[23] = anchor;
        return bb;
    }

    function bbTopColor(i, total) {
        var t = total <= 1 ? 0 : i / (total - 1);

        if (t < 0.45) {
            return mixColor('#34C759', '#00B4D8', t / 0.45);
        }
        if (t < 0.75) {
            return mixColor('#00B4D8', '#F5A623', (t - 0.45) / 0.30);
        }
        return mixColor('#F5A623', '#6B5528', (t - 0.75) / 0.25);
    }

    function renderBodyBattery(series, score) {
        var chart = document.getElementById('bb-chart');
        if (!chart) return;

        var normalized = to24Points(series) || defaultBbSeries(score);
        var hash = normalized.join(',');
        if (hash === lastBbHash) return;
        lastBbHash = hash;

        chart.innerHTML = '';

        normalized.forEach(function (value, idx) {
            var bar = document.createElement('div');
            bar.className = 'bb-bar rp-bb-bar';
            if (idx === normalized.length - 1) {
                bar.classList.add('last');
            }

            var top = bbTopColor(idx, normalized.length);
            var bottom = darken(top, 0.55);
            bar.style.height = clamp(value, 8, 100) + '%';
            bar.style.background = 'linear-gradient(180deg, ' + top + ' 0%, ' + bottom + ' 100%)';
            bar.style.opacity = String(0.42 + (idx / (normalized.length - 1 || 1)) * 0.56);
            chart.appendChild(bar);
        });

        var bbValue = document.getElementById('bb-value');
        if (bbValue && Number.isFinite(score)) {
            bbValue.textContent = String(clamp(Math.round(score), 0, 100));
        }
    }

    function updateAns(sns, pns) {
        var safeSns = clamp(Math.round(sns), 0, 100);
        var safePns = clamp(Math.round(Number.isFinite(pns) ? pns : 100 - safeSns), 0, 100);

        if (safeSns + safePns !== 100) {
            safePns = 100 - safeSns;
        }

        var snsBar = document.getElementById('ans-sns');
        var pnsBar = document.getElementById('ans-pns');
        var divider = document.getElementById('ans-divider');
        var snsPct = document.getElementById('ans-sns-pct');
        var pnsPct = document.getElementById('ans-pns-pct');

        if (snsBar) snsBar.style.width = safeSns + '%';
        if (pnsBar) pnsBar.style.width = safePns + '%';
        if (divider) divider.style.left = safeSns + '%';
        if (snsPct) snsPct.textContent = String(safeSns);
        if (pnsPct) pnsPct.textContent = String(safePns);
    }

    function ensureFdcbZoneLabel() {
        var center = document.querySelector('#fdcb-dock .fdcb-center');
        if (!center) return;
        if (center.querySelector('.rp-fdcb-zone-label')) return;

        var label = document.createElement('div');
        label.className = 'rp-fdcb-zone-label';
        label.textContent = 'Sweet Zone';
        center.appendChild(label);
    }

    function updateFdcbDetail() {
        var dock = document.getElementById('fdcb-dock');
        if (!dock) return;

        ensureFdcbZoneLabel();

        var fill = document.getElementById('fdcb-progress-fill');
        var width = fill ? parsePercentText(fill.style.width) : 0;
        var showDetail = width > 0 && width < 100;
        dock.classList.toggle('rp-show-detail', showDetail);
    }

    function mergeSnapshot(snapshot) {
        if (!snapshot) return;

        if (Number.isFinite(snapshot.tei)) state.tei = snapshot.tei;
        if (Number.isFinite(snapshot.hr)) state.hr = snapshot.hr;
        if (Number.isFinite(snapshot.hrv)) state.hrv = snapshot.hrv;
        if (Number.isFinite(snapshot.rr)) state.rr = snapshot.rr;
        if (Number.isFinite(snapshot.stress)) state.stress = snapshot.stress;
        if (Number.isFinite(snapshot.sns)) state.sns = snapshot.sns;
        if (Number.isFinite(snapshot.pns)) state.pns = snapshot.pns;
        if (Number.isFinite(snapshot.bodyBattery)) state.bodyBattery = snapshot.bodyBattery;
        if (Array.isArray(snapshot.bbSeries) && snapshot.bbSeries.length) state.bbSeries = snapshot.bbSeries;
    }

    function mergeEventDetail(detail) {
        if (!detail || typeof detail !== 'object') return;

        var hr = asNumber(detail.hr);
        if (hr === null) hr = asNumber(detail.hrBpm);

        var hrv = asNumber(detail.hrv);
        if (hrv === null) hrv = asNumber(detail.hrvRmssdMs);

        var rr = asNumber(detail.rr);
        if (rr === null) rr = asNumber(detail.rrBrpm);

        var stress = asNumber(detail.stress);
        var tei = asNumber(detail.tei);
        var bodyBattery = asNumber(detail.bodyBattery);

        if (Number.isFinite(hr)) state.hr = Math.round(hr);
        if (Number.isFinite(hrv)) state.hrv = Math.round(hrv);
        if (Number.isFinite(rr)) state.rr = Math.round(rr);
        if (Number.isFinite(stress)) state.stress = Math.round(stress);
        if (Number.isFinite(tei)) state.tei = Math.round(tei);
        if (Number.isFinite(bodyBattery)) state.bodyBattery = Math.round(bodyBattery);

        var sns = null;
        var pns = null;

        if (detail.ans && typeof detail.ans === 'object') {
            sns = asNumber(detail.ans.sns);
            pns = asNumber(detail.ans.pns);
        }

        if (sns === null) sns = asNumber(detail.sns);
        if (sns === null) sns = asNumber(detail.snsPercent);
        if (pns === null) pns = asNumber(detail.pns);

        if (Number.isFinite(sns)) state.sns = Math.round(sns);
        if (Number.isFinite(pns)) state.pns = Math.round(pns);
        if (!Number.isFinite(pns) && Number.isFinite(sns)) state.pns = 100 - Math.round(sns);

        var bbSeries = null;
        if (Array.isArray(detail.bbHourly)) bbSeries = detail.bbHourly;
        if (!bbSeries && Array.isArray(detail.bb24h)) bbSeries = detail.bb24h;
        if (bbSeries && bbSeries.length) state.bbSeries = bbSeries;
    }

    function applyAll() {
        ensureReadyClass();
        ensureBottomSpacer();

        updateStress(state.stress);
        updateAns(state.sns, state.pns);
        renderBodyBattery(state.bbSeries, state.bodyBattery);
        updateFdcbDetail();
    }

    function handleScanUpdate(event) {
        mergeEventDetail(event.detail || {});
        applyAll();
    }

    function handleFdcbTick(event) {
        var detail = (event && event.detail) || {};

        var progress = asNumber(detail.progressPct);
        if (progress === null) progress = asNumber(detail.progress);
        if (progress === null) progress = asNumber(detail.progressPercent);

        if (Number.isFinite(progress)) {
            var fill = document.getElementById('fdcb-progress-fill');
            if (fill) fill.style.width = clamp(progress, 0, 100) + '%';
        }

        var timerText = null;
        if (Number.isFinite(asNumber(detail.remainingSec))) {
            timerText = formatClock(asNumber(detail.remainingSec));
        } else if (Number.isFinite(asNumber(detail.elapsedSec))) {
            timerText = formatClock(asNumber(detail.elapsedSec));
        } else if (typeof detail.clock === 'string') {
            timerText = detail.clock;
        }

        if (timerText) {
            var timer = document.getElementById('fdcb-timer');
            if (timer) timer.textContent = timerText;
        }

        updateFdcbDetail();
    }

    function startPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }

        pollTimer = setInterval(function () {
            if (!isResultsVisible()) return;
            mergeSnapshot(readSnapshotFromDom());
            applyAll();
        }, POLL_MS);
    }

    var observerDebounce = null;

    function observeOverlay() {
        var root = document.getElementById('results-page');
        if (!root) return;

        if (observer) observer.disconnect();

        observer = new MutationObserver(function () {
            if (!isResultsVisible()) return;
            // Debounce to avoid thrashing during bulk DOM builds
            if (observerDebounce) return;
            observerDebounce = setTimeout(function () {
                observerDebounce = null;
                if (!isResultsVisible()) return;
                mergeSnapshot(readSnapshotFromDom());
                applyAll();
            }, 200);
        });

        observer.observe(root, {
            attributes: true,
            attributeFilter: ['class'],
            childList: true,
            subtree: true
        });
    }

    function init() {
        document.addEventListener('tenki:scan-update', handleScanUpdate);
        document.addEventListener('tenki:fdcb-tick', handleFdcbTick);

        observeOverlay();
        startPolling();

        if (isResultsVisible()) {
            mergeSnapshot(readSnapshotFromDom());
            applyAll();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.TENKI_RESULTS_COMPONENTS = {
        apply: applyAll,
        snapshot: readSnapshotFromDom,
        mergeEvent: mergeEventDetail
    };
})(window);
