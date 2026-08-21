import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '@/theme';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { DeckCard } from '@/components/molecules/DeckCard';
import { SamplerGrid } from '@/components/organisms/SamplerGrid';
import { SectionLabel } from '@/components/atoms/SectionLabel';
import { useDeck } from '@/hooks/useDeck';
import { useSampler } from '@/hooks/useSampler';
import { PadDef } from '@/types';

export interface StudioScreenProps {
  readonly setName?: string;
}

export const StudioScreen: React.FC<StudioScreenProps> = ({ setName = 'Untitled Set · 2 layers' }) => {
  const deck = useDeck();
  const { trigger } = useSampler();

  const onPad = (pad: PadDef) => {
    void trigger(pad.sound);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow={setName} title="Studio" rightGlyph="●" rightColor={colors.energy} rightLabel="Record" />

        <DeckCard label="Deck A" title="Neon Tide" musicKey="8A" bpm={124} seed={7} played={deck.playing ? 0.55 : 0.4} />
        <DeckCard label="Deck B" title="Midnight Protocol" musicKey="9A" bpm={126} note="+1 key" seed={19} played={deck.playing ? 0.5 : 0.4} />

        <View style={styles.transport}>
          <Pressable style={styles.tbtn} accessibilityRole="button" accessibilityLabel="Previous">
            <Text style={styles.tglyph}>⏮</Text>
          </Pressable>
          <Pressable
            style={[styles.tbtn, styles.play]}
            onPress={() => void deck.toggle()}
            accessibilityRole="button"
            accessibilityLabel={deck.playing ? 'Pause' : 'Play'}
          >
            <Text style={styles.playGlyph}>{deck.playing ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable style={styles.tbtn} accessibilityRole="button" accessibilityLabel="Record">
            <Text style={[styles.tglyph, styles.recGlyph]}>●</Text>
          </Pressable>
        </View>

        <SectionLabel>Sampler · tap to trigger</SectionLabel>
        <SamplerGrid onTrigger={onPad} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginVertical: space.xl,
  },
  tbtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.key,
    borderWidth: 0,
  },
  tglyph: { fontSize: 19, color: colors.text },
  recGlyph: { color: colors.energy },
  playGlyph: { fontSize: 26, color: colors.onAccent },
});
