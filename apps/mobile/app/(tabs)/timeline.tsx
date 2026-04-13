import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/** Timeline tab — placeholder for history & trends. */
export default function TimelineScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.headline}>Timeline</Text>
      <Text style={styles.placeholder}>Session history coming soon</Text>
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
