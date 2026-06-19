import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, radius, typography as typo } from '../theme';
import { useAutonomicStore } from '../stores/autonomic-store';

const BAR_WIDTH = 220;

function AnimatedBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value / 100,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH],
  });

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              backgroundColor: color,
            },
          ]}
        />
        {/* subtle wave overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.waveDot,
                {
                  left: (i / 4) * BAR_WIDTH,
                  backgroundColor: color,
                },
              ]}
            />
          ))}
        </View>
      </View>
      <Text style={[styles.val, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export function AutonomicCard() {
  const { snsLoad, pnsRecovery, source, wearableHrvApplied, updatedAt } =
    useAutonomicStore();

  const synced = updatedAt !== null;
  const sourceLabel = wearableHrvApplied
    ? 'Garmin'
    : source === 'finger_ppg'
    ? 'PPG'
    : 'rPPG';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Autonomic · 自律平衡</Text>
        <View style={[styles.badge, synced ? styles.badgeSynced : styles.badgeIdle]}>
          <Text style={styles.badgeText}>{synced ? 'Synced' : 'Idle'}</Text>
        </View>
      </View>

      <AnimatedBar value={snsLoad} color="#F5A623" label="交感 SNS" />
      <AnimatedBar value={pnsRecovery} color="#4CAF50" label="副交感 PNS" />

      <Text style={styles.source}>來源：{sourceLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeSynced: {
    backgroundColor: '#1B4332',
  },
  badgeIdle: {
    backgroundColor: colors.cardBorder ?? '#333',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  label: {
    width: 72,
    fontSize: 13,
    fontWeight: '500',
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    opacity: 0.85,
  },
  waveDot: {
    position: 'absolute',
    top: 1,
    width: 3,
    height: 6,
    borderRadius: 1.5,
    opacity: 0.4,
  },
  val: {
    width: 28,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
  source: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
