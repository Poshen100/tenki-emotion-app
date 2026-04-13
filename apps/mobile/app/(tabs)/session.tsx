import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/** Session tab — placeholder for session governance. */
export default function SessionScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.headline}>Session</Text>
      <Text style={styles.placeholder}>Session governance coming soon</Text>
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
