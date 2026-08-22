import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { colors, fonts, radius, space } from '@/theme';
import { Waveform } from '@/components/atoms/Waveform';
import { keyColor, keyName } from '@/utils/camelot';
import { RecordedMix } from '@/types';

export interface MixPostProps {
  readonly mix: RecordedMix;
  readonly index: number;
  readonly onDelete: (id: string) => void;
}

const formatDur = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const relTime = (ts: number): string => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const MixPost: React.FC<MixPostProps> = ({ mix, index, onDelete }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
    };
  }, []);

  const toggle = async () => {
    if (soundRef.current) {
      if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
      return;
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
    const { sound } = await Audio.Sound.createAsync(
      { uri: mix.uri },
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) return;
        const dur = status.durationMillis ?? mix.durationMs;
        if (dur > 0) setRatio((status.positionMillis ?? 0) / dur);
        if (status.didJustFinish) {
          setPlaying(false);
          setRatio(0);
        }
      }
    );
    soundRef.current = sound;
    setPlaying(true);
  };

  const accent = mix.keyA ? keyColor(mix.keyA) : colors.violet;

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: accent }]}>
          <Text style={styles.avatarText}>YOU</Text>
        </View>
        <View style={styles.headText}>
          <Text style={styles.user}>Your mix</Text>
          <Text style={styles.sub}>{`${relTime(mix.createdAt)} · ${formatDur(mix.durationMs)}`}</Text>
        </View>
        <Pressable
          style={styles.delete}
          onPress={() => onDelete(mix.id)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${mix.title}`}
        >
          <Text style={styles.deleteText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.art}>
        <Text style={styles.title}>{mix.title}</Text>
        <Waveform seed={index * 7 + 3} color={accent} played={ratio} height={46} bars={64} />
        <View style={styles.tags}>
          {mix.keyA && (
            <Text style={[styles.tag, { color: keyColor(mix.keyA) }]}>
              {`◐ A · ${mix.keyA} ${keyName(mix.keyA)}`}
            </Text>
          )}
          {mix.keyB && (
            <Text style={[styles.tag, { color: keyColor(mix.keyB) }]}>
              {`◑ B · ${mix.keyB} ${keyName(mix.keyB)}`}
            </Text>
          )}
          {mix.bpm != null && <Text style={[styles.tag, styles.tagEnergy]}>{`${mix.bpm} BPM`}</Text>}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.playBtn}
          onPress={() => void toggle()}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${mix.title}` : `Play ${mix.title}`}
        >
          <Text style={styles.playGlyph}>{playing ? '⏸' : '▶'}</Text>
        </Pressable>
        <Text style={styles.localTag}>SAVED ON THIS DEVICE</Text>
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
  avatarText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.onAccent },
  headText: { flex: 1 },
  user: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  sub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted },
  delete: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontFamily: fonts.mono, fontSize: 14, color: colors.muted2 },
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
  tagEnergy: { color: colors.energy },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 14, color: colors.onAccent },
  localTag: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.muted2, letterSpacing: 1 },
});
