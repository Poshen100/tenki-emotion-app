import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  colors,
  spacing,
  radius,
  typography as typo,
  getZoneForScore,
} from '../../theme';
import { EdgeScoreRing } from '../../components/EdgeScoreRing';
import { ZoneBadge } from '../../components/ZoneBadge';
import { ScanButton } from '../../components/ScanButton';
import { AutonomicCard } from '../../components/AutonomicCard';
import { DecisionBar } from '../../components/DecisionBar';
import { useScanStore } from '../../stores/scan-store';
import { useUserStore } from '../../stores/user-store';
import { stageProgress } from '../../features/face-baseline/utils/maturityStage';
import { useAutonomicStore } from '../../stores/autonomic-store';
import { BackgroundContainer } from '../../components/onboarding-components';

function formatScanTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function TodayScreen() {
  const router = useRouter();
  const lastResult = useScanStore((s) => s.lastResult);
  const hasBaseline = useUserStore((s) => s.hasBaseline);
  const autonomicSource = useAutonomicStore((s) => s.source);
  const wearableHrvApplied = useAutonomicStore((s) => s.wearableHrvApplied);
  const faceBaselineCount = useUserStore((s) => s.faceBaselineCount);

  useEffect(() => {
    if (!hasBaseline) {
      router.replace('/onboarding/welcome');
    }
  }, [hasBaseline]);

  const currentScore = lastResult?.edgeScore ?? null;
  // The background reads the same score the ring and badge do, so the sky and
  // the number can never disagree.
  const lastScanTime = lastResult
    ? `Last scan ${formatScanTime(lastResult.timestamp)}`
    : 'No scans today';
  const zone = currentScore !== null ? getZoneForScore(currentScore) : null;

  // Derive source badge labels for header
  const garminActive = wearableHrvApplied || autonomicSource === 'watch_healthkit';

  return (
    <BackgroundContainer score={currentScore} maturityRatio={stageProgress(faceBaselineCount)}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={styles.deepScanBtn}>
              <Text style={styles.deepScanText}>+ DEEP SCAN</Text>
            </View>
            <View style={styles.badges}>
              <View
                style={[
                  styles.sourceBadge,
                  garminActive && styles.sourceBadgeActive,
                ]}
              >
                <Text style={styles.sourceBadgeText}>
                  🎧 {garminActive ? 'Garmin' : 'Watch'}
                </Text>
              </View>
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>📷 rPPG</Text>
              </View>
            </View>
          </View>

          <Text style={[typo.caption, styles.subtitle]}>{lastScanTime}</Text>

          {/* ── Edge Score Ring ── */}
          <View style={styles.scoreSection}>
            {currentScore !== null ? (
              <>
                <EdgeScoreRing score={currentScore} size={220} />
                <View style={styles.badgeRow}>
                  <ZoneBadge score={currentScore} />
                </View>
              </>
            ) : (
              <View style={styles.emptyRing}>
                <Text style={styles.emptyScore}>—</Text>
                <Text style={typo.caption}>
                  {hasBaseline
                    ? 'Scan to see your score'
                    : 'Complete a baseline scan to begin'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Autonomic Card ── */}
          <AutonomicCard />

          {/* ── Decision Bar ── */}
          <DecisionBar
            label="Health Stress"
            duration="3:00"
            onPress={() => router.push('/session')}
          />

          {/* ── Guidance ── */}
          <View style={styles.guidanceCard}>
            <Text style={typo.body}>
              {zone === null &&
                'Start a scan to check your current readiness state.'}
              {zone?.name === 'clear' &&
                'Stable, focused state. You may be ready for important decisions.'}
              {zone?.name === 'neutral' &&
                'Mixed signals today. Consider a brief check-in or reset.'}
              {zone?.name === 'strain' &&
                'Elevated strain detected. A breathing exercise may help.'}
            </Text>
          </View>

          {/* ── Quick Actions ── */}
          <View style={styles.actions}>
            <ScanButton
              label="開始今日掃描"
              onPress={() => router.push('/scan')}
            />
          </View>

          {/* ── Stats Grid ── */}
          <View style={styles.statsGrid}>
            <StatCard label="Sessions" value="—" />
            <StatCard label="Avg Score" value="—" />
            <StatCard label="Streak" value="—" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </BackgroundContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={typo.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deepScanBtn: {
    borderWidth: 1,
    borderColor: colors.textTertiary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  deepScanText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sourceBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.textTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sourceBadgeActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.12)',
  },
  sourceBadgeText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  subtitle: { marginTop: spacing.xs },
  scoreSection: { alignItems: 'center', marginTop: spacing.xl },
  badgeRow: { marginTop: spacing.md },
  guidanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  actions: { marginTop: spacing.lg, alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScore: {
    fontSize: 72,
    fontWeight: '200',
    color: colors.textTertiary,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
});
