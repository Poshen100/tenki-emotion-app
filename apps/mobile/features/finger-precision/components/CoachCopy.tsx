/**
 * @module finger-precision/components/CoachCopy
 * @description Single-line instruction prompt with smooth fading transitions when text changes.
 *
 * @version 1.0
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Text } from 'react-native';

interface CoachCopyProps {
  text: string;
}

export function CoachCopy({ text }: CoachCopyProps): React.JSX.Element {
  const [displayedText, setDisplayedText] = useState(text);
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (text === displayedText) return;
    
    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      setDisplayedText(text);
    }, 150);

    return () => clearTimeout(timeout);
  }, [text, displayedText, opacityAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <Text style={styles.text}>{displayedText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  text: {
    fontSize: 22,
    fontWeight: '700',
    color: '#EAF1F8',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 30,
  },
});
