/**
 * haptics.js — Cross-platform tactile feedback
 *
 * Android: navigator.vibrate()
 * iOS:     Sub-bass audio pulse via TENKI_AUDIO.subBassPulse()
 *
 * Rule: vibration ONLY on positive events. Never on degradation/warnings.
 */
(function (global) {
    'use strict';

    var hasVibrate = 'vibrate' in navigator;
    var enabled = true;

    function pulse() {
        if (global.TENKI_AUDIO && typeof global.TENKI_AUDIO.subBassPulse === 'function') {
            global.TENKI_AUDIO.subBassPulse();
        }
    }

    var HAPTICS = {
        /** Light tap — data arrival */
        tap: function () {
            if (!enabled) return;
            if (hasVibrate) navigator.vibrate(15);
            else pulse();
        },

        /** Phase upgrade — double pulse */
        phaseUp: function () {
            if (!enabled) return;
            if (hasVibrate) {
                navigator.vibrate([10, 30, 10]);
            } else {
                pulse();
                setTimeout(pulse, 40);
            }
        },

        /** Scan complete — triple celebration */
        complete: function () {
            if (!enabled) return;
            if (hasVibrate) {
                navigator.vibrate([15, 50, 15, 50, 30]);
            } else {
                pulse();
                setTimeout(pulse, 65);
                setTimeout(pulse, 130);
            }
        },

        setEnabled: function (v) { enabled = !!v; }
    };

    global.TENKI_HAPTICS = HAPTICS;
})(window);
