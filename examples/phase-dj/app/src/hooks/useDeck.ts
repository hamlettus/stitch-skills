import { useCallback, useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { PhaseAudio, DeckId } from '../../modules/phase-audio';
import { LoadedTrack } from '@/types';

const TAP_MAX_INTERVAL_MS = 3000; // discard tap if user paused longer than this
const TAP_WINDOW = 8; // rolling window of taps used for average
const POLL_MS = 100; // playhead refresh rate

export interface DeckState {
  readonly track: LoadedTrack | null;
  readonly playing: boolean;
  /** 0..1 playhead position within the loaded track. */
  readonly positionRatio: number;
  readonly durationMs: number;
  /** BPM set by tap tempo, or null if not yet tapped. */
  readonly bpm: number | null;
  /** Camelot key code (e.g. "8A") set by the key picker, or null. */
  readonly musicKey: string | null;
  readonly loadFile: () => Promise<void>;
  /** Load a specific URI (e.g. picked from the media library). */
  readonly loadUri: (uri: string, name: string) => Promise<void>;
  readonly toggle: () => Promise<void>;
  readonly seek: (ratio: number) => Promise<void>;
  readonly setVolume: (v: number) => Promise<void>;
  /** Record one tap; calculates BPM from the rolling interval average. */
  readonly tapTempo: () => void;
  readonly setMusicKey: (code: string) => void;
}

/**
 * A deck backed by the native AVAudioEngine graph. Playback, gain, and the
 * playhead all live in Swift; this hook holds the React-facing state and polls
 * the engine for position while a track is playing.
 */
export function useDeck(id: DeckId): DeckState {
  const [track, setTrack] = useState<LoadedTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const [musicKey, setMusicKeyState] = useState<string | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the engine only while this deck is actually playing
  useEffect(() => {
    if (!playing || !PhaseAudio.available) return;

    pollRef.current = setInterval(() => {
      void PhaseAudio.getDeckState(id)
        .then((s) => {
          setPositionMs(s.positionMs);
          if (s.durationMs > 0) setDurationMs(s.durationMs);
          if (s.finished) setPlaying(false);
        })
        .catch(() => undefined);
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [playing, id]);

  const loadUri = useCallback(async (uri: string, name: string) => {
    const duration = await PhaseAudio.loadDeck(id, uri);
    setTrack({ uri, name: name.replace(/\.[^.]+$/, '') });
    setDurationMs(duration);
    setPositionMs(0);
    setPlaying(false);

    // Reset per-track metadata so stale values from a previous load don't persist
    setBpm(null);
    setMusicKeyState(null);
    tapTimesRef.current = [];
  }, [id]);

  const loadFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await loadUri(asset.uri, asset.name ?? 'Unknown Track');
  }, [loadUri]);

  const toggle = useCallback(async () => {
    if (!track) return;
    if (playing) {
      await PhaseAudio.pause(id);
      setPlaying(false);
    } else {
      await PhaseAudio.play(id);
      setPlaying(true);
    }
  }, [id, playing, track]);

  const seek = useCallback(async (ratio: number) => {
    if (!track || durationMs <= 0) return;
    const target = Math.max(0, Math.min(1, ratio)) * durationMs;
    await PhaseAudio.seek(id, target);
    setPositionMs(target);
  }, [id, track, durationMs]);

  const setVolume = useCallback(async (v: number) => {
    if (!PhaseAudio.available) return;
    await PhaseAudio.setGain(id, Math.max(0, Math.min(1, v)));
  }, [id]);

  const tapTempo = useCallback(() => {
    const now = Date.now();
    const prev = tapTimesRef.current;

    // Drop taps that are too far apart (user paused)
    const recent = [...prev, now].filter((t, i, arr) => i === 0 || (arr[i] - arr[i - 1]) < TAP_MAX_INTERVAL_MS);
    tapTimesRef.current = recent.slice(-TAP_WINDOW);

    if (tapTimesRef.current.length >= 2) {
      const taps = tapTimesRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculated = Math.round(60000 / avg);
      if (calculated >= 60 && calculated <= 220) {
        setBpm(calculated);
      }
    }
  }, []);

  const setMusicKey = useCallback((code: string) => {
    setMusicKeyState(code === '' ? null : code);
  }, []);

  const positionRatio = durationMs > 0 ? positionMs / durationMs : 0;

  return {
    track, playing, positionRatio, durationMs, bpm, musicKey,
    loadFile, loadUri, toggle, seek, setVolume, tapTempo, setMusicKey,
  };
}
