/**
 * @module timer
 * @description FDCB 計時器狀態機邏輯。
 * 狀態路徑：IDLE → READY → RUNNING → COMPLETE → IDLE
 */

import { DecisionTemplate, FdcbState, TemplateSegment } from './types';

/**
 * 判斷是否可以從當前狀態啟動計時器。
 * 只有 READY 狀態可以啟動。
 * @param state - 當前 FDCB 狀態
 * @returns 是否可以啟動
 */
export function canStart(state: FdcbState): boolean {
    return state === 'READY';
}

/**
 * 判斷是否可以完成（結束）當前計時。
 * 必須在 RUNNING 狀態，且如果模板設定 preventEarlyComplete，
 * 則必須等到計時結束才能完成。
 * @param state - 當前 FDCB 狀態
 * @param elapsedSec - 已過秒數
 * @param template - 當前使用的模板
 * @returns 是否可以完成
 */
export function canComplete(state: FdcbState, elapsedSec: number, template: DecisionTemplate): boolean {
    if (state !== 'RUNNING') return false;
    if (template.rules.preventEarlyComplete && elapsedSec < template.durationSec) {
        return false;
    }
    return true;
}

/**
 * 取得當前所在的時間段落。
 * 如果已超過模板時長，回傳最後一個段落。
 * @param template - 當前使用的模板
 * @param elapsedSec - 已過秒數
 * @returns 當前段落，或 null（無段落定義時）
 */
export function getCurrentSegment(template: DecisionTemplate, elapsedSec: number): TemplateSegment | null {
    for (const segment of template.rules.segments) {
        if (elapsedSec >= segment.startSec && elapsedSec < segment.endSec) {
            return segment;
        }
    }
    // If at the exact end or beyond, return the last segment
    if (elapsedSec >= template.durationSec && template.rules.segments.length > 0) {
        return template.rules.segments[template.rules.segments.length - 1];
    }
    return null;
}

/**
 * 判斷當前是否在甜蜜區內。
 * @param template - 當前使用的模板
 * @param elapsedSec - 已過秒數
 * @returns 是否在甜蜜區
 */
export function isInSweetZone(template: DecisionTemplate, elapsedSec: number): boolean {
    if (!template.rules.sweetZone) return false;
    return elapsedSec >= template.rules.sweetZone.startSec && elapsedSec < template.rules.sweetZone.endSec;
}

/**
 * 判斷 Entry 是否被鎖定。
 * 當模板設定 lockEntrySec 時，前 N 秒內 Entry 操作會被拒絕。
 * @param template - 當前使用的模板
 * @param elapsedSec - 已過秒數
 * @returns 是否被鎖定
 */
export function isEntryLocked(template: DecisionTemplate, elapsedSec: number): boolean {
    if (template.rules.lockEntrySec === undefined) return false;
    return elapsedSec < template.rules.lockEntrySec;
}

/**
 * 判斷是否應觸發呼吸引導。
 * 僅在 elapsedSec 剛好等於 breathTriggerSec 時觸發（邊緣觸發）。
 * @param template - 當前使用的模板
 * @param elapsedSec - 已過秒數
 * @returns 是否應觸發呼吸引導
 */
export function shouldTriggerBreath(template: DecisionTemplate, elapsedSec: number): boolean {
    if (template.rules.breathTriggerSec === undefined) return false;
    return elapsedSec === template.rules.breathTriggerSec;
}

/**
 * 判斷計時器是否已逾時（超過模板總時長）。
 * @param template - 當前使用的模板
 * @param elapsedSec - 已過秒數
 * @returns 是否已逾時
 */
export function isTimeout(template: DecisionTemplate, elapsedSec: number): boolean {
    return elapsedSec >= template.durationSec;
}

/**
 * 計算下一個狀態轉換。
 * IDLE → (selectTemplate) → READY → (startTimer) → RUNNING → (complete/timeout) → COMPLETE → (0.8s auto) → IDLE
 * @param currentState - 當前狀態
 * @param action - 觸發的動作
 * @returns 下一個狀態
 */
export function nextState(
    currentState: FdcbState,
    action: 'SELECT_TEMPLATE' | 'START_TIMER' | 'COMPLETE' | 'TIMEOUT' | 'RESET'
): FdcbState {
    switch (action) {
        case 'SELECT_TEMPLATE':
            return currentState === 'IDLE' ? 'READY' : currentState;
        case 'START_TIMER':
            return currentState === 'READY' ? 'RUNNING' : currentState;
        case 'COMPLETE':
        case 'TIMEOUT':
            return currentState === 'RUNNING' ? 'COMPLETE' : currentState;
        case 'RESET':
            return 'IDLE';
        default:
            return currentState;
    }
}
