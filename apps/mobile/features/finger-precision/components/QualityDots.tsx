/**
 * @module finger-precision/components/QualityDots
 * @description Row of 3 status lights displaying finger coverage, stillness, and contact pressure.
 *
 * @version 1.0
 */

import type React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import type { DotStatus } from '../types';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface QualityDotsProps {
  cover: DotStatus;
  still: DotStatus;
  pressure: DotStatus;
  labels: {
    cover: string;
    still: string;
    pressure: string;
  };
}

export function QualityDots({
  cover,
  still,
  pressure,
  labels,
}: QualityDotsProps): React.JSX.Element {
  const getStatusColor = (status: DotStatus) => {
    switch (status) {
      case 'green':
        return t.colors.dotGreen;
      case 'yellow':
        return t.colors.dotYellow;
      case 'red':
      default:
        return t.colors.dotRed;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dotWrapper}>
        <View style={[styles.dot, { backgroundColor: getStatusColor(cover) }]} />
        <Text style={styles.label}>{labels.cover}</Text>
      </View>
      <View style={styles.dotWrapper}>
        <View style={[styles.dot, { backgroundColor: getStatusColor(still) }]} />
        <Text style={styles.label}>{labels.still}</Text>
      </View>
      <View style={styles.dotWrapper}>
        <View style={[styles.dot, { backgroundColor: getStatusColor(pressure) }]} />
        <Text style={styles.label}>{labels.pressure}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 16,
  },
  dotWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9DB2CC',
  },
});
