/**
 * audio-engine.js — Web Audio synthesized sound effects
 * Warm C5-G5 range (523-784 Hz), background-level gain 0.03-0.08
 * All sounds synthesized in real-time, no audio files needed.
 * Minimum 3 second interval between sounds.
 */
(function (global) {
    'use strict';

    var audioCtx = null;
    var lastPlayTime = 0;
    var MIN_INTERVAL_MS = 3000;

    function getContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function canPlay() {
        var now = Date.now();
        if (now - lastPlayTime < MIN_INTERVAL_MS) return false;
        lastPlayTime = now;
        return true;
    }

    /**
     * Play a tone with envelope.
     * @param {number} freq - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {number} gain - Max gain (0.03-0.08)
     * @param {string} type - Oscillator type: sine, triangle, square
     */
    function playTone(freq, duration, gain, type) {
        if (!canPlay()) return;
        var ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        var osc = ctx.createOscillator();
        var gainNode = ctx.createGain();

        osc.type = type || 'sine';
        osc.frequency.value = freq;

        var now = ctx.currentTime;
        // Attack 50ms, sustain, release 200ms
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gain, now + 0.05);
        gainNode.gain.setValueAtTime(gain, now + duration - 0.2);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play a chord (multiple frequencies).
     */
    function playChord(freqs, duration, gain) {
        if (!canPlay()) return;
        var ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        var now = ctx.currentTime;
        freqs.forEach(function (freq) {
            var osc = ctx.createOscillator();
            var gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            var perGain = gain / freqs.length;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(perGain, now + 0.05);
            gainNode.gain.setValueAtTime(perGain, now + duration - 0.2);
            gainNode.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
        });
    }

    var AUDIO_ENGINE = {
        /** C5 bell tone, 300ms — scan start */
        scanStart: function () {
            playTone(523.25, 0.3, 0.06, 'sine');
        },

        /** A5 triangle, 80ms — data arrival */
        dataArrive: function () {
            playTone(880, 0.08, 0.04, 'triangle');
        },

        /** Previous tone +100 cent, 150ms — phase upgrade */
        phaseUpgrade: function (baseCent) {
            var freq = 523.25 * Math.pow(2, (baseCent || 100) / 1200);
            playTone(freq, 0.15, 0.05, 'sine');
        },

        /** C5+E5+G5 chord, 500ms — scan complete */
        scanComplete: function () {
            playChord([523.25, 659.25, 783.99], 0.5, 0.07);
        },

        /** 800Hz sine tick, 30ms — countdown */
        tick: function () {
            playTone(800, 0.03, 0.03, 'sine');
        },

        /** 60Hz continuous sub-bass for breathing background */
        startBreathBg: function () {
            var ctx = getContext();
            if (ctx.state === 'suspended') ctx.resume();

            var osc = ctx.createOscillator();
            var gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 60;
            gainNode.gain.value = 0.015;

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();

            AUDIO_ENGINE._breathOsc = osc;
            AUDIO_ENGINE._breathGain = gainNode;
        },

        stopBreathBg: function () {
            if (AUDIO_ENGINE._breathOsc) {
                AUDIO_ENGINE._breathOsc.stop();
                AUDIO_ENGINE._breathOsc = null;
                AUDIO_ENGINE._breathGain = null;
            }
        },

        /** Resume audio context on user gesture (iOS requirement) */
        unlock: function () {
            var ctx = getContext();
            if (ctx.state === 'suspended') ctx.resume();
        },

        _breathOsc: null,
        _breathGain: null
    };

    global.TENKI_AUDIO = AUDIO_ENGINE;
})(window);
