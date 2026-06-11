/**
 * Type resolution shim for the platform-split ProcessingOrbSkia implementation
 * (`.native.tsx` uses Skia, `.web.tsx` uses core RN). Metro picks the platform
 * file; tsc resolves this declaration.
 */
import type React from 'react';

export declare function ProcessingOrbSkia(props: {
  progress: number;
  size?: number;
}): React.JSX.Element;
