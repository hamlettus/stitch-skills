import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { CamelotWheel } from '@/components/organisms/CamelotWheel';
import { TrackRow } from '@/components/molecules/TrackRow';
import { useHarmonicMatches } from '@/hooks/useHarmonicMatches';
import { keyColor, keyName, relationLabel } from '@/utils/camelot';
import { useDeckContext } from '@/context/DeckContext';

export interface WheelScreenProps {
  readonly initialKey?: string;
}

export const WheelScreen: React.FC<WheelScreenProps> = ({ initialKey = '8A' }) => {
  const [selected, setSelected] = useState(initialKey);
  const matches = useHarmonicMatches(selected);
  const { deckA, deckB, wheelJumpKey, clearWheelJump } = useDeckContext();

  // Consume a jump request from the Crate or another screen
  useEffect(() => {
    if (wheelJumpKey) {
      setSelected(wheelJumpKey);
      clearWheelJump();
    }
  }, [wheelJumpKey, clearWheelJump]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Harmonic Mixing" title="Camelot" rightGlyph="?" rightLabel="How harmonic mixing works" />

        {/* Deck shortcut row — only shown when decks have keys set */}
        {(deckA.key != null || deckB.key != null) && (
          <View style={styles.deckRow}>
            <Text style={styles.deckRowLabel}>Jump to deck</Text>
            <View style={styles.deckBtns}>
              {deckA.key != null && (
                <Pressable
                  style={[styles.deckBtn, { borderColor: keyColor(deckA.key) }]}
                  onPress={() => setSelected(deckA.key!)}
                  accessibilityRole="button"
                  accessibilityLabel={`Jump to Deck A key ${deckA.key}`}
                >
                  <View style={[styles.deckDot, { backgroundColor: keyColor(deckA.key) }]} />
                  <Text style={styles.deckBtnLabel}>A</Text>
                  <Text style={[styles.deckBtnKey, { color: keyColor(deckA.key) }]}>{deckA.key}</Text>
                  {deckA.bpm != null && (
                    <Text style={styles.deckBtnBpm}>{`${deckA.bpm}`}</Text>
                  )}
                </Pressable>
              )}
              {deckB.key != null && (
                <Pressable
                  style={[styles.deckBtn, { borderColor: keyColor(deckB.key) }]}
                  onPress={() => setSelected(deckB.key!)}
                  accessibilityRole="button"
                  accessibilityLabel={`Jump to Deck B key ${deckB.key}`}
                >
                  <View style={[styles.deckDot, { backgroundColor: keyColor(deckB.key) }]} />
                  <Text style={styles.deckBtnLabel}>B</Text>
                  <Text style={[styles.deckBtnKey, { color: keyColor(deckB.key) }]}>{deckB.key}</Text>
                  {deckB.bpm != null && (
                    <Text style={styles.deckBtnBpm}>{`${deckB.bpm}`}</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}

        <CamelotWheel selectedKey={selected} onSelect={setSelected} />

        <View style={styles.legend}>
          <LegendDot color={colors.key} label="Selected" />
          <LegendDot color={colors.surface2} label="Compatible" />
          <LegendDot color={colors.bg2} label="Clash" />
        </View>

        {/* Current key info */}
        <View style={styles.keyInfo}>
          <View style={[styles.keyInfoDot, { backgroundColor: keyColor(selected) }]} />
          <Text style={[styles.keyInfoCode, { color: keyColor(selected) }]}>{selected}</Text>
          <Text style={styles.keyInfoName}>{keyName(selected)}</Text>
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

  deckRow: { marginBottom: space.lg },
  deckRowLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted2,
    letterSpacing: 1,
    marginBottom: 6,
  },
  deckBtns: { flexDirection: 'row', gap: 10 },
  deckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  deckDot: { width: 7, height: 7, borderRadius: 4 },
  deckBtnLabel: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.muted },
  deckBtnKey: { fontFamily: fonts.monoBold, fontSize: 13 },
  deckBtnBpm: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted },

  keyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  keyInfoDot: { width: 8, height: 8, borderRadius: 4 },
  keyInfoCode: { fontFamily: fonts.monoBold, fontSize: 14 },
  keyInfoName: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },

  matchHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.md,
    marginBottom: space.xs,
    marginHorizontal: 2,
  },
  matchTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
  matchCount: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.key },
});
