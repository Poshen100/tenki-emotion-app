/**
 * @module face-baseline/screens/ProcessingBaselineScreen
 * @description Screen 8 — the securing ritual. Gold orb + percent + local-only
 * footnote. Honors a minimum display time so the ritual never feels skipped.
 *
 * INTEGRATION (packages/engine baseline + secure local store): replace the
 * mocked progress with real on-device computation; write baseline locally.
 */
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CosmicBackground, ProcessingOrb, PercentReadout, PrivacyFootnote } from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { estimateConfidence } from '../utils/confidence';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

export default function ProcessingBaselineScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setProcessing = useFaceBaselineStore((s) => s.setProcessing);
  const establishBaseline = useFaceBaselineStore((s) => s.establishBaseline);
  const quality = useFaceBaselineStore((s) => s.quality);
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    goTo('processing');
    setProcessing('running', 0);
    const start = Date.now();
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.03);
        setProcessing('running', next);
        const elapsed = Date.now() - start;
        if (next >= 1 && elapsed >= t.motion.duration.processingMin && !done.current) {
          done.current = true;
          establishBaseline(estimateConfidence(quality));
          setTimeout(() => router.replace(FB_ROUTES.established), 200);
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [goTo, setProcessing, establishBaseline, quality, router]);

  return (
    <CosmicBackground mode="processing">
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ProcessingOrb progress={progress} size={200} />
          <Text style={styles.title}>{C.processing.title}</Text>
          <PercentReadout progress={progress} />
        </View>
        <View style={styles.footer}>
          <PrivacyFootnote text={C.processing.footnote} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl },
  title: { fontSize: t.text.cardTitle.size, fontWeight: '600', color: t.color.text.primary, textAlign: 'center' },
  footer: { paddingBottom: t.spacing.xxl, paddingHorizontal: t.spacing.lg },
});
