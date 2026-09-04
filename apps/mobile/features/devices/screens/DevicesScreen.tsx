/**
 * @module features/devices/screens/DevicesScreen
 * @description The Devices connection screen — where a user links Apple 健康,
 * Health Connect, a heart-rate chest strap, or (later) Garmin Connect.
 *
 * Everything it decides comes from the feature's pure modules: the catalogue
 * says what to show, `resolveUnavailableReason` says what is connectable, the
 * machine says what button a row offers, and `formatSyncStatus` says how fresh
 * the data is. The screen itself only renders.
 *
 * Privacy controls stay outside the paywall (CLAUDE.md v3 rule): this screen is
 * free, and disconnecting is always one tap away.
 */

import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography as typo } from '../../../theme';
import { BackgroundContainer } from '../../../components/onboarding-components';
import { DEVICES_SCREEN_COPY } from '../copy';
import { createUnwiredLinkPort } from '../port';
import { providersForOs } from '../providers';
import { describeRow } from '../rowPresentation';
import { useDevicesStore } from '../store/devicesStore';
import type { DeviceConnection, DeviceProvider } from '../types/devices.types';

/** Scope labels, so a partial grant can say what it actually covers. */
const SCOPE_LABELS: Record<string, string> = {
  scan: '掃描期間',
  context: '每日脈絡',
  history: '歷史趨勢',
};

export function DevicesScreen() {
  const router = useRouter();
  const connections = useDevicesStore((s) => s.connections);
  const syncEnvironment = useDevicesStore((s) => s.syncEnvironment);
  const setPort = useDevicesStore((s) => s.setPort);
  const connect = useDevicesStore((s) => s.connect);
  const disconnect = useDevicesStore((s) => s.disconnect);

  const os = Platform.OS === 'android' ? 'android' : 'ios';
  const providers = providersForOs(os);

  useEffect(() => {
    // Until the native adapters land, the unwired port reports the truth:
    // the right entries for this OS, and no adapter behind any of them.
    setPort(createUnwiredLinkPort(os));
    syncEnvironment();
  }, [os, setPort, syncEnvironment]);

  const connectedCount = providers.filter(
    (provider) => connections[provider.id].state === 'connected',
  ).length;

  return (
    <BackgroundContainer>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backLabel}>Lab</Text>
          </Pressable>

          <Text style={typo.headline}>{DEVICES_SCREEN_COPY.title}</Text>
          <Text style={[typo.caption, styles.subtitle]}>{DEVICES_SCREEN_COPY.subtitle}</Text>

          {connectedCount === 0 && (
            <Text style={styles.emptyState}>{DEVICES_SCREEN_COPY.emptyState}</Text>
          )}

          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              connection={connections[provider.id]}
              onConnect={() => connect(provider.id)}
              onDisconnect={() => disconnect(provider.id)}
            />
          ))}

          <Text style={styles.privacyNote}>{DEVICES_SCREEN_COPY.privacyNote}</Text>
        </ScrollView>
      </SafeAreaView>
    </BackgroundContainer>
  );
}

function ProviderRow({
  provider,
  connection,
  onConnect,
  onDisconnect,
}: {
  provider: DeviceProvider;
  connection: DeviceConnection;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const row = describeRow(provider, connection, Date.now());

  return (
    <View style={[styles.row, row.blocked && styles.rowBlocked]}>
      <View style={styles.rowHeader}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle}>{row.title}</Text>
          <Text style={[styles.rowPrimary, row.primaryIsStale && styles.rowPrimaryStale]}>
            {row.primaryLine}
          </Text>
        </View>

        {row.actionLabel && (
          <Pressable
            style={[styles.actionBtn, row.action === 'DISCONNECT' && styles.actionBtnQuiet]}
            onPress={row.action === 'DISCONNECT' ? onDisconnect : onConnect}
            accessibilityRole="button"
            accessibilityLabel={`${row.actionLabel} ${row.title}`}
          >
            <Text
              style={[
                styles.actionText,
                row.action === 'DISCONNECT' && styles.actionTextQuiet,
              ]}
            >
              {row.actionLabel}
            </Text>
          </Pressable>
        )}
      </View>

      {row.stateLine && <Text style={styles.rowStateLine}>{row.stateLine}</Text>}

      {row.scopes.length > 0 && (
        <View style={styles.scopeRow}>
          {row.scopes.map((scope) => (
            <View key={scope} style={styles.scopeChip}>
              <Text style={styles.scopeText}>{SCOPE_LABELS[scope] ?? scope}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backChevron: {
    fontSize: 26,
    color: colors.primary,
    marginRight: 2,
  },
  backLabel: {
    fontSize: 15,
    color: colors.primary,
  },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  emptyState: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowBlocked: { opacity: 0.55 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowInfo: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rowPrimary: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  rowPrimaryStale: { color: colors.warning },
  rowStateLine: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textPrimary,
    opacity: 0.75,
    marginTop: spacing.sm,
  },
  actionBtn: {
    backgroundColor: 'rgba(0,180,216,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  actionBtnQuiet: { backgroundColor: colors.surface },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionTextQuiet: { color: colors.textSecondary },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  scopeChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  scopeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  privacyNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
});
