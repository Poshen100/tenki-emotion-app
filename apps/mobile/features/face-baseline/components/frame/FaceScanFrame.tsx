/**
 * @module face-baseline/components/FaceScanFrame
 * @description The precision scan frame. `square` = aligning (corner brackets),
 * `halo` = capturing (circular ring). Color tracks state:
 * idle/tracking = cyan, locked = mint, capturing = gold.
 *
 * INTEGRATION (Skia + vision-camera): render the live camera preview behind the
 * frame, animate bracket tracking + lock snap, and draw the halo arc in Skia.
 * This core-RN version draws the static frame chrome over a placeholder.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export type ScanShape = 'square' | 'halo';
export type ScanState = 'idle' | 'tracking' | 'locked' | 'capturing';

interface FaceScanFrameProps {
  shape?: ScanShape;
  state?: ScanState;
  size?: number;
  children?: React.ReactNode;
}

function frameColor(state: ScanState): string {
  if (state === 'locked') return t.color.frame.locked;
  if (state === 'capturing') return t.color.frame.capture;
  if (state === 'tracking') return t.color.frame.tracking;
  return t.color.frame.idle;
}

/** L-shaped corner bracket. */
function Corner({ color, style }: { color: string; style: StyleProp<ViewStyle> }): React.JSX.Element {
  return <View style={[styles.corner, { borderColor: color }, style]} />;
}

export function FaceScanFrame({
  shape = 'square',
  state = 'idle',
  size = 240,
  children,
}: FaceScanFrameProps): React.JSX.Element {
  const color = frameColor(state);

  if (shape === 'halo') {
    return (
      <View style={[styles.haloWrap, { width: size, height: size }]}>
        <View
          style={[
            styles.halo,
            { width: size, height: size, borderRadius: size / 2, borderColor: color, shadowColor: color },
          ]}
        />
        <View style={styles.subject}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.squareWrap, { width: size, height: size }]}>
      <View style={styles.subject}>{children}</View>
      <Corner color={color} style={styles.tl} />
      <Corner color={color} style={styles.tr} />
      <Corner color={color} style={styles.bl} />
      <Corner color={color} style={styles.br} />
    </View>
  );
}

const BRACKET = 34;

const styles = StyleSheet.create({
  squareWrap: { alignItems: 'center', justifyContent: 'center' },
  haloWrap: { alignItems: 'center', justifyContent: 'center' },
  subject: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  halo: {
    position: 'absolute',
    borderWidth: t.stroke.halo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
  },
  corner: { position: 'absolute', width: BRACKET, height: BRACKET },
  tl: { top: 0, left: 0, borderTopWidth: t.stroke.reticle, borderLeftWidth: t.stroke.reticle, borderTopLeftRadius: t.radius.scanFrame.lg },
  tr: { top: 0, right: 0, borderTopWidth: t.stroke.reticle, borderRightWidth: t.stroke.reticle, borderTopRightRadius: t.radius.scanFrame.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: t.stroke.reticle, borderLeftWidth: t.stroke.reticle, borderBottomLeftRadius: t.radius.scanFrame.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: t.stroke.reticle, borderRightWidth: t.stroke.reticle, borderBottomRightRadius: t.radius.scanFrame.lg },
});
