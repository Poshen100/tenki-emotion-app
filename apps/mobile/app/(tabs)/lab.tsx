import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/** Lab tab — placeholder for growth tools & settings. */
export default function LabScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.headline}>Lab</Text>
      <Text style={styles.placeholder}>Growth tools coming soon</Text>
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
