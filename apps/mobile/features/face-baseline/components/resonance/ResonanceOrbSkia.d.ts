/**
 * Type resolution shim for the platform-split ResonanceOrbSkia implementation
 * (`.native.tsx` uses Skia, `.web.tsx` uses core RN). Metro picks the platform
 * file; tsc resolves this declaration.
 */
import type React from 'react';
import type { MaturityStage } from '../../types/faceBaseline.types';

export declare function ResonanceOrbSkia(props: {
  stage: MaturityStage;
  size?: number;
}): React.JSX.Element;
