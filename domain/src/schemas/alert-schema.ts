/**
 * @module domain/schemas/alert-schema
 * @description Runtime validation for external alert webhook payloads
 * (TradingView and simulated sources). Dependency-free so it can run
 * on-device or in a future thin ingestion endpoint.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md.
 */

import {
  ALERT_PAYLOAD_MAX_STRING_LENGTH,
  type AlertPayloadContract,
} from '../contracts/alert-contract';
import type { ValidationResult } from './scan-schema';

const OPTIONAL_TEXT_KEYS = ['condition', 'timeframe', 'strategy', 'note'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= ALERT_PAYLOAD_MAX_STRING_LENGTH;
}

/**
 * Validates a raw webhook payload into a typed alert payload contract.
 * Structural checks only — delivery rules live in `alert-policy`.
 *
 * @param input - Unknown external JSON value.
 * @returns Validation result with typed payload on success.
 */
export function validateAlertPayloadContract(
  input: unknown,
): ValidationResult<AlertPayloadContract> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ['alert payload must be an object'] };
  }

  if (!isBoundedText(input.symbol) || input.symbol.trim().length === 0) {
    errors.push(
      `alert payload.symbol must be a non-empty string of at most ${ALERT_PAYLOAD_MAX_STRING_LENGTH} characters`,
    );
  }

  if (input.price !== undefined && !isFiniteNumber(input.price)) {
    errors.push('alert payload.price must be a finite number when provided');
  }

  for (const key of OPTIONAL_TEXT_KEYS) {
    if (input[key] !== undefined && !isBoundedText(input[key])) {
      errors.push(
        `alert payload.${key} must be a string of at most ${ALERT_PAYLOAD_MAX_STRING_LENGTH} characters when provided`,
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const payload = input as Record<string, unknown>;
  const value: AlertPayloadContract = {
    symbol: payload.symbol as string,
  };

  if (payload.price !== undefined) {
    value.price = payload.price as number;
  }
  for (const key of OPTIONAL_TEXT_KEYS) {
    if (payload[key] !== undefined) {
      value[key] = payload[key] as string;
    }
  }

  return { success: true, value };
}

/**
 * Asserts that an alert payload is valid.
 *
 * @param input - Unknown external JSON value.
 */
export function assertAlertPayloadContract(input: unknown): asserts input is AlertPayloadContract {
  const result = validateAlertPayloadContract(input);
  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }
}
