import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

export interface EnergyMeterProps {
  readonly value: number; // 1..10
}

export const EnergyMeter: React.FC<EnergyMeterProps> = ({ value }) => {
  return (
    <View style={styles.row} accessibilityLabel={`Energy ${value} of 10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: 3 + (i + 1) * 0.6,
            borderRadius: 1,
            backgroundColor: i < value ? colors.energy : colors.energyDim,
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 9,
  },
});
