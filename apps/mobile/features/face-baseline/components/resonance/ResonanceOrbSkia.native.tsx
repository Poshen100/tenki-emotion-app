/**
 * @module face-baseline/components/ResonanceOrbSkia.native
 * @description Picks the Skia orb when the canvas exists, and the core RN orb
 * when it does not — same reasoning as the processing orb's selector.
 *
 * The Skia drawing itself is untouched, in `ResonanceOrbSkiaCanvas.native.tsx`.
 */
import type React from 'react';
import { probeOptionalModule } from '../../utils/optionalNative';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { ResonanceOrbFallback } from './ResonanceOrbFallback';

interface ResonanceOrbSkiaProps {
  stage: MaturityStage;
  size?: number;
}

type OrbComponent = (props: ResonanceOrbSkiaProps) => React.JSX.Element;

/** Resolved once at module load; Skia cannot appear mid-session. */
const canvas = probeOptionalModule<{ ResonanceOrbSkia: OrbComponent }>(() =>
  require('./ResonanceOrbSkiaCanvas'),
);

export const ResonanceOrbSkia: OrbComponent = canvas.available
  ? (canvas.module as { ResonanceOrbSkia: OrbComponent }).ResonanceOrbSkia
  : ResonanceOrbFallback;
