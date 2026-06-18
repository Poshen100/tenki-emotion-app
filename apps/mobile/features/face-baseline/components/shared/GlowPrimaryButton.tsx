/**
 * @module face-baseline/components/GlowPrimaryButton
 * @description Signature glowing capsule CTA with breathing glow and press
 * feedback. The accent encodes which world the user acts from:
 *   - `cyan` = ACTIVE (pre-baseline) — cyan → blue → indigo/violet gradient
 *   - `gold` = SECURED (post-baseline) — champagne → warm gold gradient
 *
 * Fill is a real horizontal `<LinearGradient>` (expo-linear-gradient).
 * `variant="pale"` renders the inverted pale-cyan / dark-label CTA used on
 * the Why-Baseline carousel card. Disabled state is a flat grey capsule,
 * clearly distinct from any active gradient.
 *
 * Pure RN Animated — no Skia/Reanimated.
 *
 * @version 3.2
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  Pressable, Text, View, Animated, StyleSheet,
  ActivityIndicator, type ViewStyle, type StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { faceBaselineTokens as t, type AccentWorld } from '../../tokens/faceBaseline.tokens';

/** Visual variant: `solid` = world gradient, `pale` = light capsule + dark label. */
export type GlowButtonVariant = 'solid' | 'pale';

interface GlowPrimaryButtonProps {
  label: string;
  onPress: () => void;
  accent?: AccentWorld;
  variant?: GlowButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Gradient stops for the active fill, by accent world / variant. */
function gradientStops(accent: AccentWorld, variant: GlowButtonVariant): readonly string[] {
  if (variant === 'pale') return t.gradient.ctaPale;
  return accent === 'gold' ? t.gradient.ctaGold : t.gradient.ctaCyan;
}

export function GlowPrimaryButton({
  label,
  onPress,
  accent = 'cyan',
  variant = 'solid',
  disabled = false,
  loading = false,
  testID,
  style,
}: GlowPrimaryButtonProps): React.JSX.Element {
  const isGold = accent === 'gold';
  const isPale = variant === 'pale';
  const inactive = disabled || loading;
  const darkLabel = isGold || isPale;

  // Breathing glow (outer halo pulsing)
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

  // Stronger breathing halo: larger layer, higher max opacity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });

  const haloColor = isPale
    ? '#A8E9FF'
    : isGold
      ? t.color.accent.goldWarm
      : t.color.accent.cyanGlow;

  const stops = gradientStops(accent, variant);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {/* Breathing outer glow halo behind the capsule */}
      {!inactive && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              backgroundColor: haloColor,
              shadowColor: haloColor,
              opacity: glowOpacity,
              transform: [
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1.08],
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
        style={styles.btn}
      >
        {inactive ? (
          /* Disabled: flat grey capsule, obviously distinct from gradient */
          <View style={[StyleSheet.absoluteFill, styles.disabledFill]} />
        ) : (
          /* Real horizontal gradient fill */
          <LinearGradient
            colors={[...stops] as [string, string, ...string[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.inner}>
          {loading && (
            <ActivityIndicator
              color={isGold ? t.color.accent.goldResonance : t.color.accent.cyanGlow}
              style={styles.spinner}
            />
          )}
          <Text
            style={[
              styles.label,
              inactive
                ? styles.labelDisabled
                : darkLabel
                  ? styles.labelDark
                  : styles.labelLight,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 57,
    borderRadius: t.radius.pill,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Content ────────────────────────
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  spinner: { marginRight: 8 },
  label: { fontSize: 17, fontWeight: '700', letterSpacing: 0.4 },
  labelLight: { color: '#FFFFFF' },
  labelDark: { color: '#0A1024' },
  labelDisabled: { color: 'rgba(255,255,255,0.35)' },

  // ─── Disabled fill ──────────────────
  disabledFill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // ─── Outer glow halo ────────────────
  glowLayer: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: t.radius.pill,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 34,
  },
});
