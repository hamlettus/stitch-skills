import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';

export interface RecordBarProps {
  readonly recording: boolean;
  readonly elapsedMs: number;
  readonly permissionDenied: boolean;
  readonly onToggle: () => void;
}

const formatElapsed = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const RecordBar: React.FC<RecordBarProps> = ({
  recording,
  elapsedMs,
  permissionDenied,
  onToggle,
}) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  return (
    <View style={[styles.bar, recording && styles.barActive]}>
      <Pressable
        style={[styles.btn, recording ? styles.btnStop : styles.btnStart]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      >
        {recording ? (
          <View style={styles.stopSquare} />
        ) : (
          <Animated.View style={[styles.recDot, { opacity: pulse }]} />
        )}
      </Pressable>

      <View style={styles.textCol}>
        <Text style={styles.title}>{recording ? 'Recording mix' : 'Record your mix'}</Text>
        <Text style={styles.sub}>
          {permissionDenied
            ? 'Microphone access denied — enable it in Settings'
            : recording
              ? 'Tap stop to save it to your feed'
              : 'Captures through the mic — play out loud'}
        </Text>
      </View>

      {recording && (
        <View style={styles.timerBox}>
          <Animated.View style={[styles.timerDot, { opacity: pulse }]} />
          <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
  },
  barActive: { borderColor: colors.energy },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  btnStart: { borderColor: colors.energy },
  btnStop: { borderColor: colors.energy, backgroundColor: colors.energyDim },
  recDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.energy },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: colors.energy },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.text },
  sub: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted, marginTop: 2 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.energy },
  timer: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.energy },
});
