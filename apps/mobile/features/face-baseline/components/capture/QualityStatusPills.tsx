/**
 * @module face-baseline/components/QualityStatusPills
 * @description Slide-fade active quality nudge pill (Hold still / Reframe / Light).
 * Ensures exactly ONE nudge is shown at a time.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { QualityStatus } from '../../types/faceBaseline.types';

interface QualityStatusPillsProps {
  status: QualityStatus;
  label: string;
}

export function QualityStatusPills({ status, label }: QualityStatusPillsProps): React.JSX.Element | null {
  const visible = status !== 'good' && !!label;

  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 8)).current;

  const currentLabel = useRef(label);
  if (visible) {
    currentLabel.current = label;
  }

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, opacity, translateY]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.warnDot}>⚠️</Text>
      <Text style={styles.text}>{currentLabel.current}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: t.spacing.md,
    paddingVertical: 8,
    borderRadius: t.radius.pill,
    backgroundColor: 'rgba(255, 194, 75, 0.15)',
    borderWidth: 1,
    borderColor: t.color.status.caution,
    marginTop: t.spacing.sm,
  },
  warnDot: { marginRight: 6, fontSize: 12 },
  text: {
    color: t.color.status.caution,
    fontSize: t.text.pill.size,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
