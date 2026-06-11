
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../stores/user-store';
import { BackgroundContainer, ProgressIndicator, PrimaryButton } from '../../components/onboarding-components';

export default function OnboardingComplete() {
  const router = useRouter();
  const setBaselineScore = useUserStore((s) => s.setBaselineScore);

  const handleComplete = () => {
    // Write state flags to store
    setBaselineScore(68);
    // Redirect to Today dashboard
    router.replace('/');
  };

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress indicator (Step 6/Complete active) */}
        <ProgressIndicator activeStep={5} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Glowing Success Mark */}
          <View style={styles.successContainer}>
            <View style={styles.successBloom}>
              <View style={styles.successCore}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            </View>
          </View>

          {/* Title & Body */}
          <View style={styles.header}>
            <Text style={styles.kicker}>BASELINE READY</Text>
            <Text style={styles.title}>Tenki 已記住你的平常狀態</Text>
            <Text style={styles.body}>
              從現在開始，每一次臉部掃描都會和你的基線比較，幫你看見今天的清晰、壓力與恢復狀態。
            </Text>
          </View>

          {/* Secondary Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>66 <Text style={styles.metricUnit}>bpm</Text></Text>
              <Text style={styles.metricLabel}>靜息心率</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>48 <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricLabel}>HRV · RMSSD</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>14 <Text style={styles.metricUnit}>/min</Text></Text>
              <Text style={styles.metricLabel}>呼吸節奏</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>良好</Text>
              <Text style={styles.metricLabel}>訊號品質</Text>
            </View>
          </View>

          {/* Calibration Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>✎</Text>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoText}>
                想讓 Tenki 更懂你的身體訊號？之後有空時用手指掃一次，能提升 HRV 精度。我們會在適合的時機提醒你。
              </Text>
            </View>
          </View>

          {/* CTA Button */}
          <View style={styles.footer}>
            <PrimaryButton
              label="進入 Tenki"
              onPress={handleComplete}
            />
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
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 40,
    alignItems: 'center',
  },
  successContainer: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBloom: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(95, 233, 208, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  successCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(95, 233, 208, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(95, 233, 208, 0.3)',
    borderWidth: 1.5,
  },
  checkText: {
    color: '#5FE9D0',
    fontSize: 26,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5FE9D0',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#EAF1F8',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: '#9DB2CC',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(28, 44, 76, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EAF1F8',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#9DB2CC',
    fontWeight: '400',
  },
  metricLabel: {
    fontSize: 11,
    color: '#5E7596',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 44, 76, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 28,
    width: '100%',
  },
  infoIcon: {
    fontSize: 16,
    color: '#5FE9D0',
    fontWeight: '600',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    color: '#9DB2CC',
    lineHeight: 18,
  },
  footer: {
    width: '100%',
  },
});
