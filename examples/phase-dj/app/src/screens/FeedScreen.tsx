import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '@/theme';
import { FEED } from '@/data/mockData';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { FeedPost } from '@/components/molecules/FeedPost';
import { MixPost } from '@/components/molecules/MixPost';
import { SectionLabel } from '@/components/atoms/SectionLabel';
import { useMixes } from '@/context/MixesContext';
import { FeedItem, RecordedMix } from '@/types';

export interface FeedScreenProps {
  readonly onRemix?: (item: FeedItem) => void;
}

type Row =
  | { kind: 'mine'; mix: RecordedMix; i: number }
  | { kind: 'community'; item: FeedItem; i: number };

export const FeedScreen: React.FC<FeedScreenProps> = ({ onRemix }) => {
  const { mixes, remove } = useMixes();

  const rows: Row[] = [
    ...mixes.map((mix, i) => ({ kind: 'mine' as const, mix, i })),
    ...FEED.map((item, i) => ({ kind: 'community' as const, item, i })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'mine' ? r.mix.id : r.item.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ScreenHeader eyebrow="Community" title="Feed" rightGlyph="🔔" rightLabel="Notifications" />
            {mixes.length > 0 && <SectionLabel>Your mixes</SectionLabel>}
            {mixes.length === 0 && (
              <View style={styles.emptyMine}>
                <Text style={styles.emptyMineText}>
                  Record a mix in the Studio and it lands here.
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'mine' ? (
            <MixPost mix={row.mix} index={row.i} onDelete={(id) => void remove(id)} />
          ) : (
            <View>
              {row.i === 0 && <SectionLabel>From the community</SectionLabel>}
              <FeedPost item={row.item} index={row.i} onRemix={onRemix} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  emptyMine: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  emptyMineText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.muted2,
    textAlign: 'center',
    lineHeight: 17,
  },
});
