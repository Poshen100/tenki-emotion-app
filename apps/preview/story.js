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
  });

  function initHero() {
    if (typeof gsap === 'undefined') return;

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;

        if (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.playEntrance === 'function') {
          window.TENKI_STARDUST.playEntrance();
        }

        var words = document.querySelectorAll('#hero-title .word');
        var targets = ['#nav', '#hero-kicker', words, '#hero-sub', '#hero-actions .btn', '#scroll-cue'];

        if (reduced) {
          gsap.set(targets, { clearProps: 'all' });
          return;
        }

        gsap.set('#nav', { autoAlpha: 0, y: -12 });
        gsap.set('#hero-kicker', { autoAlpha: 0, y: 16 });
        gsap.set(words, { autoAlpha: 0, y: 28 });
        gsap.set('#hero-sub', { autoAlpha: 0, y: 18 });
        gsap.set('#hero-actions .btn', { autoAlpha: 0, y: 18 });
        gsap.set('#scroll-cue', { autoAlpha: 0 });

        var tl = gsap.timeline({ delay: 0.2, defaults: { ease: 'power3.out' } });

        tl.to('#nav', { autoAlpha: 1, y: 0, duration: 0.6 })
          .to('#hero-kicker', { autoAlpha: 1, y: 0, duration: 0.6 }, 0.15)
          .to(words, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06 }, 0.3)
          .to('#hero-sub', { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.35')
          .to('#hero-actions .btn', { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, '-=0.4')
          .to('#scroll-cue', { autoAlpha: 1, duration: 0.6 }, '-=0.2');

        return function () {
          tl.kill();
        };
      }
    );
  }

  function initStoryPanels() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.matchMedia().add(
      { reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' },
      function (context) {
        var reduced = context.conditions.reduced;
        var panels = gsap.utils.toArray('.story-panel');

        if (reduced) {
          gsap.set(panels, { clearProps: 'all' });
          return;
        }

        var scrollTriggers = panels.map(function (panel, i) {
          var text = panel.querySelectorAll('.story-index, .story-title, .story-body');
          var visual = panel.querySelector('.story-visual');

          gsap.set(text, { autoAlpha: 0, y: 36 });
          gsap.set(visual, { autoAlpha: 0, scale: 0.92 });

          var tl = gsap.timeline({
            scrollTrigger: {
              trigger: panel,
              start: 'top top',
              end: '+=100%',
              pin: true,
              scrub: 1,
              anticipatePin: 1
            }
          });

          tl.to(text, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.05 }, 0)
            .to(visual, { autoAlpha: 1, scale: 1, duration: 0.35 }, 0.05);

          if (i < panels.length - 1) {
            tl.to(text, { autoAlpha: 0, y: -24, duration: 0.25, stagger: 0.04 }, 0.72)
              .to(visual, { autoAlpha: 0, scale: 0.96, duration: 0.25 }, 0.72);
          }

          return tl.scrollTrigger;
        });

        return function () {
          scrollTriggers.forEach(function (st) {
            if (st) st.kill();
          });
        };
      }
    );
  }
})();
