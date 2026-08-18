/**
 * @module face-baseline/screens/BaselineCaptureStabilityScreen
 * @description Screen 8 — expression stability pass (calibration, NOT emotion
 * recognition). One calm natural breath with a relaxed jaw, so the baseline
 * anchors the user's resting expression — not just facial geometry. Continues
 * the same closing halo (final segment). Neutral + arc captures are kept; this
 * phase may be retried on its own.
 *
 * INTEGRATION (useQualityMetrics): drive from real signal; gate with stabilityGate
 * (neutral expression, eye visibility, stillness, clean signal).
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
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { captureProgress } from '../utils/progress';
import {
  composeSensoryFrame,
  isQualityInstrumented,
  placeholderSignals,
  signalsFromQuality,
} from '../utils/choreography';
import { useBaselineHaptics } from '../hooks/useBaselineHaptics';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function BaselineCaptureStabilityScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setCapturePhase = useFaceBaselineStore((s) => s.setCapturePhase);
  const setStabilityProgress = useFaceBaselineStore((s) => s.setStabilityProgress);
  const quality = useFaceBaselineStore((s) => s.quality);
  const reducedMotion = useFaceBaselineStore((s) => s.reducedMotion);
  const haptics = useBaselineHaptics();
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  // Real metrics once the capture pipeline exists; until then progress-driven
  // placeholders, so an un-instrumented build reads as advancing rather than
  // as a failing scan. See utils/choreography.ts.
  const signals = isQualityInstrumented(quality)
    ? signalsFromQuality(quality, progress)
    : placeholderSignals(progress);
  const frame = composeSensoryFrame('stabilizing', signals, reducedMotion);

  useEffect(() => {
    goTo('stability_pass');
    setCapturePhase('stability');
    // Slower cadence than arc: this is a calm one-breath beat.
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.025);
        setStabilityProgress(next);
        if (next >= 1 && !done.current) {
          done.current = true;
          // Edge triggered: this is the one moment the phase actually changes,
          // so it is the one moment touch is allowed to speak.
          haptics.trigger('success');
          setTimeout(() => router.push(FB_ROUTES.processing), 250);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [goTo, setCapturePhase, setStabilityProgress, router, haptics]);

  return (
    <CosmicBackground mode="captureWarm">
      <SafeAreaView style={styles.safe}>
        <NavBar title="Baseline Capture" onCancel={() => router.back()} />
        <View style={styles.frameWrap}>
          <FaceScanFrame shape="halo" state="capturing" size={250}>
            {/* Settled mesh: convergence, scatter and glow all come from the
                choreography engine, so the feel of this moment is defined in
                one tested place rather than here. */}
            <SoulParticleMesh frame={frame} size={210} reducedMotion={reducedMotion} />
          </FaceScanFrame>
        </View>
        <View style={styles.footer}>
          <Text style={styles.instruction}>{C.captureStability.instruction}</Text>
          <Text style={styles.subtitle}>{C.captureStability.subtitle}</Text>
          <SegmentedProgress progress={captureProgress(1, 1, progress)} accent="gold" />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingBottom: t.spacing.xxl, gap: t.spacing.md, alignItems: 'center' },
  instruction: { fontSize: t.text.hero.size, fontWeight: '700', color: t.color.text.primary, textAlign: 'center' },
  subtitle: { fontSize: t.text.body.size, color: t.color.text.secondary, textAlign: 'center' },
});
