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
import React from 'react';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { ResonanceOrbSkia } from './ResonanceOrbSkia';

interface ResonanceOrbProps {
  stage: MaturityStage;
  size?: number;
}

export function ResonanceOrb({ stage, size = 180 }: ResonanceOrbProps): React.JSX.Element {
  return <ResonanceOrbSkia stage={stage} size={size} />;
}
