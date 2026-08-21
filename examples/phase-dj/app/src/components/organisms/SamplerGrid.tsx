import React from 'react';
import { View, StyleSheet } from 'react-native';
import { space } from '@/theme';
import { PADS } from '@/data/mockData';
import { PadDef } from '@/types';
import { Pad } from '@/components/molecules/Pad';

export interface SamplerGridProps {
  readonly onTrigger: (pad: PadDef) => void;
}

export const SamplerGrid: React.FC<SamplerGridProps> = ({ onTrigger }) => {
  return (
    <View style={styles.grid}>
      {PADS.map((pad, i) => (
        <Pad key={`${pad.label}-${i}`} pad={pad} onTrigger={onTrigger} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
});
