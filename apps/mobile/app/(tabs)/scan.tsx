import React, { useEffect, useState, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius, typography as typo, getZoneForScore } from '../../theme';
import { QualityMeter } from '../../components/QualityMeter';
import { ReadinessChecklist } from '../../components/ReadinessChecklist';
import { StatusPill } from '../../components/StatusPill';
import { ScanButton } from '../../components/ScanButton';
import { useScanStore } from '../../stores/scan-store';
import { useUserStore } from '../../stores/user-store';
import { startMockScan, cancelMockScan } from '../../lib/mock-scan';
import { BackgroundContainer } from '../../components/onboarding-components';

const { width } = Dimensions.get('window');

type ScanType = 'quick' | 'deep' | 'baseline';
type ScanUIState = 'idle' | 'searching' | 'detecting' | 'locked' | 'scanning' | 'processing' | 'results' | 'error';
type GuideStage = 'approach' | 'cover' | 'hold' | 'ready';

interface Thresholds {
  coverage: number;
  stability: number;
  signalQuality: number;
}

const GUIDE_STEPS: { key: GuideStage; label: string }[] = [
  { key: 'approach', label: '尋找鏡頭' },
  { key: 'cover', label: '覆蓋鏡頭' },
  { key: 'hold', label: '保持靜止' },
  { key: 'ready', label: '開始校準' },
];

function getReadinessThresholds(scanType: ScanType): Thresholds {
  if (scanType === 'baseline') {
    return { coverage: 85, stability: 70, signalQuality: 72 };
  }
  return { coverage: 65, stability: 40, signalQuality: 65 };
}

function getGuideStage(scanType: ScanType, uiState: ScanUIState, coverage: number): GuideStage {
  if (uiState === 'locked' || uiState === 'scanning' || uiState === 'processing' || uiState === 'results') {
    return 'ready';
  }
  if (uiState === 'detecting') {
    return 'hold';
  }
  if (uiState === 'searching') {
    return coverage >= (scanType === 'baseline' ? 70 : 55) ? 'cover' : 'approach';
  }
  return 'approach';
}

function getGuideCopy(scanType: ScanType, uiState: ScanUIState, stage: GuideStage) {
  if (scanType !== 'baseline') {
    return {
      eyebrow: 'CAMERA CHECK',
      title: '請將臉部對準前鏡頭',
      lead: '每日臉部掃描會與你的平常基線進行對照，看見今天的生理適應狀態。',
      primary: uiState === 'locked' ? '訊號已鎖定，準備就緒。' : '請將臉部置於前鏡頭中央並保持靜止。',
      secondary: uiState === 'detecting' ? '光線良好，偵測定位中...' : '找光線均勻處，自然呼吸就好。',
      gateNote: '本機即時運算，影像絕不上傳雲端。',
    };
  }

  if (uiState === 'locked' || uiState === 'scanning' || uiState === 'processing') {
    return {
      eyebrow: 'FINGER CALIBRATION',
      title: '覆蓋良好，準備校準',
      lead: '手指接觸校準能重新量取 face↔finger 偏移量，讓日常臉掃更準確。',
      primary: '覆蓋正確。請保持食指穩定按壓，維持鎖定狀態。',
      secondary: '維持完整覆蓋與靜止，直到校準程序啟動。',
      gateNote: '手指校準對訊號品質的要求較為嚴格。',
    };
  }

  if (stage === 'hold') {
    return {
      eyebrow: 'FINGER CALIBRATION',
      title: '請保持靜止 1 秒',
      lead: '完整覆蓋後鏡頭後，請維持食指與手機靜止以鎖定基線。',
      primary: '已正確定位。請勿滑動或過度用力按壓。',
      secondary: '安靜維持 1 秒以獲取更乾淨的生理參考訊號。',
      gateNote: '校準等待期需要比日常臉部掃描更穩定的持握。',
    };
  }

  if (stage === 'cover') {
    return {
      eyebrow: 'FINGER CALIBRATION',
      title: '請用指腹完整覆蓋鏡頭',
      lead: '請用食指指肉較厚處完整遮蓋後鏡頭與閃光燈，防範邊緣漏光。',
      primary: '請多覆蓋一些鏡頭邊緣，防範漏光干擾。',
      secondary: '請避開指尖，用指腹中心按壓能提供更穩定的訊號。',
      gateNote: '鏡頭與光源需完全被手指覆蓋以取得足夠的血流信號。',
    };
  }

  return {
    eyebrow: 'FINGER CALIBRATION',
    title: '食指輕觸後鏡頭',
    lead: '藉由接觸式光學 PPG，量測更高精度的 HRV，並校準你的臉部基線。',
    primary: '請參照引導，將食指指腹貼在後鏡頭與閃光燈上。',
    secondary: '手指置中、完整覆蓋、保持靜止，依序完成三項指標。',
    gateNote: '此校準步驟有助於消除各模態間的系統性偏差。',
  };
}

