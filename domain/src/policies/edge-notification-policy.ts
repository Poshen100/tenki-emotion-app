/**
 * @module domain/policies/edge-notification-policy
 * @description Delivery policy for Edge Detector notifications — the wellness
 * side of notification throttling.
 *
 * This is deliberately separate from `alert-policy.ts`, which governs the
 * TradingView external-alert bridge. That policy is keyed on trading symbols
 * and gated behind the `tradingview_alerts_v1` flag; routing a physiological
 * state notification through it would mean giving wellness delivery a
 * symbol-shaped primary key it has no use for. The two never share state and
 * never share constants.
 *
 * Quiet hours here are anchored to the USER'S LOCAL time, not to any market
 * session, and the daily counter rolls over at the user's local midnight — a
 * UTC day key would reset a UTC+8 user's allowance at eight in the morning.
 *
 * Pure functions; throttle state is held by the caller and passed in, mirroring
 * the engine gate and edge-detector idiom.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §7.3
 */

import {
  type EdgeDetectedEvent,
  isLiveAlertEligible,
} from '../contracts/edge-event-contract';

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

/** Minimum seconds between delivered edge notifications. */
export const EDGE_NOTIFICATION_COOLDOWN_SEC = 1800;

/** Maximum edge notifications delivered per local day. */
export const EDGE_NOTIFICATION_DAILY_CAP = 3;

/** Default quiet hours start (inclusive), local hour. */
export const DEFAULT_QUIET_HOURS_START = 22;

/** Default quiet hours end (exclusive), local hour. */
export const DEFAULT_QUIET_HOURS_END = 7;

/**
 * User-adjustable notification settings, persisted client-side. The constants
 * above are the defaults.
 */
export interface EdgeNotificationSettings {
  /** Quiet hours start (inclusive), 0–23 in the user's local time. */
  quietHoursStart: number;
  /** Quiet hours end (exclusive), 0–23 in the user's local time. */
  quietHoursEnd: number;
  /** Maximum notifications per local day. */
  dailyCap: number;
  /** Minimum seconds between notifications. */
  cooldownSec: number;
  /**
   * When true, quiet hours widen to cover a sleep window observed from
   * HealthKit rather than only the configured hours. Someone whose sleep runs
   * later than their configured quiet hours should not be woken by the app.
   */
  respectSleepWindow: boolean;
}

/**
 * Builds default notification settings.
 *
 * @returns Fresh default settings.
 */
export function createDefaultEdgeNotificationSettings(): EdgeNotificationSettings {
  return {
    quietHoursStart: DEFAULT_QUIET_HOURS_START,
    quietHoursEnd: DEFAULT_QUIET_HOURS_END,
    dailyCap: EDGE_NOTIFICATION_DAILY_CAP,
    cooldownSec: EDGE_NOTIFICATION_COOLDOWN_SEC,
    respectSleepWindow: true,
  };
}

// ─────────────────────────────────────────────
// Quiet hours
// ─────────────────────────────────────────────

/**
 * Whether a local hour falls inside a quiet window.
 *
 * Handles windows that cross midnight, which the common case (22:00–07:00)
 * always does: when start > end the window is the union of [start, 24) and
 * [0, end) rather than an empty range.
 *
 * @param localHour - Hour in the user's local time, 0–23.
 * @param start - Quiet hours start (inclusive).
 * @param end - Quiet hours end (exclusive).
 * @returns True when the hour is inside the quiet window.
 */
export function isWithinQuietHours(
  localHour: number,
  start: number,
  end: number
): boolean {
  if (start === end) return false;
  if (start < end) return localHour >= start && localHour < end;
  return localHour >= start || localHour < end;
}

// ─────────────────────────────────────────────
// Throttle state
// ─────────────────────────────────────────────

/** Caller-held throttle state for edge notifications. */
export interface EdgeNotificationThrottleState {
  /** Epoch ms of the last delivered notification, or null if never. */
  lastNotifiedAtMs: number | null;
  /** Notifications delivered during the current local day key. */
  notifiedTodayCount: number;
  /** Local day key (YYYY-MM-DD) the count belongs to. */
  dayKey: string;
}

/**
 * Resolves the local day key used for daily counting.
 *
 * Takes the local calendar date rather than deriving one from the epoch, so a
 * caller in any timezone rolls over at their own midnight.
 *
 * @param localYear - Local calendar year.
 * @param localMonth - Local calendar month, 1–12.
 * @param localDay - Local calendar day of month, 1–31.
 * @returns Day key in YYYY-MM-DD form.
 */
export function resolveEdgeNotificationDayKey(
  localYear: number,
  localMonth: number,
  localDay: number
): string {
  const mm = String(localMonth).padStart(2, '0');
  const dd = String(localDay).padStart(2, '0');
  return `${localYear}-${mm}-${dd}`;
}

