/**
 * The mode table is what every promise about scan length rests on.
 */
import { SCAN_MODE_CONFIGS, isCameraMode, modeReports } from '../scan-modes';

describe('scan modes', () => {
  it('pins the shortest full scan, because a user-facing promise depends on it', () => {
    // 🔴 `MIN_SECONDS_FOR_PULSE_ANCHOR` in
    // `domain/src/contracts/baseline-contract.ts` mirrors this number, and the
    // sensor-choice copy promises a time at least that long. `domain` is the
    // lower layer and cannot import the engine, so this test is the link:
    // lowering this value without updating that one makes the app promise an
    // HRV baseline it cannot deliver.
    expect(SCAN_MODE_CONFIGS.full_scan.minDurationSec).toBe(45);
  });

  it('keeps quick check structurally incapable of reporting HRV', () => {
    // Not a quality threshold — the metric is absent from the list, so no
    // signal however clean can talk it into producing one.
    // ⚠️ Even with the capability enabled — the mode's own list is the first
    // gate, and quick check does not list HRV at all.
    expect(modeReports('quick_check', 'hrv', { cameraHrvEstimates: true })).toBe(false);
    expect(modeReports('quick_check', 'heart_rate')).toBe(true);
    expect(modeReports('full_scan', 'hrv', { cameraHrvEstimates: true })).toBe(true);
  });

  it('separates the camera modes from the one that reads a beat sensor', () => {
    expect(isCameraMode('quick_check')).toBe(true);
    expect(isCameraMode('full_scan')).toBe(true);
    expect(isCameraMode('precision')).toBe(false);
  });
});
