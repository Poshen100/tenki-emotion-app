/**
 * @module face-baseline/screens/BaselineCaptureMotionScreen
 * @description Screen 7 — brief guided micro-motion (calibration, NOT emotion).
 * Continues the same segmented bar (segment 2 of 2). Neutral capture is kept.
 *
 * INTEGRATION (useQualityMetrics + MotionGuideCue): drive from real motion;
 * this phase may be retried independently without re-capturing neutral.
 */
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  FaceScanFrame,
  SoulParticleMesh,
  SegmentedProgress,
  MotionGuideCue,
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { captureProgress } from '../utils/progress';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function BaselineCaptureMotionScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setCapturePhase = useFaceBaselineStore((s) => s.setCapturePhase);
  const setMotionProgress = useFaceBaselineStore((s) => s.setMotionProgress);
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    goTo('motion_capture');
    setCapturePhase('motion');
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.045);
        setMotionProgress(next);
        if (next >= 1 && !done.current) {
          done.current = true;
          setTimeout(() => router.push(FB_ROUTES.processing), 250);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [goTo, setCapturePhase, setMotionProgress, router]);

  return (
    <CosmicBackground mode="captureWarm">
      <SafeAreaView style={styles.safe}>
        <NavBar title="Baseline Capture" onCancel={() => router.back()} />
        <View style={styles.frameWrap}>
          <FaceScanFrame shape="halo" state="capturing" size={250}>
            <SoulParticleMesh stability={1} size={210} />
          </FaceScanFrame>
          <View style={styles.guideContainer}>
            <MotionGuideCue />
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.instruction}>{C.captureMotion.instruction}</Text>
          <Text style={styles.subtitle}>{C.captureMotion.subtitle}</Text>
          <SegmentedProgress progress={captureProgress(1, progress)} accent="gold" />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guideContainer: { marginTop: t.spacing.xl, width: '100%' },
  footer: { paddingBottom: t.spacing.xxl, gap: t.spacing.md, alignItems: 'center' },
  instruction: { fontSize: t.text.hero.size, fontWeight: '700', color: t.color.text.primary, textAlign: 'center' },
  subtitle: { fontSize: t.text.body.size, color: t.color.text.secondary, textAlign: 'center' },
});
