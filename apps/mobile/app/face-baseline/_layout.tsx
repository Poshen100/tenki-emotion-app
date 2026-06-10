import { Stack } from 'expo-router';
import { colors } from '../../theme';

/**
 * Dedicated Face Baseline onboarding stack — intentionally separate from the
 * generic scan tab. Fade transitions keep the cosmic calm between screens.
 */
export default function FaceBaselineLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
