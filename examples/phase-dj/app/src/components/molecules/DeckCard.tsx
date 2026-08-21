import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Waveform } from '@/components/atoms/Waveform';
import { keyColor, keyName } from '@/utils/camelot';

export interface DeckCardProps {
  readonly label: string;
  readonly title: string;
  readonly musicKey: string;
  readonly bpm: number;
  readonly note?: string;
  readonly seed: number;
  readonly played: number;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  label,
  title,
  musicKey,
  bpm,
  note,
  seed,
  played,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.name}>{`${label} — ${title}`}</Text>
        <Text style={styles.meta}>
          <Text style={styles.metaKey}>{musicKey}</Text>
          <Text>{`  ·  ${bpm} BPM${note ? `  ·  ${note}` : ''}`}</Text>
        </Text>
      </View>
      <Waveform seed={seed} color={keyColor(musicKey)} played={played} height={56} bars={72} />
      <Text style={styles.keyName}>{keyName(musicKey)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.lg,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  name: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text, flexShrink: 1 },
  meta: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  metaKey: { color: colors.key, fontFamily: fonts.monoBold },
  keyName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted2,
    marginTop: 8,
    letterSpacing: 1,
  },
});
