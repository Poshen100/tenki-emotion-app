export type ZoneName = 'peak' | 'optimal' | 'neutral' | 'degraded';

export interface ZoneIndicator {
    name: ZoneName;
    label: string;
    min: number;
    max: number;
    recommendation: string;
}

export const ZONE_CONFIG: ZoneIndicator[] = [
    {
        name: 'peak',
        label: 'Peak Zone ⚠️ 高能警戒',
        min: 80,
        max: 99,
        recommendation: '可交易，但需雙重確認（過度自信風險）'
    },
    {
        name: 'optimal',
        label: 'Optimal Zone ✅ 最佳交易帶',
        min: 55,
        max: 79,
        recommendation: '理想執行區，全功能解鎖'
    },
    {
        name: 'neutral',
        label: 'Neutral Zone ⏸️ 中性區',
        min: 35,
        max: 54,
        recommendation: '僅執行 A+ Setup，倉位 50%'
    },
    {
        name: 'degraded',
        label: 'Degraded Zone 🔁 低能區',
        min: 1,
        max: 34,
        recommendation: '暫停交易，啟動呼吸校準'
    }
];

export function getZoneByTei(tei: number): ZoneIndicator {
    return ZONE_CONFIG.find(z => tei >= z.min && tei <= z.max) || ZONE_CONFIG[3]; // fallback to degraded
}
