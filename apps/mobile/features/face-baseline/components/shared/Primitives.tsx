/**
 * @module face-baseline/components/Primitives
 * @description Small shared building blocks: brand wordmark, hero copy,
 * time-cost chip, privacy lock pill, privacy footnote, nav bar.
 * All faithful to the reference frames; restrained and flat (no glow).
 */
import type React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Platform } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

/** `TENKI` letterspaced wordmark with pure wave symbol, top-center. */
export function BrandWordmark(): React.JSX.Element {
  return (
    <View style={styles.wordmarkContainer}>
      <Image
        source={require('../../../../../assets/favicon.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      <Text style={styles.wordmark}>TENKI</Text>
    </View>
  );
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
      <Text style={styles.chipText}>⏱ {seconds} Seconds</Text>
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

/** Local-only privacy footnote: 🔒-prefixed, grey tertiary, centered two-liner. */
export function PrivacyFootnote({ text }: { text: string }): React.JSX.Element {
  return <Text style={styles.footnote}>🔒 {text}</Text>;
}

interface NavBarProps {
  title?: string;
  onBack?: () => void;
  onCancel?: () => void;
  showLogo?: boolean;
  titleColor?: string;
}

/** Top nav row: optional back (left), title (center), cancel (right), optional logo. */
export function NavBar({ title, onBack, onCancel, showLogo, titleColor }: NavBarProps): React.JSX.Element {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {showLogo ? (
          <View style={styles.navLogoWrap}>
            <Image
              source={require('../../../../../assets/favicon.png')}
              style={styles.navLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.navLogoText}>TENKI</Text>
          </View>
        ) : onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
            <Text style={styles.navBack}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.navTitle, titleColor ? { color: titleColor } : null]} numberOfLines={1}>
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
  wordmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logoImage: {
    width: 36,
    height: 36,
    tintColor: '#FFFFFF',
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '200',
    letterSpacing: 6,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light',
  },
  heroCenter: { alignItems: 'center', paddingHorizontal: 20 },
  heroLeft: { alignItems: 'flex-start', paddingHorizontal: 20 },
  heroTitle: {
    fontSize: t.text.hero.size,
    lineHeight: t.text.hero.lineHeight,
    fontWeight: t.text.hero.weight,
    letterSpacing: t.text.hero.tracking,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: t.spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    color: '#A6B0D3',
    fontWeight: '500',
    maxWidth: '92%',
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
  },
  chipText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 15, fontWeight: '500' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  pillLock: { color: 'rgba(255, 200, 94, 0.8)', fontSize: 10, marginRight: 6 },
  pillText: { color: 'rgba(255, 200, 94, 0.8)', fontSize: 10, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase' },
  footnote: {
    fontSize: 11,
    lineHeight: 17,
    color: '#656D8A',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 250,
    alignSelf: 'center',
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
  navLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  navLogoImage: {
    width: 20,
    height: 20,
    tintColor: '#00B4D8',
  },
  navLogoText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#FFC85E',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
