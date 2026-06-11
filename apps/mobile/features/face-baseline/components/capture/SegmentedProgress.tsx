/**
 * @module face-baseline/components/SegmentedProgress
 * @description Thin 2-segment capture bar (neutral → motion). Pause dims the
 * fill; progress never visually resets on a transient quality dip.
 *
 * Uses Animated to transition width smoothly.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { clamp01 } from '../../utils/progress';

interface SegmentedProgressProps {
  /** Overall progress 0–1 across all segments. */
  progress: number;
  segments?: number;
  accent?: 'cyan' | 'gold';
  paused?: boolean;
  width?: number;
}

function ProgressSegment({
  index,
  totalSegments,
  progress,
  fillColor,
  paused,
}: {
  index: number;
  totalSegments: number;
  progress: number;
  fillColor: string;
  paused: boolean;
}): React.JSX.Element {
  const segStart = index / totalSegments;
  const targetFill = clamp01((progress - segStart) * totalSegments);

  const fillAnim = useRef(new Animated.Value(targetFill)).current;
  const opacityAnim = useRef(new Animated.Value(paused ? 0.5 : 1)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: targetFill,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [targetFill, fillAnim]);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: paused ? 0.5 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [paused, opacityAnim]);

  const widthStyle = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: widthStyle,
            backgroundColor: fillColor,
            opacity: opacityAnim,
          },
        ]}
      />
    </View>
  );
}

export function SegmentedProgress({
  progress,
  segments = 2,
  accent = 'gold',
  paused = false,
  width = 220,
}: SegmentedProgressProps): React.JSX.Element {
  const fillColor = accent === 'gold' ? t.color.accent.goldSoft : t.color.accent.cyanGlow;
  const p = clamp01(progress);

  return (
    <View style={{ width, alignItems: 'center', gap: 6 }}>
      {/* Ruler Notch Guide matching precise calibration references */}
      <View style={[styles.ruler, { width }]}>
        {Array.from({ length: 33 }).map((_, i) => {
          const isCenter = i === 16;
          const isFifth = i % 4 === 0;
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
              key={i}
              style={[
                styles.tick,
                isCenter
                  ? styles.tickCenter
                  : isFifth
                  ? styles.tickFifth
                  : styles.tickNormal,
              ]}
            />
          );
        })}
      </View>

      <View style={[styles.row, { width }]} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(p * 100), min: 0, max: 100 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <ProgressSegment
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
            key={i}
            index={i}
            totalSegments={segments}
            progress={p}
            fillColor={fillColor}
            paused={paused}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ruler: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 10,
    paddingHorizontal: 2,
  },
  tick: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tickNormal: {
    height: 3,
  },
  tickFifth: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  tickCenter: {
    height: 10,
    backgroundColor: '#FFC85E',
    width: 1.5,
  },
  row: { flexDirection: 'row', gap: t.progress.segmentGap, alignSelf: 'center' },
  track: {
    flex: 1,
    height: t.progress.barHeight,
    borderRadius: t.progress.barHeight / 2,
    backgroundColor: `rgba(255,255,255,${t.progress.trackOpacity})`,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: t.progress.barHeight / 2 },
});
