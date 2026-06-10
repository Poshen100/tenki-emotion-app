/**
 * @module face-baseline/hooks/useReducedMotion
 * @description Reflects the OS "Reduce Motion" accessibility setting and mirrors
 * it into the store so any component can gate animations on a single source of
 * truth. Defaults to `false` and degrades gracefully if the query fails.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFaceBaselineStore } from '../store/faceBaselineStore';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  const setReducedMotion = useFaceBaselineStore((s) => s.setReducedMotion);

  useEffect(() => {
    let mounted = true;
    const apply = (value: boolean): void => {
      if (!mounted) return;
      setReduced(value);
      setReducedMotion(value);
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(apply)
      .catch(() => undefined);

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [setReducedMotion]);

  return reduced;
}
