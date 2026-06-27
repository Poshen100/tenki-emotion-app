import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography as typo } from '../../theme';
import { ScanButton } from '../../components/ScanButton';
import { useSessionStore } from '../../stores/session-store';
import { OceanBackground, type OceanMode } from '../../components/OceanBackground';
import { BreathingRing } from '../../components/BreathingRing';
import { startMockPrecheck, cancelMockSessionProgress } from '../../lib/mock-session';

type SessionMode = 'health_reset' | 'focus' | 'performance' | 'trader';
type SessionState = 'draft' | 'configured' | 'precheck' | 'scanning' | 'gated' | 'active' | 'paused' | 'completed' | 'reflection_pending' | 'archived';

const MODES: { key: SessionMode; icon: string; name: string; description: string }[] = [
  { key: 'health_reset', icon: '🧘', name: 'Health Reset', description: 'Recovery and grounding' },
  { key: 'focus', icon: '🎯', name: 'Focus', description: 'Pre-check before deep work' },
  { key: 'performance', icon: '⚡', name: 'Performance', description: 'High-stakes preparation' },
  { key: 'trader', icon: '📊', name: 'Trader', description: 'Decision process discipline' },
];

const STATE_LABELS: Record<SessionState, string> = {
  draft: 'Select a mode to begin',
  configured: 'Mode selected — ready for pre-check',
  precheck: 'Pre-check in progress...',
  scanning: 'Scanning your readiness...',
  gated: 'Reviewing readiness gate...',
  active: 'Session in progress',
  paused: 'Session paused',
  completed: 'Session complete',
  reflection_pending: 'Reflection time',
  archived: 'Session archived',
};

/**
 * Session screen — Session Governance Layer.
 * Mode selection → Pre-check → Scan → Gate → Active Session → Reflection
 */
/** Derives the OceanBackground mode from the current session lifecycle state. */
function oceanModeForState(state: SessionState): OceanMode {
  if (state === 'completed') return 'success';
  if (state === 'scanning' || state === 'active' || state === 'paused') return 'active';
  return 'default';
}

export default function SessionScreen() {
  const { mode, state, elapsedSec, setMode, setState, tick, completeSession, reset } = useSessionStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Run a 1-second tick while the session is active
  useEffect(() => {
    if (state === 'active') {
      timerRef.current = setInterval(() => tick(), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, tick]);

  const handleSelectMode = (m: SessionMode) => {
    setMode(m);
  };

  const handleStartPrecheck = () => {
    startMockPrecheck();
  };

  const handleReset = () => {
    cancelMockSessionProgress();
    reset();
  };

  return (
    <OceanBackground mode={oceanModeForState(state)}>
      <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={typo.headline}>Session</Text>
        <Text style={[typo.caption, styles.stateLabel]}>{STATE_LABELS[state]}</Text>

        {/* State Progress Bar */}
        <SessionProgressBar currentState={state} />

        {/* Mode Selector (draft state) */}
        {state === 'draft' && (
          <View style={styles.modeGrid}>
            {MODES.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.modeCard, mode === m.key && styles.modeCardActive]}
                onPress={() => handleSelectMode(m.key)}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <Text style={styles.modeName}>{m.name}</Text>
                <Text style={styles.modeDesc}>{m.description}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Configured state */}
        {state === 'configured' && mode && (
          <View style={styles.configuredSection}>
            <View style={styles.selectedModeCard}>
              <Text style={styles.selectedModeIcon}>
                {MODES.find((m) => m.key === mode)?.icon}
              </Text>
              <Text style={typo.headline}>
                {MODES.find((m) => m.key === mode)?.name}
              </Text>
            </View>

            {/* Self-Assessment Checklist */}
            <View style={styles.checklistCard}>
              <Text style={[typo.label, styles.sectionLabel]}>SELF-ASSESSMENT</Text>
              {['Slept well last night', 'Feeling focused', 'No acute stressors', 'Hydrated today', 'Clear intention set'].map((item) => (
                <View key={item} style={styles.checkItem}>
                  <Text style={styles.checkBox}>☐</Text>
                  <Text style={typo.body}>{item}</Text>
                </View>
              ))}
            </View>

            <ScanButton label="Start Pre-check" onPress={handleStartPrecheck} />
          </View>
        )}

        {/* Precheck / scanning / gated — transient pipeline states */}
        {(state === 'precheck' || state === 'scanning' || state === 'gated') && (
          <View style={styles.transientSection}>
            <Text style={typo.headline}>{STATE_LABELS[state]}</Text>
            <Text style={[typo.caption, styles.reflectionPrompt]}>
              Hold steady while we prepare your session.
            </Text>
          </View>
        )}

        {/* Active session */}
        {(state === 'active' || state === 'paused') && (
          <View style={styles.activeSection}>
            <BreathingRing elapsedSec={elapsedSec} active={state === 'active'} />
            <View style={styles.sessionActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setState(state === 'paused' ? 'active' : 'paused')}
              >
                <Text style={styles.secondaryButtonText}>
                  {state === 'paused' ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.dangerButton]}
                onPress={() => completeSession()}
              >
                <Text style={[styles.secondaryButtonText, styles.dangerText]}>End</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Completed */}
        {state === 'completed' && (
          <View style={styles.completedSection}>
            <Text style={styles.completedIcon}>✓</Text>
            <Text style={typo.headline}>Session Complete</Text>
            <Text style={[typo.body, styles.reflectionPrompt]}>
              Take a moment to reflect on this session.
            </Text>
            <ScanButton
              label="Add Reflection"
              onPress={() => setState('reflection_pending')}
            />
          </View>
        )}

        {/* Reset */}
        {state !== 'draft' && state !== 'active' && state !== 'paused' && (
          <Pressable
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Text style={styles.resetText}>Start New Session</Text>
          </Pressable>
        )}
      </ScrollView>
      </SafeAreaView>
    </OceanBackground>
  );
}

/** Visual progress bar showing 10-state session lifecycle. */
function SessionProgressBar({ currentState }: { currentState: SessionState }) {
  const states: SessionState[] = [
    'draft', 'configured', 'precheck', 'scanning', 'gated',
    'active', 'paused', 'completed', 'reflection_pending', 'archived',
  ];
  const currentIdx = states.indexOf(currentState);

  return (
    <View style={progressStyles.container}>
      {states.slice(0, 6).map((s, i) => (
        <View
          key={s}
          style={[
            progressStyles.dot,
            i <= currentIdx && progressStyles.dotActive,
            i === currentIdx && progressStyles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.card,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  stateLabel: {
    marginTop: spacing.xs,
  },
  modeGrid: {
    gap: spacing.sm,
  },
  modeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeCardActive: {
    borderColor: colors.primary,
  },
  modeIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  configuredSection: {
    gap: spacing.lg,
  },
  selectedModeCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  selectedModeIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  checklistCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  checkBox: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  activeSection: {
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  transientSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dangerButton: {
    borderColor: colors.error,
  },
  dangerText: {
    color: colors.error,
  },
  completedSection: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  completedIcon: {
    fontSize: 48,
    color: colors.success,
  },
  reflectionPrompt: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resetButton: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  resetText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
