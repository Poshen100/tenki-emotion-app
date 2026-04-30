import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography as typo, getZoneForScore } from '../../theme';
import { QualityMeter } from '../../components/QualityMeter';
import { ReadinessChecklist } from '../../components/ReadinessChecklist';
import { StatusPill } from '../../components/StatusPill';
import { ScanButton } from '../../components/ScanButton';
import { ZoneBadge } from '../../components/ZoneBadge';
import { useScanStore } from '../../stores/scan-store';
import { startMockScan, cancelMockScan } from '../../lib/mock-scan';

type ScanType = 'quick' | 'deep' | 'baseline';
type ScanUIState = 'idle' | 'searching' | 'detecting' | 'locked' | 'scanning' | 'processing' | 'results' | 'error';
type GuideStage = 'approach' | 'cover' | 'hold' | 'ready';

interface Thresholds {
  coverage: number;
  stability: number;
  signalQuality: number;
}

const SCAN_TYPES: { key: ScanType; label: string; duration: string }[] = [
  { key: 'quick', label: 'Quick', duration: '30s' },
  { key: 'deep', label: 'Deep', duration: '60s' },
  { key: 'baseline', label: 'Baseline', duration: '3 min' },
];

const GUIDE_STEPS: { key: GuideStage; label: string }[] = [
  { key: 'approach', label: 'Find lens' },
  { key: 'cover', label: 'Cover edge' },
  { key: 'hold', label: 'Hold 1 sec' },
  { key: 'ready', label: 'Start baseline' },
];

