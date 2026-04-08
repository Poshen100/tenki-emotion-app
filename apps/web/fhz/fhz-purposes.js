/**
 * FHZ Purposes — Scenario Mode Constants
 * 4 scan purposes mapped to TENKI scenario modes.
 */
(function (global) {
  'use strict';

  var PURPOSES = {
    HEALTH_RESET: {
      id: 'HEALTH_RESET',
      label: 'Health Reset',
      labelZh: '健康重置',
      icon: 'self_improvement',
      context: '穩定副交感神經恢復',
      color: '#34C759',
    },
    FOCUS: {
      id: 'FOCUS',
      label: 'Focus',
      labelZh: '專注',
      icon: 'track_changes',
      context: '進入心流工作狀態',
      color: '#00B4D8',
    },
    PERFORMANCE: {
      id: 'PERFORMANCE',
      label: 'Performance',
      labelZh: '表現',
      icon: 'speed',
      context: '評估運動與競技就緒度',
      color: '#F5A623',
    },
    TRADER: {
      id: 'TRADER',
      label: 'Trader',
      labelZh: '交易員',
      icon: 'monitoring',
      context: '決策紀律與情緒監控',
      color: '#5E3A87',
    },
  };

  var PURPOSE_ORDER = ['HEALTH_RESET', 'FOCUS', 'PERFORMANCE', 'TRADER'];

  global.TENKI_FHZ_PURPOSES = { PURPOSES: PURPOSES, PURPOSE_ORDER: PURPOSE_ORDER };
})(window);
