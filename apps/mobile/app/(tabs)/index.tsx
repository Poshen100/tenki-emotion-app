import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography as typo, getZoneForScore, zoneLabels } from '../../theme';
import { EdgeScoreRing } from '../../components/EdgeScoreRing';
import { ZoneBadge } from '../../components/ZoneBadge';
import { ScanButton } from '../../components/ScanButton';
import { useScanStore } from '../../stores/scan-store';
import { useBaselineStore } from '../../stores/baseline-store';

/** Format a timestamp to a human-readable scan time label. */
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

/**
 * Today screen — daily summary dashboard.
 * Shows current Edge Score, zone, last scan time, and quick actions.
 */
export default function TodayScreen() {
  const router = useRouter();
  const lastResult = useScanStore((s) => s.lastResult);
  const totalScans = useBaselineStore((s) => s.totalScans);
  const hasBaseline = totalScans > 0;

  const currentScore = lastResult?.edgeScore ?? null;
  const lastScanTime = lastResult
    ? `Last scan ${formatScanTime(lastResult.timestamp)}`
    : 'No scans today';
  const zone = currentScore !== null ? getZoneForScore(currentScore) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={typo.headline}>Today</Text>
        <Text style={[typo.caption, styles.subtitle]}>{lastScanTime}</Text>

        {/* Edge Score Ring */}
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
                {hasBaseline ? 'Scan to see your score' : 'Complete a baseline scan to begin'}
              </Text>
            </View>
          )}
        </View>

        {/* Guidance */}
        <View style={styles.guidanceCard}>
          <Text style={typo.body}>
            {lastResult
              ? lastResult.headline
              : 'Start a scan to check your current readiness state.'}
          </Text>
          {lastResult && (
            <Text style={[typo.caption, { marginTop: spacing.xs }]}>
              {lastResult.body}
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <ScanButton
            label="Quick Scan (30s)"
            onPress={() => router.push('/scan')}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard label="Sessions" value="—" />
          <StatCard label="Avg Score" value="—" />
          <StatCard label="Streak" value="—" />
        </View>
      </ScrollView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  scoreSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  badgeRow: {
    marginTop: spacing.md,
  },
  guidanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  actions: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
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
