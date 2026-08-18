import type React from 'react';
import { View, StyleSheet, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { CosmicBackground } from '../features/face-baseline/components/shared/CosmicBackground';
import { useReducedMotion } from '../features/face-baseline/hooks/useReducedMotion';
import { composeAtmosphere, type AtmosphereZone } from '../features/face-baseline/utils/atmosphere';
import { getZoneForScore } from '../theme';


/**
 * Dark premium background for the tab and onboarding screens.
 *
 * This used to be five hard-coded dots and three static glows, while the real
 * animated sky lived in the face-baseline flow — where no Edge Score exists
 * yet. So the one background that could react to the user's Zone was the one
 * that never saw it. It now delegates to {@link CosmicBackground}, and screens
 * that know the score can pass it.
 *
 * @param score - Latest Edge Score, or null/undefined when nothing has been
 *   scanned. Classified with the existing {@link getZoneForScore}; the 70/40
 *   boundary is not restated here.
 * @param maturityRatio - Baseline maturity 0–1, surfacing circuit traces as it
 *   rises. Defaults to 0.
 */
export function BackgroundContainer({
  children,
  score,
  maturityRatio = 0,
}: {
  children: React.ReactNode;
  score?: number | null;
  maturityRatio?: number;
}) {
  const reducedMotion = useReducedMotion();
  const zone: AtmosphereZone =
    score === null || score === undefined ? 'unknown' : getZoneForScore(score).name;
  const atmosphere = composeAtmosphere(zone, maturityRatio, reducedMotion);

  return <CosmicBackground atmosphere={atmosphere}>{children}</CosmicBackground>;
}

/**
 * 6-dot step progress indicator.
 */
export function ProgressIndicator({ activeStep }: { activeStep: number }) {
  return (
    <View style={styles.indicatorContainer}>
      {[0, 1, 2, 3, 4, 5].map((step) => {
        const isActive = step === activeStep;
        return (
          <View
            key={step}
            style={[
              styles.dot,
              isActive ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * Premium glass medallion wrapper.
 */
export function GlassMedallion({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.medallion, style]}>
      <View style={styles.innerHighlight} />
      {children}
    </View>
  );
}

/**
 * Pill-shaped primary button with arrow chevron.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && styles.primaryBtnPressed,
        disabled && styles.primaryBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
      <Text style={styles.primaryBtnChevron}>›</Text>
    </Pressable>
  );
}

/**
 * Ghost outline secondary button.
 */
export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryBtn,
        pressed && styles.secondaryBtnPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Underlined tertiary text link.
 */
export function TertiaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tertiaryLink,
        pressed && styles.tertiaryLinkPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.tertiaryLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#5FE9D0',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(94, 117, 150, 0.4)',
  },
  medallion: {
    backgroundColor: 'rgba(28, 44, 76, 0.35)',
    borderColor: 'rgba(95, 233, 208, 0.15)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5FE9D0',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 9999,
    width: '100%',
    position: 'relative',
  },
  primaryBtnPressed: {
    backgroundColor: '#9CFFEF',
    transform: [{ scale: 0.985 }],
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(94, 117, 150, 0.25)',
  },
  primaryBtnText: {
    color: '#04141A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  primaryBtnChevron: {
    color: '#04141A',
    fontSize: 22,
    fontWeight: '700',
    position: 'absolute',
    right: 24,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(157, 178, 204, 0.25)',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 9999,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  secondaryBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    transform: [{ scale: 0.985 }],
  },
  secondaryBtnText: {
    color: '#EAF1F8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tertiaryLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tertiaryLinkPressed: {
    opacity: 0.6,
  },
  tertiaryLinkText: {
    color: '#9DB2CC',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
