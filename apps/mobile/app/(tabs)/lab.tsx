import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography as typo } from '../../theme';

interface LabItem {
  icon: string;
  title: string;
  description: string;
  available: boolean;
}

const LAB_ITEMS: LabItem[] = [
  {
    icon: '🫁',
    title: 'Breathing Practice',
    description: '4-7-8 and box breathing exercises',
    available: true,
  },
  {
    icon: '📈',
    title: 'Pattern Analysis',
    description: 'Discover your readiness patterns over time',
    available: false,
  },
  {
    icon: '🧪',
    title: 'Insights',
    description: 'AI-generated observations from your data',
    available: false,
  },
  {
    icon: '🔔',
    title: 'Reminders',
    description: 'Set up scan and session reminders',
    available: false,
  },
];

const SETTINGS_ITEMS = [
  { icon: '👤', title: 'Profile', description: 'Manage your account' },
  { icon: '🔒', title: 'Privacy', description: 'Data controls and export' },
  { icon: '⌚', title: 'Devices', description: 'Connect Garmin, Apple Watch' },
  { icon: '💎', title: 'Subscription', description: 'Free plan' },
];

/**
 * Lab screen — growth tools, breathing practice, settings.
 * Houses features that don't fit in the main session flow.
 */
export default function LabScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={typo.headline}>Lab</Text>
        <Text style={[typo.caption, styles.subtitle]}>
          Growth tools and settings
        </Text>

        {/* Lab Tools */}
        <Text style={[typo.label, styles.sectionLabel]}>TOOLS</Text>
        {LAB_ITEMS.map((item) => (
          <LabCard key={item.title} item={item} />
        ))}

        {/* Settings */}
        <Text style={[typo.label, styles.sectionLabel]}>SETTINGS</Text>
        {SETTINGS_ITEMS.map((item) => (
          <Pressable key={item.title} style={styles.settingsRow}>
            <Text style={styles.settingsIcon}>{item.icon}</Text>
            <View style={styles.settingsInfo}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={typo.caption}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        {/* Version */}
        <Text style={styles.version}>TENKI Core v3.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function LabCard({ item }: { item: LabItem }) {
  return (
    <Pressable
      style={[styles.labCard, !item.available && styles.labCardDisabled]}
      disabled={!item.available}
    >
      <Text style={styles.labIcon}>{item.icon}</Text>
      <View style={styles.labInfo}>
        <Text style={styles.labTitle}>{item.title}</Text>
        <Text style={typo.caption}>{item.description}</Text>
      </View>
      {!item.available && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Soon</Text>
        </View>
      )}
    </Pressable>
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
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  labCardDisabled: {
    opacity: 0.5,
  },
  labIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  labInfo: {
    flex: 1,
  },
  labTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  comingSoonBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  settingsIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.textTertiary,
  },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: spacing.xl,
  },
});
