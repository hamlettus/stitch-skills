import { useCallback, useEffect, useRef, useState } from 'react';
import { PhaseAudio } from '../../modules/phase-audio';

export interface RecorderResult {
  readonly uri: string;
  readonly durationMs: number;
}

export interface RecorderState {
  readonly recording: boolean;
  readonly elapsedMs: number;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<RecorderResult | null>;
}

/**
 * Records the internal mix by tapping the engine's main mixer — the decks, the
 * crossfader position, and sampler hits, exactly as they sound.
 *
 * No microphone is involved, so this needs no recording permission and picks up
 * no room noise.
 */
export function useRecorder(): RecorderState {
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => clearTick, []);

  const start = useCallback(async () => {
    await PhaseAudio.startRecording();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
  }, []);

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    clearTick();
    setRecording(false);
    const result = await PhaseAudio.stopRecording();
    return result ?? null;
  }, []);

  return { recording, elapsedMs, start, stop };
}
