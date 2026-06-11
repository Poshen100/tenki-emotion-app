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
    outputRange: [0.25, 0.55],
  });

  // Colors
  const shadow = isGold ? t.shadow.ctaGold : t.shadow.ctaCyan;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {/* Glow layer behind the button */}
      {!inactive && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              backgroundColor: shadow.color,
              opacity: glowOpacity,
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
          isGold ? styles.btnGold : styles.btnCyan,
          inactive && styles.disabled,
        ]}
      >
        {/* Gradient simulation layers */}
        {isGold ? (
          <>
            <View style={[styles.gradientLayer, styles.goldLeft]} />
            <View style={[styles.gradientLayer, styles.goldRight]} />
            <View style={styles.innerHighlight} />
          </>
        ) : (
          <>
            <View style={[styles.gradientLayer, styles.cyanLeft]} />
            <View style={[styles.gradientLayer, styles.cyanCenter]} />
            <View style={[styles.gradientLayer, styles.cyanRight]} />
            <View style={styles.innerHighlight} />
          </>
        )}
        <View style={styles.inner}>
          {loading && (
            <ActivityIndicator color={isGold ? t.color.text.onGlow : '#FFFFFF'} style={styles.spinner} />
          )}
          <Text style={[styles.label, isGold && styles.labelGold]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: t.radius.pill,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnCyan: {
    backgroundColor: t.color.accent.electricBlue,
    shadowColor: t.shadow.ctaCyan.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  btnGold: {
    backgroundColor: t.color.accent.goldResonance,
    shadowColor: t.shadow.ctaGold.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },

  // ─── Gradient simulation layers (positioned absolute inside the btn) ───
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cyanLeft: {
    right: '40%',
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.3,
  },
  cyanCenter: {
    left: '25%',
    right: '25%',
    backgroundColor: t.color.accent.indigo,
    opacity: 0.4,
  },
  cyanRight: {
    left: '55%',
    backgroundColor: t.color.accent.violet,
    opacity: 0.5,
  },
  goldLeft: {
    right: '50%',
    backgroundColor: t.color.accent.goldSoft,
    opacity: 0.35,
  },
  goldRight: {
    left: '50%',
    backgroundColor: t.color.accent.goldResonance,
    opacity: 0.25,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ─── Content ────────────────────────
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  spinner: { marginRight: 8 },
  label: { fontSize: 17, fontWeight: '600', letterSpacing: 0.3, color: '#FFFFFF' },
  labelGold: { color: t.color.text.onGlow },

  // ─── States ─────────────────────────
  disabled: { opacity: t.overlay.disabledCta, shadowOpacity: 0 },

  // ─── Outer glow layer ───────────────
  glowLayer: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    bottom: -4,
    borderRadius: t.radius.pill,
    // blur-like spread is simulated by the size being slightly larger
  },
});
