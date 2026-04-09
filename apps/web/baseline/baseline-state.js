// Baseline flow state — single source of truth for all 7 screens

const _state = {
  flow: {
    currentStep: 'intro',
    previousStep: null,
    canGoBack: false,
    canExit: true,
    startedAt: null,
    completedAt: null,
    hasExistingBaseline: false,
    isFirstTimeUser: true,
    isBusy: false,
    blockingError: null,
  },
  sensor: {
    selected: null,
    availableModes: [],
  },
  readiness: {
    level: 'not_ready',
    score: 0,
    checks: [],
    permissionGranted: false,
    cameraInitialized: false,
    warnings: [],
    blockers: [],
  },
  scanSession: null,
  result: null,
};

const _listeners = new Set();

export function getState() {
  return structuredClone(_state);
}

export function setState(patch) {
  Object.assign(_state, patch);
  _listeners.forEach(fn => fn(structuredClone(_state)));
}

export function patchFlow(patch) {
  Object.assign(_state.flow, patch);
  _listeners.forEach(fn => fn(structuredClone(_state)));
}

export function patchSensor(patch) {
  Object.assign(_state.sensor, patch);
  _listeners.forEach(fn => fn(structuredClone(_state)));
}

export function patchReadiness(patch) {
  Object.assign(_state.readiness, patch);
  _listeners.forEach(fn => fn(structuredClone(_state)));
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
