import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography as typo, getZoneForScore, zoneLabels } from '../../theme';
import { EdgeScoreRing } from '../../components/EdgeScoreRing';
import { ZoneBadge } from '../../components/ZoneBadge';
import { ScanButton } from '../../components/ScanButton';

/**
 * Today screen — daily summary dashboard.
 * Shows current Edge Score, zone, last scan time, and quick actions.
 */
export default function TodayScreen() {
  const router = useRouter();

  // Placeholder data — will be replaced by Zustand store
  const currentScore = 72;
  const lastScanTime = 'No scans today';
  const zone = getZoneForScore(currentScore);

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
          <EdgeScoreRing score={currentScore} size={220} />
          <View style={styles.badgeRow}>
            <ZoneBadge score={currentScore} />
          </View>
        </View>

        {/* Guidance */}
        <View style={styles.guidanceCard}>
          <Text style={typo.body}>
            {zone.name === 'clear' && 'Stable, focused state. You may be ready for important decisions.'}
            {zone.name === 'neutral' && 'Mixed signals today. Consider a brief check-in or reset.'}
            {zone.name === 'strain' && 'Elevated strain detected. A breathing exercise may help.'}
          </Text>
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
