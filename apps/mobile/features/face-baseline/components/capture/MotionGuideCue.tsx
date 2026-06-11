/**
 * @module face-baseline/components/MotionGuideCue
 * @description Gentle head-turn indicator (arc sweep) shown during motion capture.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export function MotionGuideCue(): React.JSX.Element {
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(sweepAnim, {
          toValue: -1,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAnim]);

  const translateX = sweepAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-60, 60],
  });

  const rotate = sweepAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background guide track */}
      <View style={styles.track} />

      {/* Sweeping cursor dot */}
      <Animated.View
        style={[
          styles.cursor,
          {
            transform: [{ translateX }, { rotate }],
          },
        ]}
      >
        <View style={styles.innerDot} />
      </Animated.View>

      <Text style={styles.caption}>Follow the sweep</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: t.spacing.md,
    height: 48,
  },
  track: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'absolute',
  },
  cursor: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.color.accent.cyanGlow,
    shadowColor: t.color.accent.cyanGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  caption: {
    marginTop: 34,
    fontSize: t.text.caption.size,
    color: t.color.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
