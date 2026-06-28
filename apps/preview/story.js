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
})();
