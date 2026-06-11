import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Group, Paint, RadialGradient, BlurMask, Path, vec } from '@shopify/react-native-skia';
import { clamp01 } from '../../utils/progress';

interface ProcessingOrbSkiaProps {
  progress: number;
  size?: number;
}

export function ProcessingOrbSkia({ progress, size = 220 }: ProcessingOrbSkiaProps): React.JSX.Element {
  const clampedProgress = clamp01(progress);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      setAngle((a) => (a + 0.015) % (Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const center = size * 0.75;
  const canvasSize = size * 1.5;
  const orbRadius = size / 2;

  // Orbiting ring radiuses
  const r1 = orbRadius * 0.94;
  const r2 = orbRadius * 0.82;
  const r3 = orbRadius * 0.66;
  const r4 = orbRadius * 0.48;

  return (
    <View style={{ width: canvasSize, height: canvasSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* 1. Ambient Gold Nebula Glow */}
        <Circle cx={center} cy={center} r={orbRadius * 1.25} color="rgba(255, 136, 0, 0.15)">
          <BlurMask sigma={36} style="normal" />
        </Circle>

        {/* 2. Glass Orb Base Shading */}
        <Circle cx={center} cy={center} r={orbRadius}>
          <RadialGradient
            c={vec(center, center)}
            r={orbRadius}
            colors={['rgba(35, 20, 10, 0.8)', 'rgba(10, 5, 2, 0.95)']}
          />
        </Circle>

        {/* 3. Orbiting ring 1 (Outer) */}
        <Group transform={[{ rotateX: 0.96 }, { rotateY: 0.17 }, { rotateZ: angle }]} origin={vec(center, center)}>
          <Circle cx={center} cy={center} r={r1} style="stroke" strokeWidth={2.0} color="#FFC85E">
            <BlurMask sigma={1.5} style="normal" />
          </Circle>
        </Group>

        {/* 4. Orbiting ring 2 (Mid) */}
        <Group transform={[{ rotateX: 1.13 }, { rotateY: -0.44 }, { rotateZ: -angle * 1.3 }]} origin={vec(center, center)}>
          <Circle cx={center} cy={center} r={r2} style="stroke" strokeWidth={1.5} color="#FFFFFF">
            <BlurMask sigma={1} style="normal" />
          </Circle>
        </Group>

        {/* 5. Orbiting ring 3 (Inner) */}
        <Group transform={[{ rotateX: 0.7 }, { rotateY: 0.61 }, { rotateZ: angle * 1.6 }]} origin={vec(center, center)}>
          <Circle cx={center} cy={center} r={r3} style="stroke" strokeWidth={2.5} color="#FF8800">
            <BlurMask sigma={2} style="normal" />
          </Circle>
        </Group>

        {/* 6. Orbiting ring 4 (Core) */}
        <Group transform={[{ rotateX: 1.22 }, { rotateZ: -angle * 2 }]} origin={vec(center, center)}>
          <Circle cx={center} cy={center} r={r4} style="stroke" strokeWidth={1} color="#FFF0D0" />
        </Group>

        {/* 7. Supercharged Glowing Gold Core */}
        <Circle cx={center} cy={center} r={orbRadius * (0.22 + clampedProgress * 0.12)} color="#FFC85E">
          <BlurMask sigma={8 + clampedProgress * 12} style="normal" />
        </Circle>

        {/* 8. Extra glass specular highlight gloss */}
        <Circle cx={center - orbRadius * 0.4} cy={center - orbRadius * 0.4} r={orbRadius * 0.3} color="rgba(255, 255, 255, 0.08)">
          <BlurMask sigma={4} style="normal" />
        </Circle>
      </Canvas>
    </View>
  );
}
