import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '@/theme';

export interface TapTempoBtnProps {
  readonly bpm: number | null;
  readonly onTap: () => void;
}

/**
 * Shows the current BPM (or "— BPM" when unknown) with a TAP button.
 * Three or more taps sets the tempo; subsequent taps refine it.
 */
export const TapTempoBtn: React.FC<TapTempoBtnProps> = ({ bpm, onTap }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.bpm}>{bpm != null ? `${bpm}` : '—'}</Text>
      <Text style={styles.bpmLabel}>BPM</Text>
      <Pressable
        style={({ pressed }) => [styles.tap, pressed && styles.tapPressed]}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Tap to set BPM"
      >
        <Text style={styles.tapLabel}>TAP</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bpm: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    color: colors.energy,
    minWidth: 36,
    textAlign: 'right',
  },
  bpmLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
    marginRight: 4,
  },
  tap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.energy,
  },
  tapPressed: { backgroundColor: colors.energy },
  tapLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.energy,
    letterSpacing: 1,
  },
});
