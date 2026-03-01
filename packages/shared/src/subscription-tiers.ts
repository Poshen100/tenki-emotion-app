export type SubscriptionTier = 'free' | 'retail' | 'pro';

export interface TierConfig {
    id: SubscriptionTier;
    pricePerMonth: number;
    scansPerDay: number | 'unlimited';
    features: {
        fullTei: boolean;
        historyDays: number;
        bentoDashboard: boolean;
        bluetoothIntegration: boolean;
        fdcb: {
            visible: boolean;
            basicTimer: boolean;
            templatesLimit: number | 'unlimited';
            eventLogging: boolean;
            miniTimeline: boolean;
            teiBucketStats: boolean;
            decisionInsights: boolean;
        };
        csvExport: boolean;
    };
}

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
        }
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
        }
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
        }
    }
};
