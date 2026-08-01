/**
 * story.js — animation/scroll wiring for apps/preview/story.html
 * GSAP timelines + ScrollTrigger only; no framework, no bundler.
 */
(function () {
  'use strict';

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHero();
    initStoryPanels();
    initTransition();
    initDashboard();
    initFooter();

    // Web font swap (Inter) can reflow text after ScrollTrigger has already
    // measured pin start/end positions — refresh once fonts settle.
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

  function initHero() {
    if (typeof gsap === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');
    var breathEase = getEase('breath', 'sine.inOut');
    var secureEase = getEase('secure', 'back.out(1.2)');

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;

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

        var targets = ['#nav', '#hero-kicker', words, '#hero-sub', '#hero-actions .btn', '#scroll-cue'];

        if (reduced) {
          gsap.set(targets, { clearProps: 'all' });
          gsap.set('#universe', { opacity: 1 });
          return;
        }

        // Initial hidden states per beat score
        gsap.set('#nav', { autoAlpha: 0, y: -12 });
        gsap.set('#hero-kicker', { autoAlpha: 0, y: 16 });
        gsap.set(words, { autoAlpha: 0, y: 40 });
        if (accentWords.length) {
          gsap.set(accentWords, { scale: 0.98 });
        }
        gsap.set('#hero-sub', { autoAlpha: 0, y: 18 });
        gsap.set('#hero-actions .btn', { autoAlpha: 0, y: 18, scale: 0.96 });
        gsap.set('#scroll-cue', { autoAlpha: 0 });

        // Master Entrance Timeline
        var masterTL = gsap.timeline({ delay: 0.1 });

        // Beat 1: #nav at 0.25s (0.5s calm)
        masterTL.to('#nav', { autoAlpha: 1, y: 0, duration: 0.5, ease: calmEase }, 0.25);

        // Beat 2: #hero-kicker at 0.35s (0.6s calm)
        masterTL.to('#hero-kicker', { autoAlpha: 1, y: 0, duration: 0.6, ease: calmEase }, 0.35);

        // Beat 3: #hero-title SplitText(words) at 0.50s (0.9s calm/expo.out, stagger 0.055)
        masterTL.to(words, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.055, ease: calmEase }, 0.50);

        // Beat 4: accent words scale 0.98->1 at +0.1s (0.6s calm)
        if (accentWords.length) {
          masterTL.to(accentWords, { scale: 1, duration: 0.6, ease: calmEase }, 0.60);
        }

        // Beat 5: #hero-sub at 1.30s (0.6s calm)
        masterTL.to('#hero-sub', { autoAlpha: 1, y: 0, duration: 0.6, ease: calmEase }, 1.30);

        // Beat 6: #hero-actions .btn at 1.50s (0.6s secure, stagger 0.08)
        masterTL.to('#hero-actions .btn', { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: secureEase }, 1.50);

        // Beat 7: #scroll-cue at 2.00s fade in -> enters breath y loop
        masterTL.to('#scroll-cue', {
          autoAlpha: 1,
          duration: 0.6,
          ease: calmEase,
          onComplete: function () {
            gsap.to('#scroll-cue .line', {
              scaleY: 1.2,
              y: 4,
              duration: 1.8,
              ease: breathEase,
              repeat: -1,
              yoyo: true
            });
          }
        }, 2.00);

        // Hero Exit Scrub (hand off to story panels)
        var exitScrub = null;
        if (typeof ScrollTrigger !== 'undefined') {
          exitScrub = gsap.timeline({
            scrollTrigger: {
              trigger: '#hero',
              start: 'top top',
              end: 'bottom top',
              scrub: 0.6
            }
          });

          // #universe wrapper y-drop + fade to ~0.35 (transform/opacity on wrapper only!)
          exitScrub.to('#universe', { yPercent: 20, opacity: 0.35, ease: 'none' }, 0);
          // Hero text group y -30 + fade out
          exitScrub.to('.hero-inner', { y: -30, autoAlpha: 0, ease: 'none' }, 0);
          exitScrub.to('#scroll-cue', { autoAlpha: 0, ease: 'none' }, 0);
        }

        return function () {
          masterTL.kill();
          if (exitScrub && exitScrub.scrollTrigger) exitScrub.scrollTrigger.kill();
          if (split && split.revert) split.revert();
        };
      }
    );
  }

  function initStoryPanels() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var calmEase = getEase('calm', 'expo.out');

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;
        var panels = gsap.utils.toArray('.story-panel');
        var splits = [];

        if (reduced) {
          gsap.set(panels, { clearProps: 'all' });
          gsap.set('.story-index-line .draw-line', { clearProps: 'all' });
          return;
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

          gsap.set(indexEl, { autoAlpha: 0, y: 20 });
          gsap.set(titleLines, { autoAlpha: 0, y: 28 });
          gsap.set(bodyEl, { autoAlpha: 0, y: 20 });
          gsap.set(visual, { autoAlpha: 0, scale: 0.92, y: parallaxY });

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

          // 3. Title SplitText(lines) stagger 0.08
          tl.to(titleLines, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08, ease: calmEase }, 0.08);

          // 4. Body fade/y
          tl.to(bodyEl, { autoAlpha: 1, y: 0, duration: 0.3, ease: calmEase }, 0.18);

          // 5. Visual depth parallax
          tl.to(visual, { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: calmEase }, 0.05);

          // Exit fade for panel 1 & 2
          if (i < panels.length - 1) {
            tl.to([indexEl, titleLines, bodyEl], { autoAlpha: 0, y: -24, duration: 0.25, stagger: 0.04 }, 0.72)
              .to(visual, { autoAlpha: 0, scale: 0.96, y: -parallaxY, duration: 0.25 }, 0.72);
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

  function initTransition() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;
        var section = document.querySelector('#transition');
        var ring = document.querySelector('#unlock-ring');
        var core = document.querySelector('#unlock-core');
        var label = document.querySelector('#unlock-label');

        if (!section || reduced) {
          gsap.set([ring, label], { clearProps: 'all' });
          return;
        }

        gsap.set(ring, { autoAlpha: 0, scale: 0.7 });
        gsap.set(label, { autoAlpha: 0, y: 12 });

        // Continuous "breathing" pulse on the core while the section is pinned —
        // independent of scroll position so the unlock cue feels alive, not scrubbed.
        var breathe = gsap.to(core, {
          scale: 1.08,
          duration: 1.6,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          paused: true
        });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=120%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            onEnter: function () { breathe.play(); },
            onEnterBack: function () { breathe.play(); },
            onLeave: function () { breathe.pause(); },
            onLeaveBack: function () { breathe.pause(); }
          }
        });

        tl.to(ring, { autoAlpha: 1, scale: 1, duration: 0.25 }, 0)
          .to(label, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.1)
          .to(ring, { autoAlpha: 0, scale: 1.6, duration: 0.25, ease: 'power2.in' }, 0.72)
          .to(core, { autoAlpha: 0, scale: 1.6, duration: 0.25, ease: 'power2.in' }, 0.72)
          .to(label, { autoAlpha: 0, y: -12, duration: 0.2 }, 0.72);

        return function () {
          breathe.kill();
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
          tl.kill();
        };
      }
    );
  }

  function initDashboard() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;
        var section = document.querySelector('#dashboard');
        var frame = document.querySelector('#phone-frame');
        if (!section || !frame) return;

        var copy = section.querySelectorAll(
          '.dash-copy > .story-index, .dash-copy > .story-title, .dash-copy > .story-body, .dash-annotation'
        );

        if (reduced) {
          gsap.set([copy, frame], { clearProps: 'all' });
          return;
        }

        gsap.set(copy, { autoAlpha: 0, y: 28 });
        gsap.set(frame, {
          autoAlpha: 0, y: 60, scale: 0.88,
          rotateX: 8, rotateY: -6, transformPerspective: 1000
        });

        var entrance = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 70%',
            toggleActions: 'play none none reverse'
          }
        });

        entrance
          .to(copy, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, 0)
          .to(frame, { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, rotateY: 0, duration: 1, ease: 'power3.out' }, 0.1);

        var parallax = gsap.to(frame, {
          y: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });

        return function () {
          if (entrance.scrollTrigger) entrance.scrollTrigger.kill();
          entrance.kill();
          if (parallax.scrollTrigger) parallax.scrollTrigger.kill();
          parallax.kill();
        };
      }
    );
  }

  function initFooter() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;
        var footer = document.querySelector('#site-footer');
        if (!footer) return;

        var targets = footer.querySelectorAll('.footer-title, .footer-actions .btn, .footer-mark');

        if (reduced) {
          gsap.set(targets, { clearProps: 'all' });
          return;
        }

        gsap.set(targets, { autoAlpha: 0, y: 24 });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: footer,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        });

        tl.to(targets, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' });

        return function () {
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
          tl.kill();
        };
      }
    );
  }
})();
