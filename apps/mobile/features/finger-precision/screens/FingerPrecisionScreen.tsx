/**
 * @module finger-precision/screens/FingerPrecisionScreen
 * @description Unified execution screen for the Finger PPG Precision Flow.
 * Handles the full 11-state machine lifecycle, mock PPG sensor simulation,
 * and multi-modal baseline fusion.
 *
 * @version 1.0
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useFingerPrecisionStore } from '../store/fingerPrecisionStore';
import { selectCanStartScan, selectCanStopEarly, selectTotalProgress } from '../store/selectors';
import { transition } from '../machine/fingerPrecisionMachine';
import { FINGER_PRECISION_COPY } from '../copy/finger-precision.copy';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

import { FingerContactCore } from '../components/FingerContactCore';
import { PulseRing } from '../components/PulseRing';
import { QualityDots } from '../components/QualityDots';
import { PrecisionArc } from '../components/PrecisionArc';
import { CoachCopy } from '../components/CoachCopy';
import { PrecisionTierBadge } from '../components/PrecisionTierBadge';
import { RecoveryOverlay } from '../components/RecoveryOverlay';
import { BlendResultCard } from '../components/BlendResultCard';

import { GlowPrimaryButton } from '../../face-baseline/components/shared/GlowPrimaryButton';
import { useUserStore } from '../../../stores/user-store';
import { blendFingerWithFaceBaseline } from '../../../../../packages/engine/src/baseline/multi-modal-blend';


export default function FingerPrecisionScreen(): React.JSX.Element {
  const router = useRouter();
  const store = useFingerPrecisionStore();
  const userStore = useUserStore();

  const totalProgress = selectTotalProgress(store);
  const canStartScan = selectCanStartScan(store);
  const canStopEarly = selectCanStopEarly(store);

  // Copy dictionary
  const C = FINGER_PRECISION_COPY.en; // English by default

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    };
  }, []);

  // FSM Event Handlers
  const handleStart = () => {
    store.goTo('permission_check');
    
    // Automatically trigger permission grant in simulation
    simulationTimeoutRef.current = setTimeout(() => {
      store.setCameraPermission('granted');
      store.setTorchAvailable(true);
      store.goTo('readiness_check');
      simulateReadiness();
    }, 1200);
  };

  const handleExit = () => {
    store.reset();
    if (timerRef.current) clearInterval(timerRef.current);
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    router.back();
  };

  // Readiness Phase Simulation
  const simulateReadiness = () => {
    store.setDotStatus({ cover: 'red', still: 'red', pressure: 'red' });
    
    // Step 1: Cover camera -> Yellow then Green
    simulationTimeoutRef.current = setTimeout(() => {
      store.setDotStatus({ cover: 'yellow' });
      
      simulationTimeoutRef.current = setTimeout(() => {
        store.setDotStatus({ cover: 'green', still: 'yellow' });
        store.setContactDetected(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        store.goTo('placement_guide');
        
        // Step 2: Hold still & establish pressure
        simulationTimeoutRef.current = setTimeout(() => {
          store.setDotStatus({ still: 'green', pressure: 'yellow' });
          
          simulationTimeoutRef.current = setTimeout(() => {
            store.setDotStatus({ pressure: 'green' });
            store.goTo('signal_locking');
            store.setSignalLocked(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            
            // Step 3: Locked -> Quick Estimate
            simulationTimeoutRef.current = setTimeout(() => {
              store.goTo('quick_estimate');
              
              // Step 4: Quick Estimate -> Precision Build
              simulationTimeoutRef.current = setTimeout(() => {
                store.goTo('precision_build');
                startPrecisionBuildTimer();
              }, 2000);
            }, 2000);
          }, 1500);
        }, 1500);
      }, 1200);
    }, 1200);
  };

  // Precision Build Phase Simulator
  const startPrecisionBuildTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    let beats = store.precision.validBeats;
    let elapsed = store.precision.elapsedMs;
    let isRecovering = false;

    timerRef.current = setInterval(() => {
      if (isRecovering) return;

      // Increment elapsed time
      elapsed += 200;

      // Randomly increment valid beats (simulates real pulse detection)
      if (Math.random() > 0.35) {
        beats += 1;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Calculate progress and tier
      const targetBeats = 150;
      const overallProgress = Math.min(1, beats / targetBeats);
      const earlyStop = beats >= 60;
      
      let currentTier: 'quick' | 'stable' | 'strong' | 'best' = 'quick';
      let tierProgress = 0;

      if (beats < 30) {
        currentTier = 'quick';
        tierProgress = beats / 30;
      } else if (beats < 60) {
        currentTier = 'stable';
        tierProgress = (beats - 30) / 30;
      } else if (beats < 90) {
        currentTier = 'strong';
        tierProgress = (beats - 60) / 30;
      } else {
        currentTier = 'best';
        tierProgress = Math.min(1, (beats - 90) / 60);
      }

      store.updatePrecision({
        validBeats: beats,
        elapsedMs: elapsed,
        currentTier,
        tierProgress,
        overallProgress,
        canStopEarly: earlyStop,
      });

      // Update live BPM and HRV display periodically
      if (beats % 5 === 0) {
        store.setCurrentBpm(Math.round(68 + Math.random() * 8));
        store.setCurrentHrvRmssd(Math.round(42 + Math.random() * 12));
      }

      // SIMULATION NUDGE: Quality drop at 42 beats to demonstrate quality recovery flow
      if (beats === 42 && store.recoveryCount === 0) {
        isRecovering = true;
        store.goTo('quality_recovery');
        store.incrementRecovery('pressure_high');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Simulating 2.5s recovery
        simulationTimeoutRef.current = setTimeout(() => {
          store.goTo('precision_build');
          store.resetRecovery();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          isRecovering = false;
        }, 2500);
      }

      // Completed target
      if (beats >= 150) {
        if (timerRef.current) clearInterval(timerRef.current);
        triggerProcessing();
      }
    }, 200);
  };

  const handleStopEarly = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    triggerProcessing();
  };

  const triggerProcessing = () => {
    store.goTo('processing');
    store.setProcessing('computing', 0.2);

    let progress = 0.2;
    const procInterval = setInterval(() => {
      progress += 0.25;
      if (progress >= 1.0) {
        clearInterval(procInterval);
        store.setProcessing('done', 1.0);
        computeFinalBlend();
      } else {
        store.setProcessing('computing', progress);
      }
    }, 500);
  };

  const computeFinalBlend = () => {
    const finalBeats = store.precision.validBeats;
    const finalBpm = store.currentBpm ?? 72;
    const finalHrv = store.currentHrvRmssd ?? 48;

    // Build raw mock reading and quality
    const reading = {
      hrBpm: finalBpm,
      hrvRmssdMs: finalHrv,
      rrBrpm: 15,
      timestamp: Date.now(),
    };

    const quality = {
      score: 92,
      grade: 'A' as const,
      coverage: 0.95,
      stability: 0.90,
      acceptable: true,
    };

    // Calculate face baseline using empty profile default
    const faceBaseline = {
      hr: { morning: { mean: 72, std: 5, sampleCount: 2, lastUpdatedAt: Date.now() }, midday: { mean: 72, std: 5, sampleCount: 0, lastUpdatedAt: 0 }, evening: { mean: 72, std: 5, sampleCount: 0, lastUpdatedAt: 0 } },
      hrv: { morning: { mean: 45, std: 6, sampleCount: 2, lastUpdatedAt: Date.now() }, midday: { mean: 45, std: 6, sampleCount: 0, lastUpdatedAt: 0 }, evening: { mean: 45, std: 6, sampleCount: 0, lastUpdatedAt: 0 } },
      rr: { morning: { mean: 15, std: 2, sampleCount: 2, lastUpdatedAt: Date.now() }, midday: { mean: 15, std: 2, sampleCount: 0, lastUpdatedAt: 0 }, evening: { mean: 15, std: 2, sampleCount: 0, lastUpdatedAt: 0 } },
      stressProxy: { mean: 50, std: 10, sampleCount: 2, lastUpdatedAt: Date.now() },
      maturity: 'ready' as const,
      totalScanCount: 2,
      version: '3.0.0',
    };

    // Execute multi-modal fusion
    const blendRes = blendFingerWithFaceBaseline({
      faceBaseline,
      fingerReading: reading,
      fingerQuality: quality,
    });

    const result = {
      bpm: finalBpm,
      hrvRmssdMs: finalHrv,
      rrBrpm: 15,
      validBeats: finalBeats,
      signalQualityScore: 92,
      confidenceUplift: blendRes.confidenceUplift,
    };

    // Update stores
    store.setResult(result, blendRes.blendMode);
    
    // Save calibration to user store
    userStore.setLastFingerCalibrationTime(Date.now());
    userStore.setFingerReminderDismissed(true);
    userStore.setFaceBaselineCount(3); // unlock full baseline state
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    store.goTo('scan_complete');
  };

  const handleRetry = () => {
    store.reset();
    store.goTo('placement_guide');
    simulateReadiness();
  };

  // UI Render Switcher
  const renderContent = () => {
    const step = store.step;

    switch (step) {
      case 'intro':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <FingerContactCore
                contactDetected={false}
                signalLocked={false}
                bpm={null}
              />
              <Text style={styles.title}>{C.intro.title}</Text>
              <Text style={styles.subtitle}>{C.intro.subtitle}</Text>
            </View>
            <View style={styles.footer}>
              <GlowPrimaryButton
                accent="cyan"
                label={C.intro.cta}
                onPress={handleStart}
              />
              <Pressable style={styles.ghostBtn} onPress={handleExit}>
                <Text style={styles.ghostBtnText}>{C.intro.notNow}</Text>
              </Pressable>
              <Text style={styles.privacyNote}>🔒 {C.intro.privacyNote}</Text>
            </View>
          </View>
        );

      case 'permission_check':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <Text style={styles.title}>{C.permission.title}</Text>
              <Text style={styles.subtitle}>{C.permission.body}</Text>
              <ActivityIndicator color={t.colors.precisionLow} style={{ marginTop: 24 }} />
            </View>
          </View>
        );

      case 'readiness_check':
      case 'placement_guide':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <FingerContactCore
                contactDetected={store.contactDetected}
                signalLocked={store.signalLocked}
                bpm={null}
              />
              <CoachCopy text={C.placement.instruction} />
              <View style={styles.tipsList}>
                {C.placement.tips.map((tip) => (
                  <Text key={tip} style={styles.tipText}>• {tip}</Text>
                ))}
              </View>
            </View>
            <View style={styles.footer}>
              <QualityDots
                cover={store.coverStatus}
                still={store.stillStatus}
                pressure={store.pressureStatus}
                labels={{
                  cover: C.readiness.cover,
                  still: C.readiness.still,
                  pressure: C.readiness.pressure,
                }}
              />
              <Text style={styles.statusLabel}>
                {store.step === 'readiness_check' ? C.readiness.waiting : C.locking.status}
              </Text>
            </View>
          </View>
        );

      case 'signal_locking':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <View style={styles.pulsingWrapper}>
                <PulseRing beatCount={1} active={true} />
                <FingerContactCore
                  contactDetected={true}
                  signalLocked={true}
                  bpm={72}
                />
              </View>
              <CoachCopy text={C.locking.instruction} />
            </View>
            <View style={styles.footer}>
              <QualityDots
                cover={store.coverStatus}
                still={store.stillStatus}
                pressure={store.pressureStatus}
                labels={{
                  cover: C.readiness.cover,
                  still: C.readiness.still,
                  pressure: C.readiness.pressure,
                }}
              />
              <Text style={styles.statusLabel}>{C.locking.status}</Text>
            </View>
          </View>
        );

      case 'quick_estimate':
      case 'precision_build':
      case 'quality_recovery': {
        // Determine the coach copy instruction
        let instruction: string = C.build.instruction;
        if (store.precision.currentTier === 'stable') instruction = C.build.instructionStable;
        else if (store.precision.currentTier === 'strong') instruction = C.build.instructionStrong;
        
        const isRecovering = store.step === 'quality_recovery';
        const recoveryReason = store.recoveryReason ?? 'signal_unstable';
        const recoveryInstruction = C.recovery[recoveryReason];

        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <View style={styles.pulsingWrapper}>
                <PulseRing beatCount={store.precision.validBeats} active={true} />
                <PrecisionArc progress={totalProgress} size={150} strokeWidth={6} />
                <FingerContactCore
                  contactDetected={true}
                  signalLocked={true}
                  bpm={store.currentBpm}
                />
              </View>
              <CoachCopy text={isRecovering ? recoveryInstruction : instruction} />
              
              {!isRecovering && (
                <PrecisionTierBadge
                  tier={store.precision.currentTier}
                  label={`${store.precision.currentTier} precision`}
                />
              )}
            </View>
            
            <View style={styles.footer}>
              {canStopEarly && (
                <GlowPrimaryButton
                  accent="cyan"
                  label={C.build.ctaDone}
                  onPress={handleStopEarly}
                  style={{ marginBottom: 12 }}
                />
              )}
              <Text style={styles.counterLabel}>{store.precision.validBeats} beats collected</Text>
            </View>

            <RecoveryOverlay
              visible={isRecovering}
              instruction={recoveryInstruction}
              beatsKeptText={C.recovery.progressKept(store.precision.validBeats)}
            />
          </View>
        );
      }

      case 'processing':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <View style={styles.pulsingWrapper}>
                <PrecisionArc progress={1.0} size={150} strokeWidth={6} />
                <FingerContactCore
                  contactDetected={true}
                  signalLocked={true}
                  bpm={null}
                  complete={true}
                />
              </View>
              <CoachCopy text={C.processing.instruction} />
              <Text style={styles.subtitle}>{C.processing.subtitle}</Text>
            </View>
          </View>
        );

      case 'scan_complete': {
        const upliftVal = Math.round((store.result?.confidenceUplift ?? 0) * 100);
        const beatsVal = store.result?.validBeats ?? 0;
        const finalTier = store.precision.currentTier;
        const bMode = store.blendMode ?? 'signal_added';

        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <FingerContactCore
                contactDetected={true}
                signalLocked={true}
                bpm={null}
                complete={true}
              />
              <Text style={styles.title}>{C.complete.title}</Text>
              
              <BlendResultCard
                blendModeText={C.complete.blendMode[bMode]}
                confidenceUpliftText={`+${upliftVal}%`}
                beatsText={`${beatsVal} beats`}
                tierText={finalTier.toUpperCase()}
              />
            </View>
            <View style={styles.footer}>
              <GlowPrimaryButton
                accent="gold"
                label={C.complete.cta}
                onPress={handleExit}
              />
            </View>
          </View>
        );
      }

      case 'retry_needed':
        return (
          <View style={styles.content}>
            <View style={styles.centerBlock}>
              <Text style={styles.title}>{C.retry.title}</Text>
              <Text style={styles.subtitle}>{C.retry.body}</Text>
            </View>
            <View style={styles.footer}>
              <GlowPrimaryButton
                accent="cyan"
                label={C.retry.cta}
                onPress={handleRetry}
                style={{ marginBottom: 12 }}
              />
              <Pressable style={styles.ghostBtn} onPress={handleExit}>
                <Text style={styles.ghostBtnText}>{C.retry.exit}</Text>
              </Pressable>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[t.colors.background, '#090F1E', t.colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        {renderContent()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030407',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulsingWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#9DB2CC',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  tipsList: {
    alignItems: 'flex-start',
    marginTop: 18,
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#5E7596',
    fontWeight: '500',
  },
  statusLabel: {
    fontSize: 13,
    color: '#5E7596',
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
  counterLabel: {
    fontSize: 14,
    color: '#9DB2CC',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  ghostBtn: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ghostBtnText: {
    fontSize: 16,
    color: '#5E7596',
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 12,
    color: '#425570',
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    paddingBottom: 16,
    alignItems: 'stretch',
  },
});
