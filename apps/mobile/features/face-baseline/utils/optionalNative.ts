/**
 * @module face-baseline/utils/optionalNative
 * @description Loading a native module that may not exist, without taking the
 * whole screen down with it.
 *
 * Expo Go ships a fixed set of native modules. Two of this app's dependencies
 * are not among them — `react-native-vision-camera` and
 * `@shopify/react-native-skia` — and both throw while their JS entry point is
 * evaluating, because the JS half is installed while the native half is not.
 * An unguarded top-level import therefore takes down every screen that renders
 * the component, which is why the scan flow could not be looked at without a
 * development build.
 *
 * The probe catches that throw so a screen can fall back to something honest
 * instead of a red box. It is not a way to pretend a capability exists: a
 * caller that cannot do without the module should say so on screen rather than
 * simulate it.
 *
 * @see apps/mobile/features/face-baseline/components/frame/CameraFeedView.native.tsx
 */

/** The outcome of trying to load an optional native module. */
export interface OptionalModule<T> {
  /** Whether the module loaded and is usable. */
  available: boolean;
  /** The module, or null when it did not load. */
  module: T | null;
  /** Why it did not load. Null when it did. */
  reason: string | null;
}

/**
 * Best-effort message for anything a `throw` can produce.
 *
 * Module entry points throw strings and bare objects as readily as they throw
 * Errors, and a reason of "[object Object]" in a log helps nobody.
 *
 * @param error - Whatever was caught.
 * @returns A human-readable message, never empty.
 */
export function describeLoadFailure(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  if (error === null) return 'threw null';
  if (error === undefined) return 'threw undefined';

  try {
    const text = JSON.stringify(error);
    if (text !== undefined && text !== '{}') return text;
  } catch {
    // Circular or otherwise unserializable — fall through to the type name.
  }
  return `threw a non-Error value of type ${typeof error}`;
}

/**
 * Runs a module loader, converting a failure into a value instead of a crash.
 *
 * The loader is a thunk rather than a module name so the call site keeps a
 * literal `require`, which is what lets Metro see the dependency and bundle it.
 * A dynamically built specifier would not be bundled at all.
 *
 * @param load - Thunk that requires the module.
 * @returns Whether it loaded, and the module or the reason it did not.
 */
export function probeOptionalModule<T>(load: () => T): OptionalModule<T> {
  try {
    const module = load();
    if (module === null || module === undefined) {
      return { available: false, module: null, reason: 'module resolved to nothing' };
    }
    return { available: true, module, reason: null };
  } catch (error) {
    return { available: false, module: null, reason: describeLoadFailure(error) };
  }
}
