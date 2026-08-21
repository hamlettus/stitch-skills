import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

const LOOP = require('../../assets/audio/loop_124.wav');

/**
 * A looping deck backed by a real 124 BPM drum loop. `toggle` starts/stops
 * playback; `playing` drives the transport UI.
 */
export function useDeck() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync(LOOP, { isLooping: true, volume: 0.9 });
      if (cancelled) {
        await sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
    })();

    return () => {
      cancelled = true;
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const toggle = async () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playFromPositionAsync(0);
      setPlaying(true);
    }
  };

  return { playing, toggle };
}
