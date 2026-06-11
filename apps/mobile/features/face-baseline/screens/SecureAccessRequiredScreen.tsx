/**
 * @module face-baseline/screens/SecureAccessRequiredScreen
 * @description Screen 3 — permission rationale shown BEFORE the OS prompt.
 * Reference: gold trust shield + numbered privacy guarantees + cyan CTA.
 *
 * INTEGRATION (useCameraPermission): replace the mocked grant with a real
 * permission request; route to permission_denied on denial.
 */
import type React from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CosmicBackground,
  BrandWordmark,
  TrustShield,
  PrivacyAssuranceList,
  GlowPrimaryButton,
  TextLink,
  NavBar,
} from '../components';
import { FACE_BASELINE_COPY as C } from '../copy/face-baseline.copy';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { faceBaselineTokens as t } from '../tokens/faceBaseline.tokens';
import { FB_ROUTES } from './routes';

import { Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';

export default function SecureAccessRequiredScreen(): React.JSX.Element {
  const router = useRouter();
  const goTo = useFaceBaselineStore((s) => s.goTo);
  const setPermission = useFaceBaselineStore((s) => s.setPermission);

  useEffect(() => {
    goTo('permission_rationale');
  }, [goTo]);

  const onEnable = async (): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Explicit user-triggered browser camera request on button click
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          // Stop stream tracks immediately since we only checked permission
          stream.getTracks().forEach((track) => track.stop());
          setPermission('granted');
          router.push(FB_ROUTES.environment);
        } catch (err) {
          console.warn('Browser camera permission denied:', err);
          setPermission('denied');
          router.push(FB_ROUTES.environment);
        }
      } else {
        setPermission('granted');
        router.push(FB_ROUTES.environment);
      }
    } else {
      // Native Camera Permission
      try {
        const status = await Camera.requestCameraPermission();
        setPermission(status);
        router.push(FB_ROUTES.environment);
      } catch (err) {
        console.warn('Native camera permission request failed:', err);
        setPermission('denied');
        router.push(FB_ROUTES.environment);
      }
    }
  };

  return (
    <CosmicBackground mode="dim">
      <SafeAreaView style={styles.safe}>
        <NavBar onBack={() => router.back()} />
        <View style={styles.head}>
          <BrandWordmark />
          <View style={styles.shield}>
            <TrustShield size={88} />
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{C.secure.title}</Text>
          <View style={styles.list}>
            <PrivacyAssuranceList items={C.secure.assurances} />
          </View>
        </View>
        <View style={styles.footer}>
          <GlowPrimaryButton accent="cyan" label={C.secure.cta} onPress={onEnable} />
          <TextLink label={C.secure.privacyLink} onPress={() => router.push(FB_ROUTES.why)} />
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: t.spacing.gutter },
  head: { alignItems: 'center', gap: t.spacing.lg },
  shield: { marginTop: t.spacing.sm },
  body: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: t.text.hero.size,
    fontWeight: '800',
    color: t.color.text.primary,
    marginBottom: t.spacing.xl,
    textAlign: 'center',
  },
  list: { marginTop: t.spacing.sm },
  footer: { paddingBottom: t.spacing.ctaDock, gap: t.spacing.sm, alignItems: 'center' },
});
