/**
 * ScanMetrics defines the raw physiology metrics collected during a scan.
 */
export interface ScanMetrics {
    hrBpm: number;
    hrvRmssdMs: number;
    rrBrpm: number;
}

/**
 * FusionSource defines the origin of the scan data.
 */
export type FusionSource =
    | 'ble_chest'
    | 'watch_healthkit'
    | 'rppg_glabella'
    | 'rppg_forehead'
    | 'rppg_cheek';

/**
 * SignalQuality dictates the grade and score of the signal.
 */
export interface SignalQuality {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    total: number; // 0-100
}

/**
 * ScanInput represents the incoming payload from a hardware sensor or camera.
 */
export interface ScanInput {
    deviceType: string;
    sqs: SignalQuality; // Signal Quality Score
    metrics: ScanMetrics;
}

/**
 * BaselineData defines a 7-day or 21-day rolling biometric baseline.
 */
export interface BaselineData {
    windowDays: 7 | 21;
    hrMean: number;
    hrStd: number;
    hrvMean: number;
    hrvStd: number;
    rrMean: number;
    rrStd: number;
    sampleCount: number;
}

/**
 * TeiZone categorizes the calculated TEI PR99 score.
 */
export type TeiZone = 'PEAK' | 'OPTIMAL' | 'NEUTRAL' | 'DEGRADED';

/**
 * ZoneConfig defines the PR99 boundaries for each TeiZone.
 */
export interface ZoneConfig {
    PEAK: { min: number; max: number };
    OPTIMAL: { min: number; max: number };
    NEUTRAL: { min: number; max: number };
    DEGRADED: { min: number; max: number };
}

/**
 * The standard PR99 boundary configuration.
 */
export const TENKI_ZONES: ZoneConfig = {
    PEAK: { min: 80, max: 99 },
    OPTIMAL: { min: 55, max: 79 },
    NEUTRAL: { min: 35, max: 54 },
    DEGRADED: { min: 1, max: 34 },
};

/**
 * TeiResult captures the fully computed TEI, PR99, and associated classification.
 */
export interface TeiResult {
    teiRaw: number;
    teiPr: number; // 1-99
    zone: TeiZone;
    confidence: number; // 0.0 - 1.0
}

/**
 * FusionLog records the audit trail of multi-modal data selection.
 */
export interface FusionLog {
    source: FusionSource;
    confidence: number;
    sqiScore: number;
    fallbackReason: string | null;
    degraded: boolean;
}

/**
 * ScanResult represents the complete output from a single scan, encapsulating TEI, metrics, and fusion trail.
 */
export interface ScanResult {
    tei: TeiResult;
    metrics: ScanMetrics;
    fusion: FusionLog;
    durationSec: number;
    timestamp: number;
}

/**
 * HrvStatus defines the relative state of HRV compared to baseline.
 */
export type HrvStatus = 'BALANCED' | 'ELEVATED' | 'UNBALANCED' | 'LOW' | 'POOR';

/**
 * StressLevel maps the 0-100 stress score into 4 categories.
 */
export type StressLevel = 'REST' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * HrvBaselineRange defines the expected baseline boundaries (±1 Std).
 */
export interface HrvBaselineRange {
    low: number;
    high: number;
    mean: number;
}

/**
 * StressResult represents the computed physiological stress score and its components.
 */
export interface StressResult {
    score: number;
    level: StressLevel;
    hrvContribution: number;
    hrContribution: number;
}

/**
 * The standard 0-100 boundaries for Garmin-like stress levels.
 */
export const STRESS_LEVELS = {
    REST: [0, 25],
    LOW: [26, 50],
    MEDIUM: [51, 75],
    HIGH: [76, 100],
} as const;
