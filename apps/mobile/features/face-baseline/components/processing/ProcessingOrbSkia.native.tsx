/**
 * @module face-baseline/components/ProcessingOrbSkia.native
 * @description Picks the Skia orb when the canvas exists, and the core RN orb
 * when it does not.
 *
 * `@shopify/react-native-skia` is not one of the native modules Expo Go
 * bundles, and its JS entry point throws while evaluating when the native half
 * is missing. An unguarded import therefore took down the whole Processing
 * screen, which is why this flow could not be looked at without a development
 * build. The probe turns that throw into a choice.
 *
 * The Skia drawing itself is untouched, in `ProcessingOrbSkiaCanvas.native.tsx`.
 */
import type React from 'react';
import { probeOptionalModule } from '../../utils/optionalNative';
import { ProcessingOrbFallback } from './ProcessingOrbFallback';
import type { SensoryFrame } from '../../utils/choreography';
import type { Tilt } from '../../utils/orbPhysics';

interface ProcessingOrbSkiaProps {
  progress: number;
  size?: number;
  frame?: SensoryFrame;
  tilt?: Tilt;
  maturityRatio?: number;
}

type OrbComponent = (props: ProcessingOrbSkiaProps) => React.JSX.Element;

/**
 * Resolved once at module load. Skia's availability cannot change while the
 * app is running, so re-probing per render would only cost frames.
 */
const canvas = probeOptionalModule<{ ProcessingOrbSkia: OrbComponent }>(() =>
  require('./ProcessingOrbSkiaCanvas'),
);

export const ProcessingOrbSkia: OrbComponent = canvas.available
  ? (canvas.module as { ProcessingOrbSkia: OrbComponent }).ProcessingOrbSkia
  : ProcessingOrbFallback;
