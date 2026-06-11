/**
 * @module face-baseline/components/GlowPrimaryButton
 * @description Signature glowing capsule CTA with breathing glow and press
 * feedback. The accent encodes which world the user acts from:
 *   - `cyan` = ACTIVE (pre-baseline) — cyan → indigo → violet gradient feel
 *   - `gold` = SECURED (post-baseline) — warm gold gradient feel
 *
 * Pure RN Animated — no Skia/Reanimated. Uses layered Views for the gradient
 * effect and Animated opacity for the breathing glow cycle.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import {
  Pressable, Text, View, Animated, StyleSheet,
  ActivityIndicator, type ViewStyle, type StyleProp,
} from 'react-native';
import { faceBaselineTokens as t, type AccentWorld } from '../../tokens/faceBaseline.tokens';

interface GlowPrimaryButtonProps {
  label: string;
  onPress: () => void;
  accent?: AccentWorld;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlowPrimaryButton({
  label,
  onPress,
  accent = 'cyan',
  disabled = false,
  loading = false,
  testID,
  style,
}: GlowPrimaryButtonProps): React.JSX.Element {
  const isGold = accent === 'gold';
  const inactive = disabled || loading;

  // Breathing glow (outer shadow pulsing)
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (inactive) {
      glowAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: t.motion.duration.ctaBreath / 2,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: t.motion.duration.ctaBreath / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [glowAnim, inactive]);

  const handlePressIn = (): void => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  // Interpolate glow opacity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.75],
  });

  const shadowColor = isGold ? t.color.accent.goldBloom : t.color.accent.cyanGlow;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {/* Intense breathing glow drop shadow behind the button */}
      {!inactive && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              backgroundColor: shadowColor,
              opacity: glowOpacity,
              transform: [
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.05],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.btn,
          inactive && styles.disabled,
        ]}
      >
        {/* Gradient Border Base Layer */}
        {isGold ? (
          <>
            <View style={[styles.gradientLayer, styles.goldLeft]} />
            <View style={[styles.gradientLayer, styles.goldRight]} />
          </>
        ) : (
          <>
            <View style={[styles.gradientLayer, styles.cyanLeft]} />
            <View style={[styles.gradientLayer, styles.cyanCenter]} />
            <View style={[styles.gradientLayer, styles.cyanRight]} />
          </>
        )}

        {/* Inner Dark Mask Container creating the border stroke */}
        <View style={[
          styles.innerMask,
          isGold ? styles.innerMaskGold : styles.innerMaskCyan,
        ]}>
          <View style={styles.inner}>
            {loading && (
              <ActivityIndicator color={isGold ? t.color.accent.goldResonance : t.color.accent.cyanGlow} style={styles.spinner} />
            )}
            <Text style={[
              styles.label,
              isGold ? styles.labelGold : styles.labelCyan
            ]}>
              {label}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 58,
    borderRadius: t.radius.pill,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },

  // ─── Gradient simulation layers (positioned absolute inside the btn) ───
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cyanLeft: {
    right: '40%',
    backgroundColor: '#00F0FF',
  },
  cyanCenter: {
    left: '25%',
    right: '25%',
    backgroundColor: '#5A7DFF',
  },
  cyanRight: {
    left: '55%',
    backgroundColor: '#704BFF',
  },
  goldLeft: {
    right: '50%',
    backgroundColor: '#FFF0D0',
  },
  goldRight: {
    left: '40%',
    backgroundColor: '#FF8800',
  },

  // ─── Inner Mask creating the 2px stroke border ───
  innerMask: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: t.radius.pill - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerMaskCyan: {
    backgroundColor: '#080C20', // deep space blue
  },
  innerMaskGold: {
    backgroundColor: '#160F05', // deep warm gold-tinted brown
  },

  // ─── Content ────────────────────────
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  spinner: { marginRight: 8 },
  label: { fontSize: 18, fontWeight: '800', letterSpacing: 0.8, textTransform: 'none' },
  labelCyan: { color: '#FFFFFF' },
  labelGold: { color: '#FFD27A' },

  // ─── States ─────────────────────────
  disabled: { opacity: t.overlay.disabledCta },

  // ─── Outer glow layer ───────────────
  glowLayer: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: t.radius.pill,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 28,
  },
});
