/**
 * @module templates/defaults
 * @description Default configurations for each trader template.
 */

import type { TraderTemplate, TemplateConfig, FBDConfig, CANSLIMConfig, Mode2Config } from './types';

/** Default FBD template configuration */
export const FBD_DEFAULT: FBDConfig = {
  templateId: 'fbd',
  durationSec: 900,
  lockWindowSec: 180,
  emotionMinScore: 55,
  addPositionAllowed: false,
  acceptancePromptRatio: 0.5,
};

/** Default CANSLIM template configuration */
export const CANSLIM_DEFAULT: CANSLIMConfig = {
  templateId: 'canslim',
  durationSec: 1800,
  entryLockWindowSec: 300,
  stopLossRequired: true,
  emotionMinScore: 60,
  fastCompletionThreshold: 75,
};

/** Default Mode2 template configuration */
export const MODE2_DEFAULT: Mode2Config = {
  templateId: 'mode2',
  durationSec: 2700,
  maxTradesPerDay: 1,
  emotionMinScore: 65,
  violationPenaltyPoints: 10,
};

/** All template defaults indexed by template ID */
export const TEMPLATE_DEFAULTS: Record<TraderTemplate, TemplateConfig> = {
  fbd: FBD_DEFAULT,
  canslim: CANSLIM_DEFAULT,
  mode2: MODE2_DEFAULT,
};
