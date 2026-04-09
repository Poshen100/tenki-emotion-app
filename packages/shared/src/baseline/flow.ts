import type { BaselineFlowStep, ReadinessLevel, BootstrapAcceptance } from './types';

export const STEP_ORDER: BaselineFlowStep[] = [
  'intro',
  'sensor_choice',
  'readiness_check',
  'guided_scan',
  'analyzing',
  'result',
];

export function canTransitionTo(
  from: BaselineFlowStep,
  to: BaselineFlowStep,
  context?: { readinessLevel?: ReadinessLevel; acceptance?: BootstrapAcceptance }
): boolean {
  if (to === 'retry_help') return true;
  const transitions: Record<BaselineFlowStep, BaselineFlowStep[]> = {
    intro: ['sensor_choice'],
    sensor_choice: ['readiness_check', 'intro'],
    readiness_check: ['guided_scan', 'sensor_choice'],
    guided_scan: ['analyzing', 'retry_help', 'readiness_check'],
    analyzing: ['result', 'retry_help'],
    result: ['retry_help'],
    retry_help: ['readiness_check', 'sensor_choice'],
  };
  if (to === 'guided_scan' && context?.readinessLevel === 'not_ready') return false;
  return transitions[from]?.includes(to) ?? false;
}
