import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { LoadedTrack } from '@/types';

export interface DeckState {
  readonly track: LoadedTrack | null;
  readonly playing: boolean;
  /** 0..1 playhead position within the loaded track. */
  readonly positionRatio: number;
  readonly durationMs: number;
  readonly loadFile: () => Promise<void>;
  readonly toggle: () => Promise<void>;
  readonly setVolume: (v: number) => Promise<void>;
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

  const loadFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

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
      { uri: asset.uri },
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

    // Strip extension from display name
    const raw = asset.name ?? 'Unknown Track';
    const displayName = raw.replace(/\.[^.]+$/, '');
    setTrack({ uri: asset.uri, name: displayName });
  }, []);

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

  const positionRatio = durationMs > 0 ? positionMs / durationMs : 0;

  return { track, playing, positionRatio, durationMs, loadFile, toggle, setVolume };
}
