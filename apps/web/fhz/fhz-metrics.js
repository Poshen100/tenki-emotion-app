// TENKI FIX v5.2 - added iOS motion permission priming and optical stability fallback for FHZ meters
(function (global) {
    'use strict';

    var MOTION_PERMISSION_KEY = 'tenki_fhz_motion_permission';
    var motionPermissionState = readStoredPermissionState();
    var motionBuffer = [];
    var opticalBuffer = [];
    var previousOpticalLuma = null;
    var isMotionListening = false;

    var sampleCanvas = document.createElement('canvas');
    var sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;

    function readStoredPermissionState() {
        try {
            return localStorage.getItem(MOTION_PERMISSION_KEY) || inferDefaultPermissionState();
        } catch (error) {
            return inferDefaultPermissionState();
        }
    }

    function inferDefaultPermissionState() {
        if (!('DeviceMotionEvent' in global)) return 'unsupported';
        if (typeof global.DeviceMotionEvent.requestPermission === 'function') return 'unknown';
        return 'granted';
    }

    function persistPermissionState(state) {
        motionPermissionState = state;

        try {
            localStorage.setItem(MOTION_PERMISSION_KEY, state);
        } catch (error) {
            console.warn('[FHZ] Unable to persist motion permission state', error);
        }
    }

    function requestMotionPermission() {
        if (!('DeviceMotionEvent' in global)) {
            persistPermissionState('unsupported');
            return Promise.resolve(false);
        }

        if (typeof global.DeviceMotionEvent.requestPermission !== 'function') {
            persistPermissionState('granted');
            return Promise.resolve(true);
        }

        return global.DeviceMotionEvent.requestPermission().then(function (state) {
            var granted = state === 'granted';
            persistPermissionState(granted ? 'granted' : 'denied');
            return granted;
        }).catch(function (error) {
            persistPermissionState('denied');
            console.warn('[FHZ] Motion permission request failed', error);
            return false;
        });
    }

    function onDeviceMotion(event) {
        var acc = event && event.accelerationIncludingGravity;
        var magnitude;

        if (!acc) return;

        magnitude = Math.sqrt(
            (acc.x || 0) * (acc.x || 0) +
            (acc.y || 0) * (acc.y || 0) +
            (acc.z || 0) * (acc.z || 0)
        );

        motionBuffer.push(magnitude);
        if (motionBuffer.length > 45) {
            motionBuffer.shift();
        }
    }

    function startMotion() {
        if (isMotionListening) return;
        if (!('DeviceMotionEvent' in global)) return;
        if (typeof global.DeviceMotionEvent.requestPermission === 'function' && motionPermissionState !== 'granted') {
            return;
        }

        global.addEventListener('devicemotion', onDeviceMotion, { passive: true });
        isMotionListening = true;
        console.info('[FHZ] Motion listener attached');
    }

    function stopMotion() {
        if (!isMotionListening) return;

        global.removeEventListener('devicemotion', onDeviceMotion);
        isMotionListening = false;
        motionBuffer = [];
    }

    function mean(values) {
        var total = 0;
        var i;

        if (!values.length) return 0;

        for (i = 0; i < values.length; i++) {
            total += values[i];
        }

        return total / values.length;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function computeVariance(values, average) {
        var total = 0;
        var i;

        if (!values.length) return 0;

        for (i = 0; i < values.length; i++) {
            total += Math.pow(values[i] - average, 2);
        }

        return total / values.length;
    }

    function computeMotionStability() {
        var average;
        var variance;

        if (motionBuffer.length < 6) return null;

        average = mean(motionBuffer);
        variance = computeVariance(motionBuffer, average);

        return clamp(1 - (variance / 1.8), 0, 1);
    }

    function sampleOpticalMetrics(videoEl) {
        var frame;
        var data;
        var i;
        var pixelCount;
        var redSum = 0;
        var greenSum = 0;
        var blueSum = 0;
        var saturationScore = 0;
        var redDominance;
        var brightness;
        var lumaValues = [];
        var diffSum = 0;
        var diffMean = 0;
        var coverage;
        var quality;
        var opticalStability;

        if (!videoEl || videoEl.readyState < 2 || !sampleContext) {
            return {
                coverage: 0,
                quality: 0,
                opticalStability: 0,
                motionStability: null,
                stability: 0,
                source: 'camera_proxy'
            };
        }

        try {
            sampleContext.drawImage(videoEl, 0, 0, sampleCanvas.width, sampleCanvas.height);
            frame = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
        } catch (error) {
            console.warn('[FHZ] Unable to sample camera frame for FHZ metrics', error);
            return {
                coverage: 0,
                quality: 0,
                opticalStability: 0,
                motionStability: null,
                stability: 0,
                source: 'camera_proxy'
            };
        }

        data = frame.data;
        pixelCount = data.length / 4;

        for (i = 0; i < data.length; i += 4) {
            var red = data[i] / 255;
            var green = data[i + 1] / 255;
            var blue = data[i + 2] / 255;
            var maxChannel = Math.max(red, green, blue);
            var minChannel = Math.min(red, green, blue);
            var luma = (0.299 * red) + (0.587 * green) + (0.114 * blue);

            redSum += red;
            greenSum += green;
            blueSum += blue;
            saturationScore += (maxChannel - minChannel);
            lumaValues.push(luma);
        }

        redSum /= pixelCount;
        greenSum /= pixelCount;
        blueSum /= pixelCount;
        brightness = mean(lumaValues);
        saturationScore = saturationScore / pixelCount;
        redDominance = clamp((redSum - ((greenSum + blueSum) * 0.5)) * 2.2, 0, 1);
        coverage = clamp((redDominance * 0.72) + (clamp(brightness / 0.75, 0, 1) * 0.28), 0, 1);

        if (previousOpticalLuma && previousOpticalLuma.length === lumaValues.length) {
            for (i = 0; i < lumaValues.length; i++) {
                diffSum += Math.abs(lumaValues[i] - previousOpticalLuma[i]);
            }
            diffMean = diffSum / lumaValues.length;
        }

        previousOpticalLuma = lumaValues.slice(0);

        opticalStability = clamp(1 - (diffMean / 0.16), 0, 1);
        opticalBuffer.push(opticalStability);
        if (opticalBuffer.length > 24) {
            opticalBuffer.shift();
        }

        quality = clamp(
            (coverage * 0.5) +
            (clamp(saturationScore / 0.24, 0, 1) * 0.2) +
            (opticalStability * 0.3),
            0,
            1
        );

        return {
            coverage: coverage,
            quality: quality,
            opticalStability: opticalStability,
            motionStability: computeMotionStability(),
            stability: 0,
            source: 'camera_proxy'
        };
    }

    function sample(videoEl) {
        var snapshot = sampleOpticalMetrics(videoEl);
        var motionStability = snapshot.motionStability;
        var opticalStability = mean(opticalBuffer);
        var useMotion = motionPermissionState === 'granted' && motionStability !== null;
        var stability;

        if (useMotion) {
            stability = clamp((motionStability * 0.65) + (opticalStability * 0.35), 0, 1);
            snapshot.source = 'motion+camera';
        } else {
            stability = clamp(opticalStability || snapshot.opticalStability, 0, 1);
            snapshot.source = 'camera_proxy';
        }

        snapshot.stability = stability;
        snapshot.motionPermissionState = motionPermissionState;

        return snapshot;
    }

    function reset() {
        motionBuffer = [];
        opticalBuffer = [];
        previousOpticalLuma = null;
    }

    global.TENKI_FHZ_METRICS = {
        MOTION_PERMISSION_KEY: MOTION_PERMISSION_KEY,
        getMotionPermissionState: function () {
            return motionPermissionState;
        },
        hasMotionPermission: function () {
            return motionPermissionState === 'granted';
        },
        requestMotionPermission: requestMotionPermission,
        startMotion: startMotion,
        stopMotion: stopMotion,
        reset: reset,
        sample: sample
    };
})(window);
