/**
 * Type resolution shim for the platform-split EdgeScoreRing implementation
 * (`.native.tsx` uses Skia, `.web.tsx` uses the View-based ring). Metro picks
 * the platform file; tsc resolves this declaration.
 */
import type React from 'react';

export declare function EdgeScoreRing(props: {
  score: number;
  size?: number;
}): React.JSX.Element;
