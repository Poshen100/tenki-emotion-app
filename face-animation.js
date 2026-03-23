/**
 * face-animation.js — v1.0 Ethereal Face Animation System
 *
 * Creates an abstract, constellation-style SVG face overlaid on the
 * stardust particle cloud. Driven by FaceMesh expression metrics
 * and autonomous idle animations (breathing, random blinks).
 *
 * Public API:
 *   TENKI_FACE.init()           — create SVG, start idle loop
 *   TENKI_FACE.setExpression(e) — push FaceMesh metrics {mouthOpen, eyeOpen, blinkDetected, browTension}
 *   TENKI_FACE.setEmotion(zone) — set TEI zone for ambient mood
 *   TENKI_FACE.destroy()        — cleanup
 */
(function (global) {
    'use strict';

    // ─── Config ───
    var BLINK_MIN_MS = 2500;
    var BLINK_MAX_MS = 6000;
    var BLINK_DUR_MS = 150;
    var BREATH_CYCLE_MS = 4200;
    var EXPRESSION_LERP = 0.18;

    // ─── State ───
    var svg = null;
    var blinkTimer = null;
    var breathFrame = null;
    var alive = false;

    // Current smoothed values
    var cur = { eyeL: 1, eyeR: 1, mouth: 0, brow: 0 };
    // Target values (from FaceMesh or idle)
    var tgt = { eyeL: 1, eyeR: 1, mouth: 0, brow: 0 };
    // Idle-driven (when no FaceMesh data)
    var idleMode = true;
    var lastExprTime = 0;
    var emotionZone = 'NEUTRAL';

    // ─── SVG Face Creation ───
    function createFace() {
        var ns = 'http://www.w3.org/2000/svg';
        svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('class', 'tenki-face-svg');
        svg.id = 'tenki-face';

        // Use innerHTML for cleaner template
        svg.innerHTML =
            '<defs>' +
            '  <filter id="face-glow"><feGaussianBlur stdDeviation="2" result="b"/>' +
            '    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
            '  <radialGradient id="iris-grad">' +
            '    <stop offset="0%" stop-color="rgba(0,220,255,0.7)"/>' +
            '    <stop offset="100%" stop-color="rgba(0,120,200,0.2)"/>' +
            '  </radialGradient>' +
            '</defs>' +
            '<g class="face-root" filter="url(#face-glow)">' +
            // Face container — breathing moves this
            '  <g class="face-breathe" transform="translate(100,100)">' +
            // Left eye group
            '  <g class="eye-group eye-left" transform="translate(-28,-12)">' +
            '    <ellipse class="eye-socket" cx="0" cy="0" rx="16" ry="9"/>' +
            '    <ellipse class="eye-iris" cx="0" cy="0" rx="6" ry="6"/>' +
            '    <ellipse class="eye-pupil" cx="0" cy="0" rx="2.5" ry="2.5"/>' +
            '    <line class="eye-shine" x1="-2" y1="-3" x2="2" y2="-3"/>' +
            '  </g>' +
            // Right eye group
            '  <g class="eye-group eye-right" transform="translate(28,-12)">' +
            '    <ellipse class="eye-socket" cx="0" cy="0" rx="16" ry="9"/>' +
            '    <ellipse class="eye-iris" cx="0" cy="0" rx="6" ry="6"/>' +
            '    <ellipse class="eye-pupil" cx="0" cy="0" rx="2.5" ry="2.5"/>' +
            '    <line class="eye-shine" x1="-2" y1="-3" x2="2" y2="-3"/>' +
            '  </g>' +
            // Mouth
            '  <ellipse class="face-mouth" cx="0" cy="18" rx="10" ry="0"/>' +
            // Brow lines
            '  <line class="face-brow brow-left" x1="-40" y1="-24" x2="-16" y2="-24"/>' +
            '  <line class="face-brow brow-right" x1="16" y1="-24" x2="40" y2="-24"/>' +
            '  </g>' +
            '</g>';

        return svg;
    }

    // ─── Insert into DOM ───
    function inject() {
        svg = createFace();
        // Place inside #universe or body, above stardust canvas
        var universe = document.getElementById('universe');
        if (universe) {
            universe.appendChild(svg);
        } else {
            document.body.appendChild(svg);
        }
    }

    // ─── Smooth lerp ───
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ─── Apply current state to SVG ───
    function applyState() {
        if (!svg) return;

        var leftEye = svg.querySelector('.eye-left');
        var rightEye = svg.querySelector('.eye-right');
        var mouth = svg.querySelector('.face-mouth');
        var browL = svg.querySelector('.brow-left');
        var browR = svg.querySelector('.brow-right');

        // Eyes: scaleY controls open (1) → closed (0.05)
        if (leftEye) {
            leftEye.setAttribute('transform',
                'translate(-28,-12) scale(1,' + Math.max(cur.eyeL, 0.05).toFixed(3) + ')');
        }
        if (rightEye) {
            rightEye.setAttribute('transform',
                'translate(28,-12) scale(1,' + Math.max(cur.eyeR, 0.05).toFixed(3) + ')');
        }

        // Mouth: ry controls open amount (0 = closed, 7 = full open)
        if (mouth) {
            var mouthRY = (cur.mouth * 7).toFixed(2);
            mouth.setAttribute('ry', mouthRY);
        }

        // Brows: tension lifts inner edge
        if (browL && browR) {
            var browLift = cur.brow * -5;
            browL.setAttribute('y1', (-24 + browLift).toFixed(1));
            browR.setAttribute('y1', (-24 + browLift).toFixed(1));
        }
    }

    // ─── Animation Loop ───
    function tick() {
        if (!alive) return;

        // Lerp toward targets
        cur.eyeL = lerp(cur.eyeL, tgt.eyeL, EXPRESSION_LERP);
        cur.eyeR = lerp(cur.eyeR, tgt.eyeR, EXPRESSION_LERP);
        cur.mouth = lerp(cur.mouth, tgt.mouth, EXPRESSION_LERP);
        cur.brow = lerp(cur.brow, tgt.brow, EXPRESSION_LERP);

        // Breathing — translate the face-breathe group
        var breathGroup = svg ? svg.querySelector('.face-breathe') : null;
        if (breathGroup) {
            var t = Date.now() / BREATH_CYCLE_MS * Math.PI * 2;
            var breathY = Math.sin(t) * 3;
            var breathScale = 1 + Math.sin(t) * 0.012;
            breathGroup.setAttribute('transform',
                'translate(100,' + (100 + breathY).toFixed(2) + ') scale(' + breathScale.toFixed(4) + ')');
        }

        // Switch to idle mode if no FaceMesh data for 3s
        if (Date.now() - lastExprTime > 3000 && !idleMode) {
            idleMode = true;
        }

        // Idle micro-expressions
        if (idleMode) {
            idleTick();
        }

        applyState();
        breathFrame = requestAnimationFrame(tick);
    }

    // ─── Idle Micro-expressions ───
    var idlePhase = 0;
    function idleTick() {
        idlePhase += 0.01;

        // Subtle eye movement (slight squint oscillation)
        var eyeBase = 0.85 + 0.15 * Math.sin(idlePhase * 1.3);
        tgt.eyeL = eyeBase;
        tgt.eyeR = eyeBase + 0.02 * Math.sin(idlePhase * 2.1);

        // Ambient mouth: mostly closed, occasional micro-movement
        tgt.mouth = 0.02 + 0.03 * Math.max(0, Math.sin(idlePhase * 0.7));

        // Brow: very subtle movement
        tgt.brow = 0.05 + 0.05 * Math.sin(idlePhase * 0.5);

        // Emotion-based ambient
        if (emotionZone === 'PEAK') {
            tgt.mouth = Math.max(tgt.mouth, 0.15 + 0.1 * Math.sin(idlePhase * 0.8));
            tgt.eyeL = Math.min(tgt.eyeL + 0.1, 1);
            tgt.eyeR = Math.min(tgt.eyeR + 0.1, 1);
        } else if (emotionZone === 'DEGRADED') {
            tgt.eyeL *= 0.7;
            tgt.eyeR *= 0.7;
            tgt.brow = Math.max(tgt.brow, 0.4);
        }
    }

    // ─── Random Blink ───
    function scheduleBlink() {
        if (!alive) return;
        var delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
        blinkTimer = setTimeout(function () {
            doBlink();
            scheduleBlink();
        }, delay);
    }

    function doBlink() {
        if (!alive) return;
        var prevL = tgt.eyeL;
        var prevR = tgt.eyeR;

        // Close eyes
        tgt.eyeL = 0;
        tgt.eyeR = 0;

        // Re-open after BLINK_DUR_MS
        setTimeout(function () {
            if (!alive) return;
            tgt.eyeL = idleMode ? prevL : 1;
            tgt.eyeR = idleMode ? prevR : 1;
        }, BLINK_DUR_MS);
    }

    // ─── Public API ───
    var FACE = {
        init: function () {
            // ── DISABLED: Pure abstract stardust design ──
            // Concrete SVG face elements (eyes, mouth, brows) are intentionally
            // disabled per v25.8.2 design principle: all emotion expression is
            // conveyed through particle behavior (scale, flow, color) only.
            // The TENKI_FACE API is kept as a no-op so calling code doesn't break.
            return;
        },

        /**
         * Push FaceMesh expression data
         * @param {Object} e - { mouthOpen: 0-1, eyeOpen: 0-1, blinkDetected: bool, browTension: 0-1 }
         */
        setExpression: function (e) {
            if (!alive || !e) return;
            lastExprTime = Date.now();
            idleMode = false;

            tgt.eyeL = e.eyeOpen !== undefined ? e.eyeOpen : 1;
            tgt.eyeR = e.eyeOpen !== undefined ? e.eyeOpen : 1;
            tgt.mouth = e.mouthOpen !== undefined ? e.mouthOpen : 0;
            tgt.brow = e.browTension !== undefined ? e.browTension : 0;

            // Explicit blink override
            if (e.blinkDetected) {
                doBlink();
            }
        },

        /**
         * Set emotion zone for ambient mood coloring
         * @param {string} zone - PEAK | OPTIMAL | NEUTRAL | DEGRADED
         */
        setEmotion: function (zone) {
            emotionZone = zone || 'NEUTRAL';

            if (!svg) return;
            var root = svg.querySelector('.face-root');
            if (!root) return;

            // Update face color based on emotion
            var colors = {
                PEAK: { iris: 'rgba(245,166,35,0.7)', socket: 'rgba(245,166,35,0.08)' },
                OPTIMAL: { iris: 'rgba(0,220,255,0.7)', socket: 'rgba(0,180,216,0.08)' },
                NEUTRAL: { iris: 'rgba(200,200,220,0.5)', socket: 'rgba(200,200,220,0.06)' },
                DEGRADED: { iris: 'rgba(94,58,135,0.6)', socket: 'rgba(94,58,135,0.08)' }
            };

            var c = colors[zone] || colors.NEUTRAL;
            var irises = svg.querySelectorAll('.eye-iris');
            var sockets = svg.querySelectorAll('.eye-socket');

            for (var i = 0; i < irises.length; i++) {
                irises[i].setAttribute('fill', c.iris);
            }
            for (var j = 0; j < sockets.length; j++) {
                sockets[j].setAttribute('fill', c.socket);
            }
        },

        destroy: function () {
            alive = false;
            if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }
            if (breathFrame) { cancelAnimationFrame(breathFrame); breathFrame = null; }
            if (svg && svg.parentNode) { svg.parentNode.removeChild(svg); }
            svg = null;
            idleMode = true;
            cur = { eyeL: 1, eyeR: 1, mouth: 0, brow: 0 };
            tgt = { eyeL: 1, eyeR: 1, mouth: 0, brow: 0 };
        }
    };

    global.TENKI_FACE = FACE;
})(window);
