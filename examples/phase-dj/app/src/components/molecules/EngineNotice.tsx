import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';

export interface EngineNoticeProps {
  readonly title?: string;
}

/**
 * Shown when the native audio engine isn't linked — i.e. the app is running in
 * Expo Go, which cannot load custom native modules.
 */
export const EngineNotice: React.FC<EngineNoticeProps> = ({
  title = 'Audio engine not loaded',
}) => (
  <View style={styles.box}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>
      The decks, sampler and recording need the native mixing engine, which Expo Go
      can't load. Build a development client:
    </Text>
    <Text style={styles.code}>npx expo run:ios</Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.energy,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    gap: 6,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.energy },
  body: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, lineHeight: 17 },
  code: {
    fontFamily: fonts.monoBold,
    fontSize: 11.5,
    color: colors.key,
    backgroundColor: colors.surface2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginTop: 2,
  },
});
