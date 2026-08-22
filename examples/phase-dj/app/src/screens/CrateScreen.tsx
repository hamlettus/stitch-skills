import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, radius, space } from '@/theme';
import { CRATE_FILTERS, TRACKS } from '@/data/mockData';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { TrackRow } from '@/components/molecules/TrackRow';
import { Chip } from '@/components/atoms/Chip';
import { useDeckContext } from '@/context/DeckContext';
import { isCompatible } from '@/utils/camelot';
import { Track } from '@/types';

export interface CrateScreenProps {
  readonly onOpenTrack?: (key: string) => void;
}

export const CrateScreen: React.FC<CrateScreenProps> = ({ onOpenTrack }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const navigation = useNavigation<any>();
  const { deckA, deckB, jumpWheel } = useDeckContext();

  // Build filter chip list: static chips + dynamic deck-match chips
  const chips = useMemo(() => {
    const base = [...CRATE_FILTERS];
    if (deckA.key != null) base.push(`♥ Deck A · ${deckA.key}`);
    if (deckB.key != null) base.push(`♥ Deck B · ${deckB.key}`);
    return base;
  }, [deckA.key, deckB.key]);

  // Ensure active filter stays valid when deck keys disappear
  const activeFilter = chips.includes(filter) ? filter : 'All';

  const filtered = useMemo((): readonly Track[] => {
    let list: readonly Track[] = TRACKS;

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
      );
    }

    // Deck-compatibility filters
    if (activeFilter.startsWith('♥ Deck A') && deckA.key != null) {
      list = list.filter((t) => isCompatible(deckA.key!, t.key));
    } else if (activeFilter.startsWith('♥ Deck B') && deckB.key != null) {
      list = list.filter((t) => isCompatible(deckB.key!, t.key));
    }

    return list;
  }, [query, activeFilter, deckA.key, deckB.key]);

  const onTrackPress = (key: string) => {
    onOpenTrack?.(key);
    jumpWheel(key);
    navigation.navigate('Wheel');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered as Track[]}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              eyebrow={`Your Library · ${TRACKS.length} tracks`}
              title="Crate"
              rightGlyph="⇅"
              rightLabel="Sort"
            />
            <View style={styles.search}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search tracks, keys, BPM…"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                accessibilityLabel="Search your crate"
              />
            </View>
            <View style={styles.chips}>
              {chips.map((f) => (
                <Chip key={f} label={f} active={f === activeFilter} onPress={() => setFilter(f)} />
              ))}
            </View>
            {activeFilter.startsWith('♥') && filtered.length > 0 && (
              <Text style={styles.compatHint}>
                {`${filtered.length} track${filtered.length !== 1 ? 's' : ''} mix harmonically with ${activeFilter.includes('Deck A') ? 'Deck A' : 'Deck B'} · tap any to see the Wheel`}
              </Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow track={item} index={index} showWaveform onPress={() => onTrackPress(item.key)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tracks match</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: space.md,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: space.md },
  compatHint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
    marginBottom: space.lg,
    lineHeight: 16,
  },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted2 },
});
