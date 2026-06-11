import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFaceBaselineStore } from '../../store/faceBaselineStore';

interface CameraFeedViewProps {
  size?: number;
  active?: boolean;
}

export function CameraFeedView({ size = 240, active = false }: CameraFeedViewProps): React.JSX.Element {
  const permission = useFaceBaselineStore((s) => s.permission);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Only attempt to start video if active and permission has been granted
    if (!active || permission !== 'granted') {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        })
        .then((mediaStream) => {
          activeStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Browser webcam acquisition failed:', err);
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [active, permission]);

  // Mirror effect so user sees themselves naturally (like a mirror)
  const isWeb = typeof window !== 'undefined';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {permission === 'granted' ? (
        isWeb ? (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // mirror effect
              borderRadius: 'inherit',
            }}
          />
        ) : null
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.text}>Camera Mock Placeholder</Text>
        </View>
      )}
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#888',
    fontSize: 12,
  },
});
