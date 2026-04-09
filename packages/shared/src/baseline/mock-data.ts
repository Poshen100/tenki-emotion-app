import type { ReadinessCheckItem, ScanSession, SelectedSensorModeState } from './types';

export const MOCK_SENSOR_MODES: SelectedSensorModeState = {
  selected: null,
  availableModes: [
    { mode: 'camera_guided', supported: true, recommended: true },
    { mode: 'manual_checkin', supported: true, recommended: false },
    { mode: 'demo_mock', supported: true, recommended: false },
  ],
};

export const MOCK_READINESS_CHECKS: ReadinessCheckItem[] = [
  { key: 'lighting', label: '光線穩定', passed: true, severity: 'required' },
  { key: 'visibility', label: '臉部清晰可見', passed: true, severity: 'required' },
  { key: 'stability', label: '可保持穩定 30–60 秒', passed: true, severity: 'required' },
  { key: 'environment', label: '非移動 / 非通勤環境', passed: true, severity: 'required' },
  { key: 'emotional_settled', label: '無強烈情緒波動', passed: true, severity: 'recommended' },
];

export function createMockScanSession(): ScanSession {
  return {
    sessionId: `scan-${Date.now()}`,
    sensorMode: 'camera_guided',
    status: 'idle',
    quality: {},
    interruptionCount: 0,
  };
}
