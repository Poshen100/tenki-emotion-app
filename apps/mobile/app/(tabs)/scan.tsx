import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/** Scan tab — placeholder for FHZ scanner. */
export default function ScanScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.headline}>Scan</Text>
      <Text style={styles.placeholder}>Finger Heat Zone scanner coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  placeholder: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
