/**
 * @module face-baseline/screens/BaselineCaptureNeutralScreen
 * @description Screen 6 — neutral capture (the gold soul moment). Circular halo
 * + gold particle mesh + privacy pill + segmented progress. One instruction.
 *
 * INTEGRATION (useQualityMetrics + Skia mesh): drive progress from real signal,
 * scatter particles + pause progress on quality drop, surface ONE status pill.
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
  PrivacyLockPill,
  QualityStatusPills,
  NavBar,
  CameraFeedView,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { captureProgress } from '../utils/progress';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';
import type { QualityStatus } from '../types/faceBaseline.types';

import { useBaselineHaptics } from '../hooks/useBaselineHaptics';

export default function BaselineCaptureNeutralScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setCapturePhase = useFaceBaselineStore((s) => s.setCapturePhase);
  const setNeutralProgress = useFaceBaselineStore((s) => s.setNeutralProgress);
  const [progress, setProgress] = useState(0);
  const done = useRef(false);
  const haptics = useBaselineHaptics();

  useEffect(() => {
    goTo('neutral_capture');
    setCapturePhase('neutral');
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.04);
        setNeutralProgress(next);
        if (next >= 1 && !done.current) {
          done.current = true;
          setTimeout(() => router.push(FB_ROUTES.captureArc), 250);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [goTo, setCapturePhase, setNeutralProgress, router]);

  // Trigger soft haptic ticks every 15% progress increment
  const lastTick = useRef(0);
  useEffect(() => {
    const currentTickIndex = Math.floor(progress / 0.15);
    if (currentTickIndex > lastTick.current) {
      lastTick.current = currentTickIndex;
      haptics.trigger('impactSoft');
    }
  }, [progress, haptics]);

  // Mock transient quality warning between 30% and 60% progress
  const qualityStatus: QualityStatus = (progress > 0.3 && progress < 0.6) ? 'movement' : 'good';
  const nudgeText = qualityStatus === 'movement' ? C.captureNeutral.nudges.movement : '';

  return (
    <CosmicBackground mode="captureWarm">
      <SafeAreaView style={styles.safe}>
        <NavBar title="Baseline Capture Phase" onCancel={() => router.back()} />
        <View style={styles.frameWrap}>
          {/* Gold square scan zone with outer cyan ring (dual accent) */}
          <FaceScanFrame shape="square" state="capturing" size={250}>
            {/* Live camera stream feed behind the particle mesh */}
            <View style={StyleSheet.absoluteFill}>
              <CameraFeedView size={250} active={true} />
            </View>

            <SoulParticleMesh stability={progress} size={210} />
          </FaceScanFrame>
          {/* Tick-mark ruler progress + privacy caption directly below the frame */}
          <View style={styles.progressBlock}>
            <SegmentedProgress progress={captureProgress(progress, 0, 0)} accent="gold" />
            <PrivacyLockPill label={C.captureNeutral.privacyPill} />
          </View>
          <View style={styles.nudgeContainer}>
            <QualityStatusPills status={qualityStatus} label={nudgeText} />
          </View>
        </View>
        <View style={styles.footer}>
          {/* The emotional anchor: huge bold statement */}
          <Text style={styles.instruction}>{C.captureNeutral.instruction}</Text>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressBlock: { marginTop: t.spacing.xl + 10, gap: t.spacing.md, alignItems: 'center' },
  nudgeContainer: { height: 40, marginTop: t.spacing.sm, justifyContent: 'center' },
  footer: { paddingBottom: t.spacing.xxl + 12, gap: t.spacing.lg, alignItems: 'center' },
  instruction: {
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: t.color.text.primary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
