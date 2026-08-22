import { useEffect, useRef } from 'react';
import { Asset } from 'expo-asset';
import { PhaseAudio } from '../../modules/phase-audio';

export type SoundName = 'kick' | 'snare' | 'hat' | 'clap' | 'tom';

const SOURCES: Record<SoundName, number> = {
  kick: require('../../assets/audio/kick.wav'),
  snare: require('../../assets/audio/snare.wav'),
  hat: require('../../assets/audio/hat.wav'),
  clap: require('../../assets/audio/clap.wav'),
  tom: require('../../assets/audio/tom.wav'),
};

/**
 * Loads the drum one-shots into the native engine's voice pool and returns a
 * `trigger` that fires one immediately.
 *
 * Routing pads through the engine (rather than a separate player) is what puts
 * them into the recorded mix.
 */
export function useSampler() {
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!PhaseAudio.available) return;
      for (const name of Object.keys(SOURCES) as SoundName[]) {
        // Bundled assets must be downloaded to a local file before the native
        // side can open them.
        const asset = Asset.fromModule(SOURCES[name]);
        await asset.downloadAsync();
        if (cancelled) return;
        const uri = asset.localUri ?? asset.uri;
        await PhaseAudio.loadSample(name, uri);
      }
      if (!cancelled) readyRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const trigger = async (name: SoundName) => {
    if (!readyRef.current) return;
    await PhaseAudio.triggerSample(name);
  };

  return { trigger };
}
