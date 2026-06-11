/**
 * @module face-baseline/screens/BaselineMaturityProgressScreen
 * @description Screen 11 — ongoing growth (cyan + gold). The re-entrant daily
 * home: resonance orb, 4-stage maturity, insight, scan history, gold CTA.
 * This is a living ritual surface — NOT a generic dashboard.
 *
 * INTEGRATION (useBaselineMaturity + persistence): hydrate stage/scanCount/
 * history from the local store; "Start Daily Scan" re-enters the scan flow.
 */
import type React from 'react';
import { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  ResonanceOrb,
  MaturityProgressBar,
  TechnicalInsightCard,
  ScanHistoryRow,
  GlowPrimaryButton,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

const DEMO_HISTORY = [
  { time: 'Today, 9:45 AM', type: 'updated' as const },
  { time: 'Yesterday, 10:12 AM', type: 'refined' as const },
];

export default function BaselineMaturityProgressScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const stage = useFaceBaselineStore((s) => s.baselineMaturity);
  const scanCount = useFaceBaselineStore((s) => s.scanCount);
  const scansRequired = useFaceBaselineStore((s) => s.scansRequired);

  useEffect(() => {
    goTo('maturity_progress');
  }, [goTo]);

  return (
    <CosmicBackground mode="circuit">
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>{C.maturity.title}</Text>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.orbWrap}>
            <ResonanceOrb stage={stage} size={150} />
            <Text style={styles.orbLabel}>{C.maturity.orbLabel}</Text>
          </View>

          <MaturityProgressBar stage={stage} labels={C.maturity.stages} />
          <Text style={styles.counter}>{C.maturity.counter(scanCount, scansRequired)}</Text>

          <TechnicalInsightCard text={C.maturity.insight} />

          <Text style={styles.historyTitle}>{C.maturity.historyTitle}</Text>
          <View style={styles.history}>
            {DEMO_HISTORY.map((h) => (
              <ScanHistoryRow
                key={h.time}
                time={h.time}
                type={h.type}
                label={h.type === 'updated' ? C.maturity.historyLabels.updated : C.maturity.historyLabels.refined}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <GlowPrimaryButton accent="gold" label={C.maturity.cta} onPress={() => router.push(FB_ROUTES.faceLock)} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  title: { fontSize: t.text.cardTitle.size, fontWeight: '700', color: t.color.accent.goldSoft, textAlign: 'center', marginVertical: t.spacing.md },
  scroll: { gap: t.spacing.xl, paddingBottom: t.spacing.lg },
  orbWrap: { alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.sm },
  orbLabel: { fontSize: t.text.body.size, fontWeight: '600', color: t.color.text.primary },
  counter: { fontSize: t.text.body.size, color: t.color.text.secondary, textAlign: 'center' },
  historyTitle: { fontSize: t.text.title.size, fontWeight: '600', color: t.color.text.primary },
  history: { marginTop: -t.spacing.sm },
  footer: { paddingBottom: t.spacing.ctaDock, paddingTop: t.spacing.sm },
});
