/**
 * @module importers/apple-health
 * @description Parser for the Apple Health "Export All Health Data" file.
 *
 * This is how Tenki gets real longitudinal data before there is a native app:
 * the Health app exports `export.xml`, the user hands it to a local page, and
 * nothing leaves the device. It is also the only source for one specific
 * signal — an iPhone with no Watch has no heart-rate sensor, so the export
 * carries no HRV and no heart rate, but it does carry SLEEP, which is exactly
 * the Edge DNA driver that camera PPG cannot supply.
 *
 * ## Why line-oriented parsing rather than an XML parser
 *
 * `export.xml` reaches hundreds of megabytes for a user with years of history.
 * Handing that to DOMParser on mobile Safari runs the tab out of memory. The
 * file's `<Record>` elements are, in practice, one self-closing tag per line,
 * so extracting per line is both cheap and streamable — the caller can feed it
 * a line at a time and never hold the file in memory.
 *
 * Parsing is pure and synchronous per line; streaming is the caller's job.
 *
 * @see docs/DATA-BOOTSTRAP.md
 */

// ─────────────────────────────────────────────
// Record types
// ─────────────────────────────────────────────

/** HealthKit type identifiers this importer cares about. */
export const HEALTH_RECORD_TYPES = {
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis',
  HRV_SDNN: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  HEART_RATE: 'HKQuantityTypeIdentifierHeartRate',
} as const;

export type HealthRecordType = typeof HEALTH_RECORD_TYPES[keyof typeof HEALTH_RECORD_TYPES];

/**
 * Sleep category values, newest schema first.
 *
 * `InBed` is tracked separately from the asleep values on purpose: time in bed
 * is not time asleep, and conflating them would inflate every sleep duration
 * by however long someone reads before sleeping.
 */
export const SLEEP_VALUES = {
  IN_BED: 'HKCategoryValueSleepAnalysisInBed',
  ASLEEP_UNSPECIFIED: 'HKCategoryValueSleepAnalysisAsleepUnspecified',
  ASLEEP_CORE: 'HKCategoryValueSleepAnalysisAsleepCore',
  ASLEEP_DEEP: 'HKCategoryValueSleepAnalysisAsleepDeep',
  ASLEEP_REM: 'HKCategoryValueSleepAnalysisAsleepREM',
  AWAKE: 'HKCategoryValueSleepAnalysisAwake',
} as const;

/** Values that count as actually asleep. */
export const ASLEEP_VALUES: readonly string[] = [
  SLEEP_VALUES.ASLEEP_UNSPECIFIED,
  SLEEP_VALUES.ASLEEP_CORE,
  SLEEP_VALUES.ASLEEP_DEEP,
  SLEEP_VALUES.ASLEEP_REM,
];

/** One parsed record. */
export interface HealthRecord {
  readonly type: HealthRecordType;
  /** Category value for sleep records, or the numeric string for quantities. */
  readonly value: string;
  readonly startMs: number;
  readonly endMs: number;
}

// ─────────────────────────────────────────────
// Line parsing
// ─────────────────────────────────────────────

const RECORD_TYPE_RE = /\btype="([^"]+)"/;
const RECORD_VALUE_RE = /\bvalue="([^"]+)"/;
const RECORD_START_RE = /\bstartDate="([^"]+)"/;
const RECORD_END_RE = /\bendDate="([^"]+)"/;

const WANTED_TYPES: readonly string[] = Object.values(HEALTH_RECORD_TYPES);

/**
 * Parses Apple's export date format, `YYYY-MM-DD HH:mm:ss ±ZZZZ`.
 *
 * The offset is part of the string and must be honoured: a night recorded in
 * Taipei and read back in UTC would otherwise land on the wrong calendar day,
 * which silently misassigns sleep to the wrong morning.
 *
 * @param raw - The raw date attribute.
 * @returns Epoch ms, or null when unparseable.
 */
export function parseAppleDate(raw: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(
    raw.trim()
  );
  if (match === null) return null;

  const [, y, mo, d, h, mi, s, sign, offH, offM] = match;
  const utc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
  const offsetMinutes = (Number(offH) * 60 + Number(offM)) * (sign === '-' ? -1 : 1);
  return utc - offsetMinutes * 60_000;
}

