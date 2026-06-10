/**
 * @module face-baseline/screens/EstablishBaselineIntroScreen
 * @description Screen 1 — flow entry. Sets expectation + trust before any
 * camera permission. Reference: "Establish Your Baseline".
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  BaselineHeroCopy,
  TimeCostChip,
  GlowPrimaryButton,
  TextLink,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function EstablishBaselineIntroScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);

  useEffect(() => {
    goTo('intro');
  }, [goTo]);

  return (
    <CosmicBackground mode="deepNebula">
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <BaselineHeroCopy title={C.intro.title} subtitle={C.intro.subtitle} body={C.intro.body} />
            <View style={styles.chip}>
              <TimeCostChip seconds={C.intro.timeSeconds} />
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton accent="cyan" label={C.intro.cta} onPress={() => router.push(FB_ROUTES.secure)} />
          <TextLink label={C.intro.whyLink} onPress={() => router.push(FB_ROUTES.why)} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  body: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center' },
  chip: { marginTop: t.spacing.xl },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
});
