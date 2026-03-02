/**
 * @module zone-config
 * @description TEI 狀態區間設定。
 * 對應 ANTIGRAVITY.md Section 1.2 的四級狀態。
 * PEAK (80-99) / OPTIMAL (55-79) / NEUTRAL (35-54) / DEGRADED (1-34)
 */

/** 區間名稱 */
export type ZoneName = 'peak' | 'optimal' | 'neutral' | 'degraded';

/** 單一區間指標定義 */
export interface ZoneIndicator {
    /** 區間名稱 */
    name: ZoneName;
    /** 區間顯示標籤（含 icon） */
    label: string;
    /** TEI PR 最小值（含） */
    min: number;
    /** TEI PR 最大值（含） */
    max: number;
    /** 交易建議文字 */
    recommendation: string;
}

/**
 * 四個 TEI 狀態區間配置，由高到低排列。
 * @see ANTIGRAVITY.md Section 1.2
 */
export const ZONE_CONFIG: readonly ZoneIndicator[] = [
    {
        name: 'peak',
        label: 'Peak Zone ⚠️ 高能警戒',
        min: 80,
        max: 99,
        recommendation: '可交易，但需雙重確認（過度自信風險）',
    },
    {
        name: 'optimal',
        label: 'Optimal Zone ✅ 最佳交易帶',
        min: 55,
        max: 79,
        recommendation: '理想執行區，全功能解鎖',
    },
    {
        name: 'neutral',
        label: 'Neutral Zone ⏸️ 中性區',
        min: 35,
        max: 54,
        recommendation: '僅執行 A+ Setup，倉位 50%',
    },
    {
        name: 'degraded',
        label: 'Degraded Zone 🔁 低能區',
        min: 1,
        max: 34,
        recommendation: '暫停交易，啟動呼吸校準',
    },
];

/**
 * 依 TEI PR 值取得對應的區間指標。
 * @param tei - TEI PR 值 (1-99)
 * @returns 對應的 ZoneIndicator，找不到時 fallback 為 degraded
 */
export function getZoneByTei(tei: number): ZoneIndicator {
    return ZONE_CONFIG.find(z => tei >= z.min && tei <= z.max) || ZONE_CONFIG[3];
}
