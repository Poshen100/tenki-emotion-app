/**
 * @module face-baseline/screens/FaceDetectionRecoveryScreen
 * @description Screen 9 — graceful recovery (cyan). Supportive, never an error
 * wall. "Try Again" resumes the nearest phase; never a forced full restart.
 *
 * INTEGRATION (retryReason): show reason-specific copy from classifyRetryReason
 * and resume via RESUME_TARGET for the failed state.
 */
import type React from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  FaceScanFrame,
  RecoveryChecklist,
  GlowPrimaryButton,
  TextLink,
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

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
      <SafeAreaView style={styles.safe}>
        <NavBar title="Face Detection Recovery" onBack={() => router.back()} />
        <View style={styles.frameWrap}>
          <FaceScanFrame shape="square" state="tracking" size={200} />
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
  frameWrap: { alignItems: 'center', justifyContent: 'center', marginTop: t.spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md },
  title: { fontSize: t.text.hero.size, fontWeight: '700', color: t.color.text.primary, textAlign: 'center' },
  subtitle: { fontSize: t.text.body.size, color: t.color.text.secondary, textAlign: 'center', paddingHorizontal: t.spacing.lg },
  checklist: { marginTop: t.spacing.lg },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
});
