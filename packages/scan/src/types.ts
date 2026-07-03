/**
 * @module types
 * @description FDCB (Floating Decision Control Bar) 所有型別定義。
 * 對應 ANTIGRAVITY.md Section 5.4。
 */

/** 六個預設情境模板的唯一識別 ID */
export type TemplateId =
  | 'CANSLIM_GS' | 'CANSLIM_HIGH_RS' | 'MANCINI_FBD'
  | 'WORK_FOCUS' | 'HEALTH_STRESS' | 'EXERCISE';

/** 模板進度條的單一時間段落 */
export interface TemplateSegment {
  /** 段落起始秒數 (含) */
  startSec: number;
  /** 段落結束秒數 (不含) */
  endSec: number;
  /** 段落對應的 UI 色彩 (hex) */
  color: string;
  /** 段落顯示名稱 */
  label: string;
}

/** 模板的「甜蜜區」時間範圍 — 最佳決策窗口 */
export interface TemplateSweetZone {
  /** 甜蜜區起始秒數 (含) */
  startSec: number;
  /** 甜蜜區結束秒數 (不含) */
  endSec: number;
}

/** 模板規則定義 — 控制計時器行為、鎖定邏輯、UI 外觀 */
export interface TemplateRules {
  /** 時間段落陣列，覆蓋整個模板時長 */
  segments: TemplateSegment[];
  /** 甜蜜區時間範圍（可選） */
  sweetZone?: TemplateSweetZone;
  /** 是否防止提前完成（true = 必須跑完全部時間） */
  preventEarlyComplete: boolean;
  /** 鎖定 Entry 的前 N 秒（可選，如 Mancini FBD 的 60 秒） */
  lockEntrySec?: number;
  /** 計時器逾時後的動作 */
  timeoutAction?: 'log_patience' | 'log_timeout' | 'none';
  /** 觸發呼吸引導的秒數（可選，如 HEALTH_STRESS 的 0 秒） */
  breathTriggerSec?: number;
  /** FDCB 浮動條的主色 (hex) */
  barColor: string;
}

/** 單一情境模板的完整定義 */
export interface DecisionTemplate {
  /** 模板唯一 ID */
  id: TemplateId;
  /** 模板英文名稱 */
  name: string;
  /** 模板繁體中文名稱 */
  nameZh: string;
  /** 模板 icon (emoji) */
  icon: string;
  /** 模板總時長 (秒) */
  durationSec: number;
  /** 模板分類：交易 或 生活 */
  category: 'trading' | 'lifestyle';
  /** 模板規則 */
  rules: TemplateRules;
}

/** 決策事件類型：進場 / 加碼 / 減碼 / 出場 / 取消 / 不交易 */
export type EventType = 'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE';

/** 決策結果：贏 / 輸 / 持平 / 不交易 / 未結算 */
export type SessionResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE' | null;

/** FDCB 狀態機四狀態 */
export type FdcbState = 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETE';

/** 單一決策事件紀錄 */
export interface DecisionEvent {
  /** 事件唯一 ID */
  id: string;
  /** 事件類型 */
  type: EventType;
  /** 事件發生時的已過秒數 */
  elapsedSec: number;
  /** 事件發生時的 Edge Score 值 */
  edgeScoreAtEvent: number;
  /** 事件發生的時間戳 (Unix ms) */
  timestamp: number;
}

/** 單一決策 Session 的完整紀錄 */
export interface DecisionSession {
  /** Session 唯一 ID */
  id: string;
  /** 使用的模板 ID */
  templateId: TemplateId;
  /** 開始時的 Edge Score 值 */
  edgeScoreAtStart: number;
  /** 結束時的 Edge Score 值（未結束為 null） */
  edgeScoreAtEnd: number | null;
  /** Session 中的所有事件 */
  events: DecisionEvent[];
  /** Session 開始時間戳 (Unix ms) */
  startedAt: number;
  /** Session 結束時間戳 (Unix ms)（未結束為 null） */
  endedAt: number | null;
  /** Session 總時長 (秒) */
  durationSec: number;
  /** Session 結果 */
  result: SessionResult;
  /** 是否已完成 */
  completed: boolean;
}

/**
 * addEvent 的回傳結果。
 * accepted 為 false 表示事件被拒絕（例如 entry lock 期間）。
 */
export interface AddEventResult {
  /** 更新後的 session（如被拒絕則為原 session 不變） */
  session: DecisionSession;
  /** 事件是否被接受 */
  accepted: boolean;
}
