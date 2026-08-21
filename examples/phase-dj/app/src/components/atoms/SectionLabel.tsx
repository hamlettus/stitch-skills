import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

export interface SectionLabelProps {
  readonly children: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ children }) => {
  return <Text style={styles.label}>{children}</Text>;
};

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.muted2,
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 2,
  },
});
