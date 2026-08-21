import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { PROFILE } from '@/data/mockData';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { SectionLabel } from '@/components/atoms/SectionLabel';
import { keyColor, keyName } from '@/utils/camelot';

export interface ProfileScreenProps {
  readonly name?: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ name = PROFILE.name }) => {
  const maxDay = Math.max(...PROFILE.weekEnergy);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Producer · DJ" title="You" rightGlyph="⚙" rightLabel="Settings" />

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>KV</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.handle}>{`${PROFILE.handle} · ${PROFILE.joined}`}</Text>
        </View>

        <View style={styles.stats}>
          <Stat value={PROFILE.followers} label="Followers" />
          <Stat value={String(PROFILE.mixes)} label="Mixes" />
          <Stat value={String(PROFILE.analyzed)} label="Analyzed" />
        </View>

        <SectionLabel>Your dominant keys</SectionLabel>
        <View style={styles.keyRow}>
          {PROFILE.dominantKeys.map((code) => (
            <View key={code} style={[styles.keyBadge, { backgroundColor: keyColor(code) }]}>
              <Text style={styles.keyBadgeCode}>{code}</Text>
              <Text style={styles.keyBadgeName}>{keyName(code)}</Text>
            </View>
          ))}
        </View>

        <SectionLabel>This week</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>Avg. mix energy</Text>
            <Text style={styles.cardValue}>{`${PROFILE.avgEnergy} / 10`}</Text>
          </View>
          <View style={styles.bars}>
            {PROFILE.weekEnergy.map((d, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: `${(d / maxDay) * 100}%`,
                  minHeight: 6,
                  borderRadius: 3,
                  backgroundColor: colors.energy,
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

interface StatProps {
  readonly value: string;
  readonly label: string;
}
const Stat: React.FC<StatProps> = ({ value, label }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 14 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 32, color: colors.onAccent },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.text, marginTop: 12 },
  handle: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, marginTop: space.xl },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.monoBold, fontSize: 22, color: colors.text },
  statLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body,
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  keyRow: { flexDirection: 'row', gap: 8 },
  keyBadge: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md },
  keyBadgeCode: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.onAccent },
  keyBadgeName: { fontFamily: fonts.mono, fontSize: 9, color: colors.onAccent, opacity: 0.7, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.lg,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  cardValue: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.energy },
  bars: { flexDirection: 'row', gap: 3, height: 34, alignItems: 'flex-end', marginTop: 12 },
});
