/**
 * @module finger-precision/components/PrecisionArc.native
 * @description Circular progress arc drawn using Skia for native platforms.
 *
 * @version 1.0
 */

import type React from 'react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface PrecisionArcProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export function PrecisionArc({
  progress,
  size = 160,
  strokeWidth = 6,
}: PrecisionArcProps): React.JSX.Element {
  const center = size / 2;
  const radius = center - strokeWidth;

  // Background track path
  const trackPath = Skia.Path.Make();
  trackPath.addArc(
    { x: strokeWidth, y: strokeWidth, width: radius * 2, height: radius * 2 },
    0,
    360
  );

  // Active progress path
  const progressPath = Skia.Path.Make();
  if (progress > 0) {
    progressPath.addArc(
      { x: strokeWidth, y: strokeWidth, width: radius * 2, height: radius * 2 },
      -90, // Start at top (12 o'clock)
      Math.min(0.9999, progress) * 360 // Avoid exactly 360 which can reset path
    );
  }

  // Dynamic colors based on progress
  let color: string = t.colors.precisionLow;
  if (progress >= 0.90) {
    color = t.colors.precisionHigh;
  } else if (progress >= 0.40) {
    color = t.colors.precisionMid;
  }

  return (
    <Canvas style={{ width: size, height: size, position: 'absolute' }}>
      <Path
        path={trackPath}
        color="rgba(255, 255, 255, 0.08)"
        style="stroke"
        strokeWidth={strokeWidth}
      />
      {progress > 0 && (
        <Path
          path={progressPath}
          color={color}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      )}
    </Canvas>
  );
}
