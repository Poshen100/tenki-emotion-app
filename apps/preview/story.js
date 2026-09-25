/**
 * story.js — Cinematic Camera & Scroll Wiring for apps/preview/story.html
 * GSAP 3.13+ timelines + ScrollTrigger + SplitText + CustomEase + DrawSVG.
 *
 * Implements 3 distinct camera language takes (Take 1 / Take 2 / Take 3).
 * To switch takes, set ACTIVE_TAKE = 1 | 2 | 3 below.
 */
(function () {
  'use strict';

  // ── Take Selector ──────────────────────────────────────────────────────────
  // 1 = Depth Push-In & Space Fly-Through (Recommended / Founder North Star)
  // 2 = Cosmic Pull-Back & Grand Reveal
  // 3 = Orbital Parallax & Dive
  var ACTIVE_TAKE = 1;

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }
  if (typeof gsap !== 'undefined' && typeof SplitText !== 'undefined') {
    gsap.registerPlugin(SplitText);
  }
  if (typeof gsap !== 'undefined' && typeof DrawSVGPlugin !== 'undefined') {
    gsap.registerPlugin(DrawSVGPlugin);
  }

  // Brand ease curves registered via CustomEase
  if (typeof gsap !== 'undefined' && typeof CustomEase !== 'undefined') {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('calm', 'M0,0 C0.22,1 0.36,1 1,1');    // --ease-calm
    CustomEase.create('breath', 'M0,0 C0.4,0 0.6,1 1,1');    // --ease-breath
    CustomEase.create('secure', 'M0,0 C0.19,1 0.22,1 1,1');  // --ease-secure
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHero();
    initStoryPanels();
    initTransition();
    initDashboard();
    initFooter();

    // Web font swap (Inter) reflow compensation
    if (typeof ScrollTrigger !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
  });

  function getEase(name, fallback) {
    if (typeof CustomEase !== 'undefined' && gsap.parseEase && gsap.parseEase(name)) {
      return name;
    }
    return fallback;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO — 3D Cinematic Camera Entrance & Depth Parallax
  // ═══════════════════════════════════════════════════════════════════════════
  function initHero() {
    if (typeof gsap === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');
    var breathEase = getEase('breath', 'sine.inOut');
    var secureEase = getEase('secure', 'back.out(1.2)');

    gsap.matchMedia().add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)'
      },
      function (context) {
        var reduced = context.conditions.reduced;

        // 🔴 Guardrail #3: prefers-reduced-motion MUST have zero camera motion
        if (reduced) {
          if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.resetCamera === 'function') {
            window.TENKI_STARDUST.resetCamera();
          }
          gsap.set(['#nav', '#hero-kicker', '#hero-title', '#hero-title .word', '#hero-sub', '#hero-actions .btn', '#scroll-cue'], {
            clearProps: 'all'
          });
          gsap.set('#universe', { opacity: 1, clearProps: 'transform' });
          return;
        }

        if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.playEntrance === 'function') {
          window.TENKI_STARDUST.playEntrance();
        }

        var heroTitle = document.querySelector('#hero-title');
        var words = document.querySelectorAll('#hero-title .word');
        var split = null;

        if (typeof SplitText !== 'undefined' && heroTitle) {
          split = new SplitText(heroTitle, { type: 'words', wordsClass: 'word' });
          words = split.words;
        }

        var accentWords = Array.prototype.filter.call(words, function (w) {
          return w.classList && w.classList.contains('accent');
        });

        // ── Initial 3D Camera & DOM States per Selected Take ──────────────────
        var camProxy = { z: 5, y: 0, x: 0, fov: 75 };
        var masterTL = gsap.timeline({ delay: 0.1 });

        if (ACTIVE_TAKE === 1) {
          // ── Take 1: Depth Push-In & Space Fly-Through ──────────────────────
          camProxy.z = 10.8;
          if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
            window.TENKI_STARDUST.setCamera({ z: camProxy.z, y: 0, x: 0 });
          }

          // Initial 3D placement across deep Z layers
          gsap.set('#universe', { opacity: 0, scale: 0.95 });
          gsap.set('#nav', { autoAlpha: 0, y: -16, z: 20 });
          gsap.set('#hero-kicker', { autoAlpha: 0, y: 24, z: -100, rotateX: 18 });
          gsap.set(words, { autoAlpha: 0, y: 50, z: -80, rotateX: 25, transformPerspective: 1000 });
          if (accentWords.length) {
            gsap.set(accentWords, { scale: 0.96, z: -60 });
          }
          gsap.set('#hero-sub', { autoAlpha: 0, y: 28, z: -50, rotateX: 12 });
          gsap.set('#hero-actions .btn', { autoAlpha: 0, y: 24, z: -30, scale: 0.92 });
          gsap.set('#scroll-cue', { autoAlpha: 0, z: 10 });

          // 1. Stardust Canvas & Three.js Camera Push-In (3.8s confident glide)
          masterTL.to('#universe', { opacity: 1, scale: 1, duration: 1.6, ease: 'sine.out' }, 0.05);
          masterTL.to(camProxy, {
            z: 5.0,
            duration: 3.8,
            ease: calmEase,
            onUpdate: function () {
              if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
                window.TENKI_STARDUST.setCamera({ z: camProxy.z });
              }
            }
          }, 0.1);

          // 2. Nav Bar Reveal
          masterTL.to('#nav', { autoAlpha: 1, y: 0, z: 0, duration: 0.8, ease: calmEase }, 0.3);

          // 3. Kicker Pill with subtle 3D leveling
          masterTL.to('#hero-kicker', { autoAlpha: 1, y: 0, z: 0, rotateX: 0, duration: 1.0, ease: calmEase }, 0.45);

          // 4. Headline Word-by-Word 3D Surfacing
          masterTL.to(words, {
            autoAlpha: 1,
            y: 0,
            z: 0,
            rotateX: 0,
            duration: 1.3,
            stagger: 0.065,
            ease: calmEase
          }, 0.7);

          // 5. Accent Glow Pop
          if (accentWords.length) {
            masterTL.to(accentWords, { scale: 1, z: 0, duration: 0.9, ease: secureEase }, 1.3);
          }

          // 6. Subhead Materialize
          masterTL.to('#hero-sub', { autoAlpha: 1, y: 0, z: 0, rotateX: 0, duration: 1.0, ease: calmEase }, 1.8);

          // 7. CTAs Spring-in
          masterTL.to('#hero-actions .btn', {
            autoAlpha: 1,
            y: 0,
            z: 0,
            scale: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: secureEase
          }, 2.2);

          // 8. Scroll Cue Ambient Pulse
          masterTL.to('#scroll-cue', {
            autoAlpha: 1,
            duration: 0.8,
            ease: calmEase,
            onComplete: function () {
              gsap.to('#scroll-cue .line', {
                scaleY: 1.25,
                y: 4,
                duration: 1.8,
                ease: breathEase,
                repeat: -1,
                yoyo: true
              });
            }
          }, 2.8);

        } else if (ACTIVE_TAKE === 2) {
          // ── Take 2: Cosmic Pull-Back & Grand Reveal ───────────────────────
          camProxy.z = 1.8;
          if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
            window.TENKI_STARDUST.setCamera({ z: camProxy.z });
          }

          gsap.set('#universe', { opacity: 0, scale: 1.2 });
          gsap.set('#nav', { autoAlpha: 0, y: -12 });
          gsap.set('#hero-kicker', { autoAlpha: 0, scale: 0.8, y: 20 });
          gsap.set(words, { autoAlpha: 0, scale: 1.15, z: 60, filter: 'blur(8px)' });
          gsap.set('#hero-sub', { autoAlpha: 0, y: 20 });
          gsap.set('#hero-actions .btn', { autoAlpha: 0, scale: 0.9, y: 16 });
          gsap.set('#scroll-cue', { autoAlpha: 0 });

          masterTL.to('#universe', { opacity: 1, scale: 1, duration: 2.0, ease: 'power2.out' }, 0);
          masterTL.to(camProxy, {
            z: 5.2,
            duration: 4.0,
            ease: 'power3.out',
            onUpdate: function () {
              if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
                window.TENKI_STARDUST.setCamera({ z: camProxy.z });
              }
            }
          }, 0.1);

          masterTL.to('#nav', { autoAlpha: 1, y: 0, duration: 0.7, ease: calmEase }, 0.4);
          masterTL.to('#hero-kicker', { autoAlpha: 1, scale: 1, y: 0, duration: 0.9, ease: calmEase }, 0.6);
          masterTL.to(words, {
            autoAlpha: 1,
            scale: 1,
            z: 0,
            filter: 'blur(0px)',
            duration: 1.4,
            stagger: 0.06,
            ease: calmEase
          }, 0.9);
          masterTL.to('#hero-sub', { autoAlpha: 1, y: 0, duration: 0.9, ease: calmEase }, 1.9);
          masterTL.to('#hero-actions .btn', { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, stagger: 0.08, ease: secureEase }, 2.3);
          masterTL.to('#scroll-cue', { autoAlpha: 1, duration: 0.8, ease: calmEase }, 2.9);

        } else if (ACTIVE_TAKE === 3) {
          // ── Take 3: Orbital Parallax & Dive ──────────────────────────────
          camProxy.z = 7.5;
          camProxy.y = 2.0;
          if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
            window.TENKI_STARDUST.setCamera({ z: camProxy.z, y: camProxy.y, lookAtY: -0.2 });
          }

          gsap.set('#universe', { opacity: 0 });
          gsap.set('.hero-inner', { rotateX: 16, y: 40 });
          gsap.set('#nav', { autoAlpha: 0, y: -20 });
          gsap.set('#hero-kicker', { autoAlpha: 0, y: 20 });
          gsap.set(words, { autoAlpha: 0, y: 35, z: -40 });
          gsap.set('#hero-sub', { autoAlpha: 0, y: 24 });
          gsap.set('#hero-actions .btn', { autoAlpha: 0, scale: 0.92, y: 20 });
          gsap.set('#scroll-cue', { autoAlpha: 0 });

          masterTL.to('#universe', { opacity: 1, duration: 1.4 }, 0);
          masterTL.to(camProxy, {
            z: 5.0,
            y: 0,
            duration: 3.6,
            ease: calmEase,
            onUpdate: function () {
              if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
                window.TENKI_STARDUST.setCamera({ z: camProxy.z, y: camProxy.y, lookAtY: 0 });
              }
            }
          }, 0.1);

          masterTL.to('.hero-inner', { rotateX: 0, y: 0, duration: 3.2, ease: calmEase }, 0.2);
          masterTL.to('#nav', { autoAlpha: 1, y: 0, duration: 0.8, ease: calmEase }, 0.3);
          masterTL.to('#hero-kicker', { autoAlpha: 1, y: 0, duration: 0.9, ease: calmEase }, 0.5);
          masterTL.to(words, { autoAlpha: 1, y: 0, z: 0, duration: 1.1, stagger: 0.06, ease: calmEase }, 0.8);
          masterTL.to('#hero-sub', { autoAlpha: 1, y: 0, duration: 0.9, ease: calmEase }, 1.8);
          masterTL.to('#hero-actions .btn', { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, stagger: 0.1, ease: secureEase }, 2.2);
          masterTL.to('#scroll-cue', { autoAlpha: 1, duration: 0.8, ease: calmEase }, 2.8);
        }

        // ── Hero Exit Scrub: 3D Depth Traversal (Hero -> Story Panel 1) ──────
        var exitScrub = null;
        if (typeof ScrollTrigger !== 'undefined') {
          var scrollCam = { z: 5.0 };
          exitScrub = gsap.timeline({
            scrollTrigger: {
              trigger: '#hero',
              start: 'top top',
              end: 'bottom top',
              scrub: 0.6
            }
          });

          // Camera plunges deep through the particle cloud into story
          exitScrub.to(scrollCam, {
            z: 1.2,
            ease: 'none',
            onUpdate: function () {
              if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.setCamera === 'function') {
                window.TENKI_STARDUST.setCamera({ z: scrollCam.z });
              }
            }
          }, 0);

          // Hero DOM accelerates toward viewer in 3D and fades out
          exitScrub.to('.hero-inner', {
            z: 280,
            y: -60,
            autoAlpha: 0,
            ease: 'power1.in'
          }, 0);

          // Stardust fades partially to serve as luminous backdrop for story
          exitScrub.to('#universe', {
            opacity: 0.42,
            yPercent: 12,
            ease: 'none'
          }, 0);

          exitScrub.to('#scroll-cue', { autoAlpha: 0, ease: 'none' }, 0);
        }

        return function () {
          masterTL.kill();
          if (exitScrub && exitScrub.scrollTrigger) exitScrub.scrollTrigger.kill();
          if (split && split.revert) split.revert();
          if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.resetCamera === 'function') {
            window.TENKI_STARDUST.resetCamera();
          }
        };
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORY PANELS — Pinning & Deep Parallax Transitions
  // ═══════════════════════════════════════════════════════════════════════════
  function initStoryPanels() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');

    gsap.matchMedia().add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)'
      },
      function (context) {
        var reduced = context.conditions.reduced;
        var panels = gsap.utils.toArray('.story-panel');
        var splits = [];

        if (reduced) {
          gsap.set(panels, { clearProps: 'all' });
          gsap.set('.story-index-line .draw-line', { clearProps: 'all' });
          return;
        }

        // ── Visual Interactive Loops ──
        var laser = document.querySelector('#sv-laser-1');
        if (laser) {
          gsap.to(laser, { y: 220, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        }
        var radarPoly = document.querySelector('#sv-radar-polygon');
        if (radarPoly) {
          gsap.to(radarPoly, { scale: 1.04, transformOrigin: 'center center', duration: 2.5, repeat: -1, yoyo: true, ease: breathEase });
        }
        var vaultChip = document.querySelector('.sv-vault-chip');
        if (vaultChip) {
          gsap.to(vaultChip, { scale: 1.03, duration: 2.8, repeat: -1, yoyo: true, ease: breathEase });
        }

        var scrollTriggers = panels.map(function (panel, i) {
          var indexEl = panel.querySelector('.story-index');
          var titleEl = panel.querySelector('.story-title');
          var bodyEl = panel.querySelector('.story-body');
          var visual = panel.querySelector('.story-visual');
          var drawLine = panel.querySelector('.story-index-line .draw-line');

          var titleLines = [titleEl];
          if (typeof SplitText !== 'undefined' && titleEl) {
            var split = new SplitText(titleEl, { type: 'lines' });
            splits.push(split);
            titleLines = split.lines;
          }

          var parallaxY = (i % 2 === 0) ? 24 : -24;
          var tiltY = (i % 2 === 0) ? 7 : -7;

          gsap.set(indexEl, { autoAlpha: 0, y: 20 });
          gsap.set(titleLines, { autoAlpha: 0, y: 28 });
          gsap.set(bodyEl, { autoAlpha: 0, y: 20 });
          gsap.set(visual, {
            autoAlpha: 0,
            scale: 0.92,
            y: parallaxY,
            transformPerspective: 1000,
            rotateY: tiltY,
            rotateX: 4
          });

          if (drawLine && typeof DrawSVGPlugin !== 'undefined') {
            gsap.set(drawLine, { drawSVG: '0%' });
          }

          var tl = gsap.timeline({
            scrollTrigger: {
              trigger: panel,
              start: 'top top',
              end: '+=100%',
              pin: true,
              scrub: 0.8,
              anticipatePin: 1
            }
          });

          // 1. Index fade/y
          tl.to(indexEl, { autoAlpha: 1, y: 0, duration: 0.25, ease: calmEase }, 0);

          // 2. Index line DrawSVG draw-on
          if (drawLine && typeof DrawSVGPlugin !== 'undefined') {
            tl.to(drawLine, { drawSVG: '100%', duration: 0.25, ease: calmEase }, 0.05);
          }

          // 3. Title SplitText(lines) stagger
          tl.to(titleLines, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08, ease: calmEase }, 0.08);

          // 4. Body text reveal
          tl.to(bodyEl, { autoAlpha: 1, y: 0, duration: 0.3, ease: calmEase }, 0.18);

          // 5. Visual depth parallax & 3D tilt level-out
          tl.to(visual, {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotateY: 0,
            rotateX: 0,
            duration: 0.45,
            ease: calmEase
          }, 0.05);

          // Exit fade for panel 1 & 2
          if (i < panels.length - 1) {
            tl.to([indexEl, titleLines, bodyEl], { autoAlpha: 0, y: -24, duration: 0.25, stagger: 0.04 }, 0.72)
              .to(visual, {
                autoAlpha: 0,
                scale: 0.96,
                y: -parallaxY,
                rotateY: -tiltY * 0.7,
                rotateX: -3,
                duration: 0.25
              }, 0.72);
          }

          return tl.scrollTrigger;
        });

        return function () {
          scrollTriggers.forEach(function (st) {
            if (st) st.kill();
          });
          splits.forEach(function (sp) {
            if (sp && sp.revert) sp.revert();
          });
        };
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSITION & SOUL SCAN CEREMONY
  // ═══════════════════════════════════════════════════════════════════════════
  function initTransition() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');
    var breathEase = getEase('breath', 'sine.inOut');

    gsap.matchMedia().add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)'
      },
      function (context) {
        var reduced = context.conditions.reduced;
        var section = document.querySelector('#transition');
        if (!section) return;

        if (reduced) {
          gsap.set(['.unlock-ring-outer', '#unlock-ring', '#unlock-core', '#unlock-label'], { clearProps: 'all' });
          return;
        }

        gsap.set('.unlock-ring-outer', { autoAlpha: 0, scale: 0.8, rotate: 0 });
        gsap.set('#unlock-ring', { autoAlpha: 0, scale: 0.82, rotate: -45 });
        gsap.set('#unlock-core', { autoAlpha: 0, scale: 0.55 });
        gsap.set('#unlock-label', { autoAlpha: 0, y: 24 });

        var pulseTween = gsap.to('#unlock-core', {
          scale: 1.18,
          duration: 1.5,
          ease: breathEase,
          repeat: -1,
          yoyo: true,
          paused: true
        });
        var gyroOuter = gsap.to('.unlock-ring-outer', {
          rotate: -360,
          duration: 16,
          repeat: -1,
          ease: 'none',
          paused: true
        });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=100%',
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            onEnter: function () { pulseTween.play(); gyroOuter.play(); },
            onLeave: function () { pulseTween.pause(); gyroOuter.pause(); },
            onEnterBack: function () { pulseTween.play(); gyroOuter.play(); },
            onLeaveBack: function () { pulseTween.pause(); gyroOuter.pause(); }
          }
        });

        tl.to('.unlock-ring-outer', { autoAlpha: 0.7, scale: 1, duration: 0.35, ease: calmEase }, 0)
          .to('#unlock-ring', { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.38, ease: calmEase }, 0)
          .to('#unlock-core', { autoAlpha: 1, scale: 1, duration: 0.38, ease: calmEase }, 0.06)
          .to('#unlock-label', { autoAlpha: 1, y: 0, duration: 0.32, ease: calmEase }, 0.14)
          .to('#unlock-ring', { rotate: 45, duration: 0.45, ease: 'none' }, 0.38)
          .to(['.unlock-ring-outer', '#unlock-ring', '#unlock-core', '#unlock-label'], {
            autoAlpha: 0,
            scale: 1.25,
            duration: 0.28,
            ease: 'power2.in'
          }, 0.74);

        return function () {
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
          pulseTween.kill();
          gyroOuter.kill();
        };
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD SECTION
  // ═══════════════════════════════════════════════════════════════════════════
  function initDashboard() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');
    var breathEase = getEase('breath', 'sine.inOut');

    gsap.matchMedia().add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)'
      },
      function (context) {
        var reduced = context.conditions.reduced;
        var section = document.querySelector('#dashboard');
        if (!section) return;

        var frame = section.querySelector('.phone-frame');
        var annotations = section.querySelectorAll('.dash-annotation');
        var glow = section.querySelector('.phone-ambient-glow');

        if (reduced) {
          gsap.set([frame, annotations, glow], { clearProps: 'all' });
          return;
        }

        if (glow) {
          gsap.to(glow, { scale: 1.15, opacity: 0.65, duration: 3.2, repeat: -1, yoyo: true, ease: breathEase });
        }

        gsap.set(frame, {
          autoAlpha: 0,
          scale: 0.9,
          rotateX: 10,
          rotateY: -6,
          transformPerspective: 1200,
          transformOrigin: 'center center'
        });
        gsap.set(annotations, { autoAlpha: 0, x: -20 });

        var entranceTL = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            toggleActions: 'play none none reverse'
          }
        });

        entranceTL
          .to(frame, { autoAlpha: 1, scale: 1, rotateX: 0, rotateY: 0, duration: 0.9, ease: calmEase })
          .to(annotations, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.12, ease: calmEase }, '-=0.5');

        var parallaxTL = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6
          }
        });

        parallaxTL.to(frame, { y: -30, rotateX: -4, ease: 'none' });

        return function () {
          if (entranceTL.scrollTrigger) entranceTL.scrollTrigger.kill();
          if (parallaxTL.scrollTrigger) parallaxTL.scrollTrigger.kill();
        };
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER SECTION
  // ═══════════════════════════════════════════════════════════════════════════
  function initFooter() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');
    var secureEase = getEase('secure', 'back.out(1.2)');

    gsap.matchMedia().add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)'
      },
      function (context) {
        var reduced = context.conditions.reduced;
        var footer = document.querySelector('#site-footer') || document.querySelector('.footer');
        if (!footer) return;

        var elements = [
          footer.querySelector('.footer-title'),
          footer.querySelectorAll('.footer-actions .btn'),
          footer.querySelector('.footer-mark')
        ];

        if (reduced) {
          gsap.set(elements, { clearProps: 'all' });
          return;
        }

        gsap.set(footer.querySelector('.footer-title'), { autoAlpha: 0, y: 24 });
        gsap.set(footer.querySelectorAll('.footer-actions .btn'), { autoAlpha: 0, y: 20, scale: 0.96 });
        gsap.set(footer.querySelector('.footer-mark'), { autoAlpha: 0 });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: footer,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        });

        tl.to(footer.querySelector('.footer-title'), { autoAlpha: 1, y: 0, duration: 0.7, ease: calmEase })
          .to(footer.querySelectorAll('.footer-actions .btn'), {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: secureEase
          }, '-=0.4')
          .to(footer.querySelector('.footer-mark'), { autoAlpha: 1, duration: 0.8, ease: calmEase }, '-=0.2');

        return function () {
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
        };
      }
    );
  }

})();
