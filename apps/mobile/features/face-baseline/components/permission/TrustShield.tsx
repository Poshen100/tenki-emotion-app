/**
 * @module face-baseline/components/TrustShield
 * @description Gold permission trust emblem (the SECURED accent).
 * A faceted glass shield rendered in Skia: volumetric gradient body, lit/shadow
 * facets either side of the centre seam, a specular sheen sweep, a gold gradient
 * outline, a breathing halo, and drifting gold stardust.
 */
import type React from 'react';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, Group, RadialGradient, LinearGradient, BlurMask, Circle, vec } from '@shopify/react-native-skia';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface TrustShieldProps {
  size?: number;
}

const SPARKLES: ReadonlyArray<{ x: number; y: number; phase: number }> = [
  { x: 0.18, y: 0.16, phase: 0.0 },
  { x: 0.84, y: 0.26, phase: 1.4 },
  { x: 0.22, y: 0.8, phase: 2.6 },
  { x: 0.8, y: 0.74, phase: 3.8 },
  { x: 0.62, y: 0.04, phase: 5.0 },
];

/** Builds the heraldic shield outline, plus its left/right facets split by the centre seam. */
function buildShield(w: number, h: number) {
  const top = { x: w * 0.5, y: 0 };
  const bottom = { x: w * 0.5, y: h };
  const topLeft = { x: w * 0.086, y: h * 0.167 };
  const topRight = { x: w * 0.914, y: h * 0.167 };
  const midLeft = { x: w * 0.086, y: h * 0.485 };
  const midRight = { x: w * 0.914, y: h * 0.485 };

  const outline = Skia.Path.Make();
  outline.moveTo(top.x, top.y);
  outline.lineTo(topRight.x, topRight.y);
  outline.lineTo(midRight.x, midRight.y);
  outline.cubicTo(midRight.x, h * 0.727, w * 0.741, h * 0.894, bottom.x, bottom.y);
  outline.cubicTo(w * 0.259, h * 0.894, midLeft.x, h * 0.727, midLeft.x, midLeft.y);
  outline.lineTo(topLeft.x, topLeft.y);
  outline.close();

  const leftFacet = Skia.Path.Make();
  leftFacet.moveTo(top.x, top.y);
  leftFacet.lineTo(topLeft.x, topLeft.y);
  leftFacet.lineTo(midLeft.x, midLeft.y);
  leftFacet.cubicTo(midLeft.x, h * 0.727, w * 0.259, h * 0.894, bottom.x, bottom.y);
  leftFacet.close();

  const rightFacet = Skia.Path.Make();
  rightFacet.moveTo(top.x, top.y);
  rightFacet.lineTo(topRight.x, topRight.y);
  rightFacet.lineTo(midRight.x, midRight.y);
  rightFacet.cubicTo(midRight.x, h * 0.727, w * 0.741, h * 0.894, bottom.x, bottom.y);
  rightFacet.close();

  const seam = Skia.Path.Make();
  seam.moveTo(top.x, top.y);
  seam.lineTo(bottom.x, bottom.y);

  return { outline, leftFacet, rightFacet, seam, top };
}

export function TrustShield({ size = 96 }: TrustShieldProps): React.JSX.Element {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      setTime(Date.now());
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const canvasSize = size * 1.6;
  const w = size * 0.9;
  const h = size * 1.1;
  const ox = (canvasSize - w) / 2;
  const oy = (canvasSize - h) / 2 - size * 0.05;
  const { outline, leftFacet, rightFacet, seam, top } = buildShield(w, h);

  const breathe = 0.5 + 0.5 * Math.sin(time * 0.0015);
  const sparkle = (phase: number) => 0.2 + 0.8 * Math.max(0, Math.sin(time * 0.0024 + phase));

  return (
    <View style={{ width: canvasSize, height: canvasSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* breathing gold halo */}
        <Circle cx={canvasSize / 2} cy={canvasSize / 2} r={canvasSize * (0.46 + 0.05 * breathe)} color={`rgba(232,162,62,${(0.16 + 0.12 * breathe).toFixed(3)})`}>
          <BlurMask blur={22} style="normal" />
        </Circle>

        <Group transform={[{ translateX: ox }, { translateY: oy }]}>
          {/* volumetric glass body — lit upper-left, deep amber falling into shadow */}
          <Path path={outline}>
            <RadialGradient c={vec(w * 0.34, h * 0.26)} r={w * 1.05} colors={['rgba(140,104,52,0.62)', 'rgba(32,22,10,0.86)']} />
          </Path>

          {/* faceted lit/shadow split either side of the centre seam */}
          <Path path={leftFacet} color="rgba(255,224,160,0.14)" />
          <Path path={rightFacet} color="rgba(0,0,0,0.16)" />

          {/* specular sheen sweep, clipped to the shield silhouette */}
          <Group clip={outline}>
            <Path
              path={(() => {
                const sheen = Skia.Path.Make();
                sheen.moveTo(-w * 0.1, h * 0.06);
                sheen.lineTo(w * 0.5, -h * 0.04);
                sheen.lineTo(w * 0.34, h * 0.22);
                sheen.lineTo(-w * 0.2, h * 0.2);
                sheen.close();
                return sheen;
              })()}
              color="rgba(255,255,255,0.12)"
            />
          </Group>

          {/* centre seam */}
          <Path path={seam} style="stroke" strokeWidth={1.1} color="rgba(255,224,160,0.4)" />

          {/* gold gradient outline */}
          <Path path={outline} style="stroke" strokeWidth={2.4} strokeCap="round">
            <LinearGradient start={vec(0, 0)} end={vec(w, h)} colors={[t.color.accent.goldChampagne, t.color.accent.goldResonance]} />
            <BlurMask blur={1.4} style="normal" />
          </Path>

          {/* sparkle glints riding the facets */}
          {SPARKLES.map((s) => (
            <Circle key={s.phase} cx={top.x + (s.x - 0.5) * w} cy={s.y * h} r={1.6 * sparkle(s.phase)} color={t.color.accent.goldHi}>
              <BlurMask blur={3} style="normal" />
            </Circle>
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
