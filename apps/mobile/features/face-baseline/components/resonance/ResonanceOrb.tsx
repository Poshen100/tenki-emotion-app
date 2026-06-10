/**
 * @module face-baseline/components/ResonanceOrb
 * @description Living maturity orb (cyan + gold blend) with a geometric core
 * that accrues gold as the baseline matures.
 *
 * INTEGRATION (Skia): geometric core + orbiting particles; brighten/accrue gold
 * per maturity stage. Reduced-motion = static stage render.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';

interface ResonanceOrbProps {
  stage: MaturityStage;
  size?: number;
}

function stageTint(stage: MaturityStage): string {
  return t.progress.stageColors[stage];
}

export function ResonanceOrb({ stage, size = 160 }: ResonanceOrbProps): React.JSX.Element {
  const tint = stageTint(stage);
  return (
    <View style={[styles.glow, { width: size * 1.4, height: size * 1.4, borderRadius: size }]}>
      <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2, shadowColor: tint }]}>
        <View style={[styles.ring, { width: size * 0.78, height: size * 0.78, borderRadius: size, borderColor: tint }]} />
        {/* geometric core */}
        <View style={[styles.core, { width: size * 0.34, height: size * 0.34, borderColor: t.color.accent.goldSoft }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,233,208,0.05)',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,20,34,0.6)',
    borderWidth: 1,
    borderColor: t.color.border.hairline,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 44,
  },
  ring: { position: 'absolute', borderWidth: 1.5, opacity: 0.7 },
  core: { borderWidth: 1.5, transform: [{ rotate: '45deg' }] },
});
