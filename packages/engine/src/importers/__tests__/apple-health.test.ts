/**
 * @module importers/apple-health.test
 * @description Tests for the Apple Health export parser, using real export
 * line formats. The night-attribution and empty-import tests matter most: the
 * first decides which morning a night's sleep belongs to, and the second is
 * what stops an empty file reading as a broken parser.
 */

import {
  ASLEEP_VALUES,
  DAYS_NEEDED_FOR_CORRELATION,
  HEALTH_RECORD_TYPES,
  NIGHT_GAP_TOLERANCE_MS,
  PAIRS_NEEDED_FOR_CORRELATION,
  SLEEP_VALUES,
  groupSleepNights,
  parseAppleDate,
  parseHealthRecordLine,
  summarizeImport,
  toSleepContext,
} from '../apple-health';
import type { HealthRecord } from '../apple-health';

/** Builds a sleep record line in Apple's export format. */
function sleepLine(value: string, start: string, end: string): string {
  return (
    ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" ` +
    `sourceVersion="10.0" creationDate="${start}" startDate="${start}" endDate="${end}" value="${value}"/>`
  );
}

/** Builds a parsed sleep record directly. */
function sleepRecord(value: string, startMs: number, endMs: number): HealthRecord {
  return { type: HEALTH_RECORD_TYPES.SLEEP, value, startMs, endMs };
}

const HOUR = 3_600_000;

describe('parseAppleDate', () => {
  it('honours the timezone offset in the string', () => {
    const taipei = parseAppleDate('2026-08-14 07:00:00 +0800');
    const utc = parseAppleDate('2026-08-13 23:00:00 +0000');
    expect(taipei).toBe(utc);
  });

  it('handles negative offsets', () => {
    const ny = parseAppleDate('2026-08-13 19:00:00 -0400');
    const utc = parseAppleDate('2026-08-13 23:00:00 +0000');
    expect(ny).toBe(utc);
  });

  it('returns null on a malformed date', () => {
    expect(parseAppleDate('not a date')).toBeNull();
    expect(parseAppleDate('2026-08-14')).toBeNull();
    expect(parseAppleDate('')).toBeNull();
  });
});

describe('parseHealthRecordLine', () => {
  it('parses a sleep record', () => {
    const line = sleepLine(
      SLEEP_VALUES.ASLEEP_CORE,
      '2026-08-13 23:40:00 +0800',
      '2026-08-14 02:10:00 +0800'
    );
    const record = parseHealthRecordLine(line);
    expect(record).not.toBeNull();
    expect(record?.type).toBe(HEALTH_RECORD_TYPES.SLEEP);
    expect(record?.value).toBe(SLEEP_VALUES.ASLEEP_CORE);
  });

  it('parses every sleep category value', () => {
    for (const value of Object.values(SLEEP_VALUES)) {
      const line = sleepLine(value, '2026-08-13 23:00:00 +0800', '2026-08-14 01:00:00 +0800');
      expect(parseHealthRecordLine(line)?.value).toBe(value);
    }
  });

  it('parses an HRV record', () => {
    const line =
      ' <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" unit="ms" ' +
      'startDate="2026-08-14 07:05:00 +0800" endDate="2026-08-14 07:05:00 +0800" value="48.2"/>';
    const record = parseHealthRecordLine(line);
    expect(record?.type).toBe(HEALTH_RECORD_TYPES.HRV_SDNN);
    expect(record?.value).toBe('48.2');
  });

  it('skips record types it does not care about', () => {
    const line =
      ' <Record type="HKQuantityTypeIdentifierStepCount" unit="count" ' +
      'startDate="2026-08-14 07:00:00 +0800" endDate="2026-08-14 08:00:00 +0800" value="812"/>';
    expect(parseHealthRecordLine(line)).toBeNull();
  });

  it('skips lines that are not records at all', () => {
    expect(parseHealthRecordLine('<HealthData locale="zh_TW">')).toBeNull();
    expect(parseHealthRecordLine('  <MetadataEntry key="x" value="y"/>')).toBeNull();
    expect(parseHealthRecordLine('')).toBeNull();
  });

  it('rejects a record missing required attributes without throwing', () => {
    expect(
      parseHealthRecordLine('<Record type="HKCategoryTypeIdentifierSleepAnalysis"/>')
    ).toBeNull();
  });

  it('rejects a record whose end precedes its start', () => {
    const line = sleepLine(
      SLEEP_VALUES.ASLEEP_CORE,
      '2026-08-14 07:00:00 +0800',
      '2026-08-13 23:00:00 +0800'
    );
    expect(parseHealthRecordLine(line)).toBeNull();
  });
});

