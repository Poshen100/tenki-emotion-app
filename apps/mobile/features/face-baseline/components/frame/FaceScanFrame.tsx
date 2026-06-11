/**
 * @module face-baseline/components/FaceScanFrame
 * @description The precision scan frame. `square` = aligning (corner brackets),
 * `halo` = capturing (circular ring). Color tracks state:
 * idle/tracking = cyan, locked = mint, capturing = gold.
 *
 * Uses Animated to transition between square brackets and halo ring,
 * and handles the lock snap animation (320ms snap) and color interpolation.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle, type StyleProp } from 'react-native';
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
  if (state === 'locked') return t.color.frame.locked; // mint
  if (state === 'capturing') return t.color.frame.capture; // gold
  if (state === 'tracking') return t.color.frame.tracking; // cyan
  return t.color.frame.idle; // dimmed blue-gray
}

// Precision alignment grid lines inside the scanner
function GridOverlay({ size }: { size: number }): React.JSX.Element {
  const lineCount = 12;
  const spacing = size / lineCount;
  return (
    <View style={[StyleSheet.absoluteFill, styles.gridWrap]} pointerEvents="none">
      {/* Vertical Lines */}
      {Array.from({ length: lineCount - 1 }).map((_, i) => (
        <View
          key={`v-${i}`}
          style={[
            styles.gridLine,
            styles.gridV,
            { left: (i + 1) * spacing },
          ]}
        />
      ))}
      {/* Horizontal Lines */}
      {Array.from({ length: lineCount - 1 }).map((_, i) => (
        <View
          key={`h-${i}`}
          style={[
            styles.gridLine,
            styles.gridH,
            { top: (i + 1) * spacing },
          ]}
        />
      ))}
      {/* Center Reticle crosshair notches */}
      <View style={[styles.crosshair, { width: 12, height: 1.5, top: size / 2 - 0.75, left: size / 2 - 6 }]} />
      <View style={[styles.crosshair, { width: 1.5, height: 12, top: size / 2 - 6, left: size / 2 - 0.75 }]} />
    </View>
  );
}

export function FaceScanFrame({
  shape = 'square',
  state = 'idle',
  size = 240,
  children,
}: FaceScanFrameProps): React.JSX.Element {
  const isHalo = shape === 'halo';
  const color = frameColor(state);

  // Animated values for visual state transitions
  const shapeAnim = useRef(new Animated.Value(isHalo ? 1 : 0)).current;
  const colorAnim = useRef(new Animated.Value(state === 'idle' ? 0 : state === 'tracking' ? 0.33 : state === 'locked' ? 0.66 : 1)).current;
  const snapScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Track state change
  useEffect(() => {
    // Animate shape transition (0 = square, 1 = halo)
    Animated.timing(shapeAnim, {
      toValue: isHalo ? 1 : 0,
      duration: t.motion.duration.lockSnap,
      useNativeDriver: false,
    }).start();

    // Color target index
    const targetColorVal = state === 'idle' ? 0 : state === 'tracking' ? 0.33 : state === 'locked' ? 0.66 : 1;
    Animated.timing(colorAnim, {
      toValue: targetColorVal,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Trigger lock/snap animation
    if (state === 'locked') {
      snapScale.setValue(1.15);
      Animated.spring(snapScale, {
        toValue: 1.0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }

    // Capture breathing animation loop
    if (state === 'capturing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [shape, state, isHalo, shapeAnim, colorAnim, snapScale, pulseAnim]);

  // Color interpolation
  const interpolatedColor = colorAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      t.color.frame.idle,
      t.color.frame.tracking,
      t.color.frame.locked,
      t.color.frame.capture,
    ],
  });

  // Corner bracket spacing/displacement animations
  const bracketOffset = shapeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  const bracketOpacity = shapeAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.3, 0],
  });

  const haloOpacity = shapeAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.3, 1],
  });

  const haloScale = shapeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.0],
  });

  // Combined scale (includes spring snap and capture breathing)
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  const combinedScale = Animated.multiply(snapScale, pulseScale);

  return (
    <Animated.View style={[styles.outerContainer, { width: size, height: size, transform: [{ scale: combinedScale }] }]}>
      {/* Background Face Subject Feed / Image */}
      <View style={styles.subject}>
        {children}
        {/* Precision scan grid overlay */}
        <GridOverlay size={size} />
      </View>

      {/* Square corner reticle */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bracketOpacity }]}>
        <Animated.View
          style={[
            styles.corner,
            styles.tl,
            {
              borderColor: interpolatedColor,
              transform: [{ translateX: Animated.multiply(bracketOffset, -1) }, { translateY: Animated.multiply(bracketOffset, -1) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            styles.tr,
            {
              borderColor: interpolatedColor,
              transform: [{ translateX: bracketOffset }, { translateY: Animated.multiply(bracketOffset, -1) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            styles.bl,
            {
              borderColor: interpolatedColor,
              transform: [{ translateX: Animated.multiply(bracketOffset, -1) }, { translateY: bracketOffset }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            styles.br,
            {
              borderColor: interpolatedColor,
              transform: [{ translateX: bracketOffset }, { translateY: bracketOffset }],
            },
          ]}
        />
      </Animated.View>

      {/* Circular halo ring */}
      <Animated.View
        style={[
          styles.haloContainer,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      >
        {/* Outer orbital guide ring */}
        <Animated.View
          style={[
            styles.haloOuterGuide,
            {
              width: size + 20,
              height: size + 20,
              borderRadius: (size + 20) / 2,
              borderColor: interpolatedColor,
            },
          ]}
        />

        {/* Primary capturing halo ring */}
        <Animated.View
          style={[
            styles.halo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: interpolatedColor,
              shadowColor: interpolatedColor,
            },
          ]}
        />

        {/* Inner concentric accuracy ring */}
        <Animated.View
          style={[
            styles.haloInnerGuide,
            {
              width: size - 30,
              height: size - 30,
              borderRadius: (size - 30) / 2,
              borderColor: interpolatedColor,
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const BRACKET = 34;

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  subject: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: t.radius.scanFrame.lg,
    backgroundColor: 'rgba(5, 8, 16, 0.6)',
  },
  gridWrap: {
    zIndex: 1,
    opacity: 0.8,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridV: {
    top: 0,
    bottom: 0,
    width: 0.7,
  },
  gridH: {
    left: 0,
    right: 0,
    height: 0.7,
  },
  crosshair: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  haloContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    borderWidth: t.stroke.halo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 44,
  },
  haloOuterGuide: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.28,
  },
  haloInnerGuide: {
    position: 'absolute',
    borderWidth: 0.8,
    borderStyle: 'solid',
    opacity: 0.35,
  },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    zIndex: 2,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: t.stroke.reticle,
    borderLeftWidth: t.stroke.reticle,
    borderTopLeftRadius: t.radius.scanFrame.lg,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: t.stroke.reticle,
    borderRightWidth: t.stroke.reticle,
    borderTopRightRadius: t.radius.scanFrame.lg,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: t.stroke.reticle,
    borderLeftWidth: t.stroke.reticle,
    borderBottomLeftRadius: t.radius.scanFrame.lg,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: t.stroke.reticle,
    borderRightWidth: t.stroke.reticle,
    borderBottomRightRadius: t.radius.scanFrame.lg,
  },
});
