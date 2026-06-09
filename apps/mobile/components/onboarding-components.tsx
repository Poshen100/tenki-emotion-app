import React from 'react';
import { View, StyleSheet, Text, Pressable, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Reusable dark premium background container with soft auroras and stardust.
 */
export function BackgroundContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {/* Navy gradient simulation */}
      <View style={styles.gradientTop} />
      
      {/* Subtle teal aurora glow top-right */}
      <View style={styles.tealGlow} />
      
      {/* Faint amber glow bottom-left */}
      <View style={styles.amberGlow} />

      {/* Subtle stardust specks */}
      <View style={[styles.star, { top: '15%', left: '10%' }]} />
      <View style={[styles.star, { top: '25%', left: '85%', opacity: 0.6 }]} />
      <View style={[styles.star, { top: '45%', left: '70%', opacity: 0.4 }]} />
      <View style={[styles.star, { top: '70%', left: '15%', opacity: 0.5 }]} />
      <View style={[styles.star, { top: '80%', left: '75%', opacity: 0.3 }]} />

      {children}
    </View>
  );
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
export function GlassMedallion({ children, style }: { children: React.ReactNode; style?: any }) {
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
  container: {
    flex: 1,
    backgroundColor: '#060E1C',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    backgroundColor: '#0A1628',
    opacity: 0.7,
  },
  tealGlow: {
    position: 'absolute',
    top: -height * 0.1,
    right: -width * 0.1,
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 9999,
    backgroundColor: '#5FE9D0',
    opacity: 0.06,
  },
  amberGlow: {
    position: 'absolute',
    bottom: -height * 0.08,
    left: -width * 0.1,
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: 9999,
    backgroundColor: '#FFC68A',
    opacity: 0.04,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#EAF1F8',
    opacity: 0.7,
  },
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
