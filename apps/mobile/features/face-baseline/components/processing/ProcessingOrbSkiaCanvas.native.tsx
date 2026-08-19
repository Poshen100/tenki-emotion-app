/**
 * @module face-baseline/components/ProcessingOrbSkia.native
 * @description The gold "securing" orb, drawn with Skia.
 *
 * Ring speed, radius, thickness, blur and parallax all come from
 * `utils/orbPhysics.ts`. This file draws; it does not decide. That split is
 * what lets the orb's behaviour be tested without a canvas.
 *
 * ⚠️ Known issue, deliberately not fixed here: the rotation angles live in
 * React state and are written once per animation frame, which re-renders this
 * component roughly sixty times a second. The idiomatic fix is Skia's own
 * clock (`useClock` plus derived values) so rotation never crosses into React
 * at all. That is a change to the rendering model, and it cannot be verified
 * without a device running Skia — so it is recorded rather than guessed at.
 */
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, BlurMask, vec } from '@shopify/react-native-skia';
import { clamp01 } from '../../utils/progress';
import type { SensoryFrame } from '../../utils/choreography';
import {
  NO_TILT,
  RING_COUNT,
  advanceAngle,
  parallaxOffset,
  ringGeometry,
  ringSpeeds,
  type Tilt,
} from '../../utils/orbPhysics';

interface ProcessingOrbSkiaProps {
  progress: number;
  size?: number;
  /** Live signal state. Falls back to a progress-derived frame when absent. */
  frame?: SensoryFrame;
  /** Device tilt for parallax. Defaults to still. */
  tilt?: Tilt;
  /** Baseline maturity, 0–1. Thickens and brightens the rings. */
  maturityRatio?: number;
}

/** Derives a frame from progress alone, so existing call sites keep working. */
function frameFromProgress(progress: number): SensoryFrame {
  const p = clamp01(progress);
  return {
    convergence: p,
    scatter: (1 - p) * 0.35,
    brightness: 0.55 + p * 0.45,
    glow: 0.4 + p * 0.6,
    transitionMs: 400,
  };
}

export function ProcessingOrbSkia({
  progress,
  size = 220,
  frame,
  tilt = NO_TILT,
  maturityRatio = 0.5,
}: ProcessingOrbSkiaProps): React.JSX.Element {
  const clampedProgress = clamp01(progress);
  const resolvedFrame = frame ?? frameFromProgress(progress);
  const [angles, setAngles] = useState<number[]>(() => new Array(RING_COUNT).fill(0));
  const lastAt = useRef(0);

  useEffect(() => {
    let animId: number;
    const tick = (now: number) => {
      // Elapsed time rather than a fixed increment, so orbit speed means the
      // same thing on a 60Hz phone and a 120Hz one.
      const dt = lastAt.current === 0 ? 16 : Math.min(64, now - lastAt.current);
      lastAt.current = now;

      const speeds = ringSpeeds(resolvedFrame);
      setAngles((prev) => prev.map((a, i) => advanceAngle(a, speeds[i], dt)));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      lastAt.current = 0;
    };
  }, [resolvedFrame]);

  const center = size * 0.75;
  const canvasSize = size * 1.5;
  const orbRadius = size / 2;

  // Geometry and parallax per ring, both derived rather than hardcoded.
  const rings = Array.from({ length: RING_COUNT }, (_, i) => {
    const geo = ringGeometry(i, resolvedFrame, maturityRatio);
    const offset = parallaxOffset(tilt, i);
    return {
      radius: orbRadius * geo.radiusRatio,
      strokeWidth: geo.strokeWidth,
      blur: geo.blur,
      opacity: geo.opacity,
      angle: angles[i] ?? 0,
      cx: center + offset.dx,
      cy: center + offset.dy,
    };
  });

  const RING_COLORS = ['#FFC85E', '#FFFFFF', '#FF8800', '#FFF0D0'];
  // Fixed axis tilts keep each ring on its own plane; only rotateZ animates.
  const RING_AXES: Array<{ rotateX: number; rotateY?: number }> = [
    { rotateX: 0.96, rotateY: 0.17 },
    { rotateX: 1.13, rotateY: -0.44 },
    { rotateX: 0.7, rotateY: 0.61 },
    { rotateX: 1.22 },
  ];

  return (
    <View style={{ width: canvasSize, height: canvasSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* 1. Ambient Gold Nebula Glow */}
        <Circle cx={center} cy={center} r={orbRadius * 1.25} color="rgba(255, 136, 0, 0.15)">
          <BlurMask blur={36} style="normal" />
        </Circle>

        {/* 2. Glass Orb Base Shading */}
        <Circle cx={center} cy={center} r={orbRadius}>
          <RadialGradient
            c={vec(center, center)}
            r={orbRadius}
            colors={['rgba(35, 20, 10, 0.8)', 'rgba(10, 5, 2, 0.95)']}
          />
        </Circle>

        {/* 3–6. Orbiting rings — speed, size, blur and parallax all derived. */}
        {rings.map((ring, i) => (
          <Group
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed ring count; index is the identity
            key={i}
            transform={[
              { rotateX: RING_AXES[i].rotateX },
              ...(RING_AXES[i].rotateY === undefined ? [] : [{ rotateY: RING_AXES[i].rotateY }]),
              { rotateZ: ring.angle },
            ]}
            origin={vec(ring.cx, ring.cy)}
          >
            <Circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              style="stroke"
              strokeWidth={ring.strokeWidth}
              color={RING_COLORS[i]}
              opacity={ring.opacity}
            >
              <BlurMask blur={ring.blur} style="normal" />
            </Circle>
          </Group>
        ))}

        {/* 7. Glowing gold core — brightness follows the live frame, so the
             orb reads as settling rather than just filling up. */}
        <Circle
          cx={center}
          cy={center}
          r={orbRadius * (0.22 + clampedProgress * 0.12)}
          color="#FFC85E"
          opacity={0.6 + resolvedFrame.brightness * 0.4}
        >
          <BlurMask blur={8 + resolvedFrame.glow * 14} style="normal" />
        </Circle>

        {/* 8. Extra glass specular highlight gloss */}
        <Circle cx={center - orbRadius * 0.4} cy={center - orbRadius * 0.4} r={orbRadius * 0.3} color="rgba(255, 255, 255, 0.08)">
          <BlurMask blur={4} style="normal" />
        </Circle>
      </Canvas>
    </View>
  );
}
