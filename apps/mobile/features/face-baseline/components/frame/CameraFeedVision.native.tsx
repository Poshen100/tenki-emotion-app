/**
 * @module face-baseline/components/CameraFeedVision.native
 * @description The real front-camera preview, via react-native-vision-camera.
 *
 * Reached only when the native module is present — `CameraFeedView.native.tsx`
 * probes for it first, because Expo Go does not bundle it.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useFaceBaselineStore } from '../../store/faceBaselineStore';

interface CameraFeedVisionProps {
  size?: number;
  active?: boolean;
}

export function CameraFeedVision({ size = 240, active = false }: CameraFeedVisionProps): React.JSX.Element {
  const permission = useFaceBaselineStore((s) => s.permission);
  const device = useCameraDevice('front');

  if (permission !== 'granted') {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.text}>Camera access not enabled</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.text}>Finding front camera device...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={active}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
  },
});