/**
 * Parses one line of `export.xml`.
 *
 * Returns null for anything that is not a record of an interesting type, which
 * is the overwhelming majority of lines — the caller simply skips them.
 *
 * @param line - A single line from the export.
 * @returns The parsed record, or null.
 */
export function parseHealthRecordLine(line: string): HealthRecord | null {
  if (!line.includes('<Record')) return null;

  const typeMatch = RECORD_TYPE_RE.exec(line);
  if (typeMatch === null) return null;

  const type = typeMatch[1];
  if (!WANTED_TYPES.includes(type)) return null;

  const valueMatch = RECORD_VALUE_RE.exec(line);
  const startMatch = RECORD_START_RE.exec(line);
  const endMatch = RECORD_END_RE.exec(line);
  if (valueMatch === null || startMatch === null || endMatch === null) return null;

  const startMs = parseAppleDate(startMatch[1]);
  const endMs = parseAppleDate(endMatch[1]);
  if (startMs === null || endMs === null || endMs < startMs) return null;

  return {
    type: type as HealthRecordType,
    value: valueMatch[1],
    startMs,
    endMs,
  };
}

// ─────────────────────────────────────────────
// Sleep grouping
// ─────────────────────────────────────────────

/**
 * Segments separated by less than this are treated as the same night. Waking
 * for a few minutes does not start a new night.
 */
export const NIGHT_GAP_TOLERANCE_MS = 3 * 60 * 60 * 1000;

/** One night's sleep, attributed to the morning the user woke up on. */
export interface SleepNight {
  /** Local date of the WAKE-UP morning, YYYY-MM-DD. */
  readonly morningDate: string;
  /** Total time asleep in hours. */
  readonly asleepHours: number;
  /** Total time in bed in hours, where recorded. */
  readonly inBedHours: number;
  /** Epoch ms of the first segment. */
  readonly startMs: number;
  /** Epoch ms of the last segment's end. */
  readonly endMs: number;
  /** Segments that made up the night. */
  readonly segmentCount: number;
}

