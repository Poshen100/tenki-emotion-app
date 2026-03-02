/**
 * @module subscription-tiers
 * @description 訂閱方案定義。
 * 對應 ANTIGRAVITY.md Section 1.3 + 5.10。
 * Free / Retail ($9) / Pro ($22) 三級。
 */

/** 訂閱等級 */
export type SubscriptionTier = 'free' | 'retail' | 'pro';

/** 單一等級的完整設定 */
export interface TierConfig {
    /** 等級 ID */
    id: SubscriptionTier;
    /** 月費 (USD) */
    pricePerMonth: number;
    /** 每日掃描次數上限 */
    scansPerDay: number | 'unlimited';
    /** 功能開關 */
    features: {
        /** 是否提供完整 TEI 分析 */
        fullTei: boolean;
        /** 歷史紀錄天數 */
        historyDays: number;
        /** Bento 儀表板 */
        bentoDashboard: boolean;
        /** 藍牙整合 */
        bluetoothIntegration: boolean;
        /** FDCB 功能分級 */
        fdcb: {
            /** FDCB 是否可見 */
            visible: boolean;
            /** 基礎計時功能 */
            basicTimer: boolean;
            /** 模板數量上限 */
            templatesLimit: number | 'unlimited';
            /** 事件 ✔ 紀錄 */
            eventLogging: boolean;
            /** Mini Timeline */
            miniTimeline: boolean;
            /** TEI Bucket 統計 */
            teiBucketStats: boolean;
            /** 決策洞察 */
            decisionInsights: boolean;
        };
        /** CSV 匯出 */
        csvExport: boolean;
    };
}

/**
 * 三個訂閱等級的完整定義。
 * @see ANTIGRAVITY.md Section 1.3 — 價格與功能
 * @see ANTIGRAVITY.md Section 5.10 — FDCB Tier Gating
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
    free: {
        id: 'free',
        pricePerMonth: 0,
        scansPerDay: 1,
        features: {
            fullTei: false,
            historyDays: 7,
            bentoDashboard: false,
            bluetoothIntegration: false,
            fdcb: {
                visible: false,
                basicTimer: false,
                templatesLimit: 0,
                eventLogging: false,
                miniTimeline: false,
                teiBucketStats: false,
                decisionInsights: false,
            },
            csvExport: false,
        },
    },
    retail: {
        id: 'retail',
        pricePerMonth: 9,
        scansPerDay: 3,
        features: {
            fullTei: true,
            historyDays: 21,
            bentoDashboard: true,
            bluetoothIntegration: false,
            fdcb: {
                visible: true,
                basicTimer: true,
                templatesLimit: 1,
                eventLogging: false,
                miniTimeline: false,
                teiBucketStats: false,
                decisionInsights: false,
            },
            csvExport: false,
        },
    },
    pro: {
        id: 'pro',
        pricePerMonth: 22,
        scansPerDay: 'unlimited',
        features: {
            fullTei: true,
            historyDays: 365,
            bentoDashboard: true,
            bluetoothIntegration: true,
            fdcb: {
                visible: true,
                basicTimer: true,
                templatesLimit: 'unlimited',
                eventLogging: true,
                miniTimeline: true,
                teiBucketStats: true,
                decisionInsights: true,
            },
            csvExport: true,
        },
    },
};
