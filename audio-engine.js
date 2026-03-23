/**
 * audio-engine.js — Web Audio synthesized sound effects
 *
 * Design principles:
 * - Warm C5-G5 range (523-784 Hz), natural harmonics
 * - Background-level gain 0.03-0.08 (not notification level)
 * - All sounds fade in/out (50ms attack, 200ms+ release)
 * - Minimum 3s interval between sounds
 * - Zero audio files — all real-time synthesis
 */
(function (global) {
    'use strict';

    var ctx = null;
    var masterGain = null;
    var reverb = null;
    var reverbGain = null;
    var lastPlayTime = 0;
    var MIN_INTERVAL = 3000;
    var enabled = true;
    var breathOsc = null;
    var breathGainNode = null;
    var breathLFOTimer = null;

    function ensureCtx() {
        if (ctx) return ctx;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 1.0;
        masterGain.connect(ctx.destination);
        buildReverb();
        return ctx;
    }

    function buildReverb() {
        if (!ctx) return;
        var sr = ctx.sampleRate;
        var len = Math.floor(sr * 0.4);
        var buf = ctx.createBuffer(2, len, sr);
        for (var ch = 0; ch < 2; ch++) {
            var d = buf.getChannelData(ch);
            for (var i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.1));
            }
        }
        reverb = ctx.createConvolver();
        reverb.buffer = buf;
        reverbGain = ctx.createGain();
        reverbGain.gain.value = 0.3;
        reverb.connect(reverbGain);
        reverbGain.connect(masterGain);
    }

    function canPlay() {
        if (!enabled) return false;
        var now = Date.now();
        if (now - lastPlayTime < MIN_INTERVAL) return false;
        lastPlayTime = now;
        return true;
    }

    function tone(freq, startTime, dur, gain, type) {
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;

        var attack = 0.05;
        var release = dur * 0.6;
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(gain, startTime + attack);
        g.gain.setValueAtTime(gain, startTime + dur - release);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(g);
        g.connect(masterGain);
        if (reverb) g.connect(reverb);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.1);
    }

    function bell(freq, gain, dur) {
        if (!ctx) return;
        var now = ctx.currentTime;
        tone(freq, now, dur, gain, 'sine');
        tone(freq * 2, now, dur * 0.7, gain * 0.3, 'sine');
        tone(freq * 3, now, dur * 0.4, gain * 0.15, 'sine');
    }

    function breathLFO() {
        if (!breathGainNode || !ctx) return;
        var now = ctx.currentTime;
        breathGainNode.gain.setValueAtTime(0.01, now);
        breathGainNode.gain.linearRampToValueAtTime(0.02, now + 2);
        breathGainNode.gain.linearRampToValueAtTime(0.01, now + 4);
        breathLFOTimer = setTimeout(breathLFO, 4000);
    }

    var AUDIO = {
        /** Must call in user gesture handler */
        init: function () {
            ensureCtx();
            if (ctx.state === 'suspended') ctx.resume();
        },

        /** C5 bell — scan start */
        scanStart: function () {
            if (!canPlay()) return;
            bell(523.25, 0.06, 0.3);
        },

        /** A5 triangle ding — data arrival */
        dataArrive: function () {
            if (!canPlay()) return;
            tone(880, ctx.currentTime, 0.08, 0.04, 'triangle');
        },

        /** Phase upgrade — ascending pitch */
        phaseUpgrade: function (phase) {
            if (!canPlay()) return;
            var freqs = [880, 932, 988, 1047]; // A5, A#5, B5, C6
            var freq = freqs[Math.min(phase || 0, freqs.length - 1)];
            tone(freq, ctx.currentTime, 0.15, 0.05, 'sine');
        },

        /** Alignment success — soft ping */
        alignOk: function () {
            if (!canPlay()) return;
            if (!ctx) return;
            tone(659.25, ctx.currentTime, 0.06, 0.03, 'triangle');
        },

        /** C5+E5+G5 chord — scan complete */
        scanComplete: function () {
            lastPlayTime = 0; // override interval
            if (!ctx) return;
            var now = ctx.currentTime;
            tone(523.25, now, 0.5, 0.06, 'sine');
            tone(659.25, now + 0.02, 0.5, 0.05, 'sine');
            tone(783.99, now + 0.04, 0.5, 0.04, 'sine');
        },

        /** Wood-block tick */
        tick: function () {
            if (!ctx) return;
            tone(800, ctx.currentTime, 0.03, 0.03, 'sine');
        },

        /** 60Hz continuous breath background with LFO */
        startBreathBg: function () {
            if (!ctx || breathOsc) return;
            breathOsc = ctx.createOscillator();
            breathGainNode = ctx.createGain();
            breathOsc.type = 'sine';
            breathOsc.frequency.value = 60;
            breathGainNode.gain.value = 0.015;
            breathOsc.connect(breathGainNode);
            breathGainNode.connect(masterGain);
            breathOsc.start();
            breathLFO();
        },

        stopBreathBg: function () {
            if (breathOsc) {
                try { breathOsc.stop(); } catch (e) { /* ignore */ }
                breathOsc = null;
                breathGainNode = null;
            }
            if (breathLFOTimer) {
                clearTimeout(breathLFOTimer);
                breathLFOTimer = null;
            }
        },

        /** Sub-bass pulse — iOS haptic substitute */
        subBassPulse: function () {
            if (!ctx) return;
            var osc = ctx.createOscillator();
            var g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 20;
            g.gain.setValueAtTime(0.15, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
            osc.connect(g);
            g.connect(masterGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.03);
        },

        setEnabled: function (v) { enabled = !!v; }
    };

    global.TENKI_AUDIO = AUDIO;
})(window);
