import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, space } from '@/theme';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { DeckCard } from '@/components/molecules/DeckCard';
import { CrossfaderSlider } from '@/components/molecules/CrossfaderSlider';
import { KeyPickerModal } from '@/components/molecules/KeyPickerModal';
import { RecordBar } from '@/components/molecules/RecordBar';
import { LibraryPickerModal } from '@/components/organisms/LibraryPickerModal';
import { SamplerGrid } from '@/components/organisms/SamplerGrid';
import { SectionLabel } from '@/components/atoms/SectionLabel';
import { useDeck } from '@/hooks/useDeck';
import { useSampler } from '@/hooks/useSampler';
import { useRecorder } from '@/hooks/useRecorder';
import { useDeckContext } from '@/context/DeckContext';
import { useMixes } from '@/context/MixesContext';
import { PadDef, LibraryTrack } from '@/types';

export interface StudioScreenProps {
  readonly setName?: string;
}

/** DJ-style linear crossfade: center = both full; sides fade the opposite deck. */
function crossfadeVolumes(cf: number): [number, number] {
  const volA = cf <= 0.5 ? 1.0 : (1.0 - cf) * 2;
  const volB = cf >= 0.5 ? 1.0 : cf * 2;
  return [volA, volB];
}

type DeckTarget = 'A' | 'B' | null;

export const StudioScreen: React.FC<StudioScreenProps> = ({ setName = 'Live Set' }) => {
  const deckA = useDeck();
  const deckB = useDeck();
  const { trigger } = useSampler();
  const recorder = useRecorder();
  const navigation = useNavigation<any>();
  const { publish } = useMixes();
  const [crossfade, setCrossfade] = useState(0.5);
  const [keyTarget, setKeyTarget] = useState<DeckTarget>(null);
  const [libTarget, setLibTarget] = useState<DeckTarget>(null);
  const { setDeckAKey, setDeckABpm, setDeckBKey, setDeckBBpm } = useDeckContext();

  // Mirror deck characterization into shared context so Wheel + Crate can react
  useEffect(() => { setDeckAKey(deckA.musicKey); }, [deckA.musicKey, setDeckAKey]);
  useEffect(() => { setDeckABpm(deckA.bpm); }, [deckA.bpm, setDeckABpm]);
  useEffect(() => { setDeckBKey(deckB.musicKey); }, [deckB.musicKey, setDeckBKey]);
  useEffect(() => { setDeckBBpm(deckB.bpm); }, [deckB.bpm, setDeckBBpm]);

  // Sync volumes on crossfade change
  useEffect(() => {
    const [volA, volB] = crossfadeVolumes(crossfade);
    void deckA.setVolume(volA);
    void deckB.setVolume(volB);
  }, [crossfade]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPad = (pad: PadDef) => {
    void trigger(pad.sound);
  };

  const editingKeyDeck = keyTarget === 'A' ? deckA : keyTarget === 'B' ? deckB : null;
  const loadingDeck = libTarget === 'A' ? deckA : libTarget === 'B' ? deckB : null;

  const onLibrarySelect = (t: LibraryTrack) => {
    void loadingDeck?.loadUri(t.uri, t.name);
  };

  const onRecordToggle = async () => {
    if (recorder.recording) {
      const result = await recorder.stop();
      if (!result) return;

      const titleParts = [deckA.track?.name, deckB.track?.name].filter(Boolean);
      await publish({
        id: `mix-${Date.now()}`,
        uri: result.uri,
        title: titleParts.length > 0 ? titleParts.join('  ×  ') : 'Untitled Mix',
        durationMs: result.durationMs,
        createdAt: Date.now(),
        keyA: deckA.musicKey,
        keyB: deckB.musicKey,
        bpm: deckA.bpm ?? deckB.bpm,
      });
      navigation.navigate('Feed');
    } else {
      await recorder.start();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow={setName} title="Studio" />

        <RecordBar
          recording={recorder.recording}
          elapsedMs={recorder.elapsedMs}
          permissionDenied={recorder.permissionDenied}
          onToggle={() => void onRecordToggle()}
        />

        <DeckCard
          label="Deck A"
          track={deckA.track}
          playing={deckA.playing}
          positionRatio={deckA.positionRatio}
          durationMs={deckA.durationMs}
          bpm={deckA.bpm}
          musicKey={deckA.musicKey}
          onLoad={() => setLibTarget('A')}
          onToggle={() => void deckA.toggle()}
          onTapTempo={deckA.tapTempo}
          onOpenKeyPicker={() => setKeyTarget('A')}
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
          onLoad={() => setLibTarget('B')}
          onToggle={() => void deckB.toggle()}
          onTapTempo={deckB.tapTempo}
          onOpenKeyPicker={() => setKeyTarget('B')}
          seed={19}
        />

        <SectionLabel>Sampler · tap to trigger</SectionLabel>
        <SamplerGrid onTrigger={onPad} />
      </ScrollView>

      {keyTarget != null && editingKeyDeck != null && (
        <KeyPickerModal
          visible={true}
          selected={editingKeyDeck.musicKey}
          deckLabel={`Deck ${keyTarget}`}
          onSelect={editingKeyDeck.setMusicKey}
          onClose={() => setKeyTarget(null)}
        />
      )}

      {libTarget != null && loadingDeck != null && (
        <LibraryPickerModal
          visible={true}
          deckLabel={`Deck ${libTarget}`}
          onSelect={onLibrarySelect}
          onClose={() => setLibTarget(null)}
          onBrowseFiles={() => void loadingDeck.loadFile()}
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
