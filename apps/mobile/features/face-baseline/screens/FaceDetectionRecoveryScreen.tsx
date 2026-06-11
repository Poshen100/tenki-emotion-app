/**
 * @module face-baseline/screens/FaceDetectionRecoveryScreen
 * @description Screen 9 — graceful recovery (cyan). Supportive, never an error
 * wall. "Try Again" resumes the nearest phase; never a forced full restart.
 *
 * Background approximates the warm blurred-ambient reference (no photo asset):
 * large warm translucent blobs under a BlurView + dark scrim.
 *
 * INTEGRATION (retryReason): show reason-specific copy from classifyRetryReason
 * and resume via RESUME_TARGET for the failed state.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import {
  CosmicBackground,
  RecoveryChecklist,
  GlowPrimaryButton,
  TextLink,
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

const GLYPH = 210;
const BRACKET_BOX = 168;

/** Detection glyph: thin cyan ring + gold corner brackets + face outline + scan line + cardinal dots. */
function DetectionGlyph(): React.JSX.Element {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-GLYPH * 0.28, GLYPH * 0.28],
  });

  return (
    <View style={styles.glyphWrap}>
      {/* thin cyan circle */}
      <View style={styles.cyanRing} />

      {/* 4 tiny dots at ring cardinal points */}
      <View style={[styles.cardinalDot, { top: -2.5, left: GLYPH / 2 - 2.5 }]} />
      <View style={[styles.cardinalDot, { bottom: -2.5, left: GLYPH / 2 - 2.5 }]} />
      <View style={[styles.cardinalDot, { left: -2.5, top: GLYPH / 2 - 2.5 }]} />
      <View style={[styles.cardinalDot, { right: -2.5, top: GLYPH / 2 - 2.5 }]} />

      {/* 4 gold corner brackets */}
      <View style={styles.bracketBox}>
        <View style={[styles.bracket, styles.bTL]} />
        <View style={[styles.bracket, styles.bTR]} />
        <View style={[styles.bracket, styles.bBL]} />
        <View style={[styles.bracket, styles.bBR]} />
      </View>

      {/* minimal face outline */}
      <View style={styles.avatarOutline}>
        <View style={styles.avatarHead} />
        <View style={styles.avatarShoulders} />
      </View>

      {/* horizontal cyan scan line */}
      <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
    </View>
  );
}

export default function FaceDetectionRecoveryScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const clearRetry = useFaceBaselineStore((s) => s.clearRetry);

  useEffect(() => {
    goTo('retry_needed');
  }, [goTo]);

  const onTryAgain = (): void => {
    clearRetry();
    router.replace(FB_ROUTES.faceLock);
  };

  return (
    <CosmicBackground mode="dim">
      {/* warm blurred ambient: large warm blobs + blur + dark scrim */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.ambientBlob, styles.blobA]} />
        <View style={[styles.ambientBlob, styles.blobB]} />
        <View style={[styles.ambientBlob, styles.blobC]} />
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.scrim} />
      </View>
      <SafeAreaView style={styles.safe}>
        <NavBar onBack={() => router.back()} />
        <View style={styles.frameWrap}>
          <DetectionGlyph />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{C.recovery.title}</Text>
          <Text style={styles.subtitle}>{C.recovery.subtitle}</Text>
          <View style={styles.checklist}>
            <RecoveryChecklist items={C.recovery.checklist} />
          </View>
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton accent="cyan" label={C.recovery.cta} onPress={onTryAgain} />
          <TextLink label={C.recovery.helpLink} tone="muted" onPress={() => undefined} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },

  // ─── Warm ambient background ────────
  ambientBlob: { position: 'absolute', borderRadius: 9999 },
  blobA: { top: '-8%', left: '-18%', width: 320, height: 320, backgroundColor: 'rgba(120, 70, 28, 0.3)' },
  blobB: { top: '34%', right: '-22%', width: 360, height: 360, backgroundColor: 'rgba(70, 44, 22, 0.32)' },
  blobC: { bottom: '-10%', left: '8%', width: 300, height: 300, backgroundColor: 'rgba(46, 30, 36, 0.4)' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 4, 10, 0.45)' },

  // ─── Detection glyph ────────────────
  frameWrap: { alignItems: 'center', justifyContent: 'center', marginTop: t.spacing.lg },
  glyphWrap: {
    width: GLYPH,
    height: GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cyanRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: GLYPH / 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.55)',
  },
  cardinalDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.9,
  },
  bracketBox: {
    position: 'absolute',
    width: BRACKET_BOX,
    height: BRACKET_BOX,
    top: (GLYPH - BRACKET_BOX) / 2,
    left: (GLYPH - BRACKET_BOX) / 2,
  },
  bracket: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: t.color.accent.goldSoft,
  },
  bTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  bTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  bBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  bBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
  avatarOutline: {
    width: 92,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarHead: {
    width: 56,
    height: 74,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    top: 8,
  },
  avatarShoulders: {
    width: 88,
    height: 38,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    bottom: 0,
  },
  scanLine: {
    position: 'absolute',
    left: GLYPH * 0.12,
    right: GLYPH * 0.12,
    height: 1.5,
    backgroundColor: 'rgba(0, 240, 255, 0.7)',
    shadowColor: t.color.accent.cyanGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },

  // ─── Copy + checklist ───────────────
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md },
  title: {
    fontSize: t.text.hero.size,
    lineHeight: t.text.hero.lineHeight,
    fontWeight: t.text.hero.weight,
    letterSpacing: t.text.hero.tracking,
    color: t.color.text.primary,
    textAlign: 'center',
  },
  subtitle: { fontSize: t.text.body.size, lineHeight: 23, color: t.color.text.secondary, textAlign: 'center', paddingHorizontal: t.spacing.lg },
  checklist: { marginTop: t.spacing.lg },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
});
