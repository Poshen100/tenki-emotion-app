/**
 * @module face-baseline/components/CameraFeedUnavailable
 * @description What sits in the scan frame when there is no camera to show.
 *
 * The one rule here is not to imply a working scan. A dark rounded rectangle
 * alone is indistinguishable from a camera pointed at a dark room, and the
 * surrounding UI — the particle mesh, the progress ruler, the nudges — will
 * happily animate over the top of it and read as a capture in progress. So it
 * says what is missing and why, in the frame, where it cannot be missed.
 *
 * This is the same principle as `isQualityInstrumented` in `choreography.ts`:
 * an un-instrumented build must look un-instrumented.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export interface CameraFeedUnavailableProps {
  size?: number;
  /** Shown under the heading. Keep it about what to do, not about the error. */
  detail?: string;
}

export function CameraFeedUnavailable({
  size = 240,
  detail = 'This preview build has no camera module. The scan will not produce a real reading here — a development build is needed for that.',
}: CameraFeedUnavailableProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={styles.glyph}>◍</Text>
      <Text style={styles.title}>No camera in this build</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0C14',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  glyph: {
    color: t.color.text.tertiary,
    fontSize: 30,
    marginBottom: 10,
  },
  title: {
    color: t.color.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  detail: {
    color: t.color.text.tertiary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
