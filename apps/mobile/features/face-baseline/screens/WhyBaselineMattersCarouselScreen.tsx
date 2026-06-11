/**
 * @module face-baseline/screens/WhyBaselineMattersCarouselScreen
 * @description Screen 2 — education. One idea per page; never crowded.
 * Reference: "Why Baseline Matters" with the cyan resonance glyph.
 */
import type React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  BrandWordmark,
  GlassInfoCard,
  ResonanceWaveGlyph,
  CarouselDots,
  GlowPrimaryButton,
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function WhyBaselineMattersCarouselScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const [index, setIndex] = useState(0);
  const pages = C.why.pages;
  const isLast = index === pages.length - 1;

  useEffect(() => {
    goTo('why_baseline');
  }, [goTo]);

  const onNext = (): void => {
    if (isLast) router.push(FB_ROUTES.secure);
    else setIndex((i) => i + 1);
  };

  const page = pages[index];

  return (
    <CosmicBackground mode="deepNebula">
      <SafeAreaView style={styles.safe}>
        <NavBar onBack={() => router.back()} />
        <View style={styles.head}>
          <BrandWordmark />
          <Text style={styles.title}>{C.why.title}</Text>
        </View>
        <View style={styles.body}>
          {/* one large frosted card filling most of the screen */}
          <GlassInfoCard edge="cyan" fill style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.glyph}>
                <ResonanceWaveGlyph size={140} />
              </View>
              <Text style={styles.heading}>{page.heading}</Text>
              <Text style={styles.copy}>{page.body}</Text>
            </View>
            <View style={styles.cardBottom}>
              <CarouselDots count={pages.length} active={index} />
              {/* pale-cyan inverted CTA — unique to this screen */}
              <GlowPrimaryButton
                accent="cyan"
                variant="pale"
                label={isLast ? C.why.finish : C.why.next}
                onPress={onNext}
                style={styles.cta}
              />
            </View>
          </GlassInfoCard>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  head: { alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.sm },
  title: { fontSize: t.text.cardTitle.size, fontWeight: '700', color: t.color.text.primary },
  body: { flex: 1, marginTop: t.spacing.md, marginBottom: t.spacing.ctaDock },
  card: { alignItems: 'center', justifyContent: 'space-between' },
  cardTop: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  cardBottom: { alignSelf: 'stretch', alignItems: 'center', gap: t.spacing.lg },
  cta: { alignSelf: 'stretch' },
  glyph: { marginBottom: t.spacing.lg },
  heading: {
    fontSize: t.text.cardTitle.size,
    fontWeight: '700',
    color: t.color.text.primary,
    textAlign: 'center',
    marginBottom: t.spacing.sm,
  },
  copy: {
    fontSize: t.text.body.size,
    lineHeight: t.text.body.lineHeight,
    color: t.color.text.secondary,
    textAlign: 'center',
    maxWidth: '92%',
  },
});
