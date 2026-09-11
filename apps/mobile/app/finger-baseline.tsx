/**
 * expo-router route → the finger HRV baseline step.
 *
 * Reached from the face baseline's exit when onboarding planned it
 * (`establishedExitRoute`). It comes AFTER the face baseline and does not
 * replace it — see `docs/SOUL-SCAN-NORTH-STAR.md` §1.
 *
 * ⚠️ The camera capture layer (VisionCamera frame processor → `PpgFrame`)
 * does not exist yet and needs a physical device. This screen therefore
 * explains the step and reports honestly that it cannot run, rather than
 * offering a button that pretends to scan. The engine behind it is complete
 * and tested (`packages/engine/src/biometric/ppg/`).
 */
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FINGER_BASELINE_COPY as C } from '../features/finger-baseline/copy';
import { ONBOARDING_COMPLETE_ROUTE } from '../features/face-baseline/screens/routes';

export default function FingerBaselineScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{C.kicker}</Text>
        <Text style={styles.title}>{C.title}</Text>

        <Text style={styles.body}>{C.why}</Text>
        <Text style={styles.body}>{C.duration}</Text>

        <View style={styles.precisionCard}>
          <Text style={styles.precisionText}>{C.precisionNote}</Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{C.unwiredNotice}</Text>
        </View>

        <Text style={styles.privacy}>{C.privacy}</Text>

        <View style={styles.footer}>
          <Text
            style={styles.skip}
            accessibilityRole="button"
            onPress={() => router.replace(ONBOARDING_COMPLETE_ROUTE)}
          >
            {C.skipLabel}
          </Text>
          <Text style={styles.skipCost}>{C.skipCost}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070B14' },
  content: { paddingHorizontal: 28, paddingVertical: 24, gap: 16 },
  kicker: { fontSize: 12, fontWeight: '700', color: '#5FE9D0', letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: '600', color: '#EAF1F8', marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 23, color: '#9DB2CC' },
  precisionCard: {
    backgroundColor: 'rgba(95, 233, 208, 0.06)',
    borderColor: 'rgba(95, 233, 208, 0.18)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  precisionText: { fontSize: 14, lineHeight: 21, color: '#EAF1F8' },
  noticeCard: {
    backgroundColor: 'rgba(157, 178, 204, 0.06)',
    borderColor: 'rgba(157, 178, 204, 0.2)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
  },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#9DB2CC' },
  privacy: { fontSize: 12, lineHeight: 18, color: '#6B7F99' },
  footer: { marginTop: 8, gap: 8 },
  skip: { fontSize: 16, fontWeight: '600', color: '#5FE9D0' },
  skipCost: { fontSize: 12, lineHeight: 18, color: '#6B7F99' },
});
