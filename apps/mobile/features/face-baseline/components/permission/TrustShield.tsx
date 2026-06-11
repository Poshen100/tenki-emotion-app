/**
 * @module face-baseline/components/TrustShield
 * @description Gold permission trust emblem (the SECURED accent).
 * Core-RN shield silhouette with a soft gold glow.
 *
 * INTEGRATION (Skia): replace with a gradient shield + inner sheen and a
 * gentle breathing glow; add a grant pulse on permission accept.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export function TrustShield({ size = 96 }: { size?: number }): React.JSX.Element {
  return (
    <View style={[styles.glow, { width: size * 1.4, height: size * 1.4, borderRadius: size }]}>
      <View
        style={[
          styles.shield,
          { width: size, height: size * 1.1, borderRadius: size * 0.28 },
        ]}
        accessibilityRole="image"
        accessibilityLabel="Secure"
      >
        <Text style={[styles.glyph, { fontSize: size * 0.5 }]}>⛨</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,180,90,0.06)',
    shadowColor: t.color.accent.goldResonance,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
  },
  shield: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.color.border.glassGold,
    backgroundColor: t.color.surface.glassGold,
  },
  glyph: { color: t.color.accent.goldSoft },
});
