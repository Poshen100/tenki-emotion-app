/**
 * @module analytics
 * @description Edge Bucket 統計與決策洞察。
 * 用途："在 Edge Score 70-75 時，你通常在 90-150 秒內進場，勝率 62%"
 */

import type { DecisionSession, TemplateId } from './types';
import { EDGE_BUCKET_BOUNDARIES } from './constants';

/**
 * 取得 Edge Score 值對應的 Bucket 標籤。
 * Bucket 由高到低依序比對，符合第一個 min 值即回傳。
 * @param edgeScore - Edge Score 值 (0-100)
 * @returns Bucket 標籤字串（如 '70-75'）
 */
export function getEdgeBucket(edgeScore: number): string {
    for (const boundary of EDGE_BUCKET_BOUNDARIES) {
        if (edgeScore >= boundary.min) {
            return boundary.label;
        }
    }
    return '01-34'; // fallback for edge cases
}

/** 單一 Bucket + Template 組合的統計結果 */
export interface SessionStats {
    /** 對應的 Edge Bucket 標籤 */
    edgeBucket: string;
    /** 對應的模板 ID */
    templateId: TemplateId;
    /** 平均首次 ENTRY 秒數 */
    avgEntrySec: number;
    /** 平均每 Session 事件數 */
    avgEventsPerSession: number;
    /** 勝率 (0-1) */
    winRate: number;
    /** 樣本數 */
    sampleCount: number;
}

/**
 * 彙總多個已完成 Session 的統計數據。
 * 以 Edge Bucket + TemplateId 為 key 分組，計算平均進場時間、勝率等。
 *
 * @param sessions - 決策 Session 陣列
 * @returns Record，key 格式為 `{bucket}::{templateId}`，value 為 SessionStats
 */
export function aggregateSessions(sessions: DecisionSession[]): Record<string, SessionStats> {
    const stats: Record<string, {
        bucket: string;
        templateId: TemplateId;
        entrySum: number;
        entries: number;
        events: number;
        wins: number;
        count: number;
    }> = {};

    for (const session of sessions) {
        if (!session.completed) continue;

        const bucket = getEdgeBucket(session.edgeScoreAtStart);
        // Use :: as separator to avoid ambiguity with template IDs that may contain _
        const key = `${bucket}::${session.templateId}`;

        if (!stats[key]) {
            stats[key] = {
                bucket,
                templateId: session.templateId,
                entrySum: 0,
                entries: 0,
                events: 0,
                wins: 0,
                count: 0,
            };
        }

        stats[key].count += 1;
        stats[key].events += session.events.length;

        if (session.result === 'WIN') {
            stats[key].wins += 1;
        }

        // Find first ENTRY event
        const firstEntry = session.events.find(e => e.type === 'ENTRY');
        if (firstEntry) {
            stats[key].entrySum += firstEntry.elapsedSec;
            stats[key].entries += 1;
        }
    }

    const result: Record<string, SessionStats> = {};
    for (const key of Object.keys(stats)) {
        const s = stats[key];

        result[key] = {
            edgeBucket: s.bucket,
            templateId: s.templateId,
            avgEntrySec: s.entries > 0 ? s.entrySum / s.entries : 0,
            avgEventsPerSession: s.events / s.count,
            winRate: s.wins / s.count,
            sampleCount: s.count,
        };
    }

    return result;
}
