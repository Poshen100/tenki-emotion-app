/**
 * @module face-baseline/screens/FaceLockPreparationScreen
 * @description Screen 5 — acquire & lock. Tracking reticle snaps to a lock,
 * then auto-advances. No CTA (the Face-ID-precision beat).
 *
 * INTEGRATION (useFaceDetector): drive `state` from real detection; on stable
 * lock advance; on timeout route to recovery.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CosmicBackground, FaceScanFrame, NavBar } from '../components';
import type { ScanState } from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function FaceLockPreparationScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setFaceLock = useFaceBaselineStore((s) => s.setFaceLock);
  const [state, setState] = useState<ScanState>('tracking');

  useEffect(() => {
    goTo('face_detecting');
    setFaceLock('tracking');
    // Mocked acquisition → lock → advance. Replace with real detection.
    const lock = setTimeout(() => {
      setState('locked');
      setFaceLock('locked');
    }, 1400);
    const advance = setTimeout(() => router.push(FB_ROUTES.captureNeutral), 2200);
    return () => {
      clearTimeout(lock);
      clearTimeout(advance);
    };
  }, [goTo, setFaceLock, router]);

  const label = state === 'locked' ? C.faceLock.locked : C.faceLock.centered;

  return (
    <CosmicBackground mode="dim">
      <SafeAreaView style={styles.safe}>
        <NavBar onBack={() => router.back()} onCancel={() => router.back()} />
        <View style={styles.frameWrap}>
          <FaceScanFrame shape="square" state={state} size={260}>
            <View style={styles.mockFaceGuide} />
          </FaceScanFrame>
        </View>
        <View style={styles.footer}>
          <Text style={styles.instruction}>{label}</Text>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mockFaceGuide: {
    width: 140,
    height: 190,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderStyle: 'dashed',
  },
  footer: { paddingBottom: t.spacing.xxl, alignItems: 'center' },
  instruction: { fontSize: t.text.cardTitle.size, fontWeight: '600', color: t.color.text.primary },
});
