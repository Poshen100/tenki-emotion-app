/**
 * @module face-baseline/__tests__/optionalNative
 * @description Covers the probe, and guards the property it exists to protect.
 *
 * The probe itself is small. The test that matters is the second one: it reads
 * the source of every screen and component and fails if an optional native
 * module is imported at module scope again, because that is exactly how the
 * capture and processing screens came to crash in Expo Go in the first place.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describeLoadFailure, probeOptionalModule } from '../utils/optionalNative';

describe('probeOptionalModule', () => {
  it('passes a module through when it loads', () => {
    const result = probeOptionalModule(() => ({ value: 42 }));

    expect(result.available).toBe(true);
    expect(result.module).toEqual({ value: 42 });
    expect(result.reason).toBeNull();
  });

  it('turns a throwing entry point into a value', () => {
    const result = probeOptionalModule(() => {
      throw new Error('Skia is not available');
    });

    expect(result.available).toBe(false);
    expect(result.module).toBeNull();
    expect(result.reason).toBe('Skia is not available');
  });

  it('treats a module that resolves to nothing as unavailable', () => {
    expect(probeOptionalModule(() => null).available).toBe(false);
    expect(probeOptionalModule(() => undefined).available).toBe(false);
  });
});

describe('describeLoadFailure', () => {
  it('always produces something a human can read', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const cases: unknown[] = [
      new Error('boom'),
      'a thrown string',
      null,
      undefined,
      { code: 'ENOENT' },
      circular,
      new Error(''),
      123,
    ];

    for (const value of cases) {
      const message = describeLoadFailure(value);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toBe('[object Object]');
    }
  });
});

describe('optional native modules stay behind the probe', () => {
  /** Modules Expo Go does not bundle. A static import of these crashes it. */
  const OPTIONAL = ['react-native-vision-camera', '@shopify/react-native-skia'];

  /** The only files allowed to load them, each reached through a probe. */
  const ALLOWED = [
    'components/frame/CameraFeedVision.native.tsx',
    'components/processing/ProcessingOrbSkiaCanvas.native.tsx',
    'components/resonance/ResonanceOrbSkiaCanvas.native.tsx',
  ];

  const featureRoot = path.resolve(__dirname, '..');

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        out.push(...sourceFiles(full));
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it('is imported at module scope only by the files the probe loads', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(featureRoot)) {
      const relative = path.relative(featureRoot, file).split(path.sep).join('/');
      if (ALLOWED.includes(relative)) continue;

      const source = fs.readFileSync(file, 'utf-8');
      for (const moduleName of OPTIONAL) {
        // A static import, as opposed to `await import(...)` inside a handler.
        if (new RegExp(`^\\s*import[^\\n]*from\\s+['"]${moduleName}['"]`, 'm').test(source)) {
          offenders.push(`${relative} statically imports ${moduleName}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('knows the allowed files still exist', () => {
    // Renaming one without updating this list would silently disarm the guard.
    for (const relative of ALLOWED) {
      expect(fs.existsSync(path.join(featureRoot, relative))).toBe(true);
    }
  });
});