/**
 * Creates an empty throttle state for a given local day.
 *
 * @param dayKey - Local day key from `resolveEdgeNotificationDayKey`.
 * @returns Fresh throttle state.
 */
export function createEmptyEdgeNotificationState(
  dayKey: string
): EdgeNotificationThrottleState {
  return { lastNotifiedAtMs: null, notifiedTodayCount: 0, dayKey };
}

/** Count delivered on the given day, treating a stale day key as zero. */
function countForDay(
  state: EdgeNotificationThrottleState,
  dayKey: string
): number {
  return state.dayKey === dayKey ? state.notifiedTodayCount : 0;
}

// ─────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────

/** Possible outcomes of a delivery evaluation. */
export const EDGE_NOTIFICATION_DECISIONS = ['deliver', 'withhold'] as const;
export type EdgeNotificationDecision = typeof EDGE_NOTIFICATION_DECISIONS[number];

/** Why a notification was withheld. */
export const EDGE_WITHHOLD_REASONS = [
  'tier_excludes_alerts',
  'background_event',
  'session_active',
  'quiet_hours',
  'cooldown',
  'daily_cap',
] as const;
export type EdgeWithholdReason = typeof EDGE_WITHHOLD_REASONS[number];

/** Input for a single delivery evaluation. */
export interface EdgeNotificationInput {
  /** The confirmed detection event. */
  event: EdgeDetectedEvent;
  /** Whether the subscription tier includes live detector alerts. */
  tierAllowsAlerts: boolean;
  /** True while a decision session is in progress. */
  sessionActive: boolean;
  /** Current hour in the user's local time, 0–23. */
  localHour: number;
  /** Local day key for the current moment. */
  dayKey: string;
  /** Current time, epoch ms. */
  nowMs: number;
  /** Caller-held throttle state. */
  throttleState: EdgeNotificationThrottleState;
  /** User settings; defaults are used when omitted. */
  settings?: EdgeNotificationSettings;
}

/** Result of a delivery evaluation. */
export interface EdgeNotificationEvaluation {
  decision: EdgeNotificationDecision;
  /** Why it was withheld, or null when delivering. */
  reason: EdgeWithholdReason | null;
}

/**
 * Decides whether a confirmed detection may reach the user as a notification.
 *
 * Check order: tier → event is live-eligible → session in progress → quiet
 * hours → cooldown → daily cap.
 *
 * The session check sits high on purpose. Someone already walking through a
 * decision session is the last person who needs an interruption telling them
 * their signals look good — they are already looking.
 *
 * @param input - Event, user state, and caller-held throttle state.
 * @returns The delivery decision.
 */
export function evaluateEdgeNotification(
  input: EdgeNotificationInput
): EdgeNotificationEvaluation {
  const settings = input.settings ?? createDefaultEdgeNotificationSettings();

  if (!input.tierAllowsAlerts) {
    return { decision: 'withhold', reason: 'tier_excludes_alerts' };
  }

  // A background-delivered event describes a window the user may have left
  // half an hour ago; announcing it as live would be a lie about the present.
  if (!isLiveAlertEligible(input.event)) {
    return { decision: 'withhold', reason: 'background_event' };
  }

  if (input.sessionActive) {
    return { decision: 'withhold', reason: 'session_active' };
  }

  if (
    isWithinQuietHours(input.localHour, settings.quietHoursStart, settings.quietHoursEnd)
  ) {
    return { decision: 'withhold', reason: 'quiet_hours' };
  }

  const { lastNotifiedAtMs } = input.throttleState;
  if (
    lastNotifiedAtMs !== null &&
    input.nowMs - lastNotifiedAtMs < settings.cooldownSec * 1000
  ) {
    return { decision: 'withhold', reason: 'cooldown' };
  }

  if (countForDay(input.throttleState, input.dayKey) >= settings.dailyCap) {
    return { decision: 'withhold', reason: 'daily_cap' };
  }

  return { decision: 'deliver', reason: null };
}

/**
 * Returns the throttle state after a notification is delivered.
 * Handles local day rollover by resetting the count.
 *
 * @param state - Previous throttle state.
 * @param dayKey - Current local day key.
 * @param nowMs - Delivery time, epoch ms.
 * @returns New throttle state; the input is not mutated.
 */
export function recordEdgeNotificationSent(
  state: EdgeNotificationThrottleState,
  dayKey: string,
  nowMs: number
): EdgeNotificationThrottleState {
  return {
    lastNotifiedAtMs: nowMs,
    notifiedTodayCount: countForDay(state, dayKey) + 1,
    dayKey,
  };
}
