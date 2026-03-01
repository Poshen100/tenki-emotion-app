export type TemplateId =
  | 'CANSLIM_GS' | 'CANSLIM_HIGH_RS' | 'MANCINI_FBD'
  | 'WORK_FOCUS' | 'HEALTH_STRESS' | 'EXERCISE';

export interface TemplateSegment {
  startSec: number;
  endSec: number;
  color: string;
  label: string;
}

export interface TemplateSweetZone {
  startSec: number;
  endSec: number;
}

export interface TemplateRules {
  segments: TemplateSegment[];
  sweetZone?: TemplateSweetZone;
  preventEarlyComplete: boolean;
  lockEntrySec?: number;
  timeoutAction?: 'log_patience' | 'log_timeout' | 'none';
  breathTriggerSec?: number;
  barColor: string;
}

export interface DecisionTemplate {
  id: TemplateId;
  name: string;
  nameZh: string;
  icon: string;
  durationSec: number;
  category: 'trading' | 'lifestyle';
  rules: TemplateRules;
}

export type EventType = 'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE';
export type SessionResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE' | null;
export type FdcbState = 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETE';

export interface DecisionEvent {
  id: string;
  type: EventType;
  elapsedSec: number;
  teiAtEvent: number;
  timestamp: number;
}

export interface DecisionSession {
  id: string;
  templateId: TemplateId;
  teiAtStart: number;
  teiAtEnd: number | null;
  events: DecisionEvent[];
  startedAt: number;
  endedAt: number | null;
  durationSec: number;
  result: SessionResult;
  completed: boolean;
}
