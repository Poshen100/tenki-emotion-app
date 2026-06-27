import type React from 'react';
import { StyleSheet, Text, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/user-store';
import { useFaceBaselineStore } from '../../features/face-baseline/store/faceBaselineStore';
import {
  NavBar,
  GlassInfoCard,
  GlowPrimaryButton,
  PrivacyFootnote,
} from '../../features/face-baseline/components';
import { faceBaselineTokens as t } from '../../features/face-baseline/tokens/faceBaseline.tokens';
import { OceanBackground } from '../../components/OceanBackground';
import { ScanTapRing } from '../../components/ScanTapRing';

export default function ScanScreen(): React.JSX.Element {
  const router = useRouter();
  const hasBaseline = useUserStore((s) => s.hasBaseline);

  const handleDailyScanPress = (): void => {
    // Set the store entry context to standalone
    useFaceBaselineStore.getState().setEntryContext('standalone');

    if (hasBaseline) {
      router.push('/face-baseline/maturity');
    } else {
      router.push('/face-baseline');
    }
  };

  const handleFingerCalibratePress = (): void => {
    router.push('/finger-precision');
  };

  return (
    <OceanBackground mode="warm">
      <SafeAreaView style={styles.safe}>
        <NavBar title="Soul Scan" showLogo={true} titleColor="#FFFFFF" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Daily Face Scan Card (Gold accent) */}
          <GlassInfoCard edge="gold" style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.badgeGold}>
                <Text style={styles.badgeTextGold}>DAILY RITUAL</Text>
              </View>
              <ScanTapRing onPress={handleDailyScanPress} accent="gold" />
            </View>
            <Text style={styles.cardTitle}>今日星塵臉部掃描</Text>
            <Text style={styles.cardDesc}>
              {hasBaseline
                ? '對照你的個人臉部基線，讀取今日的生理適應與共振狀態。'
                : '建立你的個人臉部基線，開啟每日星塵靈魂掃描。'}
            </Text>
            <GlowPrimaryButton
              accent="gold"
              label={hasBaseline ? '開始今日 Soul Scan' : '建立 Face Baseline'}
              onPress={handleDailyScanPress}
              style={styles.cardButton}
            />
          </GlassInfoCard>

          {/* Finger Calibration Card (Cyan accent) */}
          <GlassInfoCard edge="cyan" style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.badgeCyan}>
                <Text style={styles.badgeTextCyan}>HIGH PRECISION</Text>
              </View>
              <ScanTapRing onPress={handleFingerCalibratePress} accent="cyan" size={56} />
            </View>
            <Text style={styles.cardTitle}>手指接觸校準</Text>
            <Text style={styles.cardDesc}>
              藉由接觸式光學 PPG，重新量取 face↔finger 偏差，讓日常臉掃結果更為精準。
            </Text>
            <GlowPrimaryButton
              accent="cyan"
              label="開始手指校準"
              onPress={handleFingerCalibratePress}
              style={styles.cardButton}
            />
          </GlassInfoCard>

          <View style={styles.footnoteContainer}>
            <PrivacyFootnote text="所有生理數據均於本機即時處理，影像與波形絕不上傳雲端。" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </OceanBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: t.spacing.gutter,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xxl,
  },
  cardContent: {
    paddingVertical: t.spacing.cardPad,
    paddingHorizontal: t.spacing.cardPad,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.sm,
  },
  badgeGold: {
    backgroundColor: 'rgba(232, 180, 90, 0.15)',
    borderColor: 'rgba(232, 180, 90, 0.3)',
    borderWidth: 1,
    borderRadius: t.radius.badge,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  badgeTextGold: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFE9B0',
    letterSpacing: 1,
  },
  badgeCyan: {
    backgroundColor: 'rgba(61, 224, 255, 0.15)',
    borderColor: 'rgba(61, 224, 255, 0.3)',
    borderWidth: 1,
    borderRadius: t.radius.badge,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  badgeTextCyan: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8E9FF',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: t.text.cardTitle.size,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: t.spacing.sm,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: t.color.text.secondary,
    marginBottom: t.spacing.lg,
  },
  cardButton: {
    width: '100%',
  },
  footnoteContainer: {
    marginTop: t.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
