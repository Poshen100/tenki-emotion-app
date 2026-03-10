/**
 * haptics.js — Cross-platform tactile feedback
 * Uses navigator.vibrate on Android, sub-bass pulse fallback on iOS.
 * Rule: vibration ONLY on positive events. Never on degradation/warnings.
 */
(function (global) {
    'use strict';

    var hasVibrate = 'vibrate' in navigator;

    /**
     * Sub-bass pulse fallback for iOS (no navigator.vibrate support).
     * Plays a 20Hz sine wave for 30ms to simulate haptic feedback.
     */
    function subBassPulse() {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        var ctx = new AudioCtx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 20;
        gain.gain.value = 0.08;

        osc.connect(gain);
        gain.connect(ctx.destination);

        var now = ctx.currentTime;
        osc.start(now);
        osc.stop(now + 0.03);

        // Clean up after pulse
        osc.onended = function () {
            ctx.close();
        };
    }

    var HAPTICS = {
        /** Single light tap — data arrival, phase upgrade */
        tap: function () {
            if (hasVibrate) {
                navigator.vibrate(15);
            } else {
                subBassPulse();
            }
        },

        /** Double tap — scan start */
        doubleTap: function () {
            if (hasVibrate) {
                navigator.vibrate([15, 50, 15]);
            } else {
                subBassPulse();
                setTimeout(subBassPulse, 65);
            }
        },

        /** Triple celebration — scan complete */
        celebrate: function () {
            if (hasVibrate) {
                navigator.vibrate([20, 60, 20, 60, 30]);
            } else {
                subBassPulse();
                setTimeout(subBassPulse, 80);
                setTimeout(subBassPulse, 160);
            }
        }
    };

    global.TENKI_HAPTICS = HAPTICS;
})(window);
