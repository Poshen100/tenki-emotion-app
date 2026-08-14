/**
 * @module importers/apple-health-preview-parity.test
 * @description Guards the browser mirror against drift.
 *
 * `apps/preview/health-import.js` reimplements this parser in plain ES5,
 * because the preview pages are served without a bundler and cannot import
 * from the engine. A mirrored implementation is a liability the moment the two
 * disagree: the engine version is the tested one, but the preview version is
 * the one the founder actually runs on their phone.
 *
 * This test loads the browser file in a sandbox and asserts both produce
 * identical output for the same input. If someone edits one and not the other,
 * this fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {
  groupSleepNights,
  parseAppleDate,
  parseHealthRecordLine,
  summarizeImport,
} from '../apple-health';
import type { HealthRecord } from '../apple-health';

/** The shape the browser file exposes once loaded in the sandbox. */
interface PreviewApi {
  parseLine(line: string): HealthRecord | null;
  groupNights(records: readonly HealthRecord[]): Array<{
    morningDate: string;
    asleepHours: number;
    inBedHours: number;
    segmentCount: number;
  }>;
  summarize(
    records: readonly HealthRecord[],
    nights: readonly unknown[]
  ): { totalRecords: number; sleepNights: number; spanDays: number; sufficient: boolean };
  parseAppleDate(raw: string): number | null;
}

/**
 * Loads the browser mirror in a sandbox, exposing its internals.
 *
 * The file is an IIFE with no exports, so a marker comment is replaced with an
 * assignment onto the sandbox global. That keeps the shipped file free of any
 * test-only surface.
 */
function loadPreviewApi(): PreviewApi {
  const file = path.resolve(
    __dirname,
    '../../../../../apps/preview/health-import.js'
  );
  const source = fs.readFileSync(file, 'utf-8');

  const marker = '  // ── UI ────────────────────────────────────';
  expect(source).toContain(marker);

  const instrumented = source.replace(
    marker,
    '  globalThis.__previewApi = { parseLine, groupNights, summarize, parseAppleDate };\n' +
      marker
  );

  const sandbox: Record<string, unknown> = {
    document: { addEventListener: (): void => undefined },
    setTimeout,
    Date,
    FileReader: class {},
    Blob: class {},
    URL: {},
    TextDecoderStream: undefined,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(instrumented, sandbox);

  return sandbox.__previewApi as PreviewApi;
}

/** Builds a realistic multi-night export, including lines that must be skipped. */
function buildExportLines(): string[] {
  const lines: string[] = ['<HealthData locale="zh_TW">', '  <MetadataEntry key="a" value="b"/>'];

  for (let day = 1; day <= 25; day++) {
    const d = String(day).padStart(2, '0');
    const n = String(day + 1).padStart(2, '0');
    lines.push(
      ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-${d} 23:20:00 +0800" endDate="2026-03-${d} 23:59:00 +0800" value="HKCategoryValueSleepAnalysisInBed"/>`,
      ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-${d} 23:40:00 +0800" endDate="2026-03-${n} 03:10:00 +0800" value="HKCategoryValueSleepAnalysisAsleepCore"/>`,
      ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-${n} 03:10:00 +0800" endDate="2026-03-${n} 06:50:00 +0800" value="HKCategoryValueSleepAnalysisAsleepDeep"/>`,
      ` <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-03-${n} 09:00:00 +0800" endDate="2026-03-${n} 10:00:00 +0800" value="500"/>`
    );
  }

  lines.push('garbage line', '');
  return lines;
}

describe('preview mirror parity', () => {
  const preview = loadPreviewApi();
  const lines = buildExportLines();

  it('parses dates identically, including timezone offsets', () => {
    for (const raw of [
      '2026-08-13 23:40:00 +0800',
      '2026-01-05 19:00:00 -0400',
      '2026-12-31 00:00:00 +0000',
      'not a date',
    ]) {
      expect(preview.parseAppleDate(raw)).toEqual(parseAppleDate(raw));
    }
  });

  it('selects and skips the same lines', () => {
    for (const line of lines) {
      expect(preview.parseLine(line)).toEqual(parseHealthRecordLine(line));
    }
  });

  it('groups nights identically', () => {
    const engineRecords = lines
      .map(parseHealthRecordLine)
      .filter((r): r is HealthRecord => r !== null);
    const engineNights = groupSleepNights(engineRecords).map((n) => ({
      morningDate: n.morningDate,
      asleepHours: Number(n.asleepHours.toFixed(6)),
      inBedHours: Number(n.inBedHours.toFixed(6)),
      segmentCount: n.segmentCount,
    }));

    const previewNights = preview.groupNights(engineRecords).map((n) => ({
      morningDate: n.morningDate,
      asleepHours: Number(n.asleepHours.toFixed(6)),
      inBedHours: Number(n.inBedHours.toFixed(6)),
      segmentCount: n.segmentCount,
    }));

    expect(previewNights).toEqual(engineNights);
    expect(engineNights.length).toBeGreaterThan(20);
  });

  it('reaches the same sufficiency verdict', () => {
    const records = lines
      .map(parseHealthRecordLine)
      .filter((r): r is HealthRecord => r !== null);
    const engineSummary = summarizeImport(records);
    const previewSummary = preview.summarize(records, preview.groupNights(records));

    expect(previewSummary.totalRecords).toBe(engineSummary.totalRecords);
    expect(previewSummary.sleepNights).toBe(engineSummary.sleepNights);
    expect(previewSummary.spanDays).toBe(engineSummary.spanDays);
    expect(previewSummary.sufficient).toBe(engineSummary.sleepSufficientForCorrelation);
  });

  it('agrees that an empty import is empty', () => {
    expect(preview.summarize([], []).sleepNights).toBe(summarizeImport([]).sleepNights);
    expect(preview.summarize([], []).sufficient).toBe(
      summarizeImport([]).sleepSufficientForCorrelation
    );
  });
});