function FingerCoverHint({ stage }: { stage: GuideStage }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1500,
          easing: Easing.bezier(0.45, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.delay(220),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const fingerTransform = [
    {
      translateX: progress.interpolate({
        inputRange: [0, 0.38, 0.72, 1],
        outputRange: [20, 4, -16, 20],
      }),
    },
    {
      translateY: progress.interpolate({
        inputRange: [0, 0.38, 0.72, 1],
        outputRange: [-34, -10, 8, -34],
      }),
    },
    {
      rotate: progress.interpolate({
        inputRange: [0, 0.38, 0.72, 1],
        outputRange: ['-16deg', '-10deg', '-4deg', '-16deg'],
      }),
    },
  ];

  const ringAnimatedStyle = {
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 0.45, 0.72, 1],
          outputRange: [1, 0.95, 0.88, 1],
        }),
      },
    ],
    opacity: progress.interpolate({
      inputRange: [0, 0.42, 0.72, 1],
      outputRange: [1, 0.85, 0.18, 1],
    }),
  };

  const lensAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.42, 0.72, 1],
      outputRange: [1, 0.9, 0.22, 1],
    }),
  };

  const readyAccent = stage === 'ready';

  return (
    <View style={styles.hintDemo}>
      <View style={styles.hintPhone}>
        <View style={styles.hintCameraBump}>
          <Animated.View
            style={[
              styles.hintTargetRing,
              readyAccent && styles.hintTargetRingReady,
              ringAnimatedStyle,
            ]}
          />
          <Animated.View style={[styles.hintLens, styles.hintLensMain, lensAnimatedStyle]} />
          <Animated.View style={[styles.hintLens, styles.hintLensTop, lensAnimatedStyle]} />
          <Animated.View style={[styles.hintLens, styles.hintLensBottom, lensAnimatedStyle]} />
          <View style={styles.hintFlash} />
        </View>
        <View style={styles.hintGuideLine} />
        <Animated.View
          style={[
            styles.hintFingerShadow,
            {
              transform: fingerTransform,
              opacity: progress.interpolate({
                inputRange: [0, 0.4, 0.72, 1],
                outputRange: [0.25, 0.42, 0.68, 0.25],
              }),
            },
          ]}
        />
        <Animated.View style={[styles.hintFinger, { transform: fingerTransform }]}>
          <View style={styles.hintFingerHighlight} />
        </Animated.View>
      </View>
    </View>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { scanType, setScanType, uiState, metrics, reset } = useScanStore();

  const [scanMode, setScanMode] = useState<'face' | 'finger'>('face');
  const [countdown, setCountdown] = useState(30);

  // Animated values for face centerpiece
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Sync mode parameter from search query (smart reminder)
  useEffect(() => {
    if (params.mode === 'finger') {
      setScanMode('finger');
      setScanType('baseline'); // Map finger calibration to baseline scan type
    } else {
      setScanMode('face');
      setScanType('quick'); // Map face daily scan to quick scan type
    }
  }, [params.mode]);

  // Sync scanMode changes to corresponding scanTypes
  const handleModeChange = (mode: 'face' | 'finger') => {
    cancelMockScan();
    setScanMode(mode);
    setScanType(mode === 'face' ? 'quick' : 'baseline');
  };

  // Run face stardust animations when scanning
  useEffect(() => {
    let breatheLoop: any;
    let rotateLoop: any;

    if (uiState === 'scanning' && scanMode === 'face') {
      breatheLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.15,
            duration: 2500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 0.95,
            duration: 2500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ])
      );
      breatheLoop.start();

      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();
    } else {
      breatheAnim.setValue(1);
      rotateAnim.setValue(0);
    }

    return () => {
      if (breatheLoop) breatheLoop.stop();
      if (rotateLoop) rotateLoop.stop();
    };
  }, [uiState, scanMode]);

  // Handle countdown animation synchronized with mock scan duration
  useEffect(() => {
    let timer: any;
    if (uiState === 'scanning') {
      const targetDuration = scanMode === 'face' ? 30 : 60;
      setCountdown(targetDuration);
      
      // quick scan takes 4s (decrements by ~8/sec), baseline takes 15s (decrements by ~4/sec)
      const mockDur = scanMode === 'face' ? 4000 : 15000;
      const decrementInterval = 1000;
      const decrementValue = Math.ceil(targetDuration / (mockDur / 1000));
      
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= decrementValue) {
            clearInterval(timer);
            return 0;
          }
          return prev - decrementValue;
        });
      }, decrementInterval);
    } else {
      setCountdown(scanMode === 'face' ? 30 : 60);
    }
    return () => clearInterval(timer);
  }, [uiState, scanMode]);

  // Auto redirect to Daily Scan Result screen on complete
  useEffect(() => {
    if (uiState === 'results') {
      if (scanMode === 'finger') {
        // Record last finger calibration time and set face baseline count to 3
        useUserStore.getState().setLastFingerCalibrationTime(Date.now());
        useUserStore.getState().setFaceBaselineCount(3);
      } else {
        // Increment face baseline count on successful face scans
        useUserStore.getState().incrementFaceBaselineCount();
      }
      const timer = setTimeout(() => {
        router.push('/scan/result');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [uiState, scanMode]);

  const thresholds = getReadinessThresholds(scanType);
  const checklist = [
    {
      key: 'signal',
      label: scanMode === 'finger' ? '訊號鎖定' : '訊號品質',
      ready: metrics.signalQuality >= thresholds.signalQuality,
    },
    {
      key: 'coverage',
      label: scanMode === 'finger' ? '完整覆蓋' : '前鏡頭對準',
      ready: metrics.coverage >= thresholds.coverage,
    },
    {
      key: 'stability',
      label: scanMode === 'finger' ? '保持靜止' : '穩態維持',
      ready: metrics.stability >= thresholds.stability,
      skippable: scanMode !== 'finger',
    },
    {
      key: 'camera',
      label: '相機已啟動',
      ready: uiState !== 'idle' && uiState !== 'error',
    },
  ];

  const isIdle = uiState === 'idle';
  const isBusy = !isIdle && uiState !== 'results' && uiState !== 'error';
  const guideStage = getGuideStage(scanType, uiState, metrics.coverage);
  const guideCopy = getGuideCopy(scanType, uiState, guideStage);
  const activeStageIndex = GUIDE_STEPS.findIndex((step) => step.key === guideStage);

  const handlePrimaryPress = () => {
    if (isBusy) {
      cancelMockScan();
    } else {
      startMockScan(scanType);
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const formattedCountdown = `00:${countdown.toString().padStart(2, '0')}`;

  const primaryLabel = isBusy
    ? '取消量測'
    : scanMode === 'finger'
      ? '開始手指校準'
      : '開始臉部掃描';

  const cameraStatusNote = scanMode === 'finger' ? '後鏡頭校準模式' : '前鏡頭臉部掃描';

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Switcher */}
          <View style={styles.switcherRow}>
            <Pressable
              onPress={() => handleModeChange('face')}
              style={[
                styles.switcherTab,
                scanMode === 'face' && styles.switcherTabActive,
              ]}
              disabled={isBusy}
            >
              <Text
                style={[
                  styles.switcherText,
                  scanMode === 'face' && styles.switcherTextActive,
                ]}
              >
                臉部掃描
              </Text>
              <Text style={styles.switcherDuration}>30 秒 · 每日</Text>
            </Pressable>

            <Pressable
              onPress={() => handleModeChange('finger')}
              style={[
                styles.switcherTab,
                scanMode === 'finger' && styles.switcherTabActive,
              ]}
              disabled={isBusy}
            >
              <Text
                style={[
                  styles.switcherText,
                  scanMode === 'finger' && styles.switcherTextActive,
                ]}
              >
                手指校準
              </Text>
              <Text style={styles.switcherDuration}>60 秒 · 定期</Text>
            </Pressable>
          </View>

          {/* Finger Calibrate Explainer Box */}
          {scanMode === 'finger' && uiState !== 'results' && (
            <View style={styles.baselineSetupCard}>
              <Text style={[typo.label, styles.baselineEyebrow]}>{guideCopy.eyebrow}</Text>
              <Text style={styles.baselineTitle}>{guideCopy.title}</Text>
              <Text style={styles.baselineLead}>{guideCopy.lead}</Text>
              <FingerCoverHint stage={guideStage} />
              <View style={styles.stageRail}>
                {GUIDE_STEPS.map((step, index) => {
                  const isActive = index === activeStageIndex;
                  const isComplete = index < activeStageIndex;
                  return (
                    <View
                      key={step.key}
                      style={[
                        styles.stageChip,
                        isActive && styles.stageChipActive,
                        isComplete && styles.stageChipComplete,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stageChipText,
                          isActive && styles.stageChipTextActive,
                          isComplete && styles.stageChipTextComplete,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.baselineGateNote}>{guideCopy.gateNote}</Text>
            </View>
          )}

          {/* Camera View Area */}
          <View style={styles.cameraFeed}>
            <View style={styles.cameraFeedTop}>
              <StatusPill state={uiState} />
              <View style={styles.cameraFeedMeta}>
                <Text style={styles.cameraFeedMetaText}>{cameraStatusNote}</Text>
              </View>
            </View>

            <View style={styles.cameraCoach}>
              <Text style={styles.cameraCoachPrimary}>{guideCopy.primary}</Text>
              <Text style={styles.cameraCoachSecondary}>{guideCopy.secondary}</Text>
            </View>

            {/* Dynamic Centerpiece depending on mode */}
            {scanMode === 'face' ? (
              /* Signature Stardust Face Scan Motif */
              <View style={styles.faceCenterpieceContainer}>
                <View style={styles.soulCircle}>
                  
                  {/* Spinning Orbit Particles */}
                  <Animated.View style={[styles.orbitContainer, { transform: [{ rotate: spin }] }]}>
                    <View style={[styles.speck, { top: '15%', left: '25%' }]} />
                    <View style={[styles.speck, { bottom: '15%', right: '25%' }]} />
                    <View style={[styles.speck, { top: '50%', left: '8%' }]} />
                    <View style={[styles.speck, { top: '40%', right: '10%' }]} />
                  </Animated.View>

                  <View style={styles.progressRingBorder} />

                  {/* Pulsing Core */}
                  <Animated.View style={[styles.breathingCore, { transform: [{ scale: breatheAnim }] }]}>
                    <View style={styles.coreWaveformRow}>
                      <View style={styles.coreWaveDown} />
                      <View style={styles.coreWaveUp} />
                      <View style={styles.coreWaveDownDeep} />
                      <View style={styles.coreWaveUpRecover} />
                    </View>
                  </Animated.View>

                  {/* Countdown display */}
                  {uiState === 'scanning' && (
                    <View style={styles.countdownOverlay}>
                      <Text style={styles.countdownText}>{formattedCountdown}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              /* Original Finger ROI Overlay */
              <View style={styles.roiOverlay}>
                <View style={styles.roiOuterRing}>
                  <View
                    style={[
                      styles.roiInnerRing,
                      guideStage === 'ready' && styles.roiInnerRingReady,
                    ]}
                  />
                </View>
                <Text style={styles.roiText}>後置鏡頭感測區</Text>
                <Text style={styles.roiSubtext}>
                  {uiState === 'scanning' ? `校準中 · ${formattedCountdown}` : '將食指指腹覆蓋於鏡頭上'}
                </Text>
              </View>
            )}
          </View>

          {/* Quality Meters */}
          <View style={styles.metersSection}>
            <QualityMeter label={scanMode === 'finger' ? '覆蓋度' : '對齊度'} value={metrics.coverage} />
            <QualityMeter label="穩定度" value={metrics.stability} />
            <QualityMeter label="訊號強度" value={metrics.signalQuality} />
          </View>

          {/* Checklist */}
          <View style={styles.checklistSection}>
            <Text style={[typo.label, styles.sectionLabel]}>解鎖就緒狀態</Text>
            <ReadinessChecklist items={checklist} />
          </View>

          {/* Action Button */}
          <View style={styles.actions}>
            <ScanButton label={primaryLabel} onPress={handlePrimaryPress} />
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  switcherRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  switcherTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(28, 44, 76, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  switcherTabActive: {
    backgroundColor: '#5FE9D0',
    borderColor: '#5FE9D0',
  },
  switcherText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9DB2CC',
  },
  switcherTextActive: {
    color: '#04141A',
  },
  switcherDuration: {
    fontSize: 10,
    color: 'rgba(157, 178, 204, 0.6)',
    marginTop: 2,
  },
  baselineSetupCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(28, 44, 76, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(95, 233, 208, 0.15)',
  },
  baselineEyebrow: {
    marginBottom: spacing.xs,
    color: '#5FE9D0',
    letterSpacing: 1.2,
  },
  baselineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  baselineLead: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  baselineGateNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  hintDemo: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 170,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  hintPhone: {
    width: 228,
    height: 146,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(36, 40, 52, 0.96)',
  },
  hintCameraBump: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 12, 18, 0.92)',
  },
  hintTargetRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#5FE9D0',
  },
  hintTargetRingReady: {
    borderColor: colors.success,
  },
  hintLens: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#090d12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  hintLensMain: {
    width: 30,
    height: 30,
    left: 12,
    top: 20,
  },
  hintLensTop: {
    width: 22,
    height: 22,
    left: 42,
    top: 10,
  },
  hintLensBottom: {
    width: 22,
    height: 22,
    left: 42,
    top: 38,
  },
  hintFlash: {
    position: 'absolute',
    width: 10,
    height: 10,
    left: 14,
    top: 14,
    borderRadius: 5,
    backgroundColor: '#fff3c2',
  },
  hintGuideLine: {
    position: 'absolute',
    top: 53,
    left: 86,
    width: 92,
    height: 1,
    backgroundColor: 'rgba(95,233,208,0.4)',
  },
  hintFingerShadow: {
    position: 'absolute',
    top: 14,
    right: 26,
    width: 70,
    height: 110,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  hintFinger: {
    position: 'absolute',
    top: 14,
    right: 26,
    width: 70,
    height: 110,
    borderRadius: 36,
    backgroundColor: '#e9a98f',
    overflow: 'hidden',
  },
  hintFingerHighlight: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 18,
    height: 46,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  stageRail: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stageChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stageChipActive: {
    borderColor: 'rgba(95,233,208,0.4)',
    backgroundColor: 'rgba(95,233,208,0.1)',
  },
  stageChipComplete: {
    borderColor: 'rgba(52,199,89,0.3)',
    backgroundColor: 'rgba(52,199,89,0.1)',
  },
  stageChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stageChipTextActive: {
    color: colors.textPrimary,
  },
  stageChipTextComplete: {
    color: '#93e6ab',
  },
  cameraFeed: {
    minHeight: 332,
    backgroundColor: 'rgba(10, 22, 40, 0.4)',
    borderColor: 'rgba(95, 233, 208, 0.15)',
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
  },
  cameraFeedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraFeedMeta: {
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cameraFeedMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cameraCoach: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(95,233,208,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(95,233,208,0.15)',
    zIndex: 10,
  },
  cameraCoachPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cameraCoachSecondary: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  faceCenterpieceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 180,
  },
  soulCircle: {
    width: width * 0.44,
    height: width * 0.44,
    borderRadius: (width * 0.44) / 2,
    backgroundColor: 'rgba(28, 44, 76, 0.25)',
    borderColor: 'rgba(95, 233, 208, 0.12)',
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
  progressRingBorder: {
    position: 'absolute',
    inset: -5,
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
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 3,
  },
  coreWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    width: '60%',
    opacity: 0.5,
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
    fontSize: 22,
    fontWeight: '300',
    color: '#EAF1F8',
    letterSpacing: 1,
  },
  roiOverlay: {
    flex: 1,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.01)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  roiOuterRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95,233,208,0.15)',
  },
  roiInnerRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1.5,
    borderColor: 'rgba(95,233,208,0.4)',
    borderStyle: 'dashed',
  },
  roiInnerRingReady: {
    borderColor: 'rgba(52,199,89,0.8)',
  },
  roiText: {
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  roiSubtext: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metersSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  checklistSection: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actions: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
