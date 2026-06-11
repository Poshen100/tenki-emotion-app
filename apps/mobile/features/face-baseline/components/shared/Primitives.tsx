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
    fontWeight: '600',
    letterSpacing: t.text.wordmark.tracking,
    color: t.color.text.primary,
    textAlign: 'center',
  },
  heroCenter: { alignItems: 'center' },
  heroLeft: { alignItems: 'flex-start' },
  heroTitle: {
    fontSize: t.text.hero.size,
    lineHeight: t.text.hero.lineHeight,
    fontWeight: '700',
    letterSpacing: t.text.hero.tracking,
    color: t.color.text.primary,
  },
  heroSubtitle: {
    marginTop: t.spacing.md,
    fontSize: t.text.body.size,
    lineHeight: t.text.body.lineHeight,
    color: t.color.text.secondary,
  },
  heroBody: {
    marginTop: t.spacing.sm,
    fontSize: t.text.body.size,
    lineHeight: t.text.body.lineHeight,
    color: t.color.text.tertiary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.trust.pillBg,
  },
  chipDot: { color: t.color.trust.pillText, fontSize: 13, marginRight: 6 },
  chipText: { color: t.color.trust.pillText, fontSize: t.text.pill.size, fontWeight: '600' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: t.spacing.md,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.trust.pillBg,
  },
  pillLock: { color: t.color.trust.pillText, fontSize: 12, marginRight: 6 },
  pillText: { color: t.color.trust.pillText, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  footnote: {
    fontSize: t.text.caption.size,
    lineHeight: t.text.caption.lineHeight,
    color: t.color.text.tertiary,
    textAlign: 'center',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  navSide: { width: 64, justifyContent: 'center' },
  navRight: { alignItems: 'flex-end' },
  navBack: { color: t.color.text.primary, fontSize: 28, fontWeight: '400', lineHeight: 30 },
  navTitle: { flex: 1, textAlign: 'center', color: t.color.text.primary, fontSize: t.text.title.size, fontWeight: '600' },
  navCancel: { color: t.color.accent.cyanGlow, fontSize: t.text.body.size },
});
