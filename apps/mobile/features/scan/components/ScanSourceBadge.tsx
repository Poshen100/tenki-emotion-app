/**
 * @module features/scan/components/ScanSourceBadge
 * @description Displays the active sensor source during a scan.
 *
 * Shows which data source the fusion engine selected:
 *   🫁 Chest Belt  (ble_chest)
 *   ⌚ Apple Watch  (watch_healthkit)
 *   👁 Glabella rPPG (rppg_glabella)
 *   📷 Camera      (rppg_forehead / rppg_cheek)
 *
 * Also shows a ↑ accuracy boost indicator when wearableHrvApplied is true.
 *
 * Fades in when fusionLog changes, fades out automatically after 3 seconds
 * if autoDismiss is true (default). Always visible during active scan.
 *
 * @version 1.0
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
  type ViewStyle,
} from 'react-native';
import type { FusionLog } from '@tenki/engine/types';
import type { FusionSource } from '@tenki/engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Source metadata map
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_META: Record<FusionSource, { label: string; icon: string; color: string }> = {
  ble_chest:        { label: 'Chest Belt', icon: '🫁', color: '#4CAF50' },
  watch_healthkit:  { label: 'Apple Watch', icon: '⌚', color: '#007AFF' },
  rppg_glabella:   { label: 'Face (Precision)', icon: '👁', color: '#9C27B0' },
  rppg_forehead:   { label: 'Camera', icon: '📷', color: '#FF9800' },
  rppg_cheek:      { label: 'Camera', icon: '📷', color: '#FF9800' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanSourceBadgeProps {
  fusionLog: FusionLog | null;
  wearableHrvApplied?: boolean;
  /** Auto-dismiss badge after 3s. Default: false (always visible during scan). */
  autoDismiss?: boolean;
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScanSourceBadge({
  fusionLog,
  wearableHrvApplied = false,
  autoDismiss = false,
  style,
}: ScanSourceBadgeProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!fusionLog) return;

    // Cancel any pending dismiss
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (autoDismiss) {
      dismissTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 3000);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [fusionLog?.source, autoDismiss]);

  if (!fusionLog) return null;

  const meta = SOURCE_META[fusionLog.source];
  const isDegraded = fusionLog.degraded;

  return (
    <Animated.View
      style={[styles.container, { opacity, borderColor: isDegraded ? '#FF5722' : meta.color }, style]}
      accessibilityLabel={`Sensor source: ${meta.label}${wearableHrvApplied ? ', wearable accuracy boost active' : ''}${isDegraded ? ', signal degraded' : ''}`}
      accessibilityRole="text"
    >
      <Text style={styles.icon}>{meta.icon}</Text>
      <Text style={[styles.label, { color: isDegraded ? '#FF5722' : meta.color }]}>
        {meta.label}
      </Text>
      {isDegraded && (
        <Text style={styles.degraded}>⚠</Text>
      )}
      {wearableHrvApplied && !isDegraded && (
        <View style={[styles.boostBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.boostText}>↑ HRV</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    gap: 5,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  degraded: {
    fontSize: 12,
    color: '#FF5722',
    marginLeft: 2,
  },
  boostBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 2,
  },
  boostText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
