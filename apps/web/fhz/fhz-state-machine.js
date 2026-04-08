/**
 * FHZ State Machine — Pure Logic
 * Zero DOM dependencies. Unit-testable.
 */
(function (global) {
  'use strict';

  var STATES = {
    NOT_DETECTED: 'NOT_DETECTED',
    ALIGNING: 'ALIGNING',
    STABILIZING: 'STABILIZING',
    READY: 'READY',
  };

  var THRESHOLDS = {
    COVERAGE_DETECT: 30,
    COVERAGE_ALIGN: 70,
    COVERAGE_LOSE: 20,
    COVERAGE_LOSE_ALIGN: 60,
    SQI_ALIGN: 40,
    SQI_READY: 65,
    SQI_LOSE: 50,
    STABILITY_READY: 75,
    STABLE_FOR_READY: 3,
  };

  function transition(currentState, metrics) {
    var coverage = metrics.coverage;
    var stability = metrics.stability;
    var sqi = metrics.sqi;
    var stableFor = metrics.stableFor;

    switch (currentState) {
      case STATES.NOT_DETECTED:
        if (coverage > THRESHOLDS.COVERAGE_DETECT) return STATES.ALIGNING;
        return STATES.NOT_DETECTED;

      case STATES.ALIGNING:
        if (coverage < THRESHOLDS.COVERAGE_LOSE) return STATES.NOT_DETECTED;
        if (coverage > THRESHOLDS.COVERAGE_ALIGN && sqi > THRESHOLDS.SQI_ALIGN)
          return STATES.STABILIZING;
        return STATES.ALIGNING;

      case STATES.STABILIZING:
        if (coverage < THRESHOLDS.COVERAGE_LOSE_ALIGN) return STATES.ALIGNING;
        if (
          stability > THRESHOLDS.STABILITY_READY &&
          stableFor >= THRESHOLDS.STABLE_FOR_READY &&
          sqi > THRESHOLDS.SQI_READY
        )
          return STATES.READY;
        return STATES.STABILIZING;

      case STATES.READY:
        if (coverage < THRESHOLDS.COVERAGE_LOSE_ALIGN || sqi < THRESHOLDS.SQI_LOSE)
          return STATES.STABILIZING;
        return STATES.READY;

      default:
        return STATES.NOT_DETECTED;
    }
  }

  function computeChecklist(metrics) {
    return {
      cameraFocused: metrics.sqi > 20,
      fingerCovered: metrics.coverage > THRESHOLDS.COVERAGE_ALIGN,
      stable3Sec: metrics.stableFor >= THRESHOLDS.STABLE_FOR_READY,
      sqiPassed: metrics.sqi > THRESHOLDS.SQI_READY,
    };
  }

  global.TENKI_FHZ_SM = {
    STATES: STATES,
    THRESHOLDS: THRESHOLDS,
    transition: transition,
    computeChecklist: computeChecklist,
  };
})(window);
