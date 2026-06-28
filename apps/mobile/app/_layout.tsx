import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { colors } from '../theme';

export default function RootLayout() {
  // @shopify/react-native-skia's web backend (CanvasKit/WASM) loads
  // asynchronously; mounting a Skia <Canvas> before it resolves throws
  // ("Cannot read properties of undefined (reading 'Path'/'PictureRecorder')").
  // Native platforms have no such load step, so they render immediately.
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb').then(({ LoadSkiaWeb }) =>
      // canvaskit.wasm is served from apps/mobile/public/ (copied there by
      // `npx setup-skia-web`); Metro inlines the loader JS, so it can't infer
      // the wasm's URL from its own location like a normal <script> would.
      LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
        setSkiaReady(true);
      })
    );
  }, []);

  if (!skiaReady) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
