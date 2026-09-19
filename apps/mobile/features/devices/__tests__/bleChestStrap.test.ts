import {
  HEART_RATE_MEASUREMENT_UUID,
  HEART_RATE_SERVICE_UUID,
  decodeBase64,
  parseMeasurementValue,
  requiredAndroidScanPermissions,
} from '../adapters/bleChestStrap';

/** Encodes bytes the way the BLE layer would hand them over. */
function toBase64(bytes: number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString('base64');
}

describe('UUIDs', () => {
  it('uses the Bluetooth SIG base UUIDs for 0x180D / 0x2A37', () => {
    expect(HEART_RATE_SERVICE_UUID).toBe('0000180d-0000-1000-8000-00805f9b34fb');
    expect(HEART_RATE_MEASUREMENT_UUID).toBe('00002a37-0000-1000-8000-00805f9b34fb');
  });
});

describe('decodeBase64', () => {
  it('round-trips bytes produced by a real encoder', () => {
    for (const bytes of [[0], [0x10, 60], [0x10, 60, 0x00, 0x04], [1, 2, 3, 4, 5, 6, 7]]) {
      expect(Array.from(decodeBase64(toBase64(bytes)) ?? [])).toEqual(bytes);
    }
  });

  it('handles every padding length', () => {
    expect(Array.from(decodeBase64('YQ==') ?? [])).toEqual([0x61]);
    expect(Array.from(decodeBase64('YWI=') ?? [])).toEqual([0x61, 0x62]);
    expect(Array.from(decodeBase64('YWJj') ?? [])).toEqual([0x61, 0x62, 0x63]);
  });

  it('preserves high bytes rather than mangling them', () => {
    expect(Array.from(decodeBase64(toBase64([0xff, 0x80, 0x7f])) ?? [])).toEqual([0xff, 0x80, 0x7f]);
  });

  it('rejects input that is not base64 instead of returning garbage', () => {
    expect(decodeBase64('not base64!')).toBeNull();
    expect(decodeBase64('###')).toBeNull();
  });

  it('decodes an empty value to no bytes', () => {
    expect(Array.from(decodeBase64('') ?? [])).toEqual([]);
  });
});

describe('parseMeasurementValue', () => {
  it('decodes and parses a notification end to end', () => {
    // flags 0x10 (RR present), HR 60, one RR interval of 1024 units = 1000ms
    const measurement = parseMeasurementValue(toBase64([0x10, 60, 0x00, 0x04]));

    expect(measurement).not.toBeNull();
    expect(measurement?.heartRateBpm).toBe(60);
    expect(measurement?.rrIntervalsMs).toEqual([1000]);
  });

  it('returns null for an empty notification rather than a fake reading', () => {
    expect(parseMeasurementValue(null)).toBeNull();
    expect(parseMeasurementValue('')).toBeNull();
  });

  it('returns null when the payload is not valid base64', () => {
    expect(parseMeasurementValue('!!!!')).toBeNull();
  });

  it('returns null for a truncated packet', () => {
    expect(parseMeasurementValue(toBase64([0x10]))).toBeNull();
  });
});

describe('requiredAndroidScanPermissions', () => {
  it('asks for the Bluetooth permissions on Android 12 and later', () => {
    expect(requiredAndroidScanPermissions(31)).toEqual([
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ]);
    expect(requiredAndroidScanPermissions(34)).toContain('android.permission.BLUETOOTH_SCAN');
  });

  it('falls back to location before Android 12, where a scan needed it', () => {
    expect(requiredAndroidScanPermissions(30)).toEqual(['android.permission.ACCESS_FINE_LOCATION']);
  });

  it('never mixes the two schemes — asking for the wrong one just never finds a strap', () => {
    expect(requiredAndroidScanPermissions(31)).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(requiredAndroidScanPermissions(30)).not.toContain('android.permission.BLUETOOTH_SCAN');
  });
});
