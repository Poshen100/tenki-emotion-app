/**
 * @module face-baseline/screens/BaselineEstablishedScreen
 * @description Screen 10 — success (gold). Secured confirmation + gold CTA.
 * The CTA accent is gold: the user now acts from the SECURED world.
 *
 * INTEGRATION (Reanimated + haptics): checkmark bloom + success haptic on mount.
 */
import type React from 'react';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CosmicBackground, BaselineSuccessCard, GlowPrimaryButton } from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function BaselineEstablishedScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);

  useEffect(() => {
    goTo('success');
  }, [goTo]);

  return (
    <CosmicBackground mode="success">
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <BaselineSuccessCard title={C.established.title} body={C.established.body} />
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton accent="gold" label={C.established.cta} onPress={() => router.replace(FB_ROUTES.maturity)} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  body: { flex: 1, justifyContent: 'center' },
  footer: { paddingBottom: t.spacing.ctaDock },
});