describe('night grouping', () => {
  const base = Date.UTC(2026, 7, 13, 15, 0, 0); // 2026-08-13 23:00 +0800

  it('attributes a night to the morning it ends on', () => {
    // Sleeps 23:00 on the 13th, wakes 07:00 on the 14th.
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 8 * HOUR),
    ]);
    expect(nights).toHaveLength(1);
    // The wake-up moment, not the bedtime, decides the date.
    expect(nights[0].morningDate).toBe(
      new Date(base + 8 * HOUR).getFullYear() +
        '-' +
        String(new Date(base + 8 * HOUR).getMonth() + 1).padStart(2, '0') +
        '-' +
        String(new Date(base + 8 * HOUR).getDate()).padStart(2, '0')
    );
  });

  it('merges segments broken by a brief waking', () => {
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 3 * HOUR),
      sleepRecord(SLEEP_VALUES.AWAKE, base + 3 * HOUR, base + 3.2 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_DEEP, base + 3.2 * HOUR, base + 7 * HOUR),
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].segmentCount).toBe(3);
  });

  it('counts only asleep segments toward the total', () => {
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 3 * HOUR),
      sleepRecord(SLEEP_VALUES.AWAKE, base + 3 * HOUR, base + 4 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_REM, base + 4 * HOUR, base + 6 * HOUR),
    ]);
    expect(nights[0].asleepHours).toBeCloseTo(5, 5);
  });

  it('keeps time in bed separate from time asleep', () => {
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.IN_BED, base, base + 8 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base + 0.5 * HOUR, base + 7 * HOUR),
    ]);
    expect(nights[0].inBedHours).toBeCloseTo(8, 5);
    expect(nights[0].asleepHours).toBeCloseTo(6.5, 5);
  });

  it('splits nights separated by more than the gap tolerance', () => {
    const nextNight = base + 24 * HOUR;
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 7 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, nextNight, nextNight + 7 * HOUR),
    ]);
    expect(nights).toHaveLength(2);
  });

  it('does not split inside the gap tolerance', () => {
    const gap = NIGHT_GAP_TOLERANCE_MS - 60_000;
    const nights = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 2 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base + 2 * HOUR + gap, base + 5 * HOUR + gap),
    ]);
    expect(nights).toHaveLength(1);
  });

  it('ignores non-sleep records', () => {
    const nights = groupSleepNights([
      { type: HEALTH_RECORD_TYPES.HRV_SDNN, value: '48', startMs: base, endMs: base },
    ]);
    expect(nights).toEqual([]);
  });

  it('returns nothing for an empty input', () => {
    expect(groupSleepNights([])).toEqual([]);
  });

  it('treats every asleep stage as sleep', () => {
    for (const value of ASLEEP_VALUES) {
      const nights = groupSleepNights([sleepRecord(value, base, base + 6 * HOUR)]);
      expect(nights[0].asleepHours).toBeCloseTo(6, 5);
    }
  });
});

