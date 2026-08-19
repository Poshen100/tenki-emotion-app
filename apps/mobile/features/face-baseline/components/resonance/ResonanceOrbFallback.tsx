/**
 * @module face-baseline/components/ResonanceOrbFallback
 * @description The maturity resonance orb in core RN Animated, for every
 * runtime without a Skia canvas — the web build, and Expo Go, which does not
 * bundle `@shopify/react-native-skia`.
 *
 * Props mirror the Skia implementation exactly, so a call site does not care
 * which one it got.
 */
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { STAGE_ORDER } from '../../utils/maturityStage';

interface ResonanceOrbFallbackProps {
  stage: MaturityStage;
  size?: number;
}

function stageIndex(stage: MaturityStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function stageTint(stage: MaturityStage): string {
  return t.progress.stageColors[stage];
}

function goldRatio(stage: MaturityStage): number {
  const idx = stageIndex(stage);
  return [0, 0.15, 0.45, 1][idx];
}

function GlassSpecularShine({ size }: { size: number }): React.JSX.Element {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: size * 0.05,
          left: size * 0.12,
          width: size * 0.65,
          height: size * 0.24,
          borderRadius: size * 0.3,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          transform: [{ rotate: '-30deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.1,
          right: size * 0.12,
          width: size * 0.25,
          height: size * 0.08,
          borderRadius: size * 0.04,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </>
  );
}

export function ResonanceOrbFallback({ stage, size = 180 }: ResonanceOrbFallbackProps): React.JSX.Element {
  const tint = stageTint(stage);
  const gold = goldRatio(stage);
  const idx = stageIndex(stage);

  const rotAnim = useRef(new Animated.Value(0)).current;
  const rot2Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const r1 = Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const r2 = Animated.loop(
      Animated.timing(rot2Anim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    r1.start();
    r2.start();
    pulse.start();
    return () => { r1.stop(); r2.stop(); pulse.stop(); };
  }, [rotAnim, rot2Anim, pulseAnim]);

  const spin1 = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rot2Anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const coreScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const glowOp = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.75],
  });

  const orbSize = size;
  const ring1Size = size * 0.94;
  const ring2Size = size * 0.78;
  const ring3Size = size * 0.62;
  const coreSize = size * 0.38;
  const innerDotSize = size * 0.09;

  const ringColor = gold > 0.5 ? t.color.accent.goldSoft : tint;
  const coreColor = gold > 0.5 ? t.color.accent.goldResonance : tint;
  const orbBorder = gold > 0.3 ? 'rgba(243, 169, 42, 0.35)' : 'rgba(0, 240, 255, 0.25)';
  const orbBg = gold > 0.3 ? 'rgba(28, 18, 10, 0.75)' : 'rgba(8, 12, 28, 0.72)';

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size,
            opacity: glowOp,
            shadowColor: ringColor,
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            borderColor: orbBorder,
            backgroundColor: orbBg,
            shadowColor: ringColor,
          },
        ]}
      >
        <GlassSpecularShine size={size} />

        <Animated.View
          style={[
            styles.ring,
            {
              width: ring1Size,
              height: ring1Size,
              borderRadius: ring1Size / 2,
              borderColor: ringColor,
              transform: [{ rotate: spin1 }, { rotateX: '70deg' }],
            },
          ]}
        />

        {idx >= 1 && (
          <Animated.View
            style={[
              styles.ring,
              styles.ring2,
              {
                width: ring2Size,
                height: ring2Size,
                borderRadius: ring2Size / 2,
                borderColor: ringColor,
                transform: [{ rotate: spin2 }, { rotateX: '55deg' }, { rotateZ: '35deg' }],
              },
            ]}
          />
        )}

        {idx >= 2 && (
          <Animated.View
            style={[
              styles.ring,
              styles.ring3,
              {
                width: ring3Size,
                height: ring3Size,
                borderRadius: ring3Size / 2,
                borderColor: ringColor,
                transform: [{ rotate: spin1 }, { rotateY: '60deg' }, { rotateZ: '-20deg' }],
              },
            ]}
          />
        )}

        <Animated.View
          style={[
            styles.coreDiamond,
            {
              width: coreSize,
              height: coreSize,
              borderColor: coreColor,
              transform: [{ rotate: '45deg' }, { scale: coreScale }],
            },
          ]}
        >
          {idx >= 2 && (
            <View
              style={[
                styles.coreInner,
                {
                  width: coreSize * 0.6,
                  height: coreSize * 0.6,
                  borderColor: coreColor,
                  transform: [{ rotate: '22.5deg' }],
                },
              ]}
            />
          )}
        </Animated.View>

        {idx >= 3 && (
          <View
            style={[
              styles.centerDot,
              {
                width: innerDotSize,
                height: innerDotSize,
                borderRadius: innerDotSize / 2,
                backgroundColor: t.color.accent.goldSoft,
              },
            ]}
          />
        )}

        {idx >= 2 && (
          <>
            <View style={[styles.sparkle, { top: '12%', right: '18%', backgroundColor: ringColor }]} />
            <View style={[styles.sparkle, { bottom: '15%', left: '20%', backgroundColor: ringColor }]} />
            <View style={[styles.sparkle, { top: '45%', right: '8%', backgroundColor: ringColor, opacity: 0.5 }]} />
            <View style={[styles.sparkle, { bottom: '38%', left: '10%', backgroundColor: ringColor, opacity: 0.4 }]} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(127,233,208,0.06)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 50,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    overflow: 'visible',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#00F0FF',
    opacity: 0.8,
  },
  ring2: {
    opacity: 0.6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: '#00F0FF',
  },
  ring3: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopColor: '#00F0FF',
  },
  coreDiamond: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreInner: {
    borderWidth: 1.5,
    opacity: 0.7,
  },
  centerDot: {
    position: 'absolute',
    shadowColor: '#FFD27A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.75,
  },
});
