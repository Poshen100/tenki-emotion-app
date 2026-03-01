import { DecisionTemplate, TemplateId } from './types';

export const TEMPLATES: Record<TemplateId, DecisionTemplate> = {
    CANSLIM_GS: {
        id: 'CANSLIM_GS',
        name: 'Canslim GS',
        nameZh: 'Canslim 一般設定',
        icon: '📊',
        durationSec: 300,
        category: 'trading',
        rules: {
            segments: [
                { startSec: 0, endSec: 60, color: '#FF6B35', label: 'Observe' },
                { startSec: 60, endSec: 180, color: '#00B4D8', label: 'Sweet Zone' },
                { startSec: 180, endSec: 300, color: '#8E8E93', label: 'Extended' },
            ],
            sweetZone: { startSec: 60, endSec: 180 },
            preventEarlyComplete: false,
            barColor: '#00B4D8',
        },
    },
    CANSLIM_HIGH_RS: {
        id: 'CANSLIM_HIGH_RS',
        name: 'Canslim High RS',
        nameZh: 'Canslim 高RS',
        icon: '🚀',
        durationSec: 240,
        category: 'trading',
        rules: {
            segments: [
                { startSec: 0, endSec: 45, color: '#FF6B35', label: 'Quick Read' },
                { startSec: 45, endSec: 150, color: '#00B4D8', label: 'Sweet Zone' },
                { startSec: 150, endSec: 240, color: '#8E8E93', label: 'Patience' },
            ],
            sweetZone: { startSec: 45, endSec: 150 },
            preventEarlyComplete: false,
            barColor: '#00B4D8',
        },
    },
    MANCINI_FBD: {
        id: 'MANCINI_FBD',
        name: 'Mancini FBD',
        nameZh: 'Mancini 失敗突破',
        icon: '🎯',
        durationSec: 180,
        category: 'trading',
        rules: {
            segments: [
                { startSec: 0, endSec: 60, color: '#5E3A87', label: 'Lock' },
                { startSec: 60, endSec: 120, color: '#00B4D8', label: 'Execute' },
                { startSec: 120, endSec: 180, color: '#F5A623', label: 'Confirm' },
            ],
            sweetZone: { startSec: 60, endSec: 120 },
            preventEarlyComplete: true,
            lockEntrySec: 60,
            timeoutAction: 'log_patience',
            barColor: '#5E3A87',
        },
    },
    WORK_FOCUS: {
        id: 'WORK_FOCUS',
        name: 'Work Focus',
        nameZh: '工作專注模式',
        icon: '💼',
        durationSec: 1500,
        category: 'lifestyle',
        rules: {
            segments: [{ startSec: 0, endSec: 1500, color: '#00B4D8', label: 'Focus' }],
            preventEarlyComplete: false,
            barColor: '#00B4D8',
        },
    },
    HEALTH_STRESS: {
        id: 'HEALTH_STRESS',
        name: 'Health Stress',
        nameZh: '健康壓力模式',
        icon: '🧘',
        durationSec: 180,
        category: 'lifestyle',
        rules: {
            segments: [{ startSec: 0, endSec: 180, color: '#34C759', label: 'Breathe' }],
            preventEarlyComplete: false,
            breathTriggerSec: 0,
            barColor: '#34C759',
        },
    },
    EXERCISE: {
        id: 'EXERCISE',
        name: 'Exercise',
        nameZh: '運動模式',
        icon: '🏃',
        durationSec: 600,
        category: 'lifestyle',
        rules: {
            segments: [
                { startSec: 0, endSec: 120, color: '#34C759', label: 'Warm Up' },
                { startSec: 120, endSec: 480, color: '#FF6B35', label: 'Active' },
                { startSec: 480, endSec: 600, color: '#00B4D8', label: 'Cool Down' },
            ],
            preventEarlyComplete: false,
            barColor: '#FF6B35',
        },
    },
};
