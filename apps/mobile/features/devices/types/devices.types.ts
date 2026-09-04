/**
 * @module features/devices/types
 * @description Types for the Devices connection surface — the screen where a
 * user links Apple 健康 (HealthKit), Health Connect, a heart-rate chest strap,
 * or Garmin Connect.
 *
 * Scope: this is the NON-NATIVE half of Phase 1. Everything here is pure data
 * and pure decisions; the actual OS permission calls arrive later behind
 * `DeviceLinkPort`, so the flow can be built and tested before a Mac exists.
 *
 * Language rule (docs/WEARABLE-INTEGRATION.md §1): the iOS entry is
 * 「Apple 健康」— never 「Apple 健身」, which is a UI/service brand, not a data
 * API — and Android is Health Connect, never Google Fit. Nothing here may claim
 * a device is supported before its adapter exists.
 *
 * @see docs/WEARABLE-INTEGRATION.md
 * @see domain/src/contracts/wearable-sample.ts
 */

import type { BiometricPermissionScope, BiometricSourcePlatform } from '@tenki/domain';

/** The connection entries offered on the Devices screen. */
export const DEVICE_PROVIDER_IDS = [
  'apple_health',
  'health_connect',
  'chest_strap',
  'garmin_connect',
] as const;
export type DeviceProviderId = typeof DEVICE_PROVIDER_IDS[number];

/** Which OS a provider is offered on. */
export type DevicePlatformOs = 'ios' | 'android';

/**
 * Integration wave, from docs/WEARABLE-INTEGRATION.md §2.
 * `p0` ships with the first native pass; `p1` waits on Garmin's approval-gated
 * API and is shown as not-yet-available rather than hidden, so the roadmap is
 * legible without over-claiming.
 */
export type DeviceProviderWave = 'p0' | 'p1';

/** A connection entry as presented to the user. */
export interface DeviceProvider {
  id: DeviceProviderId;
  /** Canonical platform this provider's samples arrive as. */
  platform: BiometricSourcePlatform;
  /** User-facing name, Traditional Chinese. */
  label: string;
  /** One line on what connecting it adds. No medical or financial framing. */
  description: string;
  /** Which OS shows this entry; both means it is offered everywhere. */
  os: DevicePlatformOs | 'both';
  wave: DeviceProviderWave;
  /** Consent buckets this provider can populate. */
  scopes: readonly BiometricPermissionScope[];
}

/**
 * Why a provider cannot be connected right now, or `null` when it can.
 * Distinct reasons because each needs different UI: a missing app is the
 * user's to fix, a missing adapter is ours.
 */
export type DeviceUnavailableReason =
  /** Wrong OS for this provider (Apple 健康 on Android, and so on). */
  | 'wrong_os'
  /** Android only: Health Connect is not installed or not set up yet. */
  | 'hub_not_installed'
  /** No native adapter in this build yet — ours to ship, not the user's. */
  | 'adapter_missing'
  /** Second-wave provider, pending Garmin's approval-gated API. */
  | 'second_wave';

/** Runtime facts the availability decision is made from. */
export interface DeviceEnvironment {
  os: DevicePlatformOs;
  /** Whether this build carries a working native adapter for the provider. */
  adapters: Readonly<Partial<Record<DeviceProviderId, boolean>>>;
  /** Android: whether the Health Connect app is present and set up. */
  healthConnectInstalled: boolean;
}

/** Connection lifecycle for one provider. */
export type DeviceConnectionState =
  | 'unavailable'
  | 'disconnected'
  | 'requesting'
  | 'denied'
  | 'connected'
  | 'error';

/** What a provider is doing right now, as held in the store. */
export interface DeviceConnection {
  state: DeviceConnectionState;
  /** Populated whenever `state` is `unavailable`. */
  unavailableReason: DeviceUnavailableReason | null;
  /** Scopes the user actually granted; a subset of the provider's scopes. */
  grantedScopes: readonly BiometricPermissionScope[];
  /** When data last arrived from this provider (Unix ms), null if never. */
  lastSyncAt: number | null;
  /** Device the last sync came from, as reported by the platform. */
  lastSyncDevice: string | null;
  /** Honest, user-facing reason for the last failure; null when none. */
  errorMessage: string | null;
}
