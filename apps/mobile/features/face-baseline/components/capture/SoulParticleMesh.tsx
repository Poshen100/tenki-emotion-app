/**
 * @module face-baseline/components/SoulParticleMesh
 * @description Gold stardust mesh over the face — "your living signal". This is
 * the premium signature moment; it must NOT be flattened into a plain dot grid
 * in production.
 *
 * INTEGRATION (Skia + landmarks): map a particle field to face landmarks and
 * converge → crystallize as `stability` rises, scatter on drop, additive bloom.
 * Honor reduced-motion with a static low-density mesh. This core-RN placeholder
 * renders a faint static gold speckle to hold layout only.
 */
import type React from 'react';
import { View, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface SoulParticleMeshProps {
  /** 0–1: higher = more crystallized/brighter. */
  stability?: number;
  size?: number;
}

const SPECKS: ReadonlyArray<{ top: string; left: string }> = [
  { top: '20%', left: '30%' }, { top: '24%', left: '64%' }, { top: '38%', left: '46%' },
  { top: '46%', left: '28%' }, { top: '48%', left: '70%' }, { top: '58%', left: '50%' },
  { top: '66%', left: '36%' }, { top: '68%', left: '62%' }, { top: '76%', left: '48%' },
];

export function SoulParticleMesh({ stability = 0.6, size = 200 }: SoulParticleMeshProps): React.JSX.Element {
  const opacity = 0.4 + 0.5 * Math.max(0, Math.min(1, stability));
  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {SPECKS.map((s) => (
        <View
          key={`${s.top}-${s.left}`}
          style={[styles.speck, { top: s.top as never, left: s.left as never, opacity }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  speck: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: t.color.accent.goldSoft,
    shadowColor: t.color.accent.goldBloom,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
