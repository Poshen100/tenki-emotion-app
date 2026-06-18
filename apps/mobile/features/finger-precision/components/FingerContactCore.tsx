/**
 * @module finger-precision/components/FingerContactCore
 * @description Central pulsing core indicator for the Finger Precision scan.
 * Animates in a soft breathing pattern when waiting for contact,
 * and pulses dynamically based on the current BPM when finger contact is secured.
 *
 * @version 1.0
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface FingerContactCoreProps {
  contactDetected: boolean;
  signalLocked: boolean;
  bpm: number | null;
  complete?: boolean;
}

export function FingerContactCore({
  contactDetected,
  signalLocked,
  bpm,
  complete = false,
}: FingerContactCoreProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  // Pulse/breath animation loops
  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation | null = null;

    if (complete) {
      // Complete state: stable glow
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!contactDetected) {
      // Idle / waiting state: slow breathing
      animationLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.03,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.5,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 0.97,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.2,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animationLoop.start();
    } else {
      // Contact detected: active pulse
      const pulsePeriod = bpm ? (60000 / bpm) : t.motion.pulseInterval;
      
      animationLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: t.motion.pulseScale.max,
              duration: pulsePeriod * 0.3, // Systole: fast contraction/expansion
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: signalLocked ? 0.9 : 0.6,
              duration: pulsePeriod * 0.3,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: t.motion.pulseScale.min,
              duration: pulsePeriod * 0.7, // Diastole: slow release
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: signalLocked ? 0.5 : 0.3,
              duration: pulsePeriod * 0.7,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animationLoop.start();
    }

    return () => {
      if (animationLoop) {
        animationLoop.stop();
      }
    };
  }, [contactDetected, signalLocked, bpm, complete]);

  // Color mapping based on state
  const coreColor = complete
    ? t.colors.precisionHigh // Gold
    : contactDetected
    ? t.colors.pulseCore      // Warm Red
    : 'rgba(255, 255, 255, 0.2)'; // Dim white

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: coreColor,
            opacity: glowOpacity,
            transform: [{ scale: scaleAnim }],
            shadowColor: coreColor,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            backgroundColor: coreColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    zIndex: 2,
  },
  glow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 8,
  },
});
