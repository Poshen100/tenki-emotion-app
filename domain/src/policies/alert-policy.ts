/**
 * @module domain/policies/alert-policy
 * @description Delivery policy for external alerts. Decides whether an
 * incoming alert may open a decision environment (surface a panel) or is
 * received silently. Pure functions — throttle state is held by the caller
 * and passed in, mirroring the engine gate/edge-detector idiom.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md §5.
 */

import type {
  AlertContract,
  DomainAlertDeliveryDecision,
} from '../contracts/alert-contract';
import type { DomainEdgeZone } from '../contracts/scan-contract';

/** Minimum seconds between surfaced alerts for the same symbol. */
export const ALERT_COOLDOWN_SEC = 300;

/** Window in which multiple alerts are grouped into one aggregate card. */
export const ALERT_AGGREGATION_WINDOW_SEC = 60;

/** Maximum alerts surfaced per day; beyond this, alerts are received silently. */
export const ALERT_DAILY_SURFACE_CAP = 10;

/**
 * User-adjustable delivery settings (persisted client-side; the constants
 * above are the defaults). Lets a user tune their own decision rhythm without
 * changing the canonical defaults.
 */
export interface AlertDeliverySettings {
  /** Minimum seconds between surfaced alerts for the same symbol. */
  cooldownSec: number;
  /** Maximum alerts surfaced per day. */
  dailySurfaceCap: number;
  /** Aggregation grouping window in seconds. */
  aggregationWindowSec: number;
  /** When true (default), strain zone receives silently — a protective guard. */
  strainSilent: boolean;
  /** When true (default), same-symbol alerts during a session become quiet updates. */
  sessionQuietUpdate: boolean;
}

/**
 * Builds the default delivery settings from the canonical constants.
 *
 * @returns Fresh default settings.
 */
export function createDefaultAlertSettings(): AlertDeliverySettings {
  return {
    cooldownSec: ALERT_COOLDOWN_SEC,
    dailySurfaceCap: ALERT_DAILY_SURFACE_CAP,
    aggregationWindowSec: ALERT_AGGREGATION_WINDOW_SEC,
    strainSilent: true,
    sessionQuietUpdate: true,
  };
}

/** Timezone the quiet window is anchored to (Adam Mancini ES session). */
export const QUIET_WINDOW_TZ = 'America/New_York';
/** Quiet window start hour (inclusive), ET. */
export const QUIET_WINDOW_START_HOUR = 11;
/** Quiet window end hour (exclusive), ET. */
export const QUIET_WINDOW_END_HOUR = 14;
/** Soft context line shown for alerts arriving in the quiet window (a fact, not advice). */
export const QUIET_WINDOW_CONTEXT_ZH = '盤整迴避時段';

/**
 * Whether the given instant falls in the ET quiet window (11:00–14:00,
 * DST-aware via Intl). Used as a soft context annotation — it never silences
 * an alert, only adds a "盤整迴避時段" fact line.
 *
 * @param nowMs - Instant to test (Unix ms).
 * @returns True when within 11:00–14:00 America/New_York.
 */
export function isWithinQuietWindowET(nowMs: number): boolean {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: QUIET_WINDOW_TZ,
    hour: 'numeric',
    hour12: false,
  }).format(new Date(nowMs));
  const parsed = Number(formatted);
  const hour = parsed === 24 ? 0 : parsed;
  return hour >= QUIET_WINDOW_START_HOUR && hour < QUIET_WINDOW_END_HOUR;
}

/** Caller-held throttle state for alert surfacing. */
export interface AlertThrottleState {
  /** Last surfaced timestamp (Unix ms) per normalized symbol. */
  lastSurfacedAtMsBySymbol: Record<string, number>;
  /** Alerts surfaced during the current day key. */
  surfacedTodayCount: number;
  /** UTC day key (YYYY-MM-DD) the count belongs to. */
  dayKey: string;
}

/** Input for a single-alert delivery evaluation. */
export interface AlertDeliveryInput {
  alert: AlertContract;
  /** User's current Decision Edge Score zone (from the latest scan). */
  zone: DomainEdgeZone;
  throttleState: AlertThrottleState;
  nowMs: number;
  /** `tradingview_alerts_v1` feature flag state. */
  featureFlagEnabled: boolean;
  /** Whether the subscription tier includes the external alert bridge. */
  tierAllowsAlerts: boolean;
  /** True while a decision session is active — alerts never interrupt it. */
  sessionActive: boolean;
  /**
   * Symbol of the in-progress decision session, or null when none.
   * A same-symbol alert arriving during that session becomes a quiet
   * context update instead of a silent chip (the 7553/7547 scenario).
   */
  activeSessionSymbol: string | null;
  /** User-adjustable delivery settings; defaults are used when omitted. */
  settings?: AlertDeliverySettings;
}

