import React, { useCallback, useRef } from 'react';
import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '@/theme';
import { PadDef } from '@/types';

const ACCENT: Record<PadDef['accent'], string> = {
  key: colors.key,
  energy: colors.energy,
  violet: colors.violet,
};

export interface PadProps {
  readonly pad: PadDef;
  readonly onTrigger: (pad: PadDef) => void;
}

export const Pad: React.FC<PadProps> = ({ pad, onTrigger }) => {
  const glow = useRef(new Animated.Value(0)).current;
  const accent = ACCENT[pad.accent];

  const handle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTrigger(pad);
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  }, [glow, onTrigger, pad]);

  return (
    <Pressable
      onPressIn={handle}
      accessibilityRole="button"
      accessibilityLabel={`Trigger ${pad.label}`}
      style={styles.wrap}
    >
      <Animated.View
        style={[
          styles.pad,
          {
            borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [colors.line, accent] }),
            backgroundColor: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.surface, colors.surface2],
            }),
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{pad.label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: { flexBasis: '31%', flexGrow: 1, aspectRatio: 1 },
  pad: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 9,
    justifyContent: 'flex-end',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: colors.muted,
  },
});
