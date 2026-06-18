import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography as typo } from '../../theme';
import { useSubscriptionStore } from '../../stores/subscription-store';
import { useUserStore } from '../../stores/user-store';
import { useScanStore } from '../../stores/scan-store';
import { BackgroundContainer } from '../../components/onboarding-components';
import { DopamineJournalSheet } from '../../components/DopamineJournalSheet';
import {
  useDopamineJournalStore,
  DOPAMINE_STATE_LABELS,
} from '../../stores/dopamine-journal-store';

interface LabItem {
  icon: string;
  title: string;
  description: string;
  requiresPremium: boolean;
  comingSoon: boolean;
  onPress?: () => void;
}

/**
 * Lab screen — growth tools, breathing practice, settings.
 * Includes Dopamine Journal and Binaural Beats.
 */
export default function LabScreen() {
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.tier);
  const isPremium = tier === 'premium';
  const [journalVisible, setJournalVisible] = useState(false);
  const lastEntry = useDopamineJournalStore((s) => s.getLastEntry());
  const todayCount = useDopamineJournalStore((s) => s.getTodayEntries().length);

  const LAB_ITEMS: LabItem[] = [
    {
      icon: '🌬️',
      title: 'Breathing Practice',
      description: '4-7-8 和方框呼吸法——回到基準線',
      requiresPremium: false,
      comingSoon: false,
    },
    {
      icon: '🧠',
      title: '多巴胺日誌',
      description: lastEntry
        ? `上次：${DOPAMINE_STATE_LABELS[lastEntry.state].zh} · 今日 ${todayCount} 筆`
        : '記錄你的身體狀態與轉機',
      requiresPremium: false,
      comingSoon: false,
      onPress: () => setJournalVisible(true),
    },
    {
      icon: '🎧',
      title: 'Binaural Beats',
      description: '腦波引導——Alpha / Theta 狀態回基',
      requiresPremium: true,
      comingSoon: true,
    },
    {
      icon: '📈',
      title: 'Pattern Analysis',
      description: '發現你的最佳决策時段與觀察模式',
      requiresPremium: true,
      comingSoon: true,
    },
    {
      icon: '🔔',
      title: 'Reminders',
      description: '設定定時提醒，建立每日扫描習慣',
      requiresPremium: false,
      comingSoon: true,
    },
  ];

  const settingsItems = [
    { icon: '👤', title: 'Profile', description: '管理你的帳號', onPress: undefined },
    { icon: '🔒', title: 'Privacy', description: '數據控制與匹出', onPress: undefined },
    { icon: '⌚', title: 'Devices', description: '連接 Garmin、Apple Watch', onPress: undefined },
    {
      icon: '🎯',
      title: 'Precision Calibration',
      description: '新增手指精準掃描以優化基線',
      onPress: () => router.push('/finger-precision'),
    },
    {
      icon: '💎',
      title: 'Subscription',
      description: isPremium ? 'Premium plan' : 'Free plan',
      onPress: undefined,
    },
    {
      icon: '🔄',
      title: 'Reset Baseline',
      description: '重設你的生理基線與狀態 (測試用)',
      onPress: () => {
        useUserStore.getState().setHasBaseline(false);
        useUserStore.setState({ baselineScore: null });
        useScanStore.getState().reset();
      },
    },
  ];

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={typo.headline}>Lab</Text>
          <Text style={[typo.caption, styles.subtitle]}>成長工具與設定</Text>

          {/* Today's Journal Summary */}
          {todayCount > 0 && lastEntry && (
            <View style={styles.journalSummary}>
              <Text style={styles.journalSummaryEmoji}>
                {DOPAMINE_STATE_LABELS[lastEntry.state].emoji}
              </Text>
              <View style={styles.journalSummaryText}>
                <Text style={styles.journalSummaryTitle}>
                  今日已記錄 {todayCount} 筆狀態
                </Text>
                <Text style={styles.journalSummaryLast}>
                  最近：{DOPAMINE_STATE_LABELS[lastEntry.state].zh}
                </Text>
              </View>
              <Pressable
                style={styles.journalAddBtn}
                onPress={() => setJournalVisible(true)}
              >
                <Text style={styles.journalAddBtnText}>+ 新增</Text>
              </Pressable>
            </View>
          )}

          {/* Lab Tools */}
          <Text style={[typo.label, styles.sectionLabel]}>TOOLS</Text>
          {LAB_ITEMS.map((item) => (
            <LabCard key={item.title} item={item} isPremium={isPremium} />
          ))}

          {/* Settings */}
          <Text style={[typo.label, styles.sectionLabel]}>SETTINGS</Text>
          {settingsItems.map((item) => (
            <Pressable
              key={item.title}
              style={styles.settingsRow}
              onPress={item.onPress}
            >
              <Text style={styles.settingsIcon}>{item.icon}</Text>
              <View style={styles.settingsInfo}>
                <Text style={styles.settingsTitle}>{item.title}</Text>
                <Text style={typo.caption}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}

          <Text style={styles.version}>TENKI Core v3.0.0</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Dopamine Journal Bottom Sheet */}
      <DopamineJournalSheet
        visible={journalVisible}
        onClose={() => setJournalVisible(false)}
      />
    </BackgroundContainer>
  );
}

function LabCard({ item, isPremium }: { item: LabItem; isPremium: boolean }) {
  const locked = item.comingSoon || (item.requiresPremium && !isPremium);
  const badgeLabel = item.comingSoon
    ? 'Soon'
    : item.requiresPremium && !isPremium
    ? 'Premium'
    : null;

  return (
    <Pressable
      style={[styles.labCard, locked && styles.labCardDisabled]}
      disabled={locked && !item.onPress}
      onPress={item.onPress}
    >
      <Text style={styles.labIcon}>{item.icon}</Text>
      <View style={styles.labInfo}>
        <Text style={styles.labTitle}>{item.title}</Text>
        <Text style={typo.caption}>{item.description}</Text>
      </View>
      {badgeLabel && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>{badgeLabel}</Text>
        </View>
      )}
      {!locked && !badgeLabel && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
  journalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,148,136,0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.3)',
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  journalSummaryEmoji: {
    fontSize: 26,
  },
  journalSummaryText: {
    flex: 1,
  },
  journalSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  journalSummaryLast: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.55)',
    marginTop: 2,
  },
  journalAddBtn: {
    backgroundColor: 'rgba(13,148,136,0.25)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  journalAddBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2DD4BF',
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
