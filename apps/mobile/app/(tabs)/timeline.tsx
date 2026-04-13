import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography as typo, getZoneForScore, zoneLabels, type ZoneName } from '../../theme';
import { ZoneBadge } from '../../components/ZoneBadge';

interface SessionEntry {
  id: string;
  date: string;
  mode: string;
  score: number;
  duration: string;
}

/**
 * Timeline screen — session history and trend analysis.
 * Shows past sessions with Edge Scores, zone badges, and trend indicators.
 */
export default function TimelineScreen() {
  // Placeholder data — will be replaced by Zustand + SQLite
  const sessions: SessionEntry[] = [
    { id: '1', date: 'Today, 9:30 AM', mode: 'Focus', score: 78, duration: '25 min' },
    { id: '2', date: 'Yesterday, 2:15 PM', mode: 'Trader', score: 52, duration: '45 min' },
    { id: '3', date: 'Yesterday, 8:00 AM', mode: 'Health Reset', score: 85, duration: '15 min' },
    { id: '4', date: 'Apr 11, 10:45 AM', mode: 'Performance', score: 34, duration: '30 min' },
    { id: '5', date: 'Apr 10, 3:00 PM', mode: 'Focus', score: 67, duration: '25 min' },
  ];

  const isEmpty = sessions.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={typo.headline}>Timeline</Text>
        <Text style={typo.caption}>{sessions.length} sessions</Text>
      </View>

      {/* Trend Summary Cards */}
      <View style={styles.trendRow}>
        <TrendCard label="7-day avg" value="—" />
        <TrendCard label="Sessions" value={`${sessions.length}`} />
        <TrendCard label="Streak" value="—" />
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={typo.body}>No sessions yet</Text>
          <Text style={[typo.caption, styles.emptyHint]}>
            Complete your first scan to see your timeline.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SessionCard entry={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function TrendCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendValue}>{value}</Text>
      <Text style={typo.caption}>{label}</Text>
    </View>
  );
}

function SessionCard({ entry }: { entry: SessionEntry }) {
  const zone = getZoneForScore(entry.score);

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionMode}>{entry.mode}</Text>
        <Text style={typo.caption}>{entry.date}</Text>
      </View>
      <View style={styles.sessionBody}>
        <View style={styles.scoreCol}>
          <Text style={[styles.sessionScore, { color: zone.bg }]}>{entry.score}</Text>
          <ZoneBadge score={entry.score} />
        </View>
        <View style={styles.detailCol}>
          <Text style={typo.caption}>Duration: {entry.duration}</Text>
          <Text style={typo.caption}>Zone: {zoneLabels[zone.name]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  trendRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  trendCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sessionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sessionMode: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sessionBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreCol: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionScore: {
    fontSize: 32,
    fontWeight: '200',
  },
  detailCol: {
    flex: 1,
    gap: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyHint: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
