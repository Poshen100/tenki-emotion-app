import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, BlurMask } from '@shopify/react-native-skia';
import { spacing, typography as typo, getZoneForScore } from '../theme';

interface EdgeScoreRingProps {
  score: number;
  size?: number;
}

const RING_WIDTH = 6;
const FILL_DURATION_MS = 1200;
const START_ANGLE_DEG = -90;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function ringPath(size: number, sweepDeg: number) {
  const oval = Skia.XYWHRect(RING_WIDTH / 2, RING_WIDTH / 2, size - RING_WIDTH, size - RING_WIDTH);
  const path = Skia.Path.Make();
  path.addArc(oval, START_ANGLE_DEG, sweepDeg);
  return path;
}

/** Circular Edge Score gauge — Skia progress arc colored by zone, with score fill-in animation. */
export function EdgeScoreRing({ score, size = 200 }: EdgeScoreRingProps): React.JSX.Element {
  const clampedScore = Math.max(0, Math.min(100, score));
  const zone = getZoneForScore(clampedScore);
  const [animatedScore, setAnimatedScore] = useState(0);
  const startScoreRef = useRef(0);

  useEffect(() => {
    const fromScore = startScoreRef.current;
    const startTime = Date.now();
    let animId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / FILL_DURATION_MS);
      const next = fromScore + (clampedScore - fromScore) * easeOutCubic(t);
      setAnimatedScore(next);
      if (t < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        startScoreRef.current = clampedScore;
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [clampedScore]);

  const trackPath = ringPath(size, 360);
  const fillPath = ringPath(size, (animatedScore / 100) * 360);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={trackPath} style="stroke" strokeWidth={RING_WIDTH} strokeCap="round" color="rgba(255,255,255,0.1)" />
        <Path path={fillPath} style="stroke" strokeWidth={RING_WIDTH} strokeCap="round" color={zone.bg}>
          <BlurMask blur={4} style="normal" />
        </Path>
      </Canvas>
      <Text style={[typo.edgeScore, { color: zone.bg }]}>{Math.round(clampedScore)}</Text>
      <Text style={[styles.label, { color: zone.bg }]}>Edge Score</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -spacing.xs,
  },
});
