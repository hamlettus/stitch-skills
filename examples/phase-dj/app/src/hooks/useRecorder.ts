import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export interface RecorderResult {
  readonly uri: string;
  readonly durationMs: number;
}

export interface RecorderState {
  readonly recording: boolean;
  readonly elapsedMs: number;
  readonly permissionDenied: boolean;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<RecorderResult | null>;
}

/**
 * Captures audio from the device microphone. On iOS this records what the
 * mic hears — play the mix out loud (or through a routing setup) to capture it.
 * Internal audio capture is not available to third-party iOS apps.
 */
export function useRecorder(): RecorderState {
  const recRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTick();
      void recRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  const start = useCallback(async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    // Recording mode must allow mic input while still playing the decks
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();

    recRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
  }, []);

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    const rec = recRef.current;
    if (!rec) return null;

    clearTick();
    setRecording(false);

    try {
      await rec.stopAndUnloadAsync();
    } catch {
      // Already stopped — fall through and use whatever URI exists
    }

    const uri = rec.getURI();
    recRef.current = null;

    // Restore playback-only mode so the decks keep full output volume
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    if (!uri) return null;
    return { uri, durationMs: Date.now() - startedAtRef.current };
  }, []);

  return { recording, elapsedMs, permissionDenied, start, stop };
}
