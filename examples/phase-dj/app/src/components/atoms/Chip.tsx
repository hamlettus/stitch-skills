import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '@/theme';

export interface ChipProps {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, active, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter ${label}`}
      style={[styles.chip, active ? styles.chipOn : null]}
    >
      <Text style={[styles.text, active ? styles.textOn : null]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.key,
    borderColor: colors.key,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  textOn: {
    fontFamily: fonts.monoBold,
    color: colors.onAccent,
  },
});
