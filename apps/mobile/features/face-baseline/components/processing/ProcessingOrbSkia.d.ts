/**
 * Type resolution shim for the platform-split ProcessingOrbSkia implementation
 * (`.native.tsx` uses Skia, `.web.tsx` uses core RN). Metro picks the platform
 * file; tsc resolves this declaration.
 *
 * Keep this in step with both implementations — it is the only thing tsc sees,
 * so a prop missing here is a prop the compiler will reject at every call site
 * even though the runtime accepts it.
 */
import type React from 'react';
import type { SensoryFrame } from '../../utils/choreography';
import type { Tilt } from '../../utils/orbPhysics';

export declare function ProcessingOrbSkia(props: {
  progress: number;
  size?: number;
  /** Live signal state; a progress-derived frame is used when absent. */
  frame?: SensoryFrame;
  /** Device tilt for parallax. */
  tilt?: Tilt;
  /** Baseline maturity, 0–1. */
  maturityRatio?: number;
}): React.JSX.Element;
