/**
 * @module events
 * @description FDCB 事件紀錄系統 (Micro Events)。
 * 負責 Session 建立、事件新增（含 entry lock 攔截）、Session 完成。
 */

import type { AddEventResult, DecisionEvent, DecisionSession, DecisionTemplate, EventType, TemplateId } from './types';

/**
 * 建立新的決策 Session。
 * @param templateId - 使用的模板 ID
 * @param teiAtStart - 開始時的 TEI PR 值
 * @returns 新建的 DecisionSession（狀態為未完成、事件為空）
 */
export function createSession(templateId: TemplateId, teiAtStart: number): DecisionSession {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        templateId,
        teiAtStart,
        teiAtEnd: null,
        events: [],
        startedAt: Date.now(),
        endedAt: null,
        durationSec: 0,
        result: null,
        completed: false,
    };
}

/**
 * 新增事件至 Session。
 *
 * **Entry Lock 規則**：
 * - 當 `type === 'ENTRY'` 且 `elapsedSec < template.rules.lockEntrySec` 時，
 *   事件被拒絕，回傳 `{ session: 原session, accepted: false }`。
 * - 其他情況正常新增事件。
 *
 * @param session - 當前的 DecisionSession
 * @param type - 事件類型
 * @param elapsedSec - 事件發生時的已過秒數
 * @param teiAtEvent - 事件發生時的 TEI PR 值（snapshot）
 * @param template - 當前使用的模板（用於 entry lock 判斷）
 * @returns AddEventResult — 包含更新後的 session 和是否被接受
 */
export function addEvent(
    session: DecisionSession,
    type: EventType,
    elapsedSec: number,
    teiAtEvent: number,
    template: DecisionTemplate
): AddEventResult {
    // Entry Lock 檢查：ENTRY 事件在 lockEntrySec 內被拒絕
    if (type === 'ENTRY' && template.rules.lockEntrySec !== undefined) {
        if (elapsedSec < template.rules.lockEntrySec) {
            return { session, accepted: false };
        }
    }

    const newEvent: DecisionEvent = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        type,
        elapsedSec,
        teiAtEvent,
        timestamp: Date.now(),
    };

    return {
        session: {
            ...session,
            events: [...session.events, newEvent],
        },
        accepted: true,
    };
}

/**
 * 完成（關閉）一個 Session。
 * @param session - 當前的 DecisionSession
 * @param teiAtEnd - 結束時的 TEI PR 值
 * @param elapsedSec - 總計過秒數
 * @param result - 決策結果（可選，預設 null）
 * @returns 已完成的 DecisionSession
 */
export function completeSession(
    session: DecisionSession,
    teiAtEnd: number,
    elapsedSec: number,
    result: DecisionSession['result'] = null
): DecisionSession {
    return {
        ...session,
        teiAtEnd,
        endedAt: Date.now(),
        durationSec: elapsedSec,
        result,
        completed: true,
    };
}