function getReadinessThresholds(scanType: ScanType): Thresholds {
  if (scanType === 'baseline') {
    return { coverage: 85, stability: 70, signalQuality: 72 };
  }

  if (scanType === 'deep') {
    return { coverage: 72, stability: 55, signalQuality: 68 };
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
      title: 'Place finger on rear camera',
      lead: 'A quick scan can tolerate a little more variation, but fuller cover still gives you a cleaner signal.',
      primary: uiState === 'locked' ? 'Signal locked. You are ready.' : 'Place finger pad over the rear camera.',
      secondary:
        uiState === 'detecting'
          ? 'Keep phone and finger still for a cleaner lock.'
          : 'Use the center of your finger instead of the fingertip.',
      gateNote: 'Full cover and less motion will improve signal quality on every scan.',
    };
  }

  if (uiState === 'locked' || uiState === 'scanning' || uiState === 'processing') {
    return {
      eyebrow: 'BASELINE SETUP',
      title: 'That is the coverage we want.',
      lead: 'Baseline should only start after a strong, stable lock. This mode uses a stricter gate on purpose.',
      primary: 'Perfect cover. Hold steady while the baseline lock stays clean.',
      secondary: 'Full cover, stronger signal, and a steadier hold are all required before we trust the baseline.',
      gateNote: 'Baseline waits for full cover, stronger signal, and a steadier hold before it treats the reading as valid.',
    };
  }

  if (stage === 'hold') {
    return {
      eyebrow: 'BASELINE SETUP',
      title: 'Coverage is right. Now freeze it.',
      lead: 'Once the lens is fully covered, the next job is simply not moving for a full second.',
      primary: 'Position is correct. Do not slide or press harder.',
      secondary: 'A quiet 1 second hold gives us a cleaner baseline reference.',
      gateNote: 'Baseline uses a more conservative hold requirement than Quick or Deep.',
    };
  }

  if (stage === 'cover') {
    return {
      eyebrow: 'BASELINE SETUP',
      title: 'Use finger pad, center, cover.',
      lead: 'The lens should disappear completely under the softer middle of your finger, with no light leaking around the edge.',
      primary: 'Cover a little more of the lens. No light leaks at the edge.',
      secondary: 'Use finger pad instead of fingertip so the contact patch stays stable.',
      gateNote: 'We only let baseline begin once the lens is fully covered and the signal stops wobbling.',
    };
  }

  return {
    eyebrow: 'BASELINE SETUP',
    title: 'Teach the user the perfect cover first.',
    lead: 'Baseline should be stricter than a normal scan. We only trust it after centered cover, strong signal, and a steady hold.',
    primary: 'Look at the 2 second demo, then place finger pad on the rear camera.',
    secondary: 'Center first, cover the edge next, then hold still for 1 second.',
    gateNote: 'This setup step exists to protect baseline accuracy and long-term reliability.',
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
      ]),
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
  const { scanType, setScanType, uiState, metrics, lastResult, reset } = useScanStore();

  const thresholds = getReadinessThresholds(scanType);
  const checklist = [
    {
      key: 'signal',
      label: scanType === 'baseline' ? 'Signal lock' : 'Signal quality',
      ready: metrics.signalQuality >= thresholds.signalQuality,
    },
    {
      key: 'coverage',
      label: scanType === 'baseline' ? 'Full cover' : 'Coverage',
      ready: metrics.coverage >= thresholds.coverage,
    },
    {
      key: 'stability',
      label: scanType === 'baseline' ? 'Still hold' : 'Stability',
      ready: metrics.stability >= thresholds.stability,
      skippable: scanType !== 'baseline',
    },
    {
      key: 'camera',
      label: 'Camera active',
      ready: uiState !== 'idle' && uiState !== 'error',
    },
  ];

  const isIdle = uiState === 'idle';
  const isBusy = !isIdle && uiState !== 'results' && uiState !== 'error';
  const activeType = SCAN_TYPES.find((type) => type.key === scanType)!;
  const guideStage = getGuideStage(scanType, uiState, metrics.coverage);
  const guideCopy = getGuideCopy(scanType, uiState, guideStage);
  const activeStageIndex = GUIDE_STEPS.findIndex((step) => step.key === guideStage);

  const handlePrimaryPress = () => {
    if (uiState === 'results') {
      reset();
      router.push('/');
    } else if (isBusy) {
      cancelMockScan();
    } else {
      startMockScan(scanType);
    }
  };

  const primaryLabel =
    uiState === 'results'
      ? 'View on Today'
      : isBusy
        ? 'Cancel'
        : scanType === 'baseline'
          ? 'Start Baseline Setup'
          : `Start ${activeType.label} Scan`;

  const cameraStatusNote =
    scanType === 'baseline'
      ? 'Stricter gate enabled'
      : `${activeType.duration} target`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.switcherRow}>
          {SCAN_TYPES.map((type) => (
            <Pressable
              key={type.key}
              onPress={() => setScanType(type.key)}
              style={[
                styles.switcherTab,
                scanType === type.key && styles.switcherTabActive,
              ]}
            >
              <Text
                style={[
                  styles.switcherText,
                  scanType === type.key && styles.switcherTextActive,
                ]}
              >
                {type.label}
              </Text>
              <Text style={styles.switcherDuration}>{type.duration}</Text>
            </Pressable>
          ))}
        </View>

        {scanType === 'baseline' && uiState !== 'results' && (
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

          <View style={styles.roiOverlay}>
            <View style={styles.roiOuterRing}>
              <View
                style={[
                  styles.roiInnerRing,
                  guideStage === 'ready' && styles.roiInnerRingReady,
                ]}
              />
            </View>
            <Text style={styles.roiText}>Rear Camera</Text>
            <Text style={styles.roiSubtext}>
              {scanType === 'baseline'
                ? 'Use finger pad, not fingertip'
                : 'Cover lens fully to begin'}
            </Text>
          </View>
        </View>

        <View style={styles.metersSection}>
          <QualityMeter label="Coverage" value={metrics.coverage} />
          <QualityMeter label="Stability" value={metrics.stability} />
          <QualityMeter label="Signal quality" value={metrics.signalQuality} />
        </View>

        <View style={styles.checklistSection}>
          <Text style={[typo.label, styles.sectionLabel]}>READINESS</Text>
          <ReadinessChecklist items={checklist} />
        </View>

        {uiState === 'results' && lastResult && (
          <View style={styles.resultCard}>
            <Text style={[typo.label, styles.sectionLabel]}>RESULT</Text>
            <View style={styles.resultRow}>
              <Text style={[styles.resultScore, { color: getZoneForScore(lastResult.edgeScore).bg }]}>
                {lastResult.edgeScore}
              </Text>
              <ZoneBadge score={lastResult.edgeScore} />
            </View>
            <Text style={typo.caption}>
              Scan duration: {lastResult.duration}s
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <ScanButton label={primaryLabel} onPress={handlePrimaryPress} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  switcherTabActive: {
    backgroundColor: colors.primary,
  },
  switcherText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  switcherTextActive: {
    color: colors.textPrimary,
  },
  switcherDuration: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  baselineSetupCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(24, 28, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  baselineEyebrow: {
    marginBottom: spacing.xs,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  baselineTitle: {
    fontSize: 20,
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
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    borderColor: colors.primary,
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
    backgroundColor: 'rgba(0,180,216,0.42)',
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
    borderColor: 'rgba(0,180,216,0.44)',
    backgroundColor: 'rgba(0,180,216,0.12)',
  },
  stageChipComplete: {
    borderColor: 'rgba(52,199,89,0.30)',
    backgroundColor: 'rgba(52,199,89,0.10)',
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
    backgroundColor: 'rgba(4, 10, 20, 0.82)',
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
  },
  cameraFeedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,180,216,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,180,216,0.16)',
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
  roiOverlay: {
    flex: 1,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiOuterRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,180,216,0.16)',
  },
  roiInnerRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1.5,
    borderColor: 'rgba(0,180,216,0.48)',
    borderStyle: 'dashed',
  },
  roiInnerRingReady: {
    borderColor: 'rgba(52,199,89,0.80)',
  },
  roiText: {
    marginTop: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  roiSubtext: {
    marginTop: spacing.xs,
    fontSize: 12,
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
  resultCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  resultScore: {
    fontSize: 48,
    fontWeight: '200',
  },
});
