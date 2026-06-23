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
  const entryContext = useFaceBaselineStore((s) => s.entryContext);
  const goTo = useFaceBaselineStore((s) => s.goTo);

  useEffect(() => {
    goTo('success');
  }, [goTo]);

  return (
    <CosmicBackground mode="success">
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          {/* huge soft gold radial halo behind the card */}
          <View style={styles.haloWrap} pointerEvents="none">
            <View style={[styles.haloRing, styles.haloOuter]} />
            <View style={[styles.haloRing, styles.haloMid]} />
            <View style={[styles.haloRing, styles.haloInner]} />
          </View>
          <BaselineSuccessCard title={C.established.title} body={C.established.body} />
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton
            accent="gold"
            label={C.established.cta}
            onPress={() => {
              if (entryContext === 'onboarding') {
                router.replace('/onboarding/complete');
              } else {
                router.replace(FB_ROUTES.maturity);
              }
            }}
          />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const HALO = 560;

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  body: { flex: 1, justifyContent: 'center' },
  haloWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloRing: { position: 'absolute', borderRadius: HALO },
  haloOuter: { width: HALO, height: HALO, backgroundColor: 'rgba(243, 169, 42, 0.04)' },
  haloMid: { width: HALO * 0.74, height: HALO * 0.74, backgroundColor: 'rgba(243, 169, 42, 0.06)' },
  haloInner: { width: HALO * 0.5, height: HALO * 0.5, backgroundColor: 'rgba(255, 200, 94, 0.08)' },
  footer: { paddingBottom: t.spacing.ctaDock },
});
