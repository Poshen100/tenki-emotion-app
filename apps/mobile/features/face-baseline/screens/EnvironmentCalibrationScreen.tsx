/**
 * @module face-baseline/screens/EnvironmentCalibrationScreen
 * @description Screen 4 — readiness. Square cyan reticle + live checks.
 * Start Scan stays disabled until all checks pass.
 *
 * INTEGRATION (useEnvironmentChecks + vision-camera): drive the three checks
 * from real lighting/distance/stability signals and show the camera preview
 * inside the reticle. The mocked timers below only demonstrate the flow.
 */
import type React from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  FaceScanFrame,
  EnvironmentChecklist,
  GlowPrimaryButton,
  NavBar,
} from '../components';
import type { ChecklistItem } from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function EnvironmentCalibrationScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const env = useFaceBaselineStore((s) => s.env);
  const envReady = useFaceBaselineStore((s) => s.envReady);
  const updateEnv = useFaceBaselineStore((s) => s.updateEnv);

  useEffect(() => {
    goTo('environment_check');
    // Mocked progressive readiness — replace with real checks.
    updateEnv({ lighting: true, distance: true, stability: false });
    const timer = setTimeout(() => updateEnv({ stability: true }), 1800);
    return () => clearTimeout(timer);
  }, [goTo, updateEnv]);

  const items: ChecklistItem[] = [
    { key: 'lighting', label: C.environment.checks.lighting, status: env.lighting ? 'pass' : 'fail' },
    { key: 'distance', label: C.environment.checks.distance, status: env.distance ? 'pass' : 'fail' },
    { key: 'stability', label: C.environment.checks.stability, status: env.stability ? 'pass' : 'fail' },
  ];

  return (
    <CosmicBackground mode="dim">
      <SafeAreaView style={styles.safe}>
        <NavBar title={C.environment.title} onBack={() => router.back()} onCancel={() => router.back()} />
        <View style={styles.frameWrap}>
          <FaceScanFrame shape="square" state={envReady ? 'locked' : 'tracking'} size={240}>
            {/* Mock facial guide silhouette inside frame */}
            <View style={styles.mockFaceGuide} />
          </FaceScanFrame>
        </View>
        <View style={styles.body}>
          <Text style={styles.guide}>{C.environment.body}</Text>
          <View style={styles.checklistWrap}>
            <EnvironmentChecklist items={items} />
          </View>
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton
            accent="cyan"
            label={C.environment.cta}
            disabled={!envReady}
            onPress={() => router.push(FB_ROUTES.faceLock)}
          />
          {!envReady ? <Text style={styles.hint}>{C.environment.disabledHint}</Text> : null}
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', marginBottom: t.spacing.lg },
  guide: { fontSize: t.text.body.size, color: t.color.text.secondary, textAlign: 'center', marginBottom: t.spacing.md },
  checklistWrap: { width: '100%', alignItems: 'center' },
  mockFaceGuide: {
    width: 130,
    height: 180,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderStyle: 'dashed',
  },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
  hint: { fontSize: t.text.caption.size, color: t.color.text.tertiary },
});
