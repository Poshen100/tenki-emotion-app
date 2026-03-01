// Design tokens based on ANTIGRAVITY.md specs
export const TENKI_THEME = {
    zones: {
        peak: { bg: '#F5A623', text: '#FFFFFF', range: [80, 99] },
        optimal: { bg: '#00B4D8', text: '#FFFFFF', range: [55, 79] },
        neutral: { bg: '#E5E5EA', text: '#1C1C1E', range: [35, 54] },
        degraded: { bg: '#5E3A87', text: '#FFFFFF', range: [1, 34] },
    },
    fdcb: {
        height: 72,
        expandedHeight: 200,
        background: 'rgba(28, 28, 30, 0.92)',
        blur: 20,
        completeFlash: '#34C759',
        dotActive: '#FFFFFF',
        dotInactive: '#48484A',
        dotCheckmark: '#34C759',
    },
    typography: {
        teiScore: { fontSize: 72, fontWeight: '200', fontFamily: 'SF Pro Display' },
        fdcbTimer: { fontSize: 28, fontWeight: '600', fontFamily: 'SF Pro Display', fontVariant: ['tabular-nums'] },
        fdcbLabel: { fontSize: 11, fontWeight: '500' },
        bodyText: { fontSize: 15, fontWeight: '400', fontFamily: 'SF Pro Text' },
        caption: { fontSize: 11, fontWeight: '400', color: '#8E8E93' },
    },
    animation: {
        scoreTransition: { type: 'ewma', alpha: 0.05 },
        messageInterval: 3000,
        warmUp: 8000,
        fdcbComplete: 800,
    },
    colors: {
        background: '#000000', surface: '#1C1C1E', card: '#2C2C2E',
        border: '#38383A', primary: '#00B4D8',
        textPrimary: '#FFFFFF', textSecondary: '#8E8E93',
    }
};
