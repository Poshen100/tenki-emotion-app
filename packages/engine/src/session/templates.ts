/**
 * @module session/templates
 * @description Trader mode templates — structured process discipline templates.
 * Templates govern PROCESS, not financial decisions.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 5
 */

import type { TraderTemplate, TraderTemplateId } from './types';

/**
 * Three trader discipline templates.
 *
 * FBD: Follow-By-Discipline — emphasis on checklist, calmness, discipline.
 * CANSLIM: Personal process template with user-defined checklist + reflection.
 * MODE_2: High-sensitivity control template for volatile scenarios.
 *
 * @see ANTIGRAVITY.md v3.0 Section 5
 */
export const TRADER_TEMPLATES: Record<TraderTemplateId, TraderTemplate> = {
  FBD: {
    id: 'FBD',
    name: 'Follow-By-Discipline',
    nameZh: '紀律跟隨模式',
    icon: '🎯',
    durationSec: 180,
    rules: {
      segments: [
        { startSec: 0, endSec: 60, color: '#5E3A87', label: 'Ground' },
        { startSec: 60, endSec: 120, color: '#00B4D8', label: 'Execute' },
        { startSec: 120, endSec: 180, color: '#F5A623', label: 'Confirm' },
      ],
      readinessWindow: { startSec: 60, endSec: 120 },
      preventEarlyComplete: true,
      lockEventSec: 60,
      barColor: '#5E3A87',
    },
  },
  CANSLIM: {
    id: 'CANSLIM',
    name: 'CANSLIM Process',
    nameZh: 'CANSLIM 流程',
    icon: '📋',
    durationSec: 300,
    rules: {
      segments: [
        { startSec: 0, endSec: 60, color: '#FF6B35', label: 'Observe' },
        { startSec: 60, endSec: 180, color: '#00B4D8', label: 'Readiness Window' },
        { startSec: 180, endSec: 300, color: '#8E8E93', label: 'Extended' },
      ],
      readinessWindow: { startSec: 60, endSec: 180 },
      preventEarlyComplete: false,
      barColor: '#00B4D8',
    },
  },
  MODE_2: {
    id: 'MODE_2',
    name: 'High-Sensitivity Control',
    nameZh: '高靈敏控制',
    icon: '⚡',
    durationSec: 240,
    rules: {
      segments: [
        { startSec: 0, endSec: 45, color: '#FF6B35', label: 'Quick Read' },
        { startSec: 45, endSec: 150, color: '#00B4D8', label: 'Readiness Window' },
        { startSec: 150, endSec: 240, color: '#8E8E93', label: 'Control' },
      ],
      readinessWindow: { startSec: 45, endSec: 150 },
      preventEarlyComplete: false,
      barColor: '#00B4D8',
    },
  },
};

/**
 * Returns a trader template by ID.
 *
 * @param id - Template identifier.
 * @returns The corresponding TraderTemplate.
 */
export function getTraderTemplate(id: TraderTemplateId): TraderTemplate {
  return TRADER_TEMPLATES[id];
}

/**
 * Returns all trader templates as an array.
 *
 * @returns Array of TraderTemplate.
 */
export function getAllTraderTemplates(): TraderTemplate[] {
  return Object.values(TRADER_TEMPLATES);
}
