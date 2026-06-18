/**
 * @module finger-precision/components/PrecisionArc.web
 * @description Circular progress arc drawn using raw SVG elements for web compatibility.
 *
 * @version 1.0
 */

import type React from 'react';
import { View } from 'react-native';
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
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ * (1 - Math.min(1, Math.max(0, progress)));

  // Dynamic colors based on progress
  let color: string = t.colors.precisionLow;
  if (progress >= 0.90) {
    color = t.colors.precisionHigh;
  } else if (progress >= 0.40) {
    color = t.colors.precisionMid;
  }

  return (
    <View style={{ width: size, height: size, position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {progress > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        )}
      </svg>
    </View>
  );
}
