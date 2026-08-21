import React, { useRef } from 'react';
import { View, PanResponder, Animated, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '@/theme';

export interface CrossfaderSliderProps {
  /** 0 = full A, 0.5 = both, 1 = full B */
  readonly value: number;
  readonly onChange: (v: number) => void;
}

const TRACK_W = 240;
const KNOB_W = 44;

export const CrossfaderSlider: React.FC<CrossfaderSliderProps> = ({ value, onChange }) => {
  const travelW = TRACK_W - KNOB_W;
  const animX = useRef(new Animated.Value(value * travelW)).current;
  const startDx = useRef(0);
  const startVal = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_evt, gs) => {
        startDx.current = gs.dx;
        startVal.current = value;
        animX.stopAnimation();
      },
      onPanResponderMove: (_evt, gs) => {
        const delta = (gs.dx - startDx.current) / travelW;
        const next = Math.min(1, Math.max(0, startVal.current + delta));
        animX.setValue(next * travelW);
        onChangeRef.current(next);
      },
    })
  ).current;

  const knobLeft = animX.interpolate({
    inputRange: [0, travelW],
    outputRange: [0, travelW],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>A</Text>
      <View style={styles.track}>
        <View style={styles.center} />
        <Animated.View style={[styles.knob, { left: knobLeft }]} {...panResponder.panHandlers} />
      </View>
      <Text style={styles.label}>B</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    marginVertical: 14,
  },
  label: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.muted,
    width: 16,
    textAlign: 'center',
  },
  track: {
    width: TRACK_W,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    left: TRACK_W / 2 - 1,
    top: -4,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: colors.line,
  },
  knob: {
    position: 'absolute',
    width: KNOB_W,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    top: -11,
  },
});
