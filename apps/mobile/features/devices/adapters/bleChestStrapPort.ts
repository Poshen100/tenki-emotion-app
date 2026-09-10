/**
 * @module features/devices/adapters/bleChestStrapPort
 * @description `DeviceLinkPort` for a standard BLE heart-rate chest strap.
 *
 * Same rules as the Health Connect port: the native library and `react-native`
 * itself are loaded with `await import()` inside platform branches, never at
 * module top level, so the web bundle and the node-env jest both stay intact.
 *
 * Scope is deliberately narrow for the first device walk: find the first strap
 * advertising the standard Heart Rate Service, connect, and let the scan flow
 * subscribe. Choosing between several straps is a UI problem for later; being
 * able to prove one real strap end to end is the point today.
 */

import type { DeviceLinkOutcome, DeviceLinkPort } from '../port';
import type { DeviceEnvironment, DevicePlatformOs } from '../types/devices.types';
import {
  HEART_RATE_MEASUREMENT_UUID,
  HEART_RATE_SERVICE_UUID,
  parseMeasurementValue,
  requiredAndroidScanPermissions,
} from './bleChestStrap';
import type { HeartRateMeasurement } from './bleHeartRate';

/** How long to look for a strap before giving up, in ms. */
export const SCAN_TIMEOUT_MS = 12_000;

type BleModule = typeof import('react-native-ble-plx');
type BleManagerInstance = InstanceType<BleModule['BleManager']>;
type ConnectedDevice = Awaited<ReturnType<BleManagerInstance['connectToDevice']>>;

let manager: BleManagerInstance | null = null;
let connected: ConnectedDevice | null = null;

/** Loads the BLE library, or null when it is not in this build. */
async function loadBle(): Promise<BleModule | null> {
  try {
    return await import('react-native-ble-plx');
  } catch {
    return null;
  }
}

async function getManager(): Promise<BleManagerInstance | null> {
  if (manager) return manager;

  const ble = await loadBle();
  if (!ble) return null;

  manager = new ble.BleManager();
  return manager;
}

/**
 * Requests the Android runtime permissions a scan needs.
 *
 * @returns True when every permission was granted.
 */
async function ensureAndroidPermissions(): Promise<boolean> {
  const { PermissionsAndroid, Platform } = await import('react-native');
  if (Platform.OS !== 'android') return true;

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const required = requiredAndroidScanPermissions(apiLevel);
  const results: Record<string, string> = await PermissionsAndroid.requestMultiple(
    required as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
  );

  return required.every((permission) => results[permission] === 'granted');
}

/** Scans for the first device advertising the Heart Rate Service. */
function scanForStrap(bleManager: BleManagerInstance): Promise<ConnectedDevice | null> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (device: ConnectedDevice | null) => {
      if (settled) return;
      settled = true;
      bleManager.stopDeviceScan();
      resolve(device);
    };

    const timer = setTimeout(() => finish(null), SCAN_TIMEOUT_MS);

    bleManager.startDeviceScan([HEART_RATE_SERVICE_UUID], null, (error, device) => {
      if (error) {
        clearTimeout(timer);
        finish(null);
        return;
      }
      if (device) {
        clearTimeout(timer);
        finish(device as unknown as ConnectedDevice);
      }
    });
  });
}

/**
 * Creates the chest-strap port.
 *
 * @param os - The OS the app is running on.
 * @returns A `DeviceLinkPort` backed by the standard Heart Rate Service.
 */
export function createBleChestStrapPort(os: DevicePlatformOs): DeviceLinkPort {
  return {
    describeEnvironment: async (): Promise<DeviceEnvironment> => {
      const ble = await loadBle();
      return {
        os,
        adapters: ble ? { chest_strap: true } : {},
        // The BLE port says nothing about Health Connect; the composite merges.
        healthConnectInstalled: false,
      };
    },

    requestAccess: async (providerId, scopes): Promise<DeviceLinkOutcome> => {
      if (providerId !== 'chest_strap') {
        return { kind: 'failed', message: '這個來源不由心率胸帶提供' };
      }

      const bleManager = await getManager();
      if (!bleManager) {
        return { kind: 'failed', message: '這個版本還沒有裝置連接模組' };
      }

      try {
        if (!(await ensureAndroidPermissions())) {
          // The user said no to Bluetooth — a denial, not a technical failure.
          return { kind: 'denied' };
        }

        const found = await scanForStrap(bleManager);
        if (!found) {
          return { kind: 'failed', message: '找不到心率胸帶，請確認它已戴上並在附近' };
        }

        const device = await bleManager.connectToDevice(found.id);
        await device.discoverAllServicesAndCharacteristics();
        connected = device;

        return { kind: 'granted', scopes };
      } catch (error) {
        return {
          kind: 'failed',
          message: error instanceof Error ? error.message : '連接心率胸帶時發生錯誤',
        };
      }
    },

    disconnect: async () => {
      const device = connected;
      connected = null;
      if (!device) return;

      try {
        await device.cancelConnection();
      } catch {
        // Already gone — the row is disconnected either way.
      }
    },
  };
}

/**
 * Subscribes to Heart Rate Measurement notifications from the connected strap.
 *
 * @param onMeasurement - Called for every notification that parses.
 * @returns An unsubscribe function; a no-op when nothing is connected.
 */
export function subscribeHeartRate(
  onMeasurement: (measurement: HeartRateMeasurement) => void,
): () => void {
  const device = connected;
  if (!device) return () => undefined;

  const subscription = device.monitorCharacteristicForService(
    HEART_RATE_SERVICE_UUID,
    HEART_RATE_MEASUREMENT_UUID,
    (error, characteristic) => {
      if (error || !characteristic) return;

      const measurement = parseMeasurementValue(characteristic.value);
      if (measurement) onMeasurement(measurement);
    },
  );

  return () => subscription.remove();
}
