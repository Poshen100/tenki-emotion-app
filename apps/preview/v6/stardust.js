/**
 * stardust.js ??Three.js 8000-particle stardust soul animation (v6 preview fork)
 *
 * Forked from apps/web/stardust.js (which is FROZEN per CLAUDE.md) so the v6
 * preview can harden the scan ceremony without touching the web prototype.
 * Core visual identity (colors, 8000 count, Fibonacci distribution, drift,
 * rolling, breathing, expression API) is preserved byte-for-byte in feel.
 *
 * v6 additions (no visual-identity change):
 *   - Freeze resilience: WebGL context-loss/restore handling (the big one ?? *     without preventDefault a lost context never restores ??permanent freeze),
 *     pause/resume on tab visibility, render wrapped so a transient error can't
 *     kill the rAF loop.
 *   - Frame-rate-independent drift throttle (was "assume 60fps").
 *   - playEntrance(): smooth big?’small scale-in for the scan entrance.
 *
 * Requires: THREE.js (r128+)
 */
(function (global) {
    'use strict';

    if (typeof THREE === 'undefined') {
        console.warn('[TENKI stardust] THREE.js not loaded, skipping');
        return;
    }

    var PARTICLE_COUNT = 8000;
    var PARTICLE_SIZE = 0.088;
    var scene, camera, renderer, cloud, material;
    /** When true, canvas/camera track the container box rather than the viewport. */
    var fitContainer = false;

    /** @returns {{w:number,h:number}} the drawing size for the current mount. */
    function viewSize() {
        if (fitContainer && container && container.clientWidth > 0 && container.clientHeight > 0) {
            return { w: container.clientWidth, h: container.clientHeight };
        }
        return { w: window.innerWidth, h: window.innerHeight };
    }
    var container = null;
    var mounted = false;      // one binding at a time (see mount())
    var animFrame = null;
    var running = false;
    var contextLost = false;
    var lostTimer = null;     // watchdog: rebuild if a lost context never restores
    var lastDriftT = -1;      // time-based drift throttle (seconds)
    var entranceStart = -1;   // big?’small scale-in start time (seconds); <0 = idle
    var clock = new THREE.Clock();

    // v25.8.2 feel-preserving micro-tune knobs (P1)
    var ROLL_CFG = {
        x: 0.013,         // forward tumble axis
        y: 0.0065,        // depth spin
        z: 0.0015,        // side wobble
        pulseFreq: 0.20,  // speed breathing
        pulseAmp: 0.00058
    };

    // Entrance scale-in: ball starts a touch larger and eases down to rest.
    var ENTRANCE = { from: 1.5, dur: 1.2 }; // 1.5? ??1.0? over 1.2s (easeOutCubic)

    // Per-particle drift data (organic movement)
    var basePositions = null;   // Original Fibonacci positions
    var driftSeeds = null;      // Random seeds per particle (Float32Array ? 4: freqX, freqY, freqZ, amplitude)
    var baseColors = null;      // Original color values for shimmer
    var hueBand = null;         // æ¯é?ç²’å??„è‰²å¸¶ç´¢å¼•ï?bloom ?¨ï?ï¼Œå»ºæ§‹æ?ç®—ä?æ¬?
    // Expression sync state
    var expr = { mouthOpen: 0, eyeOpen: 1, blinkFlash: 0, browTension: 0.5, active: false };

    // ?€?€ Tone layer (2026-08-10) ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
    // founder asked for "?´å?å±¤æ¬¡?²å½©è®Šå?, æ¯æ¬¡?ƒæ??½æ??‰ä½¿?¨è€…è???, and picked
    // "keep the identity, layer the variation on top" over replacing the palette.
    //
    // ?”´ The v25.8.2 look is a locked asset (CLAUDE.md). The lock is honoured by a
    // structural property, not by good intentions: **at default values this layer
    // is an identity transform**, so every page that never calls setTone() ??    // story.html, soul-enroll.html, the v6 takeover ??renders byte-for-byte what
    // it renders today. `toneIdle` short-circuits the work entirely.
    //
    // What varies is a *rotation of the whole cyan?’purple?’pink gradient*, never a
    // swap of the palette: the relationships between the three stops survive, so
    // the ball still reads as the same ball.
    var tone = { hue: 0, sat: 1, mix: 0, r: 0, g: 0, b: 0 };       // smoothed, applied
    var toneTarget = { hue: 0, sat: 1, mix: 0, r: 0, g: 0, b: 0 }; // requested
    /** EWMA factor per recolour tick (~20fps). Slow enough that colour never snaps. */
    var TONE_SMOOTH = 0.12;
    /** Below this the smoothed tone counts as "off" and the fast path is taken. */
    var TONE_EPS = 0.002;
    /** Hue-rotation matrix, recomputed once per tick (not per particle). */
    var toneMat = null;

    // ?€?€ Readout layer (2026-08-10, second pass) ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
    // founder å¯¦èµ°ï¼šã€Œé??²å¥½?æ?è®Šå?ï¼Ÿã€ï??Œä?è¦åª?¯é?ä¸éŒ¯ï¼Œæ?è¦ç??¯æ??ä??ã€?    //
    // ç¬¬ä??ˆç??²èª¿??`browTension` / `mouthOpen` ?”â€?ç®—é?ä¹‹å???…©?‹åœ¨?ƒæ??…å?ä¸?    // **å¹¾ä??¯å¸¸??*ï¼ˆç”¨?›çšº?‰åªè®“è‰²?¸å? 0.69Â°ï¼›å˜´?‰è? mouthOpen ?†ç‚º ~0.1ï¼‰ã€?    // è¨Šè?æ­???–æ? 0..1 ä¸ä»£è¡¨å???*èµ°é?** 0..1ï¼Œæ??¶å?æ²’æŸ¥?Ÿå¯¦?†å???    //
    // ?™ä?å±¤æ”¹??`stillness` ?”â€?æ¯å??ç? 0..1ï¼Œè€Œä?**æ­?˜¯?‘å€‘è?æ±‚ä½¿?¨è€…æ§?¶ç???€‹é?**
    // ï¼ˆç•«?¢ä?å¯«è??Œä??ç©©å®šã€ï?ä¸»è??»å?å®ƒæ¯«?¡å??‰ï???°±?¯ã€Œé?ä¸éŒ¯?è??Œæ??ä??ç?å·®è?ï¼‰ã€?    // å¤–å? `progress`ï¼ˆç´¯ç©ç??‰æ??æ¸¬ï¼Œä??¯è??‚å™¨ï¼‰ã€?    //
    // ?”´ ä¸€æ¨?”¨çµæ?å®ˆä??–å?è³‡ç”¢ï¼?*æ²’å‘¼??setReadout å°±å???inert**ï¼?    // story / soul-enroll / v6 takeover ?ä??ƒç?ä¸è???    var readout = { active: false, still: 0.5, prog: 0, sStill: 0.5, sProg: 0 };
    /** EWMA per animation frame. æ¯?tone ç¨å¿« ?”â€??™æ˜¯?é?è¿´å?ï¼Œæ…¢äº†å°±?Ÿè¦ºä¸åˆ°? æ???*/
    var READOUT_SMOOTH = 0.08;
    /**
     * ?”´ **ç²’å?æ¼‚ç§»ä¸å??¶ä??é??šé???*
     *
     * ?é??çŸ¥?“ï?æ¼‚ç§»?¯å???0.02??.07ï¼Œè€Œç??Šå???2.5 ?”â€?     * ?1.35 vs ?0.55 ?„ä?ç§»å·®?ªæ?**?Šå???1.44%ï¼Œåœ¨?‹æ?ä¸Šç? 2.2px**??     * founder ä¸‰æ¬¡?å ±?Œç?ä¸å‡ºè®Šå??ï??™æ˜¯ä¸»å?ä¹‹ä???     * **?ç??½èµ·ä¾†å?å¤§ä?ä»?¡¨?‹å?è¦‹ã€?* ?¶æ•£?¹ç”±?´é?å°ºåº¦?¿æ?ï¼ˆè?ä¸‹ï?ï¼?     * ??€‹æ??‰ç?å°å?åº¦ã€‚é€™è£¡ä¿ç?ä¸€é»é?ï¼Œåª?¶ä?è³ªæ??Œä??¯è??Ÿã€?     */
    var READOUT_DRIFT_HI = 1.15;
    var READOUT_DRIFT_LO = 0.85;
    /**
     * ?”´ **bloomï¼šæ?é¡†ç?å­å??ªç??²ç›¸??? ?”â€??™æ˜¯?Œæ›´å¤šå±¤æ¬¡è‰²å½©è??–ã€ç?ä¸»é€šé???*
     *
     * ? ï? ä¸Šä??ˆæ˜¯?é?ä¾†ç?ï¼ˆ`focus`ï¼šè?ç©©è??¶æ??®ä? cyanActiveï¼‰ã€?     * ç®—å‡ºä¾†åœ¨ founder å¯¦æ¸¬?„ç©©å®šåº¦ä¸‹ï??ƒç?å½©åº¦è·¨åº¦?ªå‰© **36ï¼?7%ï¼? 4ï¼?3%ï¼?*ï¼?     * ?Œæ­£å¸¸æ¡ç©©å°±??85??5% ?”â€?**?´å ´?ƒæ?å¹¾ä??½æ˜¯?®ä??’è‰²**??     * ä»–å?ç¬¬ä?å¤©è??„æ˜¯?Œæ›´å¤šå±¤æ¬¡è‰²å½©è??–ã€ï??‘å»?Šé??²æŠ½ä¹¾ä???*?ªå??¯ä??±è¥¿??*
     *
     * ?¾åœ¨?¯æ•£?‹ï?ç©©ä? ???ˆé?**å±•é?**å¾—æ›´è±å???     * **é¡è‰²æ°¸é?ä¸æ?è®Šå?** ?”â€?bloom=0 ?‚ä??¯å??´ç??ºç?æ¼¸å±¤??     *
     * ä¸Šé??±ä¸»?²å??‡æ±ºå®šï?ä¸æ˜¯?‹æ??‘ç?ï¼?     * **?²ç›¸??¤ª?‹ï??´é??„å¹³?‡è‰²?ƒè¶¨è¿‘ç°ï¼Œè€Œç°å°±æ˜¯ `--zone-neutral`ï¼ˆNeutral å¸¶ä?ï¼‰ã€?*
     *
     * ?”´ **ä½?bloom ?¶å¯¦ä¸æ˜¯??€‹å??‡ç??¶é ¸ ?”â€??²ç›¸?‹è??æ˜¯??*
     * ?™ä»¶äº‹åª?‰åœ¨å®ˆé??¡æ”¹?æ? base ? band ?¨ç??ˆä?å¾Œæ??‹å??°ã€?     * ?Šæ¨¡?‹ï?band ??é«˜åº¦ä¸€ä¸€å°æ?ï¼‰ç??ºã€ŒsatLo 0.95 + bloom 0.28 ???E 21.3 ?Œã€ï?
     * ?›æ?æ­?¢º?„ç??ç???**32.1 ??* ?”â€???€????¯æ¨¡?‹ç??¢ç‰©ï¼Œä??¯ç”¢?ç??§è³ª??     * ? ï? **?‘æ›¾?§è???€‹å??¶é ¸?»æ??ƒæ•¸??* ?æ¸¬?¼æ??æ?ï¼›æ?äº†æ¨¡?‹å°±è¦å…¨?¨é?ç®—ã€?     *
     * å¯¦æ¸¬ï¼?026-08-11ï¼Œæ­£ç¢ºæ¨¡?‹ï?ï¼?     *   bloom 0.28 ??è·¨åº¦ 205?Î”E 32.7 ï½?**0.40 ??216?Î”E ä»æ˜¯ 32.7**ï¼ˆæ?å£é??½åœ¨
     *   0.24 rot 0.20ï¼Œå?å¾€ä¸Šä?å½±éŸ¿ï¼‰ï? 0.52 ??217?Î”E ?‰åˆ° 27.4
     * ?€ä»?**0.40 ?¯é‚£?‹è?é»?*ï¼šè·¨åº¦è²·æ»¿ï?å®‰å…¨?Šé?ä¸€?†æ?ä»˜ï??å?ä¸Šåªå¤?+1 ?»é?å§‹è??¬ã€?     */
    var READOUT_BLOOM_MAX = 0.40;
    /**
     * hueRotï¼šæ•´?´æ??ç??²ç›¸?…ç?ï¼Œç”± progress é©…å? ?”â€?10 ç§’ä??“ç?èµ°é?ä¸€æ®µè‰²?¸ã€?     *
     * ?”´ **0.20 ?¯ç¡¬ä¸Šé?ï¼Œè€Œä??¯æ•´çµ„å??¸è£¡?¯ä??Ÿæ­£?¡ä??„é‚£ä¸€?‹ã€?*
     * æ­?¢ºæ¨¡å?ä¸‹å¯¦æ¸¬ï?0.24 ??ä¸»è‰²??coral **?E 19.1 ??*??.32 ??**7.5 ??*??     * ?é?é£½å?åº¦ä?è²·ä??•å? ?”â€?å®ƒå??„æ˜¯å¹³å??²ç?**?²ç›¸**ï¼Œä??¯å½©åº¦ã€?     * ?³å?å¤šé??²è?å¾€ bloom / é£½å?åº¦ä??å»è¦ï?ä¸è??•é€™å€‹æ•¸å­—ã€?     */
    var READOUT_HUEROT_MAX = 0.20;
    /** ?²å¸¶?¸ï?bloom ?„é??–ç?åº¦ã€‚æ? tick ?ªå»º?™éº¼å¤šå€‹çŸ©??€?*/
    var HUE_BANDS = 16;
    /**
     * é£½å?åº¦ç??ã€?     *
     * **ä¸‹é? 1.20 è²·ç??¯ã€Œæ??•é‚£ä¸€ç«¯ä?è¦æ??½ã€?*ï¼Œä???bloom ç©ºé? ?”â€?     * ? ï? ?‘å??¬å¯«?„ç??±ï??Œæ?é«˜ä??æ?è²·å???bloom ç©ºé??ï?**?¯éŒ¯??*ï¼?     * æ­?¢ºæ¨¡å?ä¸?satLo 0.95 + bloom 0.28 ?„ä¸»???E ??32.1 ?…ï?ä¸æ˜¯ 21.3 ?Œã€?     * ?©è€…ç??ƒå…§å½©åº¦è·¨åº¦ä¹Ÿå¹¾ä¹ä?æ¨??83??08 vs 87??05ï¼‰ã€?     * å®ƒç?æ­?”¹?°ç???*ä½?stillness ç«¯ç?é£½å?åº¦åœ°??*ï¼šä½¿?¨è€…é??¨æ??„æ??™ï?
     * ?ƒä??ƒæ˜¯ä¸€é¡†æ??‰é??²ç??°ç??‚é€™æ˜¯å¯¦èµ°?‹å??°ã€ä??Œè·¨åº¦ã€é€™å€‹æ?æ¨™é?ä¸åˆ°?„æ±è¥¿ã€?     *
     * **ä¸Šé? 1.55 å°å??‡é›¶?æœ¬**ï¼šå??‡å¡?„æ˜¯ä½é£½?Œç«¯ï¼Œæ?é«˜ä??ä?å½±éŸ¿å®ƒã€?     *
     * ? ï? é£½å?åº¦ä??¯å¯è®€??*è¨Šè?**?šé?ï¼ˆadditive æ··è‰²?ƒå??‰å??²ç³»å·®ç•°ï¼‰â€”â€?     * å®ƒæ±ºå®šç??¯é??²ç?åº•æ°£ï¼Œç??‹å?é¥‹äº¤çµ?bloom ?‡å°ºåº¦ã€?     */
    var READOUT_SAT_LO = 1.20;
    var READOUT_SAT_HI = 1.55;
    /**
     * stillness å¸¶ä??„æ•´é«”å°ºåº¦ï??ƒå??‚è„¹å¤§ã€ç©©ä½æ??¶æ?ä¸€é¡†æ ¸??     * 0.86??.18 ??32%ï¼Œåœ¨ 300px ?„ç?ä¸Šç? 48px ?”â€?è·Ÿå???6%ï¼?pxï¼‰å·®ä¸€?‹é?ç´šã€?     */
    var READOUT_SCALE_LO = 0.86;
    var READOUT_SCALE_HI = 1.18;
    /**
     * ç¸½å°ºåº¦ä??ã€‚`exprScale`ï¼ˆçœ¼?‹å? ? ?´é??ˆï?0.8??.56ï¼‰æ?è·Ÿé€™è£¡?¸ä?ï¼?     * ä¸å¤¾ä½ç?è©±æ??•ç«¯?¯èƒ½?¹å‡º?ƒæ?æ¡†ã€‚å¤¾?¨ä?å¤©å¯¦?›æ??°ç?ä¸Šé?ï¼?     * **ä¿è??™ä??€ä¸æ?è®“ç?æ¯”ç¾?¨æ›´å¤?*??     */
    var READOUT_SCALE_CAP = 1.56;
    /** ?²åº¦å¸¶ä??„äº®åº¦æ????”â€?ç´¯ç??„æ??ˆé?æ¸¬è?å¤šï??ƒè?å¯¦ã€?*/
    var READOUT_PROG_LIFT = 0.10;
    /** stillness å¸¶ä??„äº®åº¦ç??ï??Ÿæœ¬?ªæ? Â±0.06ï¼Œç?ä¸å‡ºä¾†ï???*/
    var READOUT_OPACITY_SWING = 0.18;

    /**
     * ä¸€é¡†ç?å­å±¬?¼å“ª?‹è‰²å¸¶ã€?*ç´”å‡½å¼ï?å°å? export çµ?harness ?´æ¥é©—ã€?*
     *
     * ?”´ ?²å¸¶?Œæ???*é«˜åº¦**??*?¹ä?è§?* ?”â€??™å°±?¯ã€Œèº?‹ã€ï?
     * é¡è‰²ä¸åª?¨ä?ä¸‹æ–¹?‘è?ï¼Œä?ç¹è??ƒè?ï¼Œæ?ä»¥å?ä¸€é«˜åº¦?„ç?å­æ??½åœ¨ä¸å??²å¸¶??     * ?ªå?é«˜åº¦?„è©±?«é¢?ªæ˜¯ä¸€æ¢å–®ç´”ç?ä¸Šä?æ¼¸å±¤ï¼Œé‚£æ­?˜¯ founder èªªã€Œé??²è??–å?å°‘ã€?     * ?„å…¶ä¸­ä?å±¤å?? ã€?     *
     * ? ï? ?™ä?è®“å??²è??²å¸¶**ä¸å?ä¸€ä¸€å°æ?**ï¼Œå??€?¡å??ˆæ? base ? band ?„æ??‰ç???     * ï¼ˆè? `scripts/preview-scan-stardust.mjs`ï¼‰ã€?     *
     * @param {number} normalizedY - 0..1ï¼Œç?å­åœ¨?ƒä??„é?åº¦ã€?     * @param {number} x - ç²’å???x åº§æ?ï¼ˆç??¹ä?è§’ç”¨ï¼‰ã€?     * @param {number} z - ç²’å???z åº§æ???     * @returns {number} 0..HUE_BANDS-1
     */
    function hueBandOf(normalizedY, x, z) {
        var azimuth = (Math.atan2(z, x) / (Math.PI * 2)) + 0.5; // 0..1
        var t = (normalizedY * 0.62 + azimuth * 0.38) % 1;
        return Math.min(HUE_BANDS - 1, Math.floor(t * HUE_BANDS));
    }

    /**
     * Bind the stardust to a container element and start rendering.
     *
     * Single-binding by design: a second live WebGL context alongside
     * getUserMedia + MediaPipe is the iOS WebKit OOM zone (the reason
     * soul-enroll.html releases this context before its own scan). Callers
     * therefore have to cope with a refused mount ??`/preview/readiness-scan.js`
     * checks the return value and simply skips its stardust layer when a host
     * page (v6) already owns the binding.
     *
     * @param {HTMLElement} [el] - Container to render into. Defaults to
     *   `#universe`, which keeps the historical auto-init behaviour for
     *   `/preview/v6/`, `/preview/story.html` and `/preview/soul-enroll.html`.
     * @param {{fitContainer?: boolean}} [opts] - `fitContainer:true` sizes the
     *   canvas and camera from the container box instead of the viewport, so the
     *   sphere can live *inside* a small frame (North Star SS4: the soul belongs
     *   in the aperture). **Opt-in on purpose**: the three historical `#universe`
     *   hosts keep the viewport path byte-for-byte, because the stardust feel is
     *   a locked asset (CLAUDE.md) and must not shift as a side effect.
     * @returns {boolean} true when this call took ownership of the binding.
     */
    function mount(el, opts) {
        if (mounted) return false;
        var node = el || document.getElementById('universe');
        if (!node) return false;

        container = node;
        fitContainer = !!(opts && opts.fitContainer);
        mounted = true;

        // Fade-in to prevent black flash
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.6s ease';

        createRenderer();
        buildScene();
        start();

        // Fade in after first render
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (container) container.style.opacity = '1';
            });
        });

        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);
        return true;
    }

    /** @returns {boolean} whether the stardust currently owns a container. */
    function isMounted() {
        return mounted;
    }

    function createRenderer() {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        var vs0 = viewSize();
        renderer.setSize(vs0.w, vs0.h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // ?€?€ Freeze fix: a lost GL context must be preventDefault()-ed or the
        // browser will never restore it, leaving the ball frozen forever. ?€?€
        var cv = renderer.domElement;
        cv.addEventListener('webglcontextlost', onContextLost, false);
        cv.addEventListener('webglcontextrestored', onContextRestored, false);
    }

    function buildScene() {
        scene = new THREE.Scene();
        var vs1 = viewSize();
        camera = new THREE.PerspectiveCamera(75, vs1.w / vs1.h, 0.1, 1000);
        camera.position.z = 5;

        // Fibonacci sphere distribution
        var geometry = new THREE.BufferGeometry();
        var positions = new Float32Array(PARTICLE_COUNT * 3);
        var colors = new Float32Array(PARTICLE_COUNT * 3);
        var phi = Math.PI * (3 - Math.sqrt(5));
        var topColor = new THREE.Color(0xFF66CC);   // Pink
        var midColor = new THREE.Color(0x9966FF);   // Purple
        var botColor = new THREE.Color(0x00CCFF);   // Cyan

        // Per-particle drift seeds: each particle gets unique freq and amplitude
        basePositions = new Float32Array(PARTICLE_COUNT * 3);
        driftSeeds = new Float32Array(PARTICLE_COUNT * 4);
        hueBand = new Uint8Array(PARTICLE_COUNT);
        baseColors = new Float32Array(PARTICLE_COUNT * 3);

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
            var radius = Math.sqrt(1 - y * y);
            var theta = phi * i;
            var r = 2.5;
            var idx = i * 3;

            positions[idx]     = Math.cos(theta) * radius * r;
            positions[idx + 1] = y * r;
            positions[idx + 2] = Math.sin(theta) * radius * r;

            // Store base positions for drift calculation
            basePositions[idx]     = positions[idx];
            basePositions[idx + 1] = positions[idx + 1];
            basePositions[idx + 2] = positions[idx + 2];

            // Generate unique drift seeds per particle
            var si = i * 4;
            driftSeeds[si]     = 0.3 + Math.random() * 0.7;   // freqX: 0.3-1.0
            driftSeeds[si + 1] = 0.2 + Math.random() * 0.8;   // freqY: 0.2-1.0
            driftSeeds[si + 2] = 0.4 + Math.random() * 0.6;   // freqZ: 0.4-1.0
            driftSeeds[si + 3] = 0.02 + Math.random() * 0.05; // amplitude: 0.02-0.07 (tighter sphere)

            // Color gradient: bot cyan ??mid purple ??top pink
            var normalizedY = (y + 1) / 2;
            var mixed = new THREE.Color();
            if (normalizedY > 0.5) {
                mixed.copy(midColor).lerp(topColor, (normalizedY - 0.5) * 2);
            } else {
                mixed.copy(botColor).lerp(midColor, normalizedY * 2);
            }
            colors[idx] = mixed.r;
            colors[idx + 1] = mixed.g;
            colors[idx + 2] = mixed.b;

            // Store base colors for shimmer
            baseColors[idx] = mixed.r;
            baseColors[idx + 1] = mixed.g;
            baseColors[idx + 2] = mixed.b;

            // ?²å¸¶ç´¢å?ï¼šbloom è¦è?**æ¯é?ç²’å??‰è‡ªå·±ç??²ç›¸?ç§»**ï¼Œä?ä¸èƒ½æ¯é?ç®—ä?æ¬?            // ä¸‰è??½æ•¸?‚é??–æ? HUE_BANDS ?‹è‰²å¸¶ï?å»ºæ??‚ç?ä¸€æ¬¡ï?ï¼Œæ???tick ?ªå»º
            // HUE_BANDS ?‹çŸ©???æ¯é?ç²’å??§å??„è‰²å¸¶å????”â€?            // per-particle ?æœ¬ä»æ˜¯ 9 æ¬¡ä?æ³•ï?è·Ÿä?å¤©ä?æ¨??MOTION-DIRECTION Â§2ï¼‰ã€?            //
            // ?”´ **?²å¸¶?Œæ??ƒé?åº¦è??¹ä?è§’ï??ºæ?ï¼‰ï?ä¸åª?ƒé?åº¦ã€?*
            // ?ªå?é«˜åº¦?‚é??²åª?¨ä?ä¸‹æ–¹?‘è?ï¼Œæ˜¯ä¸€æ¢å–®ç´”ç?æ¼¸å±¤ï¼›æ··?¥æ–¹ä½è?ä¹‹å?
            // é¡è‰²ä¹Ÿç??—ç?è½‰ï??Œä?é«˜åº¦?„ç?å­æ??½åœ¨ä¸å??²å¸¶ ?”â€?????¯ã€Œå±¤æ¬¡ã€ã€?            // ? ï? ?™ä?è®“å??²è??²å¸¶**ä¸å?ä¸€ä¸€å°æ?**ï¼Œæ?ä»¥å??€?¡å??ˆæ”¹??            // base ? band ?„æ??‰ç??ˆï?è¦?preview-scan-stardust.mjsï¼‰ã€?            // ?å??„å¥½?•ï?æ··å?ä¹‹å??´é??„å¹³?‡è‰²?´ä?å®¹æ?è¶¨ç°ï¼Œä¸»???E ?è€Œè?å¥½ã€?            hueBand[i] = hueBandOf(normalizedY, positions[idx], positions[idx + 2]);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Soft radial gradient sprite texture
        var spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = 32;
        spriteCanvas.height = 32;
        var ctx = spriteCanvas.getContext('2d');
        var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.24, 'rgba(255,255,255,0.90)');
        grad.addColorStop(0.56, 'rgba(255,255,255,0.40)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);

        var tex = new THREE.Texture(spriteCanvas);
        tex.needsUpdate = true;

        material = new THREE.PointsMaterial({
            size: PARTICLE_SIZE,
            map: tex,
            transparent: true,
            opacity: 0.92,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        cloud = new THREE.Points(geometry, material);
        scene.add(cloud);
    }

    function start() {
        if (running) return;
        running = true;
        lastDriftT = -1;
        animFrame = requestAnimationFrame(animate);
    }

    function stop() {
        running = false;
        if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    }

    function onContextLost(e) {
        // Critical: preventDefault lets the browser restore the context later.
        e.preventDefault();
        contextLost = true;
        stop();
        // Watchdog: some mobile browsers never fire 'restored' after an OOM loss,
        // which would leave the ball frozen forever ??rebuild ourselves if so.
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = setTimeout(function () { if (contextLost) rebuild(); }, 2500);
        console.warn('[TENKI stardust] WebGL context lost ??awaiting restore/rebuild');
    }

    function onContextRestored() {
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        // Full rebuild (fresh renderer + scene) ??guarantees recovery regardless of
        // whether the GL driver kept our resources. Same scene, so visually identical.
        rebuild();
        console.warn('[TENKI stardust] WebGL context restored ??rebuilt');
    }

    // Tear down the dead renderer/canvas and recreate everything from retained CPU
    // data, then resume. Visual identity is unchanged (same geometry/colours/material).
    function rebuild() {
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        // Unmounted while a retry was in flight: stay down. Without this the
        // catch below would re-arm the 2500ms timer forever against a null
        // container, quietly burning a timer for the life of the page.
        if (!mounted || !container) return;
        try {
            if (renderer) {
                var old = renderer.domElement;
                try { renderer.dispose(); } catch (_) {}
                if (old) {
                    old.removeEventListener('webglcontextlost', onContextLost, false);
                    old.removeEventListener('webglcontextrestored', onContextRestored, false);
                    if (old.parentNode) old.parentNode.removeChild(old);
                }
            }
        } catch (_) {}
        renderer = null;
        running = false;
        try {
            contextLost = false;
            createRenderer();
            buildScene();
            start();
            playEntrance();
            console.warn('[TENKI stardust] rebuilt after context loss');
        } catch (e) {
            // GPU still unavailable ??back off and retry.
            contextLost = true;
            if (lostTimer) clearTimeout(lostTimer);
            lostTimer = setTimeout(rebuild, 2500);
            console.warn('[TENKI stardust] rebuild failed, retrying:', e && e.message);
        }
    }

    function onVisibility() {
        if (document.hidden) stop();
        else if (!contextLost) start();
    }

    function animate() {
        if (!running) return;
        animFrame = requestAnimationFrame(animate);

        var t = clock.getElapsedTime();

        // Auto-decay blink flash
        expr.blinkFlash *= 0.82;

        stepReadout();

        if (cloud) {
            // ?€?€ Per-particle organic drift ?€?€
            var posAttr = cloud.geometry.getAttribute('position');
            var colAttr = cloud.geometry.getAttribute('color');
            var pos = posAttr.array;
            var col = colAttr.array;

            // Drift intensity scales with expression (more emotional ??more particle chaos)
            var driftMult = 0.95;
            if (expr.active) {
                driftMult += expr.mouthOpen * 0.48 + expr.browTension * 0.28;
            }
            // Readout: ä½ è?ç©©ï?ç²’å?è¶Šå?å®šã€‚é€™æ˜¯?Œä??ç©©å®šã€é‚£?¥æ?ä»¤ç??é?è¿´å? ?”â€?            // ä½¿ç”¨?…å?å°ä?ï¼Œä¸»è§’è??‹å??ºä???founder 2026-08-10 ?¾å¯¬äº†æ?ç§»ç???
            if (readout.active) {
                driftMult *= READOUT_DRIFT_HI + (READOUT_DRIFT_LO - READOUT_DRIFT_HI) * readout.sStill;
            }

            // Throttle drift to ~20fps by ELAPSED TIME (was: assume 60fps), so the
            // cadence ??and the feel ??stays the same whether render is 60 or 30fps.
            if (lastDriftT < 0 || t - lastDriftT >= 0.05) {
                lastDriftT = t;

                // Tone: ease toward the requested values, then build the 3?3 once
                // for the whole cloud. Per particle this costs 9 multiplies ??                // the same order as the shimmer that is already here, and it
                // touches only the colour buffer (MOTION-DIRECTION Â§2: no layout).
                stepTone();
                var toned = !toneIdle();
                var m = toned ? toneMat : null;

                // ?€?€ Readout ?„é??²ï?bloomï¼ˆæ•£?‹ï?+ hueRotï¼ˆæ?ç¨‹ï??€?€
                //
                //   bloom  ?”â€?ä½ è?ç©©ï?æ¯é?ç²’å??„è‰²?¸æ•£å¾—è??‹ï??ˆé?**å±•é?**å¾—æ›´è±å?
                //   hueRot ?”â€?ç´¯ç??„æ??ˆé?æ¸¬è?å¤šï??´å ´?²ç›¸èµ°é?ä¸€æ®µæ?ç¨?                //
                // ? ï? ä¸Šä??ˆæ˜¯?é?ä¾†ç?ï¼ˆæ”¶?å–®ä¸€?’è‰²ï¼‰ï?çµæ??¨æ­£å¸¸æ¡ç©©ç? 85??5%
                //    ç©©å?åº¦ä??´å ´?½æ˜¯?®è‰² ?”â€?founder è¦ç??¯ã€Œæ›´å¤šå±¤æ¬¡è‰²å½©è??–ã€ã€?                //    **?¾åœ¨é¡è‰²æ°¸é?ä¸æ?è®Šå?**ï¼šbloom=0 ?‚ä??¯å??´ç??ºç?æ¼¸å±¤??                //
                // æ¯é?ç²’å?è¦æ??ªå·±?„è‰²?¸å?ç§»ï?ä½†ä??½æ?é¡†ç?ä¸‰è??½æ•¸ï¼?                // ?å???HUE_BANDS ?‹è‰²å¸¶ï?æ¯?tick å»?HUE_BANDS ?‹çŸ©???
                // æ¯é?ç²’å???`hueBand[i]` ?–ç”¨ ?”â€?per-particle ä»æ˜¯ 9 æ¬¡ä?æ³•ã€?                var bloomed = readout.active
                    && (readout.sStill > 0.001 || readout.sProg > 0.001);
                if (bloomed) buildBandMats();
                var mixAmt = tone.mix;
                var tr = tone.r, tg = tone.g, tb = tone.b;

                for (var i = 0; i < PARTICLE_COUNT; i++) {
                    var idx = i * 3;
                    var si = i * 4;

                    var fx = driftSeeds[si];
                    var fy = driftSeeds[si + 1];
                    var fz = driftSeeds[si + 2];
                    var amp = driftSeeds[si + 3] * driftMult;

                    // Each particle floats with its own unique sine pattern
                    pos[idx]     = basePositions[idx]     + Math.sin(t * fx + i * 0.01) * amp;
                    pos[idx + 1] = basePositions[idx + 1] + Math.cos(t * fy + i * 0.013) * amp;
                    pos[idx + 2] = basePositions[idx + 2] + Math.sin(t * fz + i * 0.017) * amp * 0.8;

                    var br = baseColors[idx];
                    var bg = baseColors[idx + 1];
                    var bb = baseColors[idx + 2];

                    // ?”´ **?©é™£?ªèƒ½å¥—ä?æ¬¡ã€?* bandMats å·²ç??«ä??²ç›¸?‹è??‡é£½?Œåº¦ï¼?                    // ?¥é€™è£¡?å?ä¸€æ¬?toneMat å°±æ˜¯?™é?é£½å? + ?™é??²ç›¸??                    // ?€ä»¥å…©?…æ˜¯**äº’æ–¥**?„ï?bloom æ´»è?å°±ç”±å®ƒæ??‰é€™ä?æ­¥ï?
                    // ?¦å??èµ°?¨å???toneMatï¼ˆæ”¶?Ÿæ? readout å·²è¢« clearï¼Œèµ°?™æ?ï¼‰ã€?                    if (bloomed) {
                        var bo = hueBand[i] * 9;
                        var pr = bandMats[bo] * br + bandMats[bo + 1] * bg + bandMats[bo + 2] * bb;
                        var pg = bandMats[bo + 3] * br + bandMats[bo + 4] * bg + bandMats[bo + 5] * bb;
                        var pb = bandMats[bo + 6] * br + bandMats[bo + 7] * bg + bandMats[bo + 8] * bb;
                        br = pr; bg = pg; bb = pb;
                    } else if (toned) {
                        var rr = m[0] * br + m[1] * bg + m[2] * bb;
                        var gg = m[3] * br + m[4] * bg + m[5] * bb;
                        var bbv = m[6] * br + m[7] * bg + m[8] * bb;
                        br = rr; bg = gg; bb = bbv;
                    }
                    // å¾€?¶ä??„ç›®æ¨™è‰²?¶ï??¶æ??‚ç? gold / å¸¶ä??²ï??‚å…©æ¢è·¯?½è??šã€?                    if (mixAmt > 0) {
                        br += (tr - br) * mixAmt;
                        bg += (tg - bg) * mixAmt;
                        bb += (tb - bb) * mixAmt;
                    }

                    // Subtle color shimmer: gentle hue shift over time
                    var shimmer = 0.025 * Math.sin(t * 0.5 + i * 0.003);
                    col[idx]     = Math.max(0, Math.min(1, br + shimmer));
                    col[idx + 1] = Math.max(0, Math.min(1, bg + shimmer * 0.6));
                    col[idx + 2] = Math.max(0, Math.min(1, bb - shimmer * 0.3));
                }
                posAttr.needsUpdate = true;
                colAttr.needsUpdate = true;
            }

            // ?€?€ v25.8.2 Rolling Rotation (accumulating increment = natural tumble) ?€?€
            // Forward roll: X-axis is the main rolling axis, with gentle Y/Z precession
            var rotSpeedX = ROLL_CFG.x;
            var rotSpeedY = ROLL_CFG.y;
            var rotSpeedZ = ROLL_CFG.z;
            var rollPulse = Math.sin(t * ROLL_CFG.pulseFreq) * ROLL_CFG.pulseAmp;
            if (expr.active) {
                // Emotion active: brow tension ??faster rolling (agitation)
                rotSpeedX += expr.browTension * 0.00195;
                // Mouth open ??slightly faster (excitement/arousal)
                rotSpeedY += expr.mouthOpen * 0.00095;
                // Add wobble on other axes for dramatic expression
                rotSpeedZ += expr.browTension * 0.00042;
            }
            cloud.rotation.x += rotSpeedX + rollPulse;
            cloud.rotation.y += rotSpeedY + Math.sin(t * 0.13) * 0.00037;
            cloud.rotation.z += rotSpeedZ + Math.sin(t * 0.16) * 0.00020;

            // ?€?€ v25.8.2 Per-particle Expression Scaling (updateParticleSync) ?€?€
            // Each particle individually scales based on expression:
            // eyeScale: eyes closed ??particles contract (0.8?), eyes open ??expand (1.2?)
            // mouthExpansion: mouth open ??particles spread outward (up to 1.3?)
            var eyeScale = 0.8 + (expr.eyeOpen * 0.4);
            var mouthExpansion = 1 + (expr.mouthOpen * 0.3);
            var exprScale = eyeScale * mouthExpansion;

            // Breathing: period ~4s, combines with expression scale
            var breath = 1 + Math.sin(t * 1.571) * 0.02;

            // Smooth big?’small entrance (easeOutCubic), multiplies the rest.
            var entScale = 1;
            if (entranceStart >= 0) {
                var p = (t - entranceStart) / ENTRANCE.dur;
                if (p >= 1) { entranceStart = -1; }
                else {
                    var e = 1 - Math.pow(1 - Math.max(0, p), 3);
                    entScale = ENTRANCE.from - (ENTRANCE.from - 1) * e;
                }
            }

            // Readout: ?ƒå??‚è„¹å¤§ã€ç©©ä½æ??¶æ?ä¸€é¡†æ ¸??            // ? ï? ?™ä?æ®µæ‰¿?”ç??¯å??äº¤çµ¦ã€Œç?å­æ?ç§»ã€ç?å·¥ä? ?”â€???€‹ç?ä½ç§»å·®åª??2.2pxï¼?            // ?™è£¡?¯æ•´é«”å°ºåº?32%ï¼?00px ?„ç?ä¸Šç? 48pxï¼‰ï?å·®ä??‹é?ç´šã€?            var readoutScale = readout.active
                ? READOUT_SCALE_HI + (READOUT_SCALE_LO - READOUT_SCALE_HI) * readout.sStill
                : 1;

            var totalScale = breath * exprScale * entScale * readoutScale;
            // å¤¾ä?ä¸Šé? ?”â€?exprScale ?€å¤§åˆ° 1.56ï¼Œç›¸ä¹˜å??¯èƒ½?¹å‡º?ƒæ?æ¡†ã€?            // å¤¾åœ¨ä»Šå¤©å¯¦é??ƒåˆ°?„å€¼ï?ä¿è??™ä??€ä¸æ?è®“ç?æ¯”ç¾?¨æ›´å¤§ã€?            if (readout.active && entranceStart < 0 && totalScale > READOUT_SCALE_CAP) {
                totalScale = READOUT_SCALE_CAP;
            }
            cloud.scale.set(totalScale, totalScale, totalScale);
        }

        // Blink flash ??brief opacity dip (abstract "blink" via particle opacity)
        if (material) {
            var op = 0.9;
            if (expr.active) {
                op -= expr.blinkFlash * 0.35;
                // Emotional intensity subtly shifts particle brightness
                op += (expr.browTension - 0.5) * 0.05;
            }
            if (readout.active) {
                // ?¨çœ¼??*?Ÿç??åˆ°?„é›¢???ä»?*ï¼Œå€¼å?ä¸€?“ç?å¾—è??„è?è¡è€Œä??ªæ˜¯è®Šæ?ä¸€é»ã€?                // ?ˆå??ªæ? ??.35 ?„å‡¹?·ï??¨æ·±?²è??¯ä?å¹¾ä??‹ä??ºä???                op += expr.blinkFlash * 0.55;
                // è¶Šç©©è¶Šäº®?‚ç??å? Â±0.06 ?‰åˆ° Â±0.18 ?”â€??è€…åœ¨ additive æ··è‰²ä¸‹ç?ä¸å‡ºä¾†ã€?                op += (readout.sStill - 0.5) * READOUT_OPACITY_SWING * 2;
                // ç´¯ç??„æ??ˆé?æ¸¬è?å¤šï??ƒè?å¯¦ã€?                op += readout.sProg * READOUT_PROG_LIFT;
            }
            material.opacity = Math.max(0.4, Math.min(1.0, op));
        }

        // Guard render so a transient GL hiccup can't kill the loop.
        try {
            renderer.render(scene, camera);
        } catch (err) {
            console.warn('[TENKI stardust] render skipped:', err && err.message);
        }
    }

    function onResize() {
        if (!camera || !renderer) return;
        var vs = viewSize();
        camera.aspect = vs.w / vs.h;
        camera.updateProjectionMatrix();
        renderer.setSize(vs.w, vs.h);
    }

    /** Play the smooth big?’small scale-in (call when the ball becomes visible). */
    function playEntrance() {
        entranceStart = clock.getElapsedTime();
        if (!contextLost) start();
    }

    /** Dim the stardust (during scan completion) */
    function dim() {
        if (container) container.style.opacity = '0.3';
    }

    /** Brighten the stardust */
    function brighten() {
        if (container) container.style.opacity = '1';
    }

    /**
     * Tear the stardust down completely and release the WebGL context, leaving
     * the module ready for a fresh `mount()`.
     *
     * Previously this was a one-way door: it disposed the renderer but left
     * `renderer`/`container` set, left the canvas in the DOM, never forced the
     * context loss, and ??because it removes the contextlost/restored listeners
     * ??also removed the only path that could have rebuilt (`rebuild()` hangs
     * off those listeners). A later `playEntrance()` would then `start()` a rAF
     * loop against a disposed renderer, surviving only on the try/catch in
     * `animate()`. A scan overlay opens and closes repeatedly, so a re-mountable
     * teardown that actually returns the context is required; browsers cap live
     * contexts (~16) and drop the oldest, which on iOS shows up as the ball
     * silently freezing.
     *
     * Listener removal must happen before `forceContextLoss()` ??that call
     * fires `webglcontextlost`, and our handler would otherwise arm the
     * 2500ms rebuild watchdog against a renderer we are in the middle of
     * throwing away.
     */
    function destroy() {
        if (!mounted && !renderer) return;
        stop();
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (renderer) {
            var cv = renderer.domElement;
            if (cv) {
                cv.removeEventListener('webglcontextlost', onContextLost, false);
                cv.removeEventListener('webglcontextrestored', onContextRestored, false);
                if (cv.parentNode) cv.parentNode.removeChild(cv);
            }
            try { renderer.forceContextLoss(); } catch (_) { /* not fatal */ }
            renderer.dispose();
        }
        renderer = null;
        scene = null;
        camera = null;
        fitContainer = false;
        cloud = null;
        material = null;
        if (container) {
            container.style.opacity = '';
            container.style.transition = '';
            container = null;
        }
        contextLost = false;
        entranceStart = -1;
        mounted = false;
        // Tone is per-session, not per-module: a borrowed context handed back to
        // its original host must not arrive still wearing the scan's colour.
        tone.hue = 0; tone.sat = 1; tone.mix = 0; tone.r = 0; tone.g = 0; tone.b = 0;
        toneTarget.hue = 0; toneTarget.sat = 1; toneTarget.mix = 0;
        toneTarget.r = 0; toneTarget.g = 0; toneTarget.b = 0;
        toneMat = null;
        clearReadout(); // ?Œç?ï¼šå€Ÿå‡º?»ç? context ?„å??Ÿä¸»?‚ä?è©²é?å¸¶è?ä¸Šä?è¼ªç?è®€?ºç???    }

    // ?€?€ Tone: pure helpers ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
    // Kept side-effect free on purpose so they can be unit-verified directly
    // (known input ??known output) instead of only through a rendered frame,
    // which the sandbox cannot produce (three.js is CDN-blocked).

    /** Rec.709 luma weights ??the axis both hue rotation and saturation pivot on. */
    var LUM_R = 0.213, LUM_G = 0.715, LUM_B = 0.072;

    /**
     * Combined saturation + hue-rotation matrix, row-major 9-vector.
     *
     * Same construction as SVG `feColorMatrix` (`saturate` ??`hueRotate`), so the
     * result matches what a designer would get from a CSS filter. Composing the
     * two here means the per-particle inner loop stays a single 3?3 multiply.
     *
     * @param {number} hueTurns - Hue rotation in turns (1 = 360Â°).
     * @param {number} sat - Saturation multiplier (1 = unchanged, 0 = greyscale).
     * @returns {Array<number>} 9 coefficients, row-major.
     */
    function toneMatrix(hueTurns, sat) {
        var a = hueTurns * Math.PI * 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        // hueRotate
        var h = [
            LUM_R + c * (1 - LUM_R) - s * LUM_R,
            LUM_G - c * LUM_G - s * LUM_G,
            LUM_B - c * LUM_B + s * (1 - LUM_B),
            LUM_R - c * LUM_R + s * 0.143,
            LUM_G + c * (1 - LUM_G) + s * 0.140,
            LUM_B - c * LUM_B - s * 0.283,
            LUM_R - c * LUM_R - s * (1 - LUM_R),
            LUM_G - c * LUM_G + s * LUM_G,
            LUM_B + c * (1 - LUM_B) + s * LUM_B
        ];
        if (sat === 1) return h;
        // saturate
        var q = [
            LUM_R + (1 - LUM_R) * sat, LUM_G - LUM_G * sat, LUM_B - LUM_B * sat,
            LUM_R - LUM_R * sat, LUM_G + (1 - LUM_G) * sat, LUM_B - LUM_B * sat,
            LUM_R - LUM_R * sat, LUM_G - LUM_G * sat, LUM_B + (1 - LUM_B) * sat
        ];
        // h Â· q
        var o = new Array(9);
        for (var r = 0; r < 3; r++) {
            for (var k = 0; k < 3; k++) {
                o[r * 3 + k] = h[r * 3] * q[k] + h[r * 3 + 1] * q[3 + k] + h[r * 3 + 2] * q[6 + k];
            }
        }
        return o;
    }

    /**
     * @returns {boolean} whether the smoothed tone is close enough to "off" to skip.
     *
     * ? ï? å¿…é???readout ?„é£½?Œåº¦ç®—é€²ä? ?”â€??¦å? readout æ´»è??ä? tone ä¸‰å€‹å€¼éƒ½??     * ?è¨­?¼æ??ƒèµ°å¿«æ·è·¯å?ï¼Œé£½?Œåº¦å°±é?é»˜å¤±?ˆä???     */
    function toneIdle() {
        return Math.abs(tone.hue) < TONE_EPS
            && Math.abs(effectiveSat() - 1) < TONE_EPS
            && tone.mix < TONE_EPS;
    }

    /**
     * ?®å??Ÿæ??„é£½?Œåº¦??     *
     * ?”´ **é£½å?åº¦åª?½æ?ä¸€?‹å¯«?¥è€?*ï¼ˆPLAYBOOK Â§6ï¼šåˆ¤å®??ˆç¾?ªèƒ½?‰ä??‹ä?æº??”â€?     * ?™å€?bug é¡åˆ¥å·²ç??¬é??‘ä?æ¬¡ï??‚æ?ä»¥è??‡å¯«æ­»åœ¨?™è£¡ï¼?     * **readout æ´»è??„æ??™ç”± readout ?æ?ï¼Œå¦?‡ç”± setTone ?æ???*
     * ?æ¸¬ä¸?readiness-scan ?ªé¤µ `stillness`?ä?é¤?`sat`ï¼?     * ?¶æ??‚å???`clearReadout()` ??`setTone({sat})`ï¼Œäº¤?¥é??ç¢º??     */
    function effectiveSat() {
        return readout.active
            ? READOUT_SAT_LO + (READOUT_SAT_HI - READOUT_SAT_LO) * readout.sStill
            : tone.sat;
    }

    /** Ease the applied tone toward the requested one and rebuild the matrix. */
    function stepTone() {
        tone.hue += (toneTarget.hue - tone.hue) * TONE_SMOOTH;
        tone.sat += (toneTarget.sat - tone.sat) * TONE_SMOOTH;
        tone.mix += (toneTarget.mix - tone.mix) * TONE_SMOOTH;
        tone.r += (toneTarget.r - tone.r) * TONE_SMOOTH;
        tone.g += (toneTarget.g - tone.g) * TONE_SMOOTH;
        tone.b += (toneTarget.b - tone.b) * TONE_SMOOTH;
        toneMat = toneIdle() ? null : toneMatrix(tone.hue, effectiveSat());
    }

    /**
     * Colour the cloud from whatever the caller actually measured.
     *
     * ?”´ **Defaults are an identity transform.** A page that never calls this
     * renders exactly what it renders today ??that is how the locked v25.8.2
     * look survives this feature (CLAUDE.md).
     *
     * ? ï? This module makes no claim about *what* the values mean. It rotates a
     * gradient; naming the signal is the caller's job, and the caller must only
     * feed it things it genuinely measured.
     *
     * @param {{hue?:number, sat?:number, toward?:string, mix?:number}} [data]
     *   `hue` in turns (Â±0.5), `sat` multiplier, `toward` a CSS colour to pull
     *   toward (resolve `var(--token)` before passing it ??this runs per frame
     *   and must not touch the cascade), `mix` 0..1 how far to pull.
     */
    function setTone(data) {
        var d = data || {};
        if (d.hue !== undefined) toneTarget.hue = Math.max(-0.5, Math.min(0.5, d.hue));
        if (d.sat !== undefined) toneTarget.sat = Math.max(0, Math.min(3, d.sat));
        if (d.mix !== undefined) toneTarget.mix = Math.max(0, Math.min(1, d.mix));
        if (d.toward !== undefined) {
            try {
                var c = new THREE.Color(d.toward);
                toneTarget.r = c.r; toneTarget.g = c.g; toneTarget.b = c.b;
            } catch (_) { /* unparseable colour: keep the previous target */ }
        }
    }

    /** HUE_BANDS ??3?3ï¼ˆrow-majorï¼Œé€??å­˜æ”¾ï¼‰ï?æ¯?tick ?å»ºä¸€æ¬¡ã€?*/
    var bandMats = new Float32Array(HUE_BANDS * 9);

    /**
     * ?®å??„æ•£å¹…è??…ç??‚æŠ½?ºä??¶å–®ä¸€ä¾†æ? ?”â€?`readoutState()` ?‡ç¹ªè£½è¿´??     * ?½è??¨å?ä¸€çµ„å€¼ï??„ç?ä¸€æ¬¡å°±?¯ä?ä¸€?‹æ?æ¼‚ç§»?„é¡å°„ã€?     *
     * @returns {{bloom:number, rot:number}} turn ?ºå–®ä½ã€?     */
    function bloomRot() {
        if (!readout.active) return { bloom: 0, rot: 0 };
        return {
            bloom: readout.sStill * READOUT_BLOOM_MAX,
            rot: readout.sProg * READOUT_HUEROT_MAX,
        };
    }

    /**
     * å»?HUE_BANDS ?‹è‰²å¸¶çŸ©??€‚æ??‹è‰²å¸?= ?¨å ´?‹è? + å®ƒè‡ªå·±åœ¨æ¼¸å±¤ä¸Šç?????ç§»??     *
     * ???ä»¥æ¼¸å±¤ä¸­é»ç‚ºè»¸å?ç¨±å??‹ï?`band - ä¸­é?`ï¼‰ï??€ä»?*?´é??ƒç?å¹³å??²ç›¸
     * ä¸æ?è¢?bloom ?¨èµ°** ?”â€??¨èµ°?„è©±ä¸»è‰²?ƒæ??°åˆ¥?„è??è‰²ä¸Šã€?     */
    function buildBandMats() {
        var br = bloomRot();
        var sat = effectiveSat();
        var mid = (HUE_BANDS - 1) / 2;
        for (var b = 0; b < HUE_BANDS; b++) {
            var h = br.rot + ((b - mid) / mid) * (br.bloom / 2);
            var mm = toneMatrix(h, sat);
            var o = b * 9;
            for (var k = 0; k < 9; k++) bandMats[o + k] = mm[k];
        }
    }

    /** Ease the readout toward the requested values (per animation frame). */
    function stepReadout() {
        if (!readout.active) return;
        readout.sStill += (readout.still - readout.sStill) * READOUT_SMOOTH;
        readout.sProg += (readout.prog - readout.sProg) * READOUT_SMOOTH;
    }

    /**
     * ??*?™æ¬¡?æ¸¬?Ÿæ­£?åˆ°?„æ±è¥?*?¥åˆ°?ƒèº«ä¸Šï?è®“å??ç‚ºä¸€?‹è??ºè?ç½®ã€?     *
     * ?”´ ?™æ˜¯?é?è¿´å?ï¼Œä??¯è?é£¾ï??«é¢ä¸Šå«ä½¿ç”¨?…ã€Œä??ç©©å®šã€ï?
     * ??º¼?Œç©©ä½ä?æ²’æ??å°±å¿…é??¨ä¸»è§’èº«ä¸Šç?å¾—å‡ºä¾†ã€?     *
     * - `stillness` ??é£½å?åº?/ æ¼¸å±¤å¯¬åº¦ / ç²’å?æ¼‚ç§» / äº®åº¦ï¼?*è¶Šç©©è¶Šæ”¶?ã€è?ç´”ã€è?äº?*ï¼?     * - `progress`  ??å¾€ cyanCore ?šç„¦ + å°ºåº¦?¶ç?ï¼?*ç´¯ç??„æ??ˆé?æ¸?*ï¼Œä??¯è??‚å™¨ï¼?     *
     * ? ï? ?¼å«?™æ”¯å°±ä»£è¡¨é€™ä???*?¥å??Ÿå¡µ?ƒéš¨?æ¸¬?¶æ•£**ï¼ˆfounder 2026-08-10 ?¾å¯¬ï¼‰ã€?     * ä¸å‘¼?«ç??é¢å®Œå…¨ inertï¼Œé€ä??ƒç?ç¶­æ? v25.8.2??     *
     * @param {{stillness?: number, progress?: number}} [data] ?©è€…ç? 0..1??     */
    function setReadout(data) {
        var d = data || {};
        readout.active = true;
        if (d.stillness !== undefined) {
            readout.still = Math.max(0, Math.min(1, d.stillness));
        }
        if (d.progress !== undefined) {
            readout.prog = Math.max(0, Math.min(1, d.progress));
        }
    }

    /** ?œæ?è®€?ºå±¤ï¼Œå???inertï¼ˆæ??ç??Ÿæ??¼å«ï¼‰ã€?*/
    function clearReadout() {
        readout.active = false;
        readout.still = 0.5; readout.prog = 0;
        readout.sStill = 0.5; readout.sProg = 0;
    }

    /**
     * ?®å?å¥—ç”¨ä¸­ç?è®€?ºé?ï¼ˆå·²å¹³æ?ï¼‰ã€‚çµ¦ harness é©—ã€Œé€šé??Ÿç??‰å??ç”¨ ?”â€?     * æ¸²æ?çµæ??¨å®¹?¨è£¡?‹ä??°ï?three.js è¢«æ?ç®±æ?ï¼‰ï?ä½†é€™ä??¸å??‹å??°ã€?     *
     * @returns {{active:boolean, stillness:number, progress:number, sat:number,
     *   bloom:number, rot:number, scale:number, drift:number}}
     */
    function readoutState() {
        return {
            active: readout.active,
            stillness: readout.sStill,
            progress: readout.sProg,
            sat: effectiveSat(),
            // bloom / rot / scale ?¯ä¸»?šé?ï¼?*harness ? å??‘é??Œä½¿?¨è€…ç?ä¸ç?å¾—å‡ºä¾†ã€?*
            // ï¼ˆé??²æ•£å¾—å??‹ã€èµ°?å?å°‘è‰²?¸ã€ç??¹ç¸®?„æ?ä¾‹ï???            bloom: bloomRot().bloom,
            rot: bloomRot().rot,
            scale: readout.active
                ? READOUT_SCALE_HI + (READOUT_SCALE_LO - READOUT_SCALE_HI) * readout.sStill
                : 1,
            drift: READOUT_DRIFT_HI + (READOUT_DRIFT_LO - READOUT_DRIFT_HI) * readout.sStill,
        };
    }

    /** Return to the resting palette. Smoothed, like every other tone change. */
    function clearTone() {
        toneTarget.hue = 0;
        toneTarget.sat = 1;
        toneTarget.mix = 0;
    }

    /**
     * Who currently owns the binding, and how it was mounted.
     *
     * Needed because `destroy()` nulls `container`: a caller that wants to
     * *borrow* the single context has to capture the host before tearing it
     * down, or it has nothing to give back.
     *
     * @returns {?{node: HTMLElement, fitContainer: boolean}} null when unmounted.
     */
    function hostInfo() {
        return container ? { node: container, fitContainer: fitContainer } : null;
    }

    /** Set expression data from FaceMesh pipeline */
    function setExpression(data) {
        expr.active = true;
        if (data.mouthOpen !== undefined) expr.mouthOpen = data.mouthOpen;
        if (data.eyeOpen !== undefined) expr.eyeOpen = data.eyeOpen;
        if (data.browTension !== undefined) expr.browTension = data.browTension;
        if (data.blinkDetected) expr.blinkFlash = 1;
    }

    /** Clear expression state (face lost or face sync stopped) */
    function clearExpression() {
        expr.active = false;
        expr.mouthOpen = 0;
        expr.eyeOpen = 1;
        expr.blinkFlash = 0;
        expr.browTension = 0.5;
    }

    // Auto-init when DOM ready. Unchanged behaviour: pages that ship a
    // `#universe` (v6 / story / soul-enroll) get bound automatically; pages
    // without one (e.g. /decision-alert/) are simply left alone, and whoever
    // wants the stardust there calls mount() with their own container.
    function autoMount() { mount(null); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
    } else {
        autoMount();
    }

    
    // ¢w¢w Camera Control Layer (Additive API for Hero Camera Motion) ¢w¢w¢w¢w¢w¢w¢w¢w¢w¢w¢w
    var camControl = {
        active: false,
        x: 0, y: 0, z: 5,
        rotX: 0, rotY: 0, rotZ: 0,
        fov: 75,
        lookAtX: 0, lookAtY: 0, lookAtZ: 0
    };

    function setCamera(opts) {
        if (!opts) return;
        camControl.active = true;
        if (opts.x !== undefined) camControl.x = opts.x;
        if (opts.y !== undefined) camControl.y = opts.y;
        if (opts.z !== undefined) camControl.z = opts.z;
        if (opts.rotX !== undefined) camControl.rotX = opts.rotX;
        if (opts.rotY !== undefined) camControl.rotY = opts.rotY;
        if (opts.rotZ !== undefined) camControl.rotZ = opts.rotZ;
        if (opts.fov !== undefined && camera && camera.fov !== opts.fov) {
            camControl.fov = opts.fov;
            camera.fov = opts.fov;
            camera.updateProjectionMatrix();
        }
        if (camera) {
            camera.position.set(camControl.x, camControl.y, camControl.z);
            if (opts.lookAtX !== undefined || opts.lookAtY !== undefined || opts.lookAtZ !== undefined) {
                camControl.lookAtX = opts.lookAtX || 0;
                camControl.lookAtY = opts.lookAtY || 0;
                camControl.lookAtZ = opts.lookAtZ || 0;
                camera.lookAt(camControl.lookAtX, camControl.lookAtY, camControl.lookAtZ);
            }
        }
    }

    function getCamera() {
        return camera;
    }

    function cameraState() {
        return {
            active: camControl.active,
            x: camera ? camera.position.x : 0,
            y: camera ? camera.position.y : 0,
            z: camera ? camera.position.z : 5,
            fov: camera ? camera.fov : 75
        };
    }

    function resetCamera() {
        camControl.active = false;
        camControl.x = 0; camControl.y = 0; camControl.z = 5;
        camControl.rotX = 0; camControl.rotY = 0; camControl.rotZ = 0;
        camControl.fov = 75;
        if (camera) {
            camera.position.set(0, 0, 5);
            camera.fov = 75;
            camera.updateProjectionMatrix();
            camera.lookAt(0, 0, 0);
        }
    }

    global.TENKI_STARDUST = {
        setCamera: setCamera,
        getCamera: getCamera,
        cameraState: cameraState,
        resetCamera: resetCamera,
        mount: mount,
        unmount: destroy,
        isMounted: isMounted,
        dim: dim,
        brighten: brighten,
        destroy: destroy,
        playEntrance: playEntrance,
        setExpression: setExpression,
        clearExpression: clearExpression,
        hostInfo: hostInfo,
        setTone: setTone,
        clearTone: clearTone,
        setReadout: setReadout,
        clearReadout: clearReadout,
        readoutState: readoutState,
        // Exported for direct unit verification ??the rendered frame is not
        // reachable in the sandbox (three.js is CDN-blocked), but this is.
        toneMatrix: toneMatrix,
        hueBandOf: hueBandOf,
        HUE_BANDS: HUE_BANDS,
        // ?”´ ?–å?è³‡ç”¢??*?Ÿæ­£**?˜é?ï¼šå???false ?„é‚£ä¸€?»ï?ç²’å?å°±ä?é¡†éƒ½ä¸é??°ä??²ã€?        // harness ?¬ä??ªé? `readoutState().active === false`ï¼Œä???˜¯ä¸€?‹è?å¸³ç”¨??        // ?—æ?ï¼Œä??¯é??²é€šé? ?”â€??‘æ? effectiveSat ?¹æ?æ°¸é?èµ?readout ?†æ”¯
        // ï¼ˆé??¯é£½?Œåº¦ 1.0 ??1.20ï¼Œv25.8.2 ?„æ¨£å­ç•¶?´è¢«?¹æ?ï¼‰æ?å®ƒç…§æ¨?…¨ç¶ ã€?        toneIdle: toneIdle
    };
})(window);