/** Formats an epoch ms as a local YYYY-MM-DD. */
function localDateKey(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Groups sleep records into nights.
 *
 * A night is attributed to the morning it ENDS on, not the evening it starts.
 * Edge DNA's question is "how did the user sleep before today's decisions",
 * and a night that runs 23:40 to 07:10 belongs to the second day's decisions,
 * not the first's.
 *
 * @param records - Parsed records; non-sleep records are ignored.
 * @returns Nights in chronological order.
 */
export function groupSleepNights(records: readonly HealthRecord[]): SleepNight[] {
  const sleepRecords = records
    .filter((r) => r.type === HEALTH_RECORD_TYPES.SLEEP)
    .sort((a, b) => a.startMs - b.startMs);

  if (sleepRecords.length === 0) return [];

  const nights: SleepNight[] = [];
  let bucket: HealthRecord[] = [sleepRecords[0]];

  const flush = (): void => {
    let asleepMs = 0;
    let inBedMs = 0;
    for (const seg of bucket) {
      const duration = seg.endMs - seg.startMs;
      if (ASLEEP_VALUES.includes(seg.value)) asleepMs += duration;
      else if (seg.value === SLEEP_VALUES.IN_BED) inBedMs += duration;
    }
    const endMs = bucket.reduce((max, s) => Math.max(max, s.endMs), bucket[0].endMs);
    nights.push({
      morningDate: localDateKey(endMs),
      asleepHours: asleepMs / 3_600_000,
      inBedHours: inBedMs / 3_600_000,
      startMs: bucket[0].startMs,
      endMs,
      segmentCount: bucket.length,
    });
  };

  for (let i = 1; i < sleepRecords.length; i++) {
    const previousEnd = bucket.reduce((max, s) => Math.max(max, s.endMs), 0);
    if (sleepRecords[i].startMs - previousEnd > NIGHT_GAP_TOLERANCE_MS) {
      flush();
      bucket = [sleepRecords[i]];
    } else {
      bucket.push(sleepRecords[i]);
    }
  }
  flush();

  return nights;
}

// ─────────────────────────────────────────────
// Sleep context
// ─────────────────────────────────────────────

/**
 * Shape matching `SleepContext` on the DPD record.
 *
 * Declared structurally rather than imported so the engine does not depend on
 * the shared package — the field names are what must match, and the DPD test
 * pins that.
 */
export interface ImportedSleepContext {
  readonly durationHours: number | null;
  readonly qualityScore: number | null;
}

/**
 * Converts a night into the sleep context a DPD record carries.
 *
 * `qualityScore` stays null: the export gives duration and stages, not a
 * quality figure, and inventing one from stage ratios would be presenting a
 * derived guess as a measurement.
 *
 * @param night - The night to convert.
 * @returns The sleep context.
 */
export function toSleepContext(night: SleepNight): ImportedSleepContext {
  return {
    durationHours: night.asleepHours > 0 ? night.asleepHours : null,
    qualityScore: null,
  };
}

// ─────────────────────────────────────────────
// Import summary
// ─────────────────────────────────────────────

/** Pairs needed before a correlation can run — mirrors `correlation.ts`. */
export const PAIRS_NEEDED_FOR_CORRELATION = 20;

/** Days of span needed — mirrors `correlation.ts`. */
export const DAYS_NEEDED_FOR_CORRELATION = 14;

/** What an import actually yielded, and whether it is enough to be useful. */
export interface ImportSummary {
  readonly totalRecords: number;
  readonly sleepNights: number;
  readonly hrvReadings: number;
  readonly heartRateReadings: number;
  /** Days between the earliest and latest record, 0 when empty. */
  readonly spanDays: number;
  /** Mean hours asleep across nights, or null with no nights. */
  readonly meanAsleepHours: number | null;
  /** Whether there is enough sleep data to support a sleep correlation. */
  readonly sleepSufficientForCorrelation: boolean;
  /**
   * Plain statements about what is and is not present.
   *
   * An empty import must SAY it is empty. Someone who has never tracked sleep
   * gets a file with no sleep records at all, and silently returning zero
   * nights reads as a broken parser rather than an honest answer.
   */
  readonly notes: readonly string[];
}

/**
 * Summarises an import.
 *
 * @param records - All parsed records.
 * @returns The summary.
 */
export function summarizeImport(records: readonly HealthRecord[]): ImportSummary {
  const nights = groupSleepNights(records);
  const hrv = records.filter((r) => r.type === HEALTH_RECORD_TYPES.HRV_SDNN).length;
  const hr = records.filter((r) => r.type === HEALTH_RECORD_TYPES.HEART_RATE).length;

  let spanDays = 0;
  if (records.length > 0) {
    const earliest = records.reduce((min, r) => Math.min(min, r.startMs), Infinity);
    const latest = records.reduce((max, r) => Math.max(max, r.endMs), -Infinity);
    spanDays = Math.round((latest - earliest) / 86_400_000);
  }

  const meanAsleepHours =
    nights.length > 0
      ? nights.reduce((sum, n) => sum + n.asleepHours, 0) / nights.length
      : null;

  const sleepSufficientForCorrelation =
    nights.length >= PAIRS_NEEDED_FOR_CORRELATION && spanDays >= DAYS_NEEDED_FOR_CORRELATION;

  const notes: string[] = [];

  if (records.length === 0) {
    notes.push('No records of interest were found in this file.');
  }

  if (nights.length === 0) {
    notes.push(
      'No sleep data. Sleep only appears here if you track it, through the ' +
        'Sleep Focus schedule or a sleep app — without it the sleep pattern ' +
        'cannot be built.'
    );
  } else if (!sleepSufficientForCorrelation) {
    notes.push(
      `${nights.length} nights over ${spanDays} days. A sleep pattern needs at ` +
        `least ${PAIRS_NEEDED_FOR_CORRELATION} nights across ` +
        `${DAYS_NEEDED_FOR_CORRELATION} days.`
    );
  }

  if (hrv === 0) {
    notes.push(
      'No heart-rate variability. An iPhone has no heart-rate sensor, so this ' +
        'only appears with a Watch or another connected device. Camera scans ' +
        'cover this instead.'
    );
  }

  return {
    totalRecords: records.length,
    sleepNights: nights.length,
    hrvReadings: hrv,
    heartRateReadings: hr,
    spanDays,
    meanAsleepHours,
    sleepSufficientForCorrelation,
    notes,
  };
}
