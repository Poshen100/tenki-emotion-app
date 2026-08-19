import type React from 'react';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, BlurMask, Path, Skia, vec } from '@shopify/react-native-skia';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { STAGE_ORDER } from '../../utils/maturityStage';

interface ResonanceOrbSkiaProps {
  stage: MaturityStage;
  size?: number;
}

function stageIndex(stage: MaturityStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function stageTint(stage: MaturityStage): string {
  return t.progress.stageColors[stage];
}

function goldRatio(stage: MaturityStage): number {
  const idx = stageIndex(stage);
  return [0, 0.15, 0.45, 1][idx];
}

export function ResonanceOrbSkia({ stage, size = 180 }: ResonanceOrbSkiaProps): React.JSX.Element {
  const tint = stageTint(stage);
  const gold = goldRatio(stage);
  const idx = stageIndex(stage);

  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      setAngle((a) => (a + 0.01) % (Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const center = size * 0.75;
  const canvasSize = size * 1.5;
  const orbRadius = size / 2;

  // Measurements
  const r1 = orbRadius * 0.94;
  const r2 = orbRadius * 0.78;
  const r3 = orbRadius * 0.62;
  const coreSize = orbRadius * 0.38;

  // Colors
  const ringColor = gold > 0.5 ? t.color.accent.goldSoft : tint;
  const coreColor = gold > 0.5 ? t.color.accent.goldResonance : tint;
  const orbBg = gold > 0.3 ? 'rgba(40, 24, 12, 0.75)' : 'rgba(12, 18, 36, 0.75)';

  // Build diamond path
  const diamondPath = Skia.Path.Make();
  diamondPath.moveTo(center, center - coreSize);
  diamondPath.lineTo(center + coreSize, center);
  diamondPath.lineTo(center, center + coreSize);
  diamondPath.lineTo(center - coreSize, center);
  diamondPath.close();

  // Build inner octagon path
  const octSize = coreSize * 0.6;
  const octPath = Skia.Path.Make();
  for (let i = 0; i < 8; i++) {
    const theta = (i * Math.PI) / 4;
    const x = center + octSize * Math.cos(theta);
    const y = center + octSize * Math.sin(theta);
    if (i === 0) octPath.moveTo(x, y);
    else octPath.lineTo(x, y);
  }
  octPath.close();

  const coreScale = 1.0 + Math.sin(angle * 3) * 0.04;

  return (
    <View style={{ width: canvasSize, height: canvasSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* 1. Outer ambient glow */}
        <Circle cx={center} cy={center} r={orbRadius * 1.2} color={ringColor}>
          <BlurMask blur={28} style="normal" />
        </Circle>

        {/* 2. Main sphere body */}
        <Circle cx={center} cy={center} r={orbRadius}>
          <RadialGradient
            c={vec(center, center)}
            r={orbRadius}
            colors={[orbBg, 'rgba(4, 6, 15, 0.96)']}
          />
        </Circle>

        {/* 3. Ring 1 — Outermost orbital (always visible) */}
        <Group transform={[{ rotateX: 1.22 }, { rotateZ: angle }]} origin={vec(center, center)}>
          <Circle cx={center} cy={center} r={r1} style="stroke" strokeWidth={2.0} color={ringColor}>
            <BlurMask blur={1} style="normal" />
          </Circle>
        </Group>

        {/* 4. Ring 2 — Building+ */}
        {idx >= 1 && (
          <Group transform={[{ rotateX: 0.96 }, { rotateZ: -angle * 0.8 }, { rotateY: 0.6 }]} origin={vec(center, center)}>
            <Circle cx={center} cy={center} r={r2} style="stroke" strokeWidth={1.5} color={ringColor}>
              <BlurMask blur={0.8} style="normal" />
            </Circle>
          </Group>
        )}

        {/* 5. Ring 3 — Ready+ */}
        {idx >= 2 && (
          <Group transform={[{ rotateY: 1.05 }, { rotateZ: angle * 1.2 }]} origin={vec(center, center)}>
            <Circle cx={center} cy={center} r={r3} style="stroke" strokeWidth={1.0} color={ringColor} />
          </Group>
        )}

        {/* 6. Geometric diamond core */}
        <Group transform={[{ scale: coreScale }]} origin={vec(center, center)}>
          <Path path={diamondPath} style="stroke" strokeWidth={2.0} color={coreColor}>
            <BlurMask blur={1.5} style="normal" />
          </Path>
        </Group>

        {/* 7. Inner octagon (Ready+) */}
        {idx >= 2 && (
          <Group transform={[{ rotate: Math.PI / 8 }]} origin={vec(center, center)}>
            <Path path={octPath} style="stroke" strokeWidth={1.2} color={coreColor} />
          </Group>
        )}

        {/* 8. Center dot (Mature only) */}
        {idx >= 3 && (
          <Circle cx={center} cy={center} r={orbRadius * 0.09} color={t.color.accent.goldSoft}>
            <BlurMask blur={4} style="normal" />
          </Circle>
        )}

        {/* 9. Extra glass specular highlight gloss */}
        <Circle cx={center - orbRadius * 0.38} cy={center - orbRadius * 0.38} r={orbRadius * 0.28} color="rgba(255, 255, 255, 0.06)">
          <BlurMask blur={3} style="normal" />
        </Circle>
      </Canvas>
    </View>
  );
}
