import type React from 'react';

export interface CameraFeedViewProps {
  size?: number;
  active?: boolean;
}

export function CameraFeedView({ size = 240, active = false }: CameraFeedViewProps): React.JSX.Element {
  // TypeScript base fallback placeholder - actual implementations resolved via .native.tsx and .web.tsx
  return <></>;
}
