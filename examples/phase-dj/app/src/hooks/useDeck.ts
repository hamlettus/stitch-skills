import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { LoadedTrack } from '@/types';

const TAP_MAX_INTERVAL_MS = 3000; // discard tap if user paused longer than this
const TAP_WINDOW = 8; // rolling window of taps used for average

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
  readonly setVolume: (v: number) => Promise<void>;
  /** Record one tap; calculates BPM from the rolling interval average. */
  readonly tapTempo: () => void;
  readonly setMusicKey: (code: string) => void;
}

/**
 * A full deck player. Supports loading any audio file from the device,
 * real-time playhead tracking, and volume control for crossfading.
 */
export function useDeck(): DeckState {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [track, setTrack] = useState<LoadedTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const [musicKey, setMusicKeyState] = useState<string | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  // Stable ref so PanResponder / closures always call the latest onChange
  const onStatusRef = useRef<(pos: number, dur: number, finished: boolean) => void>(
    () => undefined
  );
  onStatusRef.current = (pos, dur, finished) => {
    setPositionMs(pos);
    if (dur > 0) setDurationMs(dur);
    if (finished) setPlaying(false);
  };

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
    };
  }, []);

  const loadUri = useCallback(async (uri: string, name: string) => {
    // Unload any previous sound
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlaying(false);
    setPositionMs(0);
    setDurationMs(0);

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: 1.0 },
      (status) => {
        if (!status.isLoaded) return;
        onStatusRef.current(
          status.positionMillis ?? 0,
          status.durationMillis ?? 0,
          status.didJustFinish ?? false
        );
      }
    );

    soundRef.current = sound;
    setTrack({ uri, name: name.replace(/\.[^.]+$/, '') });

    // Reset per-track metadata so stale values from a previous load don't persist
    setBpm(null);
    setMusicKeyState(null);
    tapTimesRef.current = [];
  }, []);

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
    const sound = soundRef.current;
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playAsync();
      setPlaying(true);
    }
  }, [playing]);

  const setVolume = useCallback(async (v: number) => {
    await soundRef.current?.setVolumeAsync(Math.max(0, Math.min(1, v)));
  }, []);

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

  return { track, playing, positionRatio, durationMs, bpm, musicKey, loadFile, loadUri, toggle, setVolume, tapTempo, setMusicKey };
}
