
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { radius, } from '../theme';
import { PrimaryButton, SecondaryButton } from './onboarding-components';

const { height } = Dimensions.get('window');

interface FingerSmartReminderProps {
  visible: boolean;
  onScanFinger: () => void;
  onDismiss: () => void;
  onNeverRemind: () => void;
}

export function FingerSmartReminder({
  visible,
  onScanFinger,
  onDismiss,
  onNeverRemind,
}: FingerSmartReminderProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        {/* Click outside to dismiss */}
        <Pressable style={styles.dismissPressable} onPress={onDismiss} />
        
        {/* Bottom sheet content */}
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          
          <Text style={styles.title}>想讓掃描更準嗎？</Text>
          
          <Text style={styles.body}>
            用手指掃一次（約 30 秒），不只這次更準，也能幫 Tenki 校準你的臉部基線，讓往後每次掃臉都更穩定。
          </Text>

          <View style={styles.actions}>
            <View style={styles.btnWrapper}>
              <PrimaryButton
                label="現在掃一次手指"
                onPress={onScanFinger}
              />
            </View>
            
            <View style={styles.btnWrapper}>
              <SecondaryButton
                label="下次再說"
                onPress={onDismiss}
              />
            </View>

            <Pressable style={styles.linkPressable} onPress={onNeverRemind}>
              <Text style={styles.linkText}>不再提醒</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 20, 0.65)',
    justifyContent: 'flex-end',
  },
  dismissPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#0A1628', // Fcb/today card gradient start
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(95, 233, 208, 0.15)',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 42,
    alignItems: 'center',
    shadowColor: '#5FE9D0',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EAF1F8',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: '#9DB2CC',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  btnWrapper: {
    width: '100%',
  },
  linkPressable: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  linkText: {
    fontSize: 13,
    color: '#5E7596',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});
