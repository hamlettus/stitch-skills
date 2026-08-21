import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { FEED } from '@/data/mockData';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { FeedPost } from '@/components/molecules/FeedPost';
import { FeedItem } from '@/types';

export interface FeedScreenProps {
  readonly onRemix?: (item: FeedItem) => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({ onRemix }) => {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={FEED}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScreenHeader eyebrow="Community" title="Feed" rightGlyph="🔔" rightLabel="Notifications" />
        }
        renderItem={({ item, index }) => <FeedPost item={item} index={index} onRemix={onRemix} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
});
