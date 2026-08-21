import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

export type SoundName = 'kick' | 'snare' | 'hat' | 'clap' | 'tom';

const SOURCES: Record<SoundName, number> = {
  kick: require('../../assets/audio/kick.wav'),
  snare: require('../../assets/audio/snare.wav'),
  hat: require('../../assets/audio/hat.wav'),
  clap: require('../../assets/audio/clap.wav'),
  tom: require('../../assets/audio/tom.wav'),
};

/**
 * Preloads the drum one-shots and returns a `trigger` that plays one immediately.
 * Real audio via expo-av — pads make sound on tap.
 */
export function useSampler() {
  const soundsRef = useRef<Partial<Record<SoundName, Audio.Sound>>>({});

  useEffect(() => {
    let cancelled = false;
    const store = soundsRef.current;

    (async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      for (const name of Object.keys(SOURCES) as SoundName[]) {
        const { sound } = await Audio.Sound.createAsync(SOURCES[name], { volume: 1.0 });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        store[name] = sound;
      }
    })();

    return () => {
      cancelled = true;
      Object.values(store).forEach((s) => {
        void s?.unloadAsync();
      });
    };
  }, []);

  const trigger = async (name: SoundName) => {
    const sound = soundsRef.current[name];
    if (sound) {
      await sound.replayAsync();
    }
  };

  return { trigger };
}
