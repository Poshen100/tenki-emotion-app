/**
 * @module features/devices/adapters/bleChestStrap
 * @description The pure half of the chest-strap adapter: identifiers, the
 * base64 hop, and which Android permissions a scan actually needs.
 *
 * `react-native-ble-plx` hands characteristic values over as **base64
 * strings**, not bytes — decoding that wrong produces plausible-looking
 * garbage rather than an error, which is exactly the class of bug the
 * Heart Rate parser exists to prevent. So the hop lives here, with tests, and
 * the decoder is written out rather than leaning on `atob` being present in
 * whichever JS engine the build ships.
 */

import { type HeartRateMeasurement, parseHeartRateMeasurement } from './bleHeartRate';

/** Bluetooth SIG Heart Rate Service (`0x180D`), in the 128-bit form BLE APIs use. */
export const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';

/** Heart Rate Measurement characteristic (`0x2A37`). */
export const HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes a base64 string to bytes.
 *
 * @param value - Base64 as delivered by the BLE layer.
 * @returns The bytes, or null when the input is not valid base64.
 */
export function decodeBase64(value: string): Uint8Array | null {
  const clean = value.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) return null;

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) return null;

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

/**
 * Decodes and parses one Heart Rate Measurement notification.
 *
 * @param value - The characteristic value as base64, or null when the BLE
 *   layer reported an empty notification.
 * @returns The measurement, or null when it cannot be trusted.
 */
export function parseMeasurementValue(value: string | null): HeartRateMeasurement | null {
  if (!value) return null;

  const bytes = decodeBase64(value);
  return bytes ? parseHeartRateMeasurement(bytes) : null;
}

/**
 * The runtime permissions an Android BLE scan needs, which changed at API 31.
 *
 * Before Android 12 a scan could reveal location, so it required the location
 * permission; from 12 on there are dedicated Bluetooth permissions and asking
 * for location instead simply fails. Getting this wrong looks like "the strap
 * is never found" rather than a permission error.
 *
 * @param apiLevel - `Platform.Version` on Android.
 * @returns The permission identifiers to request, in order.
 */
export function requiredAndroidScanPermissions(apiLevel: number): string[] {
  if (apiLevel >= 31) {
    return ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT'];
  }
  return ['android.permission.ACCESS_FINE_LOCATION'];
}
