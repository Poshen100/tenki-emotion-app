/**
 * @module face-baseline/components/GlowPrimaryButton
 * @description Signature glowing capsule CTA. The accent encodes which world
 * the user acts from: `cyan` = ACTIVE (pre-baseline), `gold` = SECURED (post).
 *
 * INTEGRATION (Reanimated): add the idle breathing-glow loop + press glow
 * intensify. This core-RN version uses static shadow + press-scale only.
 */
import type React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { faceBaselineTokens as t, type AccentWorld } from '../../tokens/faceBaseline.tokens';

interface GlowPrimaryButtonProps {
  label: string;
  onPress: () => void;
  accent?: AccentWorld;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

export function GlowPrimaryButton({
  label,
  onPress,
  accent = 'cyan',
  disabled = false,
  loading = false,
  testID,
}: GlowPrimaryButtonProps): React.JSX.Element {
  const isGold = accent === 'gold';
  const fill = isGold ? t.color.accent.goldResonance : t.color.accent.electricBlue;
  const glow = isGold ? t.shadow.ctaGold.color : t.shadow.ctaCyan.color;
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: fill, shadowColor: glow },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}
    >
      <View style={styles.inner}>
        {loading && <ActivityIndicator color={t.color.text.onGlow} style={styles.spinner} />}
        <Text style={[styles.label, { color: t.color.text.onGlow }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: t.radius.pill,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  spinner: { marginRight: 8 },
  label: { fontSize: 17, fontWeight: '600', letterSpacing: 0.3 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: t.overlay.disabledCta, shadowOpacity: 0 },
});
