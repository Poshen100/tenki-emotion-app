import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/** Today tab — placeholder for Edge Score display. */
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.headline}>Today</Text>
      <Text style={styles.placeholder}>Edge Score display coming soon</Text>
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
