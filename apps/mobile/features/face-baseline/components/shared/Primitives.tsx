/**
 * @module face-baseline/components/Primitives
 * @description Small shared building blocks: brand wordmark, hero copy,
 * time-cost chip, privacy lock pill, privacy footnote, nav bar.
 * All faithful to the reference frames; restrained and flat (no glow).
 */
import type React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

/** `TENKI` letterspaced wordmark, top-center. */
export function BrandWordmark(): React.JSX.Element {
  return <Text style={styles.wordmark}>TENKI</Text>;
}

interface HeroCopyProps {
  title: string;
  subtitle?: string;
  body?: string;
  align?: 'center' | 'left';
}

/** Centered (or left) hero title + optional subtitle/body block. */
export function BaselineHeroCopy({ title, subtitle, body, align = 'center' }: HeroCopyProps): React.JSX.Element {
  const textAlign = align;
  return (
    <View style={align === 'center' ? styles.heroCenter : styles.heroLeft}>
      <Text style={[styles.heroTitle, { textAlign }]}>{title}</Text>
      {subtitle ? <Text style={[styles.heroSubtitle, { textAlign }]}>{subtitle}</Text> : null}
      {body ? <Text style={[styles.heroBody, { textAlign }]}>{body}</Text> : null}
    </View>
  );
}

/** `⏱ {n} Seconds` expectation chip — a trust cue. */
export function TimeCostChip({ seconds }: { seconds: number }): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipDot}>⏱</Text>
      <Text style={styles.chipText}>{seconds} Seconds</Text>
    </View>
  );
}

/** `PRIVACY SECURED`-style lock pill. */
export function PrivacyLockPill({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLock}>🔒</Text>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/** Local-only privacy footnote. */
export function PrivacyFootnote({ text }: { text: string }): React.JSX.Element {
  return <Text style={styles.footnote}>{text}</Text>;
}

interface NavBarProps {
  title?: string;
  onBack?: () => void;
  onCancel?: () => void;
}

/** Top nav row: optional back (left), title (center), cancel (right). */
export function NavBar({ title, onBack, onCancel }: NavBarProps): React.JSX.Element {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
            <Text style={styles.navBack}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.navTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.navSide, styles.navRight]}>
        {onCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
            <Text style={styles.navCancel}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontSize: t.text.wordmark.size,
    fontWeight: '800',
    letterSpacing: t.text.wordmark.tracking,
    color: t.color.text.primary,
    textAlign: 'center',
  },
  heroCenter: { alignItems: 'center', paddingHorizontal: 16 },
  heroLeft: { alignItems: 'flex-start', paddingHorizontal: 16 },
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: t.spacing.md,
    fontSize: 16,
    lineHeight: 24,
    color: '#E0E4F3',
    fontWeight: '600',
  },
  heroBody: {
    marginTop: t.spacing.sm,
    fontSize: 14,
    lineHeight: 22,
    color: '#A6B0D3',
    fontWeight: '500',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  chipDot: { color: '#00F0FF', fontSize: 13, marginRight: 6 },
  chipText: { color: '#00F0FF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(243, 169, 42, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(243, 169, 42, 0.3)',
  },
  pillLock: { color: '#FFC85E', fontSize: 12, marginRight: 6 },
  pillText: { color: '#FFC85E', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    color: '#656D8A',
    textAlign: 'center',
    fontWeight: '500',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
  },
  navSide: { width: 64, justifyContent: 'center' },
  navRight: { alignItems: 'flex-end' },
  navBack: { color: '#FFFFFF', fontSize: 32, fontWeight: '300', lineHeight: 34 },
  navTitle: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  navCancel: { color: '#00F0FF', fontSize: 14, fontWeight: '700' },
});
