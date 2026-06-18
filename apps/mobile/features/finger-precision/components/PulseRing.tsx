/**
 * @module finger-precision/components/PulseRing
 * @description Expanding ripple ring that animates outward with each detected heartbeat.
 *
 * @version 1.0
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface PulseRingProps {
  beatCount: number;
  active: boolean;
}

export function PulseRing({ beatCount, active }: PulseRingProps): React.JSX.Element | null {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || beatCount === 0) {
      opacityAnim.setValue(0);
      return;
    }

    // Reset animations
    scaleAnim.setValue(0.7);
    opacityAnim.setValue(0.6);

    // Expand outward and fade away
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 2.2,
        duration: t.motion.ringExpand,
        easing: (x) => 1 - (1 - x) ** 3, // cubic easeOut
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: t.motion.ringExpand,
        useNativeDriver: true,
      }),
    ]).start();
  }, [beatCount, active, scaleAnim, opacityAnim]);

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          borderColor: t.colors.pulseRing,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    zIndex: 1,
  },
});
