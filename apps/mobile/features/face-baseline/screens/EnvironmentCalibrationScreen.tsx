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
  CameraFeedView,
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
          <FaceScanFrame shape="square" state={envReady ? 'locked' : 'tracking'} size={280}>
            {/* Camera feed overlayed with face silhouette + floating checklist pills */}
            <View style={styles.cameraPreview}>
              <View style={StyleSheet.absoluteFill}>
                <CameraFeedView size={280} active={true} />
              </View>

              <View style={styles.mockFaceGuide} />
              
              {/* Floating checklist pills matching Image 2 */}
              <View style={styles.floatingChecklist}>
                <EnvironmentChecklist items={items} />
              </View>
            </View>
          </FaceScanFrame>
        </View>
        <View style={styles.body}>
          <Text style={styles.guide}>{C.environment.body}</Text>
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
  frameWrap: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  cameraPreview: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mockFaceGuide: {
    width: 140,
    height: 190,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderStyle: 'dashed',
    position: 'absolute',
    top: 25,
  },
  floatingChecklist: {
    position: 'absolute',
    bottom: 18,
    width: 230,
    alignSelf: 'center',
    zIndex: 3,
  },
  body: { alignItems: 'center', marginVertical: t.spacing.md },
  guide: { fontSize: 16, fontWeight: '700', color: t.color.text.secondary, textAlign: 'center' },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
  hint: { fontSize: t.text.caption.size, color: t.color.text.tertiary },
});
