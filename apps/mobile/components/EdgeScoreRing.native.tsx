import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { spacing, typography as typo, getZoneForScore } from '../theme';

interface EdgeScoreRingProps {
  score: number;
  size?: number;
}

const RING_WIDTH = 6;
const TRACK_OPACITY = 0.25;

/**
 * Circular Edge Score display (Skia).
 * Full-circle track in the zone tone plus a sweep arc proportional to the
 * score (0-100 → 0-360°, starting at 12 o'clock). Static by design — the
 * animated treatment lands with the Reanimated 3 migration at native stage.
 */
export function EdgeScoreRing({ score, size = 200 }: EdgeScoreRingProps): React.JSX.Element {
  const zone = getZoneForScore(score);
  const inset = RING_WIDTH / 2;
  const oval = { x: inset, y: inset, width: size - RING_WIDTH, height: size - RING_WIDTH };

  const track = Skia.Path.Make();
  track.addOval(oval);

  const sweep = (Math.min(Math.max(score, 0), 100) / 100) * 360;
  const arc = Skia.Path.Make();
  arc.addArc(oval, -90, sweep);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          path={track}
          style="stroke"
          strokeWidth={RING_WIDTH}
          color={zone.bg}
          opacity={TRACK_OPACITY}
        />
        <Path
          path={arc}
          style="stroke"
          strokeWidth={RING_WIDTH}
          strokeCap="round"
          color={zone.bg}
        />
      </Canvas>
      <View style={styles.center}>
        <Text style={[typo.edgeScore, { color: zone.bg }]}>{score}</Text>
        <Text style={[styles.label, { color: zone.bg }]}>Edge Score</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -spacing.xs,
  },
});
