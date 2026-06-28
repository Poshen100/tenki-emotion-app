import type React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import { typography as typo } from '../theme';

export type BreathPattern = '4-7-8' | 'box';
type BreathPhase = 'inhale' | 'hold' | 'exhale';

interface BreathingRingProps {
  size?: number;
  elapsedSec: number;
  active: boolean;
  cyclePattern?: BreathPattern;
}

interface BreathStep {
  phase: BreathPhase;
  durationSec: number;
  startScale: number;
  endScale: number;
}

// Mirrors packages/shared/src/design-tokens.ts brand.cyanActive.
const CYAN = '#22D3EE';

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: '吸氣',
  hold: '屏息',
  exhale: '呼氣',
};

const PATTERNS: Record<BreathPattern, BreathStep[]> = {
  '4-7-8': [
    { phase: 'inhale', durationSec: 4, startScale: 0.6, endScale: 1 },
    { phase: 'hold', durationSec: 7, startScale: 1, endScale: 1 },
    { phase: 'exhale', durationSec: 8, startScale: 1, endScale: 0.6 },
  ],
  box: [
    { phase: 'inhale', durationSec: 4, startScale: 0.6, endScale: 1 },
    { phase: 'hold', durationSec: 4, startScale: 1, endScale: 1 },
    { phase: 'exhale', durationSec: 4, startScale: 1, endScale: 0.6 },
    { phase: 'hold', durationSec: 4, startScale: 0.6, endScale: 0.6 },
  ],
};

/** Format elapsed seconds as mm:ss. */
function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Resolves breath phase + ring scale at a given elapsed-ms position within the pattern's cycle. */
function breathStateAt(elapsedMs: number, pattern: BreathPattern): { phase: BreathPhase; scale: number } {
  const steps = PATTERNS[pattern];
  const cycleMs = steps.reduce((sum, step) => sum + step.durationSec, 0) * 1000;
  const t = elapsedMs % cycleMs;
  let acc = 0;
  for (const step of steps) {
    const stepMs = step.durationSec * 1000;
    if (t < acc + stepMs) {
      const progress = (t - acc) / stepMs;
      return { phase: step.phase, scale: step.startScale + (step.endScale - step.startScale) * progress };
    }
    acc += stepMs;
  }
  return { phase: steps[0].phase, scale: steps[0].startScale };
}

/** Breathing guide ring (Skia) — radius oscillates with inhale/hold/exhale; freezes in place when paused. */
export function BreathingRing({
  size = 220,
  elapsedSec,
  active,
  cyclePattern = '4-7-8',
}: BreathingRingProps): React.JSX.Element {
  const [breath, setBreath] = useState<{ phase: BreathPhase; scale: number }>({
    phase: 'inhale',
    scale: 0.6,
  });

  useEffect(() => {
    if (!active) return;
    const startTime = Date.now();
    let animId: number;
    const tick = () => {
      setBreath(breathStateAt(Date.now() - startTime, cyclePattern));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [active, cyclePattern]);

  const center = size / 2;
  const maxRadius = size * 0.42;
  const radius = maxRadius * breath.scale;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={radius} color={CYAN} opacity={0.16}>
          <BlurMask blur={16} style="normal" />
        </Circle>
        <Circle cx={center} cy={center} r={radius * 0.78} style="stroke" strokeWidth={2} color={CYAN} opacity={0.6} />
        <Circle cx={center} cy={center} r={radius * 0.55} color={CYAN} opacity={0.12} />
      </Canvas>
      <Text style={typo.timerDisplay}>{formatTimer(elapsedSec)}</Text>
      <Text style={styles.phaseLabel}>{active ? PHASE_LABELS[breath.phase] : '暫停'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  phaseLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: CYAN,
    marginTop: 4,
  },
});
