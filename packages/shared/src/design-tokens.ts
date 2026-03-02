/**
 * @module design-tokens
 * @description Tenki Core 設計語彙系統。
 * 對應 ANTIGRAVITY.md Section 9.1 的 TENKI_THEME。
 * 所有 UI 元件應使用此 token 而非硬編碼數值。
 */

/** Tenki Core 全域設計 Token — 包含色彩、字型、動畫、FDCB 配置 */
export const TENKI_THEME = {
    /** TEI 狀態區間色彩與範圍 */
    zones: {
        peak: { bg: '#F5A623', text: '#FFFFFF', range: [80, 99] as const },
        optimal: { bg: '#00B4D8', text: '#FFFFFF', range: [55, 79] as const },
        neutral: { bg: '#E5E5EA', text: '#1C1C1E', range: [35, 54] as const },
        degraded: { bg: '#5E3A87', text: '#FFFFFF', range: [1, 34] as const },
    },
    /** FDCB 浮動條 UI 配置 */
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
    /** 字型系統 */
    typography: {
        teiScore: { fontSize: 72, fontWeight: '200' as const, fontFamily: 'SF Pro Display' },
        fdcbTimer: { fontSize: 28, fontWeight: '600' as const, fontFamily: 'SF Pro Display', fontVariant: ['tabular-nums'] as const },
        fdcbLabel: { fontSize: 11, fontWeight: '500' as const },
        bodyText: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'SF Pro Text' },
        caption: { fontSize: 11, fontWeight: '400' as const, color: '#8E8E93' },
    },
    /** 動畫參數 */
    animation: {
        scoreTransition: { type: 'ewma' as const, alpha: 0.05 },
        messageInterval: 3000,
        warmUp: 8000,
        fdcbComplete: 800,
    },
    /** 基礎色盤 */
    colors: {
        background: '#000000', surface: '#1C1C1E', card: '#2C2C2E',
        border: '#38383A', primary: '#00B4D8',
        textPrimary: '#FFFFFF', textSecondary: '#8E8E93',
    },
} as const;
