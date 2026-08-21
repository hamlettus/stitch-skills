import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { CRATE_FILTERS, TRACKS } from '@/data/mockData';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { TrackRow } from '@/components/molecules/TrackRow';
import { Chip } from '@/components/atoms/Chip';

export interface CrateScreenProps {
  readonly onOpenTrack?: (key: string) => void;
}

export const CrateScreen: React.FC<CrateScreenProps> = ({ onOpenTrack }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={TRACKS}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ScreenHeader eyebrow="Your Library · 248 tracks" title="Crate" rightGlyph="⇅" rightLabel="Sort" />
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
              {CRATE_FILTERS.map((f, i) => (
                <Chip key={f} label={f} active={i === filter} onPress={() => setFilter(i)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow track={item} index={index} showWaveform onPress={() => onOpenTrack?.(item.key)} />
        )}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: space.lg },
});
