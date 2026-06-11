import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useFaceBaselineStore } from '../../store/faceBaselineStore';

interface CameraFeedViewProps {
  size?: number;
  active?: boolean;
}

export function CameraFeedView({ size = 240, active = false }: CameraFeedViewProps): React.JSX.Element {
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
