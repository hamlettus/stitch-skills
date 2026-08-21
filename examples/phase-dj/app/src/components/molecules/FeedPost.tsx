import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { FeedItem } from '@/types';
import { Waveform } from '@/components/atoms/Waveform';
import { keyColor, keyName } from '@/utils/camelot';

const ACCENT: Record<FeedItem['accent'], string> = {
  key: colors.key,
  energy: colors.energy,
  violet: colors.violet,
};

export interface FeedPostProps {
  readonly item: FeedItem;
  readonly index: number;
  readonly onRemix?: (item: FeedItem) => void;
}

export const FeedPost: React.FC<FeedPostProps> = ({ item, index, onRemix }) => {
  const accent = ACCENT[item.accent];
  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: accent }]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        <View style={styles.headText}>
          <Text style={styles.user}>{item.user}</Text>
          <Text style={styles.sub}>{item.subtitle}</Text>
        </View>
        <Pressable style={styles.follow} accessibilityRole="button" accessibilityLabel={`Follow ${item.user}`}>
          <Text style={styles.followText}>Follow</Text>
        </Pressable>
      </View>

      <View style={styles.art}>
        <Text style={styles.title}>{item.title}</Text>
        <Waveform seed={index * 5 + 2} color={accent} height={46} bars={64} />
        <View style={styles.tags}>
          <Text style={[styles.tag, styles.tagKey]}>{`◐ ${item.key} · ${keyName(item.key)}`}</Text>
          <Text style={[styles.tag, styles.tagEnergy]}>{`${item.bpm} BPM`}</Text>
          <Text style={styles.tag}>{`Energy ${item.energy}`}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Text style={styles.action}>{`♥ ${item.likes}`}</Text>
        <Text style={styles.action}>{`▶ ${item.plays}`}</Text>
        <Text style={styles.action}>{`💬 ${Math.floor(item.likes / 4)}`}</Text>
        <Pressable
          style={styles.remix}
          onPress={() => onRemix?.(item)}
          accessibilityRole="button"
          accessibilityLabel={`Remix ${item.title}`}
        >
          <Text style={styles.remixText}>⟳ Remix</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  post: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 14, color: colors.onAccent },
  headText: { flex: 1 },
  user: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  sub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted },
  follow: { borderWidth: 1, borderColor: colors.keyDim, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  followText: { fontFamily: fonts.mono, fontSize: 11, color: colors.key },
  art: { paddingHorizontal: 14, paddingBottom: 12 },
  title: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text, marginBottom: 9 },
  tags: { flexDirection: 'row', gap: 7, marginTop: 11, flexWrap: 'wrap' },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    color: colors.muted,
  },
  tagKey: { color: colors.key },
  tagEnergy: { color: colors.energy },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  action: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.muted },
  remix: { marginLeft: 'auto' },
  remixText: { fontFamily: fonts.monoBold, fontSize: 12.5, color: colors.violet },
});
