import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../stores/user-store';
import { BackgroundContainer, ProgressIndicator, TertiaryLink } from '../../components/onboarding-components';

const { width } = Dimensions.get('window');

export default function OnboardingScan() {
  const router = useRouter();
  const setBaselineScore = useUserStore((s) => s.setBaselineScore);

  const [countdown, setCountdown] = useState(60);
  const [heartRate, setHeartRate] = useState(66);
  const [isProcessing, setIsProcessing] = useState(false);

  // Animated values
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Core breathing pulse animation (Teal core expansion/contraction)
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.14,
          duration: 3000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0.94,
          duration: 3000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 2. Stardust specks rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Countdown & HR simulation
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerAnalysis();
          return 0;
        }
        // Sync progress value (0 to 1)
        progressAnim.setValue((60 - (prev - 1)) / 60);
        return prev - 1;
      });

      // Gently flicker heart rate
      setHeartRate((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        return next > 70 ? 69 : next < 62 ? 63 : next;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const triggerAnalysis = () => {
    setIsProcessing(true);
    // Simulate biometric analysis for 2.5 seconds
    setTimeout(() => {
      setBaselineScore(68); // Store mock baseline score
      router.push('/onboarding/complete');
    }, 2500);
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const formattedTime = `00:${countdown.toString().padStart(2, '0')}`;
  const progressPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Determine active step dot
  // Step 3 active (index 2) during scan, Step 5 active (index 4) during processing
  const currentStep = isProcessing ? 4 : 2;

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress indicator */}
        <ProgressIndicator activeStep={currentStep} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kicker}>
              {isProcessing ? 'CALIBRATING BASELINE' : '建立你的內在天氣圖'}
            </Text>
            <Text style={styles.subtitle}>
              {isProcessing ? '正在分析你的生理訊號...' : '跟著節奏，慢慢呼吸'}
            </Text>
          </View>

          {/* Stardust soul centerpiece */}
          <View style={styles.centerpieceContainer}>
            <View style={styles.soulCircle}>
              
              {/* Spinning particle system container */}
              <Animated.View style={[styles.orbitContainer, { transform: [{ rotate: spin }] }]}>
                {/* 4 Orbiting specks */}
                <View style={[styles.speck, { top: '10%', left: '30%' }]} />
                <View style={[styles.speck, { bottom: '15%', right: '20%' }]} />
                <View style={[styles.speck, { top: '50%', left: '5%' }]} />
                <View style={[styles.speck, { top: '35%', right: '8%' }]} />
              </Animated.View>

              {/* Progress Arc Overlay */}
              <View style={styles.arcContainer}>
                {/* Dynamic progress bar ring simulation */}
                <View style={styles.progressRingBorder} />
              </View>

              {/* Breathing Inner Core */}
              <Animated.View style={[styles.breathingCore, { transform: [{ scale: breatheAnim }] }]}>
                {/* Abstract ECG line across core */}
                <View style={styles.coreWaveformRow}>
                  <View style={styles.coreWaveDown} />
                  <View style={styles.coreWaveUp} />
                  <View style={styles.coreWaveDownDeep} />
                  <View style={styles.coreWaveUpRecover} />
                </View>
              </Animated.View>

              {/* Countdown overlay */}
              {!isProcessing && (
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownText}>{formattedTime}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status and Action info */}
          <View style={styles.footer}>
            <Text style={styles.statusText}>
              {isProcessing ? '訊號鎖定 · 即將完成' : `心率 ${heartRate} BPM · 訊號良好`}
            </Text>

            <View style={styles.cancelLink}>
              <TertiaryLink
                label="取消"
                onPress={() => router.push('/onboarding/ready')}
              />
            </View>
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
    paddingVertical: 16,
  },
  header: {
    marginTop: 10,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5FE9D0',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#EAF1F8',
    fontWeight: '500',
  },
  centerpieceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soulCircle: {
    width: width * 0.64,
    height: width * 0.64,
    borderRadius: (width * 0.64) / 2,
    backgroundColor: 'rgba(28, 44, 76, 0.2)',
    borderColor: 'rgba(95, 233, 208, 0.1)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  speck: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CFFEF',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  arcContainer: {
    position: 'absolute',
    inset: -6,
    borderRadius: 9999,
  },
  progressRingBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(95, 233, 208, 0.25)',
    borderStyle: 'dashed',
  },
  breathingCore: {
    width: '50%',
    height: '50%',
    borderRadius: 9999,
    backgroundColor: 'rgba(95, 233, 208, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 3,
  },
  coreWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    width: '60%',
    opacity: 0.6,
  },
  coreWaveDown: {
    width: 1.5,
    height: 4,
    backgroundColor: '#5FE9D0',
    marginTop: 3,
  },
  coreWaveUp: {
    width: 1.5,
    height: 12,
    backgroundColor: '#9CFFEF',
    marginTop: -6,
  },
  coreWaveDownDeep: {
    width: 1.5,
    height: 18,
    backgroundColor: '#5FE9D0',
    marginTop: 9,
  },
  coreWaveUpRecover: {
    width: 1.5,
    height: 7,
    backgroundColor: '#5FE9D0',
    marginTop: -4,
  },
  countdownOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 26,
    fontWeight: '300',
    color: '#EAF1F8',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#9DB2CC',
    fontWeight: '600',
    letterSpacing: 1,
  },
  cancelLink: {
    marginTop: 12,
  },
});
