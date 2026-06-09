import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackgroundContainer, GlassMedallion, PrimaryButton } from '../../components/onboarding-components';

const { width } = Dimensions.get('window');

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header section */}
          <View style={styles.header}>
            <Text style={styles.kicker}>TENKI CORE</Text>
            <Text style={styles.title}>
              讀懂內在天氣{'\n'}找到你的轉折點
            </Text>
          </View>

          {/* Centered Glass Medallion with glowing core */}
          <View style={styles.medallionContainer}>
            <GlassMedallion style={styles.medallion}>
              <View style={styles.glowOuter}>
                <View style={styles.glowInner}>
                  {/* Abstract Pulse Waveform constructed with Views */}
                  <View style={styles.waveformRow}>
                    <View style={styles.waveLineShort} />
                    <View style={styles.waveDown} />
                    <View style={styles.waveUp} />
                    <View style={styles.waveDownDeep} />
                    <View style={styles.waveUpRecover} />
                    <View style={styles.waveLineLong} />
                  </View>
                </View>
              </View>
            </GlassMedallion>
          </View>

          {/* Footer section */}
          <View style={styles.footer}>
            <Text style={styles.body}>
              用手機鏡頭讀出你的生理訊號，看見情緒背後的身體狀態。
            </Text>
            
            <View style={styles.btnWrapper}>
              <PrimaryButton
                label="開始"
                onPress={() => router.push('/onboarding/explainer')}
              />
            </View>

            <Text style={styles.note}>
              資料只存在你的裝置上
            </Text>
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
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  header: {
    marginTop: 20,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5FE9D0', // Teal accent
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#EAF1F8', // Primary text
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 0.5,
  },
  medallionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  medallion: {
    width: width * 0.52,
    height: width * 0.52,
    borderRadius: (width * 0.52) / 2,
    padding: 0,
    overflow: 'hidden',
  },
  glowOuter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(95, 233, 208, 0.03)',
  },
  glowInner: {
    width: '70%',
    height: '70%',
    borderRadius: 9999,
    backgroundColor: 'rgba(95, 233, 208, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: '80%',
  },
  waveLineShort: {
    width: 20,
    height: 2,
    backgroundColor: '#5FE9D0',
    borderRadius: 1,
  },
  waveDown: {
    width: 2,
    height: 8,
    backgroundColor: '#5FE9D0',
    marginTop: 6,
    borderRadius: 1,
  },
  waveUp: {
    width: 2,
    height: 24,
    backgroundColor: '#9CFFEF',
    marginTop: -12,
    borderRadius: 1,
  },
  waveDownDeep: {
    width: 2,
    height: 36,
    backgroundColor: '#5FE9D0',
    marginTop: 18,
    borderRadius: 1,
  },
  waveUpRecover: {
    width: 2,
    height: 14,
    backgroundColor: '#5FE9D0',
    marginTop: -8,
    borderRadius: 1,
  },
  waveLineLong: {
    width: 30,
    height: 2,
    backgroundColor: '#5FE9D0',
    borderRadius: 1,
    marginLeft: 1,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: '#9DB2CC', // Secondary text
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  btnWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  note: {
    fontSize: 11,
    color: '#5E7596', // Faint note text
    letterSpacing: 0.8,
  },
});
