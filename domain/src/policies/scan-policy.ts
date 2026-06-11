/**
 * @module domain/policies/scan-policy
 * @description Domain policies for validating scan intent before the pipeline runs.
 */

import type {
  DomainScanType,
  DomainSessionMode,
  DomainTraderTemplateId,
  ScanReadinessChecklistContract,
  ScanRequestContract,
  ScanRequirementsContract,
  SignalGrade,
} from '../contracts/scan-contract';

const SIGNAL_GRADE_RANK: Record<SignalGrade, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
};

interface ScanRequirementTemplate {
  minimumSignalGrade: SignalGrade;
  defaultDurationSec: number;
  requiresBaseline: boolean;
  requiresTemplate: boolean;
  requiresSessionGate: boolean;
  allowedModes: readonly DomainSessionMode[];
}

const SCAN_REQUIREMENT_TEMPLATES: Record<DomainScanType, ScanRequirementTemplate> = {
  baseline: {
    minimumSignalGrade: 'B',
    defaultDurationSec: 60,
    requiresBaseline: false,
    requiresTemplate: false,
    requiresSessionGate: false,
    allowedModes: ['health_reset', 'focus', 'performance', 'trader'],
  },
  quick: {
    minimumSignalGrade: 'C',
    defaultDurationSec: 30,
    requiresBaseline: false,
    requiresTemplate: false,
    requiresSessionGate: false,
    allowedModes: ['health_reset', 'focus', 'performance', 'trader'],
  },
  deep: {
    minimumSignalGrade: 'B',
    defaultDurationSec: 60,
    requiresBaseline: false,
    requiresTemplate: false,
    requiresSessionGate: false,
    allowedModes: ['health_reset', 'focus', 'performance', 'trader'],
  },
  trader_check: {
    minimumSignalGrade: 'B',
    defaultDurationSec: 60,
    requiresBaseline: true,
    requiresTemplate: true,
    requiresSessionGate: true,
    allowedModes: ['trader'],
  },
};

/**
 * Resolves the duration requirement for a scan.
 * Mode 2 uses the shorter 30-second trader gate described in the product spec.
 *
 * @param type - Scan type.
 * @param templateId - Trader template if present.
 * @returns Required scan duration in seconds.
 */
export function resolveRequiredDurationSec(
  type: DomainScanType,
  templateId: DomainTraderTemplateId | null
): number {
  if (type === 'trader_check' && templateId === 'MODE_2') {
    return 30;
  }

  return SCAN_REQUIREMENT_TEMPLATES[type].defaultDurationSec;
}

/**
 * Resolves the canonical scan requirements for a request.
 *
 * @param request - Scan request context.
 * @returns Resolved requirements for orchestration and UI gating.
 */
export function resolveScanRequirements(request: ScanRequestContract): ScanRequirementsContract {
  const template = SCAN_REQUIREMENT_TEMPLATES[request.type];

  return {
    type: request.type,
    minimumDurationSec: resolveRequiredDurationSec(request.type, request.templateId),
    minimumSignalGrade: template.minimumSignalGrade,
    requiresBaseline: template.requiresBaseline,
    requiresTemplate: template.requiresTemplate,
    requiresSessionGate: template.requiresSessionGate,
    allowedModes: template.allowedModes,
  };
}

/**
 * Checks whether a measured signal grade satisfies a scan type's minimum.
 *
 * @param signalGrade - Current signal grade.
 * @param type - Scan type being attempted.
 * @returns True when the signal grade is acceptable.
 */
export function meetsSignalGradeRequirement(
  signalGrade: SignalGrade,
  type: DomainScanType
): boolean {
  const required = SCAN_REQUIREMENT_TEMPLATES[type].minimumSignalGrade;
  return SIGNAL_GRADE_RANK[signalGrade] >= SIGNAL_GRADE_RANK[required];
}

/**
 * Determines whether the readiness checklist satisfies the scan policy.
 *
 * @param checklist - UI readiness checklist.
 * @param requirements - Resolved requirements for the scan.
 * @returns True when the scan can begin.
 */
export function canStartScanFromChecklist(
  checklist: ScanReadinessChecklistContract,
  requirements: ScanRequirementsContract
): boolean {
  if (!checklist.signalQualityReady) return false;
  if (!checklist.coverageReady) return false;
  if (!checklist.stabilityReady) return false;
  if (!checklist.cameraPermissionReady) return false;
  if (!checklist.minimumDurationMet) return false;
  if (requirements.requiresBaseline && !checklist.baselineReady) return false;

  return true;
}

/**
 * Validates policy-level constraints that go beyond structural schema checks.
 *
 * @param request - Scan request to validate.
 * @returns A list of policy violations. Empty means the request is allowed.
 */
export function validateScanRequestPolicy(request: ScanRequestContract): string[] {
  const errors: string[] = [];
  const requirements = resolveScanRequirements(request);

  if (!request.featureFlagEnabled) {
    errors.push('scan_pipeline_v1 feature flag must be enabled before starting a scan');
  }

  if (!requirements.allowedModes.includes(request.mode)) {
    errors.push(`scan type "${request.type}" is not allowed in mode "${request.mode}"`);
  }

  if (requirements.requiresTemplate && request.templateId === null) {
    errors.push(`scan type "${request.type}" requires a trader template`);
  }

  if (request.mode !== 'trader' && request.templateId !== null) {
    errors.push('templateId can only be set when mode is "trader"');
  }

  if (requirements.requiresBaseline && !request.baselineAvailable) {
    errors.push(`scan type "${request.type}" requires a baseline before it can run`);
  }

  return errors;
}
