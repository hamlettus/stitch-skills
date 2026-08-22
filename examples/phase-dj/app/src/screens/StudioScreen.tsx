import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '@/theme';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { DeckCard } from '@/components/molecules/DeckCard';
import { CrossfaderSlider } from '@/components/molecules/CrossfaderSlider';
import { KeyPickerModal } from '@/components/molecules/KeyPickerModal';
import { SamplerGrid } from '@/components/organisms/SamplerGrid';
import { SectionLabel } from '@/components/atoms/SectionLabel';
import { useDeck } from '@/hooks/useDeck';
import { useSampler } from '@/hooks/useSampler';
import { PadDef } from '@/types';

export interface StudioScreenProps {
  readonly setName?: string;
}

/** DJ-style linear crossfade: center = both full; sides fade the opposite deck. */
function crossfadeVolumes(cf: number): [number, number] {
  const volA = cf <= 0.5 ? 1.0 : (1.0 - cf) * 2;
  const volB = cf >= 0.5 ? 1.0 : cf * 2;
  return [volA, volB];
}

type PickerTarget = 'A' | 'B' | null;

export const StudioScreen: React.FC<StudioScreenProps> = ({ setName = 'Live Set' }) => {
  const deckA = useDeck();
  const deckB = useDeck();
  const { trigger } = useSampler();
  const [crossfade, setCrossfade] = useState(0.5);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  // Sync volumes on crossfade change
  useEffect(() => {
    const [volA, volB] = crossfadeVolumes(crossfade);
    void deckA.setVolume(volA);
    void deckB.setVolume(volB);
  }, [crossfade]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPad = (pad: PadDef) => {
    void trigger(pad.sound);
  };

  // Which deck's key is being edited?
  const editingDeck = pickerTarget === 'A' ? deckA : pickerTarget === 'B' ? deckB : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={setName}
          title="Studio"
          rightGlyph="●"
          rightColor={colors.energy}
          rightLabel="Record"
        />

        <DeckCard
          label="Deck A"
          track={deckA.track}
          playing={deckA.playing}
          positionRatio={deckA.positionRatio}
          durationMs={deckA.durationMs}
          bpm={deckA.bpm}
          musicKey={deckA.musicKey}
          onLoad={() => void deckA.loadFile()}
          onToggle={() => void deckA.toggle()}
          onTapTempo={deckA.tapTempo}
          onOpenKeyPicker={() => setPickerTarget('A')}
          seed={7}
        />

        <View style={styles.crossfaderRow}>
          <Text style={styles.crossfaderLabel}>CROSSFADER</Text>
          <CrossfaderSlider value={crossfade} onChange={setCrossfade} />
        </View>

        <DeckCard
          label="Deck B"
          track={deckB.track}
          playing={deckB.playing}
          positionRatio={deckB.positionRatio}
          durationMs={deckB.durationMs}
          bpm={deckB.bpm}
          musicKey={deckB.musicKey}
          onLoad={() => void deckB.loadFile()}
          onToggle={() => void deckB.toggle()}
          onTapTempo={deckB.tapTempo}
          onOpenKeyPicker={() => setPickerTarget('B')}
          seed={19}
        />

        <SectionLabel>Sampler · tap to trigger</SectionLabel>
        <SamplerGrid onTrigger={onPad} />
      </ScrollView>

      {/* Key picker modal — rendered above ScrollView */}
      {pickerTarget != null && editingDeck != null && (
        <KeyPickerModal
          visible={true}
          selected={editingDeck.musicKey}
          deckLabel={`Deck ${pickerTarget}`}
          onSelect={editingDeck.setMusicKey}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  crossfaderRow: {
    alignItems: 'center',
    marginBottom: space.lg,
  },
  crossfaderLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted2,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
});