describe('sleep context', () => {
  const base = Date.UTC(2026, 7, 13, 15, 0, 0);

  it('maps a night onto the DPD sleep shape', () => {
    const [night] = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_CORE, base, base + 7 * HOUR),
    ]);
    expect(toSleepContext(night)).toEqual({ durationHours: 7, qualityScore: null });
  });

  it('leaves quality null rather than inventing one from stage ratios', () => {
    const [night] = groupSleepNights([
      sleepRecord(SLEEP_VALUES.ASLEEP_DEEP, base, base + 2 * HOUR),
      sleepRecord(SLEEP_VALUES.ASLEEP_REM, base + 2 * HOUR, base + 5 * HOUR),
    ]);
    expect(toSleepContext(night).qualityScore).toBeNull();
  });

  it('reports null duration for a night with only time in bed', () => {
    const [night] = groupSleepNights([
      sleepRecord(SLEEP_VALUES.IN_BED, base, base + 8 * HOUR),
    ]);
    expect(toSleepContext(night).durationHours).toBeNull();
  });
});

describe('import summary', () => {
  const base = Date.UTC(2026, 0, 1, 15, 0, 0);

  /** Builds n consecutive nights of sleep. */
  function nights(n: number): HealthRecord[] {
    return Array.from({ length: n }, (_, i) =>
      sleepRecord(
        SLEEP_VALUES.ASLEEP_CORE,
        base + i * 24 * HOUR,
        base + i * 24 * HOUR + 7 * HOUR
      )
    );
  }

  it('says plainly when the file yielded nothing', () => {
    const summary = summarizeImport([]);
    expect(summary.totalRecords).toBe(0);
    expect(summary.notes.join(' ')).toContain('No records of interest');
  });

  it('explains an absence of sleep rather than reporting zero silently', () => {
    const summary = summarizeImport([
      { type: HEALTH_RECORD_TYPES.HEART_RATE, value: '62', startMs: base, endMs: base },
    ]);
    expect(summary.sleepNights).toBe(0);
    expect(summary.notes.join(' ')).toContain('No sleep data');
  });

  it('explains why an iPhone-only export has no HRV', () => {
    const summary = summarizeImport(nights(30));
    expect(summary.hrvReadings).toBe(0);
    expect(summary.notes.join(' ')).toContain('no heart-rate sensor');
  });

  it('reports insufficient sleep history against the correlation thresholds', () => {
    const summary = summarizeImport(nights(PAIRS_NEEDED_FOR_CORRELATION - 1));
    expect(summary.sleepSufficientForCorrelation).toBe(false);
    expect(summary.notes.join(' ')).toContain(String(PAIRS_NEEDED_FOR_CORRELATION));
  });

  it('confirms sufficiency once both thresholds are cleared', () => {
    const summary = summarizeImport(nights(PAIRS_NEEDED_FOR_CORRELATION + 5));
    expect(summary.sleepNights).toBeGreaterThanOrEqual(PAIRS_NEEDED_FOR_CORRELATION);
    expect(summary.spanDays).toBeGreaterThanOrEqual(DAYS_NEEDED_FOR_CORRELATION);
    expect(summary.sleepSufficientForCorrelation).toBe(true);
  });

  it('reports the mean nightly sleep', () => {
    const summary = summarizeImport(nights(25));
    expect(summary.meanAsleepHours).toBeCloseTo(7, 5);
  });

  it('reports null mean sleep with no nights', () => {
    expect(summarizeImport([]).meanAsleepHours).toBeNull();
  });
});

describe('large input', () => {
  it('parses thousands of lines without accumulating the file', () => {
    const records: HealthRecord[] = [];
    for (let i = 0; i < 5000; i++) {
      const line =
        i % 2 === 0
          ? sleepLine(
              SLEEP_VALUES.ASLEEP_CORE,
              '2026-08-13 23:00:00 +0800',
              '2026-08-14 06:00:00 +0800'
            )
          : ' <Record type="HKQuantityTypeIdentifierStepCount" unit="count" ' +
            'startDate="2026-08-14 07:00:00 +0800" endDate="2026-08-14 08:00:00 +0800" value="1"/>';
      const parsed = parseHealthRecordLine(line);
      if (parsed !== null) records.push(parsed);
    }
    expect(records).toHaveLength(2500);
    // Identical timestamps collapse into a single night, which is the correct
    // reading of a file that repeats the same interval.
    expect(groupSleepNights(records)).toHaveLength(1);
  });
});
