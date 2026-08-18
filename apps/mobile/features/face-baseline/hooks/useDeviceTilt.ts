/**
 * @module face-baseline/hooks/useDeviceTilt
 * @description Reads device orientation so the orb can sit *in* the phone
 * rather than on it.
 *
 * Three things this deliberately does not do. It never asks for motion
 * permission on its own — the effect is decorative, and a permission prompt
 * for decoration is a bad trade. It returns flat zeros rather than throwing
 * when no sensor exists, which is the normal case on a simulator and on web.
 * And it goes silent under Reduce Motion, because parallax tied to how someone
 * holds their phone is exactly the kind of movement that setting exists to
 * stop.
 *
 * The raw signal is smoothed with the same damping the orb uses elsewhere, so
 * a hand tremor does not become a visible wobble.
 *
 * @see apps/mobile/features/face-baseline/utils/orbPhysics.ts
 */
import { useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { NO_TILT, dampedApproach, type Tilt } from '../utils/orbPhysics';

/** Sensor sampling interval in ms. 60Hz is far more than the effect needs. */
const UPDATE_INTERVAL_MS = 60;

/**
 * Tilt beyond which the effect is already at full strength, in radians.
 * Roughly 30 degrees — past that the phone is being handled, not held.
 */
const FULL_TILT_RAD = Math.PI / 6;

/** Smoothing half-life. Long enough to erase tremor, short enough to feel live. */
const SMOOTHING_HALF_LIFE_MS = 120;

function normalize(radians: number): number {
  const n = radians / FULL_TILT_RAD;
  return Math.min(1, Math.max(-1, Number.isFinite(n) ? n : 0));
}

/**
 * Current smoothed device tilt, each axis in -1..1.
 *
 * @param reducedMotion - When true, always reports no tilt.
 * @returns The tilt to feed {@link parallaxOffset}.
 */
export function useDeviceTilt(reducedMotion: boolean): Tilt {
  const [tilt, setTilt] = useState<Tilt>(NO_TILT);
  const smoothed = useRef<Tilt>({ ...NO_TILT });
  const lastAt = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      smoothed.current = { ...NO_TILT };
      setTilt(NO_TILT);
      return;
    }

    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        // No sensor is an ordinary outcome — simulators and web have none —
        // so the orb simply stays still rather than reporting a failure.
        if (!mounted || !available) return;

        DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = DeviceMotion.addListener((event) => {
          if (!mounted || event.rotation === undefined) return;

          const now = Date.now();
          const dt = lastAt.current === 0 ? UPDATE_INTERVAL_MS : now - lastAt.current;
          lastAt.current = now;

          // gamma is the left-right roll, beta the front-back pitch.
          const targetX = normalize(event.rotation.gamma);
          const targetY = normalize(event.rotation.beta);

          smoothed.current = {
            x: dampedApproach(smoothed.current.x, targetX, dt, SMOOTHING_HALF_LIFE_MS),
            y: dampedApproach(smoothed.current.y, targetY, dt, SMOOTHING_HALF_LIFE_MS),
          };
          setTilt({ ...smoothed.current });
        });
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      subscription?.remove();
      lastAt.current = 0;
    };
  }, [reducedMotion]);

  return tilt;
}
