
import { lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScanStore } from '../../stores/scan-store';
import { getZoneForScore, } from '../../theme';
import { BackgroundContainer, GlassMedallion, PrimaryButton, SecondaryButton } from '../../components/onboarding-components';
import { ZoneBadge } from '../../components/ZoneBadge';

// Lazy: see app/(tabs)/scan.tsx for why @shopify/react-native-skia consumers must be
// dynamically imported rather than statically, on web.
const EdgeScoreRing = lazy(() =>
  import('../../components/EdgeScoreRing').then((m) => ({ default: m.EdgeScoreRing }))
);

export default function DailyScanResult() {
  const router = useRouter();
  const lastResult = useScanStore((s) => s.lastResult);

  // Fallback mock data if visited directly without scanning
  const score = lastResult?.edgeScore ?? 72;
  const metrics = lastResult?.metrics ?? { coverage: 84, stability: 72, signalQuality: 92 };

  const zone = getZoneForScore(score);
  
  // Compliance-checked non-medical guidance
  let mainMessage = '今天的身體訊號偏穩定，適合做重要決定。';
  if (zone.name === 'neutral') {
    mainMessage = '今天的身體訊號處於中等區間，決策時可多加留意內在感受。';
  } else if (zone.name === 'strain') {
    mainMessage = '目前生理訊號顯示張力偏高，建議做些放鬆調息，暫緩重大決策。';
  }

  // Map metrics to driver card values
  const clarityVal = `${metrics.signalQuality}%`;
  // Stress is inverse of stability in mock representation
  const stressVal = `${Math.max(10, 100 - metrics.stability)}%`;
  const recoveryVal = `${metrics.coverage}%`;

  const handleStartSession = () => {
    // Navigate to Session tab
    router.replace('/session');
  };

  const handleGoTimeline = () => {
    // Navigate to Timeline tab
    router.replace('/timeline');
  };

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>今日內在天氣</Text>
            <Text style={styles.dateLabel}>
              {new Date(lastResult?.timestamp ?? Date.now()).toLocaleDateString('zh-TW', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Central Edge Score Visual */}
          <View style={styles.scoreContainer}>
            <Suspense fallback={null}>
              <EdgeScoreRing score={score} size={220} />
            </Suspense>
            <View style={styles.badgeWrapper}>
              <ZoneBadge score={score} />
            </View>
          </View>

          {/* Message Glass Medallion */}
          <View style={styles.messageContainer}>
            <GlassMedallion style={styles.messageCard}>
              <Text style={styles.messageText}>{mainMessage}</Text>
            </GlassMedallion>
          </View>

          {/* Three Driver Cards */}
          <View style={styles.driversRow}>
            <View style={styles.driverCard}>
              <Text style={styles.driverValue}>{clarityVal}</Text>
              <Text style={styles.driverLabel}>清晰度</Text>
            </View>
            <View style={styles.driverCard}>
              <Text style={styles.driverValue}>{stressVal}</Text>
              <Text style={styles.driverLabel}>壓力</Text>
            </View>
            <View style={styles.driverCard}>
              <Text style={styles.driverValue}>{recoveryVal}</Text>
              <Text style={styles.driverLabel}>恢復</Text>
            </View>
          </View>

          {/* Navigation CTAs */}
          <View style={styles.actions}>
            <View style={styles.btnWrapper}>
              <PrimaryButton
                label="開始一段專注 Session"
                onPress={handleStartSession}
              />
            </View>
            <View style={styles.btnWrapper}>
              <SecondaryButton
                label="查看時間軸"
                onPress={handleGoTimeline}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BackgroundContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#EAF1F8',
    letterSpacing: 0.5,
  },
  dateLabel: {
    fontSize: 12,
    color: '#9DB2CC',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  scoreContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  badgeWrapper: {
    marginTop: 16,
  },
  messageContainer: {
    marginVertical: 16,
    width: '100%',
  },
  messageCard: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 44, 76, 0.22)',
  },
  messageText: {
    fontSize: 14,
    color: '#EAF1F8',
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  driversRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
    width: '100%',
  },
  driverCard: {
    flex: 1,
    backgroundColor: 'rgba(28, 44, 76, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  driverValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5FE9D0', // Teal accent
    marginBottom: 4,
  },
  driverLabel: {
    fontSize: 12,
    color: '#9DB2CC',
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  btnWrapper: {
    width: '100%',
  },
});
