import type React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, BlurMask, vec } from '@shopify/react-native-skia';

interface WeeklyTrendChartProps {
  /** 7 entries, oldest first. `null` marks a day with no completed session. */
  data: (number | null)[];
  /** 7 day labels, same order as `data`. */
  labels: string[];
  height?: number;
  width?: number;
}

// Mirrors packages/shared/src/design-tokens.ts brand.cyanActive.
const CYAN = '#22D3EE';
const PADDING_Y = 16;
const DEFAULT_WIDTH = Dimensions.get('window').width - 48;

function buildPaths(data: (number | null)[], width: number, height: number) {
  const n = data.length;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const points = data.reduce<{ x: number; y: number }[]>((acc, value, i) => {
    if (value === null) return acc;
    const y = PADDING_Y + (1 - value / 100) * (height - PADDING_Y * 2);
    acc.push({ x: i * stepX, y });
    return acc;
  }, []);

  const linePath = Skia.Path.Make();
  const areaPath = Skia.Path.Make();
  if (points.length === 0) return { linePath, areaPath };

  linePath.moveTo(points[0].x, points[0].y);
  areaPath.moveTo(points[0].x, height);
  areaPath.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    linePath.lineTo(points[i].x, points[i].y);
    areaPath.lineTo(points[i].x, points[i].y);
  }
  areaPath.lineTo(points[points.length - 1].x, height);
  areaPath.close();

  return { linePath, areaPath };
}

/** 7-day Edge Score trend — Skia line + gradient area fill, with day labels as an RN Text overlay. */
export function WeeklyTrendChart({
  data,
  labels,
  height = 100,
  width = DEFAULT_WIDTH,
}: WeeklyTrendChartProps): React.JSX.Element {
  const { linePath, areaPath } = buildPaths(data, width, height);

  return (
    <View style={{ width }}>
      <Canvas style={{ width, height }}>
        <Path path={areaPath} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={['rgba(34,211,238,0.35)', 'rgba(34,211,238,0)']}
          />
        </Path>
        <Path path={linePath} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" color={CYAN}>
          <BlurMask blur={3} style="normal" />
        </Path>
      </Canvas>
      <View style={styles.labelRow}>
        {labels.map((label) => (
          <Text key={label} style={styles.label}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  label: {
    fontSize: 10,
    color: '#8E8E93',
  },
});
