import { getState, patchFlow, setState } from './baseline-state.js';
import { renderIntro } from './screens/screen-intro.js';
import { renderSensorChoice } from './screens/screen-sensor-choice.js';
import { renderReadinessCheck } from './screens/screen-readiness.js';
import { renderGuidedScan } from './screens/screen-guided-scan.js';
import { renderAnalyzing } from './screens/screen-analyzing.js';
import { renderResult } from './screens/screen-result.js';
import { renderRetryHelp } from './screens/screen-retry-help.js';

const SCREEN_MAP = {
  intro: renderIntro,
  sensor_choice: renderSensorChoice,
  readiness_check: renderReadinessCheck,
  guided_scan: renderGuidedScan,
  analyzing: renderAnalyzing,
  result: renderResult,
  retry_help: renderRetryHelp,
};

let _container = null;
let _currentCleanup = null;

export function initBaselineFlow(containerEl) {
  _container = containerEl;
  navigateTo('intro');
}

export function navigateTo(step, context = {}) {
  const state = getState();
  if (_currentCleanup) {
    _currentCleanup();
    _currentCleanup = null;
  }

  patchFlow({
    previousStep: state.flow.currentStep,
    currentStep: step,
    canGoBack: ['sensor_choice', 'readiness_check'].includes(step),
  });

  const renderFn = SCREEN_MAP[step];
  if (!renderFn || !_container) return;

  _container.innerHTML = '';
  _currentCleanup = renderFn(_container, { navigateTo, getState, setState, context });
}

export function closeBaselineFlow() {
  if (_currentCleanup) {
    _currentCleanup();
    _currentCleanup = null;
  }
  if (_container) {
    _container.innerHTML = '';
    _container.style.display = 'none';
  }
}
