import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

interface ScanButtonProps {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
}

/** Primary CTA button to start a scan. */
export function ScanButton({ onPress, label = 'Start Scan', disabled = false }: ScanButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    backgroundColor: colors.card,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  disabledText: {
    color: colors.textTertiary,
  },
});
