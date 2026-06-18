/**
 * @module finger-precision/components/RecoveryOverlay
 * @description Translucent blur overlay surfaced when scan quality drops.
 * Communicates the recovery tip clearly without resetting the user's progress.
 *
 * @version 1.0
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface RecoveryOverlayProps {
  visible: boolean;
  instruction: string;
  beatsKeptText: string;
}

export function RecoveryOverlay({
  visible,
  instruction,
  beatsKeptText,
}: RecoveryOverlayProps): React.JSX.Element | null {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: t.motion.recoveryOverlay,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: opacityAnim }]}>
      <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.hint}>{instruction}</Text>
        <Text style={styles.subHint}>{beatsKeptText}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(3, 4, 7, 0.4)',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hint: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF4A4A',
    textAlign: 'center',
    lineHeight: 30,
  },
  subHint: {
    fontSize: 14,
    color: '#9DB2CC',
    textAlign: 'center',
  },
});
