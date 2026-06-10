/**
 * @module face-baseline/components/Buttons
 * @description Secondary (ghost) and tertiary (text-link) actions. Restrained,
 * no glow — glow is reserved for the focal subject + primary CTA.
 */
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
}

export function GhostButton({ label, onPress, testID }: GhostButtonProps): React.JSX.Element {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
    >
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

interface TextLinkProps {
  label: string;
  onPress: () => void;
  tone?: 'cyan' | 'muted';
  testID?: string;
}

export function TextLink({ label, onPress, tone = 'cyan', testID }: TextLinkProps): React.JSX.Element {
  const color = tone === 'cyan' ? t.color.accent.cyanGlow : t.color.text.secondary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      <Text style={[styles.linkLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ghost: {
    height: 56,
    borderRadius: t.radius.pill,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border.hairline,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  ghostPressed: { backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ scale: 0.985 }] },
  ghostLabel: { color: t.color.text.primary, fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  link: { paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  linkPressed: { opacity: 0.6 },
  linkLabel: { fontSize: 13, fontWeight: '500' },
});
