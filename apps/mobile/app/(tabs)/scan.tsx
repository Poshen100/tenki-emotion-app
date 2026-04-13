import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography as typo } from '../../theme';
import { QualityMeter } from '../../components/QualityMeter';
import { ReadinessChecklist } from '../../components/ReadinessChecklist';
import { StatusPill } from '../../components/StatusPill';
import { ScanButton } from '../../components/ScanButton';
import { useScanStore } from '../../stores/scan-store';

type ScanType = 'quick' | 'deep' | 'baseline';

const SCAN_TYPES: { key: ScanType; label: string; duration: string }[] = [
  { key: 'quick', label: 'Quick', duration: '30s' },
  { key: 'deep', label: 'Deep', duration: '60s' },
  { key: 'baseline', label: 'Baseline', duration: '3 min' },
];

/**
 * Scan screen — Finger Heat Zone (FHZ) scanner.
 * Core interaction point for biometric readiness assessment.
 *
 * Layout: ScanTypeSwitcher → CameraFeed/FHZ → QualityMeters → ReadinessChecklist → Actions
 */
export default function ScanScreen() {
  const { scanType, setScanType, uiState, setUiState, metrics } = useScanStore();

  const checklist = [
    { key: 'signal', label: 'Signal quality', ready: metrics.signalQuality >= 65 },
    { key: 'coverage', label: 'Coverage', ready: metrics.coverage >= 65 },
    { key: 'stability', label: 'Stability', ready: metrics.stability >= 40, skippable: true },
    { key: 'camera', label: 'Camera ready', ready: uiState !== 'idle' && uiState !== 'error' },
  ];

  const canStart = uiState === 'locked';
  const activeType = SCAN_TYPES.find((t) => t.key === scanType)!;

  const instructionText = {
    idle: 'Select a scan type and place your finger on the rear camera.',
    searching: 'Cover the rear camera fully and hold still.',
    detecting: 'Keep the phone and finger still.',
    locked: 'Signal locked. Ready to scan.',
    scanning: 'Analyzing your readiness state...',
    processing: 'Calculating results...',
    results: 'Scan complete.',
    error: 'Signal lost. Please try again.',
  }[uiState];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan Type Switcher */}
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

        {/* Camera Feed / FHZ Placeholder */}
        <View style={styles.cameraFeed}>
          <StatusPill state={uiState} />
          <View style={styles.roiOverlay}>
            <Text style={styles.roiText}>Camera Feed</Text>
            <Text style={styles.roiSubtext}>
              Place finger on rear camera to begin
            </Text>
          </View>
          <Text style={styles.instruction}>{instructionText}</Text>
        </View>

        {/* Quality Meters */}
        <View style={styles.metersSection}>
          <QualityMeter label="Coverage" value={metrics.coverage} />
          <QualityMeter label="Stability" value={metrics.stability} />
          <QualityMeter label="Signal quality" value={metrics.signalQuality} />
        </View>

        {/* Readiness Checklist */}
        <View style={styles.checklistSection}>
          <Text style={[typo.label, styles.sectionLabel]}>READINESS</Text>
          <ReadinessChecklist items={checklist} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <ScanButton
            label={`Start ${activeType.label} Scan`}
            onPress={() => setUiState('scanning')}
            disabled={!canStart}
          />
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
  cameraFeed: {
    height: 320,
    backgroundColor: 'rgba(4, 10, 20, 0.82)',
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  roiOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.md,
    borderStyle: 'dashed',
    margin: spacing.lg,
  },
  roiText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  roiSubtext: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  instruction: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
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
