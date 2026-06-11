
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackgroundContainer, ProgressIndicator, PrimaryButton } from '../../components/onboarding-components';

export default function OnboardingExplainer() {
  const router = useRouter();

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress indicator */}
        <ProgressIndicator activeStep={0} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kicker}>BASELINE SETUP · 第 1 步</Text>
            <Text style={styles.title}>
              先讓 Tenki 認識你的平常
            </Text>
          </View>

          {/* Explanation content block */}
          <View style={styles.cardContainer}>
            <View style={styles.explainCard}>
              <Text style={styles.cardText}>
                第一次使用時，Tenki 會用前鏡頭讀取約 60 秒的生理訊號，在你的裝置上建立專屬基線。
              </Text>
              <Text style={styles.cardTextSecondary}>
                之後每天掃描時，Tenki 會看見你和「平常的自己」有什麼不同。
              </Text>
            </View>

            {/* Meta tags card */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>≈ 60 SEC</Text>
                <Text style={styles.metaLabel}>量測時間</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>臉部掃描</Text>
                <Text style={styles.metaLabel}>相機鏡頭</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>一次就好</Text>
                <Text style={styles.metaLabel}>建立基線</Text>
              </View>
            </View>
          </View>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <PrimaryButton
              label="開始建立"
              onPress={() => router.push('/onboarding/ready')}
            />
          </View>
        </View>
      </SafeAreaView>
    </BackgroundContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  header: {
    marginTop: 10,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5FE9D0',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#EAF1F8',
    lineHeight: 36,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    marginVertical: 10,
  },
  explainCard: {
    backgroundColor: 'rgba(28, 44, 76, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
  },
  cardText: {
    fontSize: 15,
    color: '#EAF1F8',
    lineHeight: 25,
    marginBottom: 14,
  },
  cardTextSecondary: {
    fontSize: 14,
    color: '#9DB2CC',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 44, 76, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5FE9D0',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#5E7596',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(157, 178, 204, 0.15)',
  },
  footer: {
    marginBottom: 10,
    width: '100%',
  },
});
