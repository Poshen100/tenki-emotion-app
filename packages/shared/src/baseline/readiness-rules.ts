import type { ReadinessCheckItem, ReadinessLevel, ReadinessStatus } from './types';

export function evaluateReadiness(
  checks: ReadinessCheckItem[],
  permissionGranted: boolean,
  cameraInitialized: boolean
): ReadinessStatus {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!permissionGranted) blockers.push('Camera permission not granted');
  if (!cameraInitialized) blockers.push('Camera not initialized');

  for (const check of checks) {
    if (!check.passed) {
      if (check.severity === 'required') blockers.push(check.label);
      else warnings.push(check.label);
    }
  }

  const requiredPassed = checks.filter(c => c.severity === 'required').every(c => c.passed);
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  let level: ReadinessLevel;
  if (!permissionGranted || !cameraInitialized || !requiredPassed) {
    level = 'not_ready';
  } else if (warnings.length > 0) {
    level = 'ready_with_caution';
  } else {
    level = 'ready';
  }

  return {
    level,
    score,
    checks,
    permissionGranted,
    cameraInitialized,
    warnings,
    blockers,
    lastCheckedAt: new Date().toISOString(),
  };
}
