import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '@/theme';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { CamelotWheel } from '@/components/organisms/CamelotWheel';
import { TrackRow } from '@/components/molecules/TrackRow';
import { useHarmonicMatches } from '@/hooks/useHarmonicMatches';
import { relationLabel } from '@/utils/camelot';

export interface WheelScreenProps {
  readonly initialKey?: string;
}

export const WheelScreen: React.FC<WheelScreenProps> = ({ initialKey = '8A' }) => {
  const [selected, setSelected] = useState(initialKey);
  const matches = useHarmonicMatches(selected);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Harmonic Mixing" title="Camelot" rightGlyph="?" rightLabel="How harmonic mixing works" />

        <CamelotWheel selectedKey={selected} onSelect={setSelected} />

        <View style={styles.legend}>
          <LegendDot color={colors.key} label="Selected" />
          <LegendDot color={colors.surface2} label="Compatible" />
          <LegendDot color={colors.bg2} label="Clash" />
        </View>

        <View style={styles.matchHead}>
          <Text style={styles.matchTitle}>Mixes from here</Text>
          <Text style={styles.matchCount}>{`${matches.length} tracks`}</Text>
        </View>

        {matches.slice(0, 8).map((t, i) => (
          <TrackRow key={t.id} track={t} index={i + 10} relation={relationLabel(selected, t.key)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

interface LegendDotProps {
  readonly color: string;
  readonly label: string;
}
const LegendDot: React.FC<LegendDotProps> = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted },
  matchHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.xs,
    marginHorizontal: 2,
  },
  matchTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
  matchCount: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.key },
});
