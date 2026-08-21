import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

export interface WaveformProps {
  readonly seed: number;
  readonly color: string;
  readonly played?: number; // 0..1 portion drawn in `color`
  readonly height?: number;
  readonly bars?: number;
}

function makeBars(seed: number, count: number): number[] {
  let s = (seed * 2654435761) % 2147483647;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const envelope = Math.sin((i / count) * Math.PI);
    out.push((0.22 + 0.78 * Math.pow(next(), 1.3)) * envelope);
  }
  return out;
}

export const Waveform: React.FC<WaveformProps> = ({
  seed,
  color,
  played = 0,
  height = 22,
  bars = 44,
}) => {
  const values = useMemo(() => makeBars(seed, bars), [seed, bars]);
  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden={true}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 0.6,
            height: Math.max(2, v * height),
            borderRadius: 1,
            backgroundColor: i / bars < played ? color : colors.waveIdle,
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
    width: '100%',
  },
});