/** Result of a delivery evaluation. */
export interface AlertDeliveryEvaluation {
  decision: DomainAlertDeliveryDecision;
  reason: string;
}

/**
 * Resolves the UTC day key used for daily surface counting.
 *
 * @param nowMs - Current time (Unix ms).
 * @returns Day key in YYYY-MM-DD form.
 */
export function resolveAlertDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Creates an empty throttle state anchored to the given time.
 *
 * @param nowMs - Current time (Unix ms).
 * @returns Fresh throttle state.
 */
export function createEmptyAlertThrottleState(nowMs: number): AlertThrottleState {
  return {
    lastSurfacedAtMsBySymbol: {},
    surfacedTodayCount: 0,
    dayKey: resolveAlertDayKey(nowMs),
  };
}

function surfacedCountForDay(state: AlertThrottleState, nowMs: number): number {
  return state.dayKey === resolveAlertDayKey(nowMs) ? state.surfacedTodayCount : 0;
}

/**
 * Evaluates whether an alert may surface a decision entry panel.
 * Check order: feature flag → tier → active session → strain zone →
 * per-symbol cooldown → daily cap → surfaced.
 *
 * @param input - Alert, user state, and caller-held throttle state.
 * @returns Delivery decision with a short internal reason.
 */
export function evaluateAlertDelivery(input: AlertDeliveryInput): AlertDeliveryEvaluation {
  const { alert, zone, throttleState, nowMs } = input;
  const settings = input.settings ?? createDefaultAlertSettings();

  if (!input.featureFlagEnabled) {
    return { decision: 'silent_received', reason: 'feature flag disabled' };
  }

  if (!input.tierAllowsAlerts) {
    return { decision: 'silent_received', reason: 'tier does not include external alert bridge' };
  }

  if (input.sessionActive) {
    if (
      settings.sessionQuietUpdate &&
      input.activeSessionSymbol !== null &&
      input.activeSessionSymbol === alert.symbol
    ) {
      return {
        decision: 'session_quiet_update',
        reason: 'same-symbol update during active session',
      };
    }
    return { decision: 'silent_received', reason: 'decision session in progress' };
  }

  if (settings.strainSilent && zone === 'strain') {
    return { decision: 'silent_received', reason: 'strain zone — receive without interrupting' };
  }

  const lastSurfacedAtMs = throttleState.lastSurfacedAtMsBySymbol[alert.symbol];
  if (lastSurfacedAtMs !== undefined && nowMs - lastSurfacedAtMs < settings.cooldownSec * 1000) {
    return { decision: 'suppressed_cooldown', reason: 'same-symbol cooldown active' };
  }

  if (surfacedCountForDay(throttleState, nowMs) >= settings.dailySurfaceCap) {
    return { decision: 'silent_received', reason: 'daily surface cap reached' };
  }

  return { decision: 'surfaced', reason: 'all delivery checks passed' };
}

/**
 * Returns the throttle state after surfacing an alert for a symbol.
 * Handles day rollover by resetting the daily count.
 *
 * @param state - Previous throttle state.
 * @param symbol - Normalized alert symbol.
 * @param nowMs - Surface time (Unix ms).
 * @returns New throttle state (input is not mutated).
 */
export function recordAlertSurfaced(
  state: AlertThrottleState,
  symbol: string,
  nowMs: number,
): AlertThrottleState {
  return {
    lastSurfacedAtMsBySymbol: {
      ...state.lastSurfacedAtMsBySymbol,
      [symbol]: nowMs,
    },
    surfacedTodayCount: surfacedCountForDay(state, nowMs) + 1,
    dayKey: resolveAlertDayKey(nowMs),
  };
}

/**
 * Groups alerts received close together into aggregation groups.
 * Alerts within `windowSec` of a group's first alert join that group;
 * a group of 2+ alerts should render as one aggregate card.
 *
 * @param alerts - Alerts sorted or unsorted; grouped by receivedAt.
 * @param windowSec - Aggregation window (defaults to ALERT_AGGREGATION_WINDOW_SEC).
 * @returns Groups ordered by first receive time.
 */
export function groupSimultaneousAlerts(
  alerts: readonly AlertContract[],
  windowSec: number = ALERT_AGGREGATION_WINDOW_SEC,
): AlertContract[][] {
  const sorted = [...alerts].sort((a, b) => a.receivedAt - b.receivedAt);
  const groups: AlertContract[][] = [];

  for (const alert of sorted) {
    const currentGroup = groups[groups.length - 1];
    if (
      currentGroup !== undefined &&
      alert.receivedAt - currentGroup[0].receivedAt <= windowSec * 1000
    ) {
      currentGroup.push(alert);
    } else {
      groups.push([alert]);
    }
  }

  return groups;
}
