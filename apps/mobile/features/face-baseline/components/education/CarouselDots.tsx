/**
 * @module face-baseline/components/CarouselDots
 * @description Page indicator for the Why-Baseline carousel. Active dot widens.
 * Uses Animated values for smooth transition.
 */
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface CarouselDotsProps {
  count: number;
  active: number;
}

function AnimatedDot({ active }: { active: boolean }): React.JSX.Element {
  const widthAnim = useRef(new Animated.Value(active ? 18 : 6)).current;
  const colorAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: active ? 18 : 6,
        duration: t.motion.duration.carouselPage,
        useNativeDriver: false,
      }),
      Animated.timing(colorAnim, {
        toValue: active ? 1 : 0,
        duration: t.motion.duration.carouselPage,
        useNativeDriver: false,
      }),
    ]).start();
  }, [active, widthAnim, colorAnim]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(166,173,200,0.35)', t.color.accent.cyanGlow],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: widthAnim,
          backgroundColor,
        },
      ]}
    />
  );
}

export function CarouselDots({ count, active }: CarouselDotsProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
        <AnimatedDot key={i} active={i === active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { height: 6, borderRadius: 3 },
});
