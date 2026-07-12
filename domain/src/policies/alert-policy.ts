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

  if (!input.featureFlagEnabled) {
    return { decision: 'silent_received', reason: 'feature flag disabled' };
  }

  if (!input.tierAllowsAlerts) {
    return { decision: 'silent_received', reason: 'tier does not include external alert bridge' };
  }

  if (input.sessionActive) {
    return { decision: 'silent_received', reason: 'decision session in progress' };
  }

  if (zone === 'strain') {
    return { decision: 'silent_received', reason: 'strain zone — receive without interrupting' };
  }

  const lastSurfacedAtMs = throttleState.lastSurfacedAtMsBySymbol[alert.symbol];
  if (lastSurfacedAtMs !== undefined && nowMs - lastSurfacedAtMs < ALERT_COOLDOWN_SEC * 1000) {
    return { decision: 'suppressed_cooldown', reason: 'same-symbol cooldown active' };
  }

  if (surfacedCountForDay(throttleState, nowMs) >= ALERT_DAILY_SURFACE_CAP) {
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
