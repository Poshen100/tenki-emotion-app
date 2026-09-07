import {
  RR_UNITS_PER_SECOND,
  parseHeartRateMeasurement,
  supportsHrv,
} from '../adapters/bleHeartRate';

/** Builds a characteristic value the way a strap would. */
function packet(flags: number, ...rest: number[]): Uint8Array {
  return Uint8Array.from([flags, ...rest]);
}

/** An RR interval of `ms` milliseconds, as the two little-endian bytes on the wire. */
function rrBytes(ms: number): [number, number] {
  const raw = Math.round((ms * RR_UNITS_PER_SECOND) / 1000);
  return [raw & 0xff, (raw >> 8) & 0xff];
}

describe('parseHeartRateMeasurement', () => {
  it('reads an 8-bit heart rate', () => {
    expect(parseHeartRateMeasurement(packet(0x00, 62))?.heartRateBpm).toBe(62);
  });

  it('reads a 16-bit heart rate, little endian', () => {
    // 0x0102 = 258 — proves the byte order, which a symmetric value would hide.
    expect(parseHeartRateMeasurement(packet(0x01, 0x02, 0x01))?.heartRateBpm).toBe(258);
  });

  it('converts RR intervals from 1/1024 s to milliseconds', () => {
    // 1024 units = exactly one second.
    const parsed = parseHeartRateMeasurement(packet(0x10, 60, 0x00, 0x04));
    expect(parsed?.rrIntervalsMs).toEqual([1000]);
  });

  it('does not mistake the raw units for milliseconds', () => {
    // The classic bug: 800 raw units is 781ms, not 800ms.
    const parsed = parseHeartRateMeasurement(packet(0x10, 60, 800 & 0xff, 800 >> 8));
    expect(parsed?.rrIntervalsMs[0]).toBeCloseTo(781.25, 2);
  });

  it('reads several RR intervals in order', () => {
    const parsed = parseHeartRateMeasurement(
      packet(0x10, 58, ...rrBytes(1000), ...rrBytes(900), ...rrBytes(1050)),
    );
    const rr = parsed?.rrIntervalsMs ?? [];
    expect(rr).toHaveLength(3);
    expect(rr[0]).toBeCloseTo(1000, 0);
    expect(rr[1]).toBeCloseTo(900, 0);
    expect(rr[2]).toBeCloseTo(1050, 0);
  });

  it('skips the energy field before reading RR intervals', () => {
    // flags 0x18 = energy present + RR present. Getting the offset wrong here
    // turns the energy bytes into a fake first beat.
    const parsed = parseHeartRateMeasurement(packet(0x18, 60, 0x2c, 0x01, ...rrBytes(1000)));
    expect(parsed?.energyExpendedKj).toBe(300);
    expect(parsed?.rrIntervalsMs).toHaveLength(1);
    expect(parsed?.rrIntervalsMs[0]).toBeCloseTo(1000, 0);
  });

  it('reports energy as null when the strap does not send it', () => {
    expect(parseHeartRateMeasurement(packet(0x00, 60))?.energyExpendedKj).toBeNull();
  });

  describe('sensor contact', () => {
    it('says not_supported when the strap cannot detect contact', () => {
      // Contact-status bit set but supported bit clear must NOT read as good.
      expect(parseHeartRateMeasurement(packet(0x02, 60))?.sensorContact).toBe('not_supported');
      expect(parseHeartRateMeasurement(packet(0x00, 60))?.sensorContact).toBe('not_supported');
    });

    it('distinguishes good from poor contact once supported', () => {
      expect(parseHeartRateMeasurement(packet(0x06, 60))?.sensorContact).toBe('good');
      expect(parseHeartRateMeasurement(packet(0x04, 60))?.sensorContact).toBe('poor');
    });
  });

  describe('malformed packets', () => {
    it('returns null rather than throwing', () => {
      expect(parseHeartRateMeasurement(Uint8Array.from([]))).toBeNull();
      expect(parseHeartRateMeasurement(Uint8Array.from([0x00]))).toBeNull();
      // 16-bit HR flagged but only one byte of value present
      expect(parseHeartRateMeasurement(packet(0x01, 60))).toBeNull();
      // energy flagged but truncated
      expect(parseHeartRateMeasurement(packet(0x08, 60, 0x2c))).toBeNull();
      // an odd number of RR bytes means a half interval
      expect(parseHeartRateMeasurement(packet(0x10, 60, 0x00, 0x04, 0x00))).toBeNull();
    });
  });
});

describe('supportsHrv', () => {
  it('is true only when the strap actually sent inter-beat intervals', () => {
    const withRr = parseHeartRateMeasurement(packet(0x10, 60, ...rrBytes(1000)));
    const withoutRr = parseHeartRateMeasurement(packet(0x00, 60));

    expect(withRr && supportsHrv(withRr)).toBe(true);
    expect(withoutRr && supportsHrv(withoutRr)).toBe(false);
  });
});
