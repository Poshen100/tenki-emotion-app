import { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography as typo, getZoneForScore, zoneLabels, type ZoneName } from '../../theme';
import { ZoneBadge } from '../../components/ZoneBadge';
import { useTimelineStore, type CompletedSession } from '../../stores/timeline-store';
import { BackgroundContainer } from '../../components/onboarding-components';

const MODE_LABELS: Record<string, string> = {
  health_reset: 'Health Reset',
  focus: 'Focus',
  performance: 'Performance',
  trader: 'Trader',
};

/** Format seconds to a human-readable duration. */
function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min} min`;
}

/** Format a timestamp to a relative or absolute date string. */
function formatDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

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
  const completedSessions = useTimelineStore((s) => s.sessions);

  const sessions: SessionEntry[] = useMemo(
    () =>
      completedSessions.map((s) => ({
        id: s.id,
        date: formatDate(s.completedAt),
        mode: MODE_LABELS[s.mode] ?? s.mode,
        score: s.edgeScore,
        duration: formatDuration(s.durationSec),
      })),
    [completedSessions],
  );

  // Compute 7-day average
  const sevenDayAvg = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const recent = completedSessions.filter((s) => s.completedAt >= cutoff);
    if (recent.length === 0) return '—';
    const avg = Math.round(recent.reduce((sum, s) => sum + s.edgeScore, 0) / recent.length);
    return String(avg);
  }, [completedSessions]);

  const isEmpty = sessions.length === 0;

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={typo.headline}>Timeline</Text>
        <Text style={typo.caption}>{sessions.length} sessions</Text>
      </View>

      {/* Trend Summary Cards */}
      <View style={styles.trendRow}>
        <TrendCard label="7-day avg" value={sevenDayAvg} />
        <TrendCard label="Sessions" value={sessions.length > 0 ? `${sessions.length}` : '—'} />
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
    </BackgroundContainer>
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
    backgroundColor: 'transparent',
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
