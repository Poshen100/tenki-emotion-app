import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackgroundContainer, ProgressIndicator, PrimaryButton } from '../../components/onboarding-components';

export default function OnboardingReady() {
  const router = useRouter();

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress indicator */}
        <ProgressIndicator activeStep={1} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kicker}>GET READY · 準備好就開始</Text>
            <Text style={styles.title}>幾個小提醒</Text>
          </View>

          {/* Tips and permissions blocks */}
          <View style={styles.tipsContainer}>
            {/* Tip 1 */}
            <View style={styles.tipCard}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>☼</Text>
              </View>
              <View style={styles.tipTextWrap}>
                <Text style={styles.tipText}>找光線充足、均勻的地方</Text>
              </View>
            </View>

            {/* Tip 2 */}
            <View style={styles.tipCard}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>☌</Text>
              </View>
              <View style={styles.tipTextWrap}>
                <Text style={styles.tipText}>臉對準前鏡頭，保持不動</Text>
              </View>
            </View>

            {/* Tip 3 */}
            <View style={styles.tipCard}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>〜</Text>
              </View>
              <View style={styles.tipTextWrap}>
                <Text style={styles.tipText}>放鬆，自然呼吸就好</Text>
              </View>
            </View>

            {/* Privacy / Camera Note Card */}
            <View style={styles.noteCard}>
              <View style={styles.noteIconBox}>
                <Text style={styles.noteIconText}>⊙</Text>
              </View>
              <View style={styles.noteTextWrap}>
                <Text style={styles.noteText}>
                  需要使用前鏡頭，掃描全程在本機進行
                </Text>
              </View>
            </View>
          </View>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <PrimaryButton
              label="允許並開始"
              onPress={() => router.push('/onboarding/scan')}
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
  },
  tipsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    marginVertical: 10,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 44, 76, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(95, 233, 208, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
    color: '#5FE9D0',
    fontWeight: '600',
    lineHeight: 22,
  },
  tipTextWrap: {
    flex: 1,
  },
  tipText: {
    fontSize: 15,
    color: '#EAF1F8',
    fontWeight: '500',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(95, 233, 208, 0.03)',
    borderColor: 'rgba(95, 233, 208, 0.15)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginTop: 8,
  },
  noteIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(95, 233, 208, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteIconText: {
    fontSize: 18,
    color: '#5FE9D0',
    fontWeight: '600',
  },
  noteTextWrap: {
    flex: 1,
  },
  noteText: {
    fontSize: 13,
    color: '#9DB2CC',
    lineHeight: 18,
  },
  footer: {
    marginBottom: 10,
    width: '100%',
  },
});
