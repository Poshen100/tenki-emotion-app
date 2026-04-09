export type BaselineFlowStep =
  | 'intro'
  | 'sensor_choice'
  | 'readiness_check'
  | 'guided_scan'
  | 'analyzing'
  | 'result'
  | 'retry_help';

export type SensorMode =
  | 'camera_guided'
  | 'manual_checkin'
  | 'demo_mock';

export type ReadinessLevel =
  | 'ready'
  | 'ready_with_caution'
  | 'not_ready';

export type ScanSessionStatus =
  | 'idle'
  | 'initializing'
  | 'aligning'
  | 'capturing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type BootstrapAcceptance =
  | 'accepted'
  | 'provisional'
  | 'insufficient'
  | 'failed';

export type FailureReasonCode =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'low_light'
  | 'motion_too_high'
  | 'face_not_detected'
  | 'session_interrupted'
  | 'analysis_timeout'
  | 'signal_inconclusive'
  | 'unknown';

export interface BaselineFlowState {
  currentStep: BaselineFlowStep;
  previousStep?: BaselineFlowStep;
  canGoBack: boolean;
  canExit: boolean;
  startedAt?: string;
  completedAt?: string;
  hasExistingBaseline: boolean;
  isFirstTimeUser: boolean;
  isBusy: boolean;
  blockingError?: { code: string; message: string };
}

export interface SelectedSensorModeState {
  selected: SensorMode | null;
  availableModes: Array<{
    mode: SensorMode;
    supported: boolean;
    recommended: boolean;
    reasonIfUnavailable?: string;
  }>;
}

export interface ReadinessCheckItem {
  key: 'lighting' | 'visibility' | 'stability' | 'environment' | 'emotional_settled';
  label: string;
  passed: boolean;
  severity: 'required' | 'recommended';
  message?: string;
}

export interface ReadinessStatus {
  level: ReadinessLevel;
  score: number;
  checks: ReadinessCheckItem[];
  permissionGranted: boolean;
  cameraInitialized: boolean;
  warnings: string[];
  blockers: string[];
  lastCheckedAt?: string;
}

export interface ScanQualityMetrics {
  lightingQuality?: number;
  motionLevel?: number;
  framingQuality?: number;
  signalConfidence?: number;
}

export interface ScanSession {
  sessionId: string;
  sensorMode: SensorMode;
  status: ScanSessionStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  progress?: number;
  quality: ScanQualityMetrics;
  interruptionCount: number;
  failureReason?: FailureReasonCode;
  debugNotes?: string[];
}

export interface BootstrapObservation {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'caution';
}

export interface BootstrapResult {
  resultId: string;
  acceptance: BootstrapAcceptance;
  baselineScore?: number;
  confidence: 'high' | 'medium' | 'low';
  signalQuality: 'high' | 'medium' | 'low';
  stability: 'stable' | 'moderate' | 'weak';
  createdAt?: string;
  observations: BootstrapObservation[];
  recommendedAction: 'accept' | 'retry_now' | 'retry_later' | 'switch_mode';
  retryReason?: FailureReasonCode;
}

export interface BaselineBootstrapStore {
  flow: BaselineFlowState;
  sensor: SelectedSensorModeState;
  readiness: ReadinessStatus;
  scanSession: ScanSession | null;
  result: BootstrapResult | null;
}
