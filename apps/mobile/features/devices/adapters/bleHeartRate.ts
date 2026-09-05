/**
 * @module features/devices/adapters/bleHeartRate
 * @description Parser for the Bluetooth SIG Heart Rate Measurement characteristic
 * (service `0x180D`, characteristic `0x2A37`) — the public standard every
 * compatible chest strap implements (Polar H10, Wahoo TICKR, Garmin HRM, …).
 *
 * This is the whole reason the chest strap is a P0 source: it is the only path
 * to real **RR intervals** (inter-beat timings), and therefore to HRV we
 * actually measured rather than estimated.
 *
 * Pure byte parsing, no Bluetooth stack: whichever BLE library the native
 * layer ends up using hands us the characteristic value, and this turns it
 * into numbers. That makes the risky part — bit flags and unit conversion —
 * testable today, years before any hardware is in the room.
 *
 * Packet layout (Heart Rate Service v1.0, §3.1):
 *   byte 0  flags
 *     bit 0  HR value format: 0 = uint8, 1 = uint16
 *     bit 1  sensor contact status  (only meaningful when bit 2 is set)
 *     bit 2  sensor contact supported
 *     bit 3  energy expended field present (uint16, kJ)
 *     bit 4  RR intervals present (one or more uint16)
 *   then     HR value (uint8 or uint16, little endian)
 *   then     energy expended (uint16 LE) — when bit 3
 *   then     RR intervals (uint16 LE each) — when bit 4
 *
 * All multi-byte fields are little endian. RR intervals are expressed in
 * units of 1/1024 second, NOT milliseconds — the conversion is the classic
 * silent-wrong-number bug in this characteristic, so it lives here with tests.
 */

/** Whether the strap reports skin contact, and whether it can report it at all. */
export type SensorContact = 'good' | 'poor' | 'not_supported';

/** One decoded Heart Rate Measurement notification. */
export interface HeartRateMeasurement {
  /** Heart rate in beats per minute. */
  heartRateBpm: number;
  /** Inter-beat intervals in milliseconds, oldest first; empty when absent. */
  rrIntervalsMs: number[];
  /** Skin-contact state as reported by the strap. */
  sensorContact: SensorContact;
  /** Energy expended in kilojoules since reset, when the strap reports it. */
  energyExpendedKj: number | null;
}

/** RR intervals come in units of 1/1024 s, so this is the conversion factor. */
export const RR_UNITS_PER_SECOND = 1024;

const FLAG_HR_16BIT = 0b0000_0001;
const FLAG_CONTACT_STATUS = 0b0000_0010;
const FLAG_CONTACT_SUPPORTED = 0b0000_0100;
const FLAG_ENERGY_PRESENT = 0b0000_1000;
const FLAG_RR_PRESENT = 0b0001_0000;

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/**
 * Decodes one Heart Rate Measurement characteristic value.
 *
 * Returns null rather than throwing on a malformed packet: a dropped or
 * truncated notification is normal over BLE, and one bad packet must not take
 * down a scan in progress.
 *
 * @param value - Raw characteristic bytes as delivered by the BLE layer.
 * @returns The decoded measurement, or null when the packet cannot be trusted.
 */
export function parseHeartRateMeasurement(value: Uint8Array): HeartRateMeasurement | null {
  if (value.length < 2) return null;

  const flags = value[0];
  const hrIs16Bit = (flags & FLAG_HR_16BIT) !== 0;
  let offset = 1;

  if (hrIs16Bit && value.length < 3) return null;

  const heartRateBpm = hrIs16Bit ? readUint16Le(value, offset) : value[offset];
  offset += hrIs16Bit ? 2 : 1;

  let energyExpendedKj: number | null = null;
  if ((flags & FLAG_ENERGY_PRESENT) !== 0) {
    if (value.length < offset + 2) return null;
    energyExpendedKj = readUint16Le(value, offset);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if ((flags & FLAG_RR_PRESENT) !== 0) {
    // A truncated final interval means the packet is malformed, not that the
    // last beat should be silently dropped.
    if ((value.length - offset) % 2 !== 0) return null;

    for (let i = offset; i + 1 < value.length; i += 2) {
      rrIntervalsMs.push((readUint16Le(value, i) * 1000) / RR_UNITS_PER_SECOND);
    }
  }

  return {
    heartRateBpm,
    rrIntervalsMs,
    sensorContact: resolveSensorContact(flags),
    energyExpendedKj,
  };
}

/**
 * Reads the two contact bits. A strap that cannot detect contact reports
 * `not_supported` — which must never be shown as "good contact", because the
 * quality claim would be invented.
 */
function resolveSensorContact(flags: number): SensorContact {
  if ((flags & FLAG_CONTACT_SUPPORTED) === 0) return 'not_supported';
  return (flags & FLAG_CONTACT_STATUS) !== 0 ? 'good' : 'poor';
}

/**
 * Whether this strap can drive TENKI's measured-HRV path.
 *
 * A strap with no RR intervals still improves heart-rate quality, but it
 * cannot support an HRV claim — `docs/WEARABLE-INTEGRATION.md` §5 forbids
 * saying we measured chest-strap HRV without inter-beat data.
 */
export function supportsHrv(measurement: HeartRateMeasurement): boolean {
  return measurement.rrIntervalsMs.length > 0;
}
