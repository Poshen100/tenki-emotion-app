/**
 * @module domain/contracts/alert-contract
 * @description Canonical domain contracts for external alert ingestion
 * (TradingView webhook and simulated sources). An alert is NOT an action
 * signal — it is the trigger that may open a decision environment.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md.
 */

export const DOMAIN_ALERT_SOURCES = ['tradingview', 'manual', 'simulated'] as const;
export type DomainAlertSource = typeof DOMAIN_ALERT_SOURCES[number];

export const DOMAIN_ALERT_PRIORITIES = ['high', 'normal', 'low'] as const;
export type DomainAlertPriority = typeof DOMAIN_ALERT_PRIORITIES[number];

/** Delivery decision produced by the alert delivery policy. */
export const DOMAIN_ALERT_DELIVERY_DECISIONS = [
  'surfaced',
  'silent_received',
  'suppressed_cooldown',
  'session_quiet_update',
  'aggregated',
] as const;
export type DomainAlertDeliveryDecision = typeof DOMAIN_ALERT_DELIVERY_DECISIONS[number];

/** Alert lifecycle states, from ingestion to terminal outcome. */
export const DOMAIN_ALERT_LIFECYCLE_STATES = [
  'received',
  'surfaced',
  'engaged',
  'dismissed',
  'expired',
] as const;
export type DomainAlertLifecycleState = typeof DOMAIN_ALERT_LIFECYCLE_STATES[number];

/** Maximum accepted length for free-form payload strings. */
export const ALERT_PAYLOAD_MAX_STRING_LENGTH = 120;

/**
 * Raw webhook payload contract (the JSON body a TradingView alert posts).
 * Only `symbol` is required; everything else is optional context.
 */
export interface AlertPayloadContract {
  symbol: string;
  price?: number;
  condition?: string;
  timeframe?: string;
  strategy?: string;
  note?: string;
}

/** Metadata supplied by the ingesting layer when normalizing a payload. */
export interface AlertContractMeta {
  id: string;
  source: DomainAlertSource;
  receivedAt: number;
  priority?: DomainAlertPriority;
}

/** Internal canonical alert object used by delivery policy and UI layers. */
export interface AlertContract {
  id: string;
  source: DomainAlertSource;
  symbol: string;
  price: number | null;
  condition: string | null;
  timeframe: string | null;
  strategyHint: string | null;
  note: string | null;
  receivedAt: number;
  priority: DomainAlertPriority;
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds the canonical internal alert object from a validated payload.
 * Throws on structurally invalid input (empty symbol/id, bad timestamps);
 * use `validateAlertPayloadContract` first for untrusted external JSON.
 *
 * @param payload - Validated webhook payload.
 * @param meta - Ingestion metadata (id, source, receive time, priority).
 * @returns Canonical alert contract.
 */
export function buildAlertContract(
  payload: AlertPayloadContract,
  meta: AlertContractMeta,
): AlertContract {
  const symbol = payload.symbol.trim().toUpperCase();
  if (symbol.length === 0) {
    throw new Error('Alert symbol must be a non-empty string');
  }

  if (meta.id.trim().length === 0) {
    throw new Error('Alert id must be a non-empty string');
  }

  if (!Number.isFinite(meta.receivedAt) || meta.receivedAt <= 0) {
    throw new Error('Alert receivedAt must be a positive timestamp');
  }

  if (payload.price !== undefined && !Number.isFinite(payload.price)) {
    throw new Error('Alert price must be a finite number when provided');
  }

  return {
    id: meta.id,
    source: meta.source,
    symbol,
    price: payload.price ?? null,
    condition: normalizeOptionalText(payload.condition),
    timeframe: normalizeOptionalText(payload.timeframe),
    strategyHint: normalizeOptionalText(payload.strategy),
    note: normalizeOptionalText(payload.note),
    receivedAt: meta.receivedAt,
    priority: meta.priority ?? 'normal',
  };
}
