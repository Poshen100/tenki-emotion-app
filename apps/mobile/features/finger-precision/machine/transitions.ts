/**
 * @module finger-precision/machine/transitions
 * @description Higher-level transition helpers: recovery target and resume states.
 *
 * @version 1.0
 */

import type { MachineState } from './fingerPrecisionMachine';

/**
 * Maps each state to its recovery / retry entry state.
 * If we fail in processing or precision build and need to retry,
 * we guide the user back to the placement guide.
 */
export const RESUME_TARGET: Record<MachineState, MachineState> = {
  intro: 'intro',
  permission_check: 'permission_check',
  readiness_check: 'readiness_check',
  placement_guide: 'placement_guide',
  signal_locking: 'placement_guide',
  quick_estimate: 'placement_guide',
  precision_build: 'placement_guide',
  quality_recovery: 'placement_guide',
  processing: 'placement_guide',
  scan_complete: 'scan_complete',
  retry_needed: 'placement_guide',
  exit: 'exit',
};
