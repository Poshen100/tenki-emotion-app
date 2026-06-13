/**
 * @module face-baseline/screens/BaselineCaptureArcScreen
 * @description Screen 7 — guided arc capture (calibration, NOT emotion). A slow,
 * precise micro head-turn — left then right — to gather multi-angle landmarks,
 * Face ID style. Two FSM sub-states (arc_left → arc_right) share one continuous
 * closing halo. Neutral capture is kept; this phase may be retried on its own.
 *
 * INTEGRATION (useQualityMetrics + MotionGuideCue): drive from real head pose;
 * gate each side with arcGate and surface a single pose nudge via deriveQualityStatus.
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

/** Progress fraction at which the arc hands off from the left side to the right. */
const ARC_MIDPOINT = 0.5;

export default function BaselineCaptureArcScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setCapturePhase = useFaceBaselineStore((s) => s.setCapturePhase);
  const setArcProgress = useFaceBaselineStore((s) => s.setArcProgress);
  const [progress, setProgress] = useState(0);
  const side = useRef<'left' | 'right'>('left');
  const done = useRef(false);

  useEffect(() => {
    goTo('arc_left');
    setCapturePhase('arc');
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.03);
        setArcProgress(next);
        if (next >= ARC_MIDPOINT && side.current === 'left') {
          side.current = 'right';
          goTo('arc_right');
        }
        if (next >= 1 && !done.current) {
          done.current = true;
          setTimeout(() => router.push(FB_ROUTES.captureStability), 250);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [goTo, setCapturePhase, setArcProgress, router]);

  // One instruction at a time: turn left, then right, then recenter near the end.
  const instruction =
    progress >= 0.85
      ? C.captureArc.recenter
      : progress < ARC_MIDPOINT
        ? C.captureArc.left
        : C.captureArc.right;

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
          <Text style={styles.instruction}>{instruction}</Text>
          <Text style={styles.subtitle}>{C.captureArc.subtitle}</Text>
          <SegmentedProgress progress={captureProgress(1, progress, 0)} accent="gold" />
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
