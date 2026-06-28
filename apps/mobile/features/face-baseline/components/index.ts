/**
 * @module face-baseline/components
 * @description Barrel for Face Baseline UI components.
 * Core-RN implementations faithful to the reference frames; Skia/Reanimated/
 * camera upgrades are marked `INTEGRATION` in each file.
 */
export { CosmicBackground } from './shared/CosmicBackground';
export type { CosmicMode } from './shared/CosmicBackground';
export { GlowPrimaryButton } from './shared/GlowPrimaryButton';
export { GhostButton, TextLink } from './shared/Buttons';
export {
  BrandWordmark,
  BaselineHeroCopy,
  TimeCostChip,
  PrivacyLockPill,
  PrivacyFootnote,
  NavBar,
} from './shared/Primitives';

export { GlassInfoCard } from './glass/GlassInfoCard';
export { ResonanceWaveGlyph } from './education/ResonanceWaveGlyph';
export { CarouselDots } from './education/CarouselDots';
// TrustShield is intentionally NOT re-exported here: it statically imports
// @shopify/react-native-skia, and this barrel is imported (eagerly, on web) by many
// face-baseline screens that Expo Router requires up front to build its route table.
// Re-exporting it would evaluate Skia.web.js before LoadSkiaWeb (app/_layout.tsx) resolves
// CanvasKit, permanently wedging the shared Skia singleton. Its one consumer
// (SecureAccessRequiredScreen) imports it directly via a lazy dynamic import instead.
export { PrivacyAssuranceList } from './permission/PrivacyAssuranceList';
export type { AssuranceItem } from './permission/PrivacyAssuranceList';
export { EnvironmentChecklist, ChecklistRow } from './env/EnvironmentChecklist';
export type { CheckStatus, ChecklistItem } from './env/EnvironmentChecklist';
export { FaceScanFrame } from './frame/FaceScanFrame';
export type { ScanShape, ScanState } from './frame/FaceScanFrame';
export { CameraFeedView } from './frame/CameraFeedView';
export { SegmentedProgress } from './capture/SegmentedProgress';
export { SoulParticleMesh } from './capture/SoulParticleMesh';
export { QualityStatusPills } from './capture/QualityStatusPills';
export { MotionGuideCue } from './capture/MotionGuideCue';
export { ProcessingOrb, PercentReadout } from './processing/ProcessingOrb';
export { ResonanceOrb } from './resonance/ResonanceOrb';
export { MaturityProgressBar } from './maturity/MaturityProgressBar';
export { ScanHistoryRow } from './maturity/ScanHistoryRow';
export { TechnicalInsightCard } from './maturity/TechnicalInsightCard';
export { RecoveryChecklist } from './recovery/RecoveryChecklist';
export { BaselineSuccessCard } from './success/BaselineSuccessCard';
