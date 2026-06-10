/**
 * @module face-baseline/components/CarouselDots
 * @description Page indicator for the Why-Baseline carousel. Active dot widens.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface CarouselDotsProps {
  count: number;
  active: number;
}

export function CarouselDots({ count, active }: CarouselDotsProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active ? styles.active : styles.inactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { height: 6, borderRadius: 3 },
  active: { width: 18, backgroundColor: t.color.accent.cyanGlow },
  inactive: { width: 6, backgroundColor: 'rgba(166,173,200,0.35)' },
});
