/**
 * ScanFreezeTimeline — TENKI Scan 頁面「2 秒凝固時刻」
 *
 * 動效敘事弧：
 *   IDLE → PRESS → SCANNING → FREEZE(2s) → REVEAL → RESULT
 *
 * 設計決策：
 *   - 凝固時刻 (FREEZE) 是整個 UX 的魔法節點
 *   - 數字從 blur(8px) → blur(0) 的 0.5s 窗口產生「數據正在凝固」感
 *   - 數字過衝 (overshoot): 到 target+5 再彈回，給數字「重量感」
 *   - 精度條像心跳：跳動式填充而非線性
 *   - 粒子在 FREEZE 時爆散後內聚，視覺引導用戶眼睛到數字中心
 *
 * 相依：
 *   - react-native-reanimated v3+
 *   - expo-haptics
 *   - react-native-svg
 *   - ./StardustOrb (v25.8.2 — 不修改內部邏輯，只傳 color token)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StardustOrb } from './StardustOrb'; // v25.8.2 原始元件

// ─────────────────────────────────────────────
// 類型定義
// ─────────────────────────────────────────────
export type ScanState =
  | 'idle'
  | 'press'
  | 'scanning'
  | 'freeze'
  | 'reveal'
  | 'result';

export type TEIState = 'clear' | 'neutral' | 'strain';

interface ScanFreezeTimelineProps {
  onScanComplete?: (score: number, state: TEIState) => void;
  mockScore?: number;      // Dev mode: 直接指定分數
  mockTEIState?: TEIState; // Dev mode: 直接指定狀態
}

// ─────────────────────────────────────────────
// 設計 Token（對應 DESIGN-SYSTEM.md）
// ─────────────────────────────────────────────
const TOKENS = {
  cyan:        '#00E5CC',
  amber:       '#FFB347',
  rose:        '#FF4D6D',
  bg:          '#080A0E',
  surface:     '#0D1117',
  surface2:    '#121820',
  textPrimary: '#E8EDF5',
  textMuted:   '#8A99B0',
  textFaint:   '#4A5668',
  border:      '#243042',
} as const;

const STATE_COLORS: Record<TEIState, string> = {
  clear:   TOKENS.cyan,
  neutral: TOKENS.amber,
  strain:  TOKENS.rose,
};

// ─────────────────────────────────────────────
// Timing 常數（每個數字對應一個設計決策）
// ─────────────────────────────────────────────
const T = {
  pressCollapse:   300,  // Orb 收縮到 scale(0.95)
  scanningRamp:    500,  // 粒子加速
  freezeEnter:     200,  // 進入凝固狀態
  blurClear:       500,  // blur(8px) → blur(0) ← 這是魔法的 0.5s
  numberReveal:    800,  // 數字 opacity 0→1
  numberOvershoot: 400,  // 計數到 target+5
  numberSettle:    300,  // 彈回 target
  precisionPulse:  200,  // 精度條跳動週期
  precisionFill:   600,  // 精度條填充總時長
  glowTransition:  600,  // glow 顏色切換
  resultBadge:     400,  // 狀態 Badge 滑入
} as const;

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────
export const ScanFreezeTimeline: React.FC<ScanFreezeTimelineProps> = ({
  onScanComplete,
  mockScore = 78,
  mockTEIState = 'clear',
}) => {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [displayScore, setDisplayScore] = useState(0);
  const [teiState, setTEIState] = useState<TEIState>('clear');
  const [precisionPct, setPrecisionPct] = useState(0);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animated Values ──────────────────────────
  const orbScale        = useSharedValue(1);
  const orbGlowOpacity  = useSharedValue(0.25);
  const scoreBlur       = useSharedValue(8);    // CSS: blur(Xpx)
  const scoreOpacity    = useSharedValue(0);
  const scoreScale      = useSharedValue(0.88);  // 從略小放大，增加重量感
  const precisionWidth  = useSharedValue(0);     // 0~1 比例
  const badgeTranslateY = useSharedValue(20);
  const badgeOpacity    = useSharedValue(0);
  const scanRingOpacity = useSharedValue(0);
  const scanRingScale   = useSharedValue(1);

  // ── Orb 呼吸動效 (IDLE) ──────────────────────
  useEffect(() => {
    if (scanState !== 'idle') return;
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
        withTiming(1.00, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
      ),
      -1, // 無限
      false
    );
    orbGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.40, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
        withTiming(0.20, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
      ),
      -1,
      false
    );
  }, [scanState]);

  // ── 完整動效 Timeline ────────────────────────
  const runFreezeTimeline = useCallback(async () => {
    // ① PRESS — 觸感 + Orb 收縮
    setScanState('press');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    orbScale.value = withSpring(0.95, { damping: 12, stiffness: 200 });
    orbGlowOpacity.value = withTiming(0.05, { duration: T.pressCollapse });

    await delay(T.pressCollapse);

    // ② SCANNING — 掃描環出現，粒子加速
    setScanState('scanning');
    orbScale.value = withSpring(1.0, { damping: 10, stiffness: 120 });
    scanRingOpacity.value = withTiming(1, { duration: 400 });
    // 掃描環動效：脈動式擴散（模擬同心圓）
    scanRingScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 0 }),
      ),
      -1,
      false
    );

    // 模擬 2 秒資料收集（實際接 HRV 引擎）
    await delay(1800);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // ③ FREEZE — 停止掃描環，進入凝固狀態
    setScanState('freeze');
    scanRingOpacity.value = withTiming(0, { duration: T.freezeEnter });
    orbScale.value = withTiming(1.0, { duration: T.freezeEnter });
    await delay(T.freezeEnter + 80); // 80ms 靜默間隙 ← 讓使用者「感覺到停頓」

    // ④ REVEAL — 魔法的 0.5s 窗口
    //    blur 從 8px → 0 + opacity 0 → 1 + scale 0.88 → 1
    //    三個動效同步觸發，造成「數字從虛空中凝固出現」感
    setScanState('reveal');
    setTEIState(mockTEIState);

    // 數字模糊揭露（同步觸發）
    scoreBlur.value    = withTiming(0,   { duration: T.blurClear,    easing: Easing.out(Easing.cubic) });
    scoreOpacity.value = withTiming(1,   { duration: T.numberReveal, easing: Easing.out(Easing.quad)  });
    scoreScale.value   = withSpring(1.0, { damping: 14, stiffness: 160 });

    // Glow 顏色隨狀態切換
    orbGlowOpacity.value = withTiming(0.45, { duration: T.glowTransition });

    // 數字計數：過衝效果
    await delay(T.blurClear * 0.3); // 等 blur 開始清晰後才開始計數
    runCountUp(0, mockScore, 1200, mockTEIState);

    // 精度條：心跳式填充
    runPrecisionHeartbeat(60); // 初步精度 60%

    await delay(1400);

    // ⑤ RESULT — 狀態 Badge 滑入
    setScanState('result');
    badgeOpacity.value    = withTiming(1, { duration: T.resultBadge });
    badgeTranslateY.value = withSpring(0, { damping: 16, stiffness: 200 });

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScanComplete?.(mockScore, mockTEIState);
  }, [mockScore, mockTEIState]);

  // ── 過衝計數器 ────────────────────────────────
  const runCountUp = (from: number, to: number, duration: number, state: TEIState) => {
    const overshoot = to + 5;
    let startTime: number | null = null;
    let phase: 'up' | 'settle' = 'up';
    let settleStart: number | null = null;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      if (phase === 'up') {
        const progress = Math.min(elapsed / (duration - T.numberSettle), 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(from + (overshoot - from) * eased);
        setDisplayScore(current);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          phase = 'settle';
          settleStart = now;
          requestAnimationFrame(tick);
        }
      } else {
        if (!settleStart) settleStart = now;
        const settleElapsed = now - settleStart;
        const settleProgress = Math.min(settleElapsed / T.numberSettle, 1);
        const eased = 1 - Math.pow(1 - settleProgress, 2); // ease-out quad
        const current = Math.round(overshoot + (to - overshoot) * eased);
        setDisplayScore(current);
        if (settleProgress < 1) requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  };

  // ── 心跳式精度填充 ────────────────────────────
  const runPrecisionHeartbeat = (targetPct: number) => {
    // 分 3 次脈動填充到目標，模擬每次 HRV 樣本的跳動感
    const steps = [
      { pct: targetPct * 0.55, delay: 0    },
      { pct: targetPct * 0.80, delay: 220  },
      { pct: targetPct,        delay: 450  },
    ];
    steps.forEach(({ pct, delay: d }) => {
      setTimeout(() => {
        setPrecisionPct(pct);
        precisionWidth.value = withSpring(pct / 100, {
          damping: 16,
          stiffness: 180,
        });
      }, d);
    });
  };

  // ── 重置 ──────────────────────────────────────
  const resetScan = useCallback(() => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setScanState('idle');
    setDisplayScore(0);
    setPrecisionPct(0);
    scoreBlur.value    = 8;
    scoreOpacity.value = 0;
    scoreScale.value   = 0.88;
    precisionWidth.value = 0;
    badgeOpacity.value    = 0;
    badgeTranslateY.value = 20;
    scanRingOpacity.value = 0;
    scanRingScale.value   = 1;
  }, []);

  // ── Animated Styles ──────────────────────────
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const scoreStyle = useAnimatedStyle(() => {
    const stateColor = STATE_COLORS[teiState];
    return {
      opacity: scoreOpacity.value,
      transform: [{ scale: scoreScale.value }],
      // blur 由 filter 模擬（RN 目前用 shadow/opacity 疊加模擬）
      // 精確 blur 效果見 ScanScoreBlur 子元件
    };
  });

  const scanRingStyle = useAnimatedStyle(() => ({
    opacity: scanRingOpacity.value,
    transform: [{ scale: scanRingScale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  const precisionFillStyle = useAnimatedStyle(() => ({
    width: `${precisionWidth.value * 100}%`,
  }));

  const canScan = scanState === 'idle' || scanState === 'result';
  const stateColor = STATE_COLORS[teiState];

  return (
    <View style={styles.container}>
      {/* ── 掃描環（掃描中出現）── */}
      <Animated.View style={[styles.scanRing, scanRingStyle,
        { borderColor: `${stateColor}66` }]} />

      {/* ── Stardust Orb（v25.8.2 原始視覺，只傳 token）── */}
      <Pressable
        onPress={canScan ? runFreezeTimeline : undefined}
        disabled={!canScan}
        style={styles.orbPressable}
        accessibilityRole="button"
        accessibilityLabel={canScan ? '開始掃描' : '掃描中'}
        accessibilityState={{ busy: !canScan }}
      >
        <Animated.View style={[styles.orbWrapper, orbStyle]}>
          <StardustOrb
            primaryColor={stateColor}
            scanState={scanState}
            size={ORB_SIZE}
          />

          {/* ── 2秒凝固：TEI 分數（overlay on Orb）── */}
          {(scanState === 'reveal' || scanState === 'result') && (
            <ScanScoreBlur
              score={displayScore}
              blur={scoreBlur}
              style={scoreStyle}
              color={stateColor}
            />
          )}
        </Animated.View>
      </Pressable>

      {/* ── Idle 文字提示 ── */}
      {scanState === 'idle' && (
        <View style={styles.idleHint}>
          <Text style={styles.idleHintText}>點擊開始掃描</Text>
          <Text style={styles.idleSubtext}>約 2 秒得到初步讀數</Text>
        </View>
      )}

      {/* ── 掃描中文字 ── */}
      {scanState === 'scanning' && (
        <View style={styles.scanningHint}>
          <Text style={styles.scanningText}>正在讀取...</Text>
        </View>
      )}

      {/* ── 凝固狀態：精度條 + 數值卡 ── */}
      {(scanState === 'reveal' || scanState === 'result') && (
        <View style={styles.metricsContainer}>
          {/* 精度條 */}
          <View style={styles.precisionRow}>
            <Text style={styles.precisionLabel}>精度</Text>
            <View style={styles.precisionTrack}>
              <Animated.View
                style={[
                  styles.precisionFill,
                  precisionFillStyle,
                  { backgroundColor: stateColor },
                ]}
              />
            </View>
            <Text style={[styles.precisionPct, { color: stateColor }]}>
              {Math.round(precisionPct)}%
            </Text>
          </View>

          {/* 繼續掃描提示 */}
          {scanState === 'result' && (
            <Text style={styles.continueHint}>
              保持 30 秒提升至 82% 精度
            </Text>
          )}
        </View>
      )}

      {/* ── 狀態 Badge（result 時滑入）── */}
      {scanState === 'result' && (
        <Animated.View style={[styles.stateBadge, badgeStyle,
          { borderColor: `${stateColor}40`,
            backgroundColor: `${stateColor}18` }]}>
          <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
          <Text style={[styles.stateBadgeText, { color: stateColor }]}>
            {teiState === 'clear'   ? 'Clear — 穩定'   :
             teiState === 'neutral' ? 'Neutral — 警戒' :
                                     'Strain — 過熱'}
          </Text>
        </Animated.View>
      )}

      {/* ── 重置按鈕（result 後出現）── */}
      {scanState === 'result' && (
        <Animated.View style={[{ opacity: badgeOpacity }]}>
          <Pressable onPress={resetScan} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>再次掃描</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// ScanScoreBlur — 模糊數字揭露子元件
// 用多層半透明疊加模擬 CSS blur 效果
// ─────────────────────────────────────────────
const ScanScoreBlur: React.FC<{
  score: number;
  blur: Animated.SharedValue<number>;
  style: ReturnType<typeof useAnimatedStyle>;
  color: string;
}> = ({ score, blur, style, color }) => {
  // blur 越大 → 底層 ghost 越明顯，造成「模糊」視覺
  const blurGhostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blur.value, [0, 8], [0, 0.6]),
  }));

  return (
    <Animated.View style={[styles.scoreOverlay, style]}>
      {/* Ghost 層（模擬 blur 暈散效果）*/}
      {[8, 5, 3, 1].map((offset) => (
        <Animated.Text
          key={offset}
          style={[
            styles.scoreGhost,
            blurGhostStyle,
            {
              color: `${color}${'30'.repeat(1)}`,
              transform: [
                { translateX: offset * 0.5 },
                { translateY: offset * 0.5 },
              ],
            },
          ]}
        >
          {score}
        </Animated.Text>
      ))}
      {/* 主數字層 */}
      <Text style={[styles.scoreMain, { color }]}>
        {score}
      </Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const { width: SCREEN_W } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_W * 0.55, 220);

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.bg,
    gap: 24,
    paddingHorizontal: 24,
  },

  // Orb
  orbPressable: {
    width: ORB_SIZE + 40,
    height: ORB_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 掃描環
  scanRing: {
    position: 'absolute',
    width: ORB_SIZE * 1.35,
    height: ORB_SIZE * 1.35,
    borderRadius: (ORB_SIZE * 1.35) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },

  // Score
  scoreOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMain: {
    fontFamily: 'Outfit',
    fontSize: 72,
    fontWeight: '300',
    letterSpacing: -4,
    lineHeight: 80,
  },
  scoreGhost: {
    position: 'absolute',
    fontFamily: 'Outfit',
    fontSize: 72,
    fontWeight: '300',
    letterSpacing: -4,
    lineHeight: 80,
  },

  // Idle hint
  idleHint: { alignItems: 'center', gap: 4 },
  idleHintText: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: TOKENS.textMuted,
    fontWeight: '400',
  },
  idleSubtext: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: TOKENS.textFaint,
  },

  // Scanning hint
  scanningHint: {},
  scanningText: {
    fontFamily: 'JetBrains Mono',
    fontSize: 13,
    color: TOKENS.cyan,
    letterSpacing: 1.5,
  },

  // Metrics
  metricsContainer: { width: '100%', gap: 8 },
  precisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  precisionLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: TOKENS.textMuted,
    width: 28,
  },
  precisionTrack: {
    flex: 1,
    height: 3,
    backgroundColor: TOKENS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  precisionFill: {
    height: '100%',
    borderRadius: 2,
  },
  precisionPct: {
    fontFamily: 'JetBrains Mono',
    fontSize: 12,
    width: 36,
    textAlign: 'right',
  },
  continueHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: TOKENS.textFaint,
    textAlign: 'center',
    marginTop: 4,
  },

  // State Badge
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateBadgeText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Reset
  resetBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  resetBtnText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: TOKENS.textMuted,
  },
});

export default ScanFreezeTimeline;
