import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../theme';

/**
 * react-native-gesture-handler has been a dependency all along but nothing
 * mounted its root view, which React Navigation requires — so any RNGH gesture
 * would have been dead on Android. It wraps everything here, at the outermost
 * level and with `flex: 1`, which is the only arrangement that works.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}
