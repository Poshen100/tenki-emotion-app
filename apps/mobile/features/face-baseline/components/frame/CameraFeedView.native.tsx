/**
 * @module face-baseline/components/CameraFeedView.native
 * @description Shows the real camera when there is one, and says so plainly
 * when there is not.
 *
 * `react-native-vision-camera` is not among the native modules Expo Go bundles,
 * and its JS entry throws while evaluating when the native half is missing —
 * which took down every capture screen and made the scan ritual impossible to
 * look at without a development build.
 *
 * The fallback deliberately does not fake a feed. A capture that cannot read
 * anything must not look like a capture that is working.
 */
import type React from 'react';
import { probeOptionalModule } from '../../utils/optionalNative';
import { CameraFeedUnavailable } from './CameraFeedUnavailable';

export interface CameraFeedViewProps {
  size?: number;
  active?: boolean;
}

type FeedComponent = (props: CameraFeedViewProps) => React.JSX.Element;

/** Resolved once at module load; the native module cannot appear mid-session. */
const vision = probeOptionalModule<{ CameraFeedVision: FeedComponent }>(() =>
  require('./CameraFeedVision'),
);

export const CameraFeedView: FeedComponent = vision.available
  ? (vision.module as { CameraFeedVision: FeedComponent }).CameraFeedVision
  : ({ size }: CameraFeedViewProps) => <CameraFeedUnavailable size={size} />;
