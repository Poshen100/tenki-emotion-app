/**
 * DopamineJournalSheet
 *
 * A bottom-sheet modal for logging the user's dopamine state.
 * Lets the user select above_baseline / at_baseline / below_baseline,
 * rate three body signals, and optionally add a short note.
 *
 * Privacy: All data stays on-device. No network calls.
 * Compliance: No clinical claims. Observational language only.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useDopamineJournalStore,
  type DopamineState,
  type BodySignals,
  DOPAMINE_STATE_LABELS,
  BODY_SIGNAL_LABELS,
} from '../stores/dopamine-journal-store';
import { colors, spacing, radius, typography as typo } from '../theme';

const STATES: DopamineState[] = ['above_baseline', 'at_baseline', 'below_baseline'];

const RATING_LABELS: Record<number, string> = {
  1: '非常低',
  2: '偏低',
  3: '中等',
  4: '偶佳',
  5: '非常好',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional current Edge Score to attach to the entry */
  edgeScore?: number;
}

export function DopamineJournalSheet({ visible, onClose, edgeScore }: Props) {
  const insets = useSafeAreaInsets();
  const addEntry = useDopamineJournalStore((s) => s.addEntry);

  const [selectedState, setSelectedState] = useState<DopamineState>('at_baseline');
  const [bodySignals, setBodySignals] = useState<BodySignals>({
    breathingQuality: 3,
    heartRateFeel: 3,
    stressLevel: 3,
  });
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    addEntry({
      state: selectedState,
      bodySignals,
      note: note.trim().slice(0, 280),
      edgeScore,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setNote('');
      setBodySignals({ breathingQuality: 3, heartRateFeel: 3, stressLevel: 3 });
      setSelectedState('at_baseline');
      onClose();
    }, 800);
  }, [selectedState, bodySignals, note, edgeScore, addEntry, onClose]);

  const setSignal = (key: keyof BodySignals, value: number) => {
    setBodySignals((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <Text style={styles.title}>多巴胺日誌</Text>
            <Text style={styles.subtitle}>
              記錄你現在的身體狀態——僅供个人觀察，不構成醫療診斷。
            </Text>

            {/* State Selector */}
            <Text style={styles.sectionLabel}>你現在的狀態？</Text>
            <View style={styles.stateRow}>
              {STATES.map((s) => {
                const meta = DOPAMINE_STATE_LABELS[s];
                const isSelected = selectedState === s;
                return (
                  <Pressable
                    key={s}
                    style={[
                      styles.stateBtn,
                      isSelected && { borderColor: meta.color, backgroundColor: meta.color + '22' },
                    ]}
                    onPress={() => setSelectedState(s)}
                  >
                    <Text style={styles.stateEmoji}>{meta.emoji}</Text>
                    <Text
                      style={[
                        styles.stateLabelZh,
                        isSelected && { color: meta.color },
                      ]}
                    >
                      {meta.zh}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* State Description */}
            <StateDescription state={selectedState} />

            {/* Body Signals */}
            <Text style={styles.sectionLabel}>身體訊號</Text>
            {(Object.keys(bodySignals) as (keyof BodySignals)[]).map((key) => (
              <SignalRater
                key={key}
                label={BODY_SIGNAL_LABELS[key].zh}
                value={bodySignals[key]}
                onChange={(v) => setSignal(key, v)}
              />
            ))}

            {/* Note */}
            <Text style={styles.sectionLabel}>備註（可選）</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="發生了什麼？你當下的感受是？"
              placeholderTextColor={colors.textTertiary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={280}
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{note.length}/280</Text>

            {/* Save */}
            <Pressable
              style={[styles.saveBtn, saved && styles.saveBtnSaved]}
              onPress={handleSave}
              disabled={saved}
            >
              <Text style={styles.saveBtnText}>
                {saved ? '✓ 已記錄' : '儲存狀態'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StateDescription({ state }: { state: DopamineState }) {
  const descriptions: Record<DopamineState, string> = {
    above_baseline:
      '你可能感到過度興奮、衝動沛發或難以集中。\n建議：做幾次深呼吸，暫停重要決策。',
    at_baseline:
      '你的身體狀態回到穩定基準線。\n這是做清晰判斷的好時機。',
    below_baseline:
      '你可能感到空虐、疑惱或衝動難以好好放鬆。\n建議：先對自己溫柔一點，不要強迫就範。',
  };
  const meta = DOPAMINE_STATE_LABELS[state];
  return (
    <View style={[styles.descBox, { borderLeftColor: meta.color }]}>
      <Text style={styles.descText}>{descriptions[state]}</Text>
    </View>
  );
}

function SignalRater({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.raterRow}>
      <Text style={styles.raterLabel}>{label}</Text>
      <View style={styles.raterDots}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable
            key={v}
            style={[
              styles.dot,
              v <= value && styles.dotActive,
            ]}
            onPress={() => onChange(v)}
            hitSlop={8}
          />
        ))}
        <Text style={styles.raterValueLabel}>{RATING_LABELS[value]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0F1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(226,232,240,0.55)',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(226,232,240,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  stateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stateBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stateEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  stateLabelZh: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(226,232,240,0.6)',
    textAlign: 'center',
  },
  descBox: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  descText: {
    fontSize: 13,
    color: 'rgba(226,232,240,0.65)',
    lineHeight: 19,
  },
  raterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  raterLabel: {
    width: 72,
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  raterDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  raterValueLabel: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.5)',
    marginLeft: spacing.xs,
    minWidth: 36,
  },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#E2E8F0',
    fontSize: 14,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(226,232,240,0.3)',
    textAlign: 'right',
    marginTop: 4,
  },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: '#0D9488',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnSaved: {
    backgroundColor: '#059669',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
