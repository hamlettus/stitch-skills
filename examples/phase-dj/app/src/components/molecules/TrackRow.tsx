import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';
import { Track } from '@/types';
import { CamelotBadge } from '@/components/atoms/CamelotBadge';
import { EnergyMeter } from '@/components/atoms/EnergyMeter';
import { Waveform } from '@/components/atoms/Waveform';
import { keyColor } from '@/utils/camelot';

export interface TrackRowProps {
  readonly track: Track;
  readonly index: number;
  readonly showWaveform?: boolean;
  readonly relation?: string;
  readonly onPress?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  showWaveform = false,
  relation,
  onPress,
}) => {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}, ${track.bpm} BPM`}
    >
      <CamelotBadge code={track.key} showName={showWaveform} />
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
          {relation ? <Text style={styles.relation}>{`  ·  ${relation}`}</Text> : null}
        </Text>
        {showWaveform ? (
          <View style={styles.wave}>
            <Waveform seed={index + 3} color={keyColor(track.key)} height={20} bars={52} />
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.bpm}>
          <Text style={styles.bpmNum}>{track.bpm}</Text>
          <Text style={styles.bpmUnit}> BPM</Text>
        </Text>
        <EnergyMeter value={track.energy} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  mid: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  artist: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  relation: { color: colors.key, fontFamily: fonts.bodyMed },
  wave: { marginTop: 7 },
  right: { alignItems: 'flex-end', gap: 5 },
  bpm: {},
  bpmNum: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.energy },
  bpmUnit: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted2 },
});
