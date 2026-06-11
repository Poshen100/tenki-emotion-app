/**
 * @module face-baseline/components/ResonanceOrb
 * @description Living maturity orb (cyan + gold blend) with a geometric core
 * that accrues complexity and gold as the baseline matures through 4 stages.
 *
 * Stage progression:
 *   - new     = single ring, simple diamond core, tertiary color
 *   - building = two rings, diamond + outer square, cyan
 *   - ready   = three rings, more complex geometry, teal/gold blend
 *   - mature  = three rings + inner dot, full geometric core, full gold
 *
 * Pure RN Animated — rings rotate slowly, core pulses gently.
 * Skia upgrade: replace with actual icosahedron wireframe.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { STAGE_ORDER } from '../../utils/maturityStage';

interface ResonanceOrbProps {
  stage: MaturityStage;
  size?: number;
}

function stageIndex(stage: MaturityStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function stageTint(stage: MaturityStage): string {
  return t.progress.stageColors[stage];
}

/** How much gold (0–1) the orb shows based on stage. */
function goldRatio(stage: MaturityStage): number {
  const idx = stageIndex(stage);
  return [0, 0.15, 0.45, 1][idx];
}

export function ResonanceOrb({ stage, size = 160 }: ResonanceOrbProps): React.JSX.Element {
  const tint = stageTint(stage);
  const gold = goldRatio(stage);
  const idx = stageIndex(stage);

  // Slow rotation for the outer orbital ring
  const rotAnim = useRef(new Animated.Value(0)).current;
  const rot2Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const r1 = Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const r2 = Animated.loop(
      Animated.timing(rot2Anim, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 3000,
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
    outputRange: [1, 1.06],
  });
  const glowOp = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.65],
  });

  // Measurements
  const orbSize = size;
  const ring1Size = size * 0.92;
  const ring2Size = size * 0.75;
  const coreSize = size * 0.36;
  const innerDotSize = size * 0.08;

  // Colors: blend from tint (stage) toward gold as maturity increases
  const ringColor = gold > 0.5 ? t.color.accent.goldSoft : tint;
  const coreColor = gold > 0.5 ? t.color.accent.goldResonance : tint;
  const orbBorder = gold > 0.3 ? t.color.border.glassGold : t.color.border.hairline;

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: size,
            opacity: glowOp,
            shadowColor: ringColor,
          },
        ]}
      />

      {/* Main sphere */}
      <View
        style={[
          styles.orb,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            borderColor: orbBorder,
            shadowColor: tint,
          },
        ]}
      >
        {/* Ring 1 — outermost orbital */}
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

        {/* Ring 2 — visible from building stage */}
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

        {/* Geometric core — diamond that grows with stage */}
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
          {/* Inner octagon (ready+) */}
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

        {/* Center dot (mature only) */}
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

        {/* Sparkle dots — small particles around the sphere (ready+) */}
        {idx >= 2 && (
          <>
            <View style={[styles.sparkle, { top: '8%', right: '15%', backgroundColor: ringColor }]} />
            <View style={[styles.sparkle, { bottom: '12%', left: '18%', backgroundColor: ringColor }]} />
            <View style={[styles.sparkle, { top: '45%', right: '5%', backgroundColor: ringColor, opacity: 0.4 }]} />
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
    backgroundColor: 'rgba(127,233,208,0.04)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 44,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,20,34,0.55)',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: undefined, // overridden via style prop
    opacity: 0.7,
  },
  ring2: {
    opacity: 0.5,
    borderWidth: 1,
  },
  coreDiamond: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreInner: {
    borderWidth: 1,
    opacity: 0.6,
  },
  centerDot: {
    position: 'absolute',
    shadowColor: '#FFD27A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  sparkle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
});
