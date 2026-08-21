import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Waveform } from '@/components/atoms/Waveform';
import { LoadedTrack } from '@/types';

export interface DeckCardProps {
  readonly label: string;
  readonly track: LoadedTrack | null;
  readonly playing: boolean;
  readonly positionRatio: number;
  readonly durationMs: number;
  readonly onLoad: () => void;
  readonly onToggle: () => void;
  /** Seed for the placeholder waveform shown before a track is loaded. */
  readonly seed: number;
}

const formatMs = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const DeckCard: React.FC<DeckCardProps> = ({
  label,
  track,
  playing,
  positionRatio,
  durationMs,
  onLoad,
  onToggle,
  seed,
}) => {
  const elapsed = durationMs > 0 ? formatMs(positionRatio * durationMs) : '0:00';
  const remaining = durationMs > 0 ? `-${formatMs(durationMs - positionRatio * durationMs)}` : '0:00';

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        {track ? (
          <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
        ) : (
          <Text style={styles.emptyHint}>no track loaded</Text>
        )}
        {/* Load button */}
        <Pressable
          style={styles.loadBtn}
          onPress={onLoad}
          accessibilityRole="button"
          accessibilityLabel={`Load track onto ${label}`}
        >
          <Text style={styles.loadBtnText}>LOAD</Text>
        </Pressable>
      </View>

      {/* Waveform / empty state */}
      {track ? (
        <>
          <Waveform seed={seed} color={colors.key} played={positionRatio} height={56} bars={72} />
          <View style={styles.timecodes}>
            <Text style={styles.tc}>{elapsed}</Text>
            <Text style={styles.tc}>{remaining}</Text>
          </View>
        </>
      ) : (
        <Pressable style={styles.loadZone} onPress={onLoad} accessibilityRole="button" accessibilityLabel={`Load track onto ${label}`}>
          <Text style={styles.loadZoneIcon}>♫</Text>
          <Text style={styles.loadZoneText}>TAP TO LOAD TRACK</Text>
        </Pressable>
      )}

      {/* Transport */}
      <View style={styles.transport}>
        <Pressable
          style={[styles.playBtn, !track && styles.playBtnDim]}
          onPress={onToggle}
          disabled={!track}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          accessibilityState={{ disabled: !track }}
        >
          <Text style={styles.playBtnGlyph}>{playing ? '⏸' : '▶'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
    gap: 8,
  },
  label: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 48,
  },
  trackName: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  emptyHint: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted2,
    flex: 1,
  },
  loadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  loadBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.key,
    letterSpacing: 1,
  },
  loadZone: {
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadZoneIcon: { fontSize: 20, color: colors.muted2 },
  loadZoneText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.muted2,
    letterSpacing: 1.5,
  },
  timecodes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tc: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted2 },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnDim: { opacity: 0.35 },
  playBtnGlyph: { fontSize: 16, color: colors.onAccent },
});
