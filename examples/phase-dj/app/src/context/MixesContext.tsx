import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecordedMix } from '@/types';

const STORAGE_KEY = 'phase.mixes.v1';

export interface MixesContextValue {
  readonly mixes: readonly RecordedMix[];
  readonly loaded: boolean;
  readonly publish: (mix: RecordedMix) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}

const MixesContext = createContext<MixesContextValue>({
  mixes: [],
  loaded: false,
  publish: async () => undefined,
  remove: async () => undefined,
});

export const useMixes = () => useContext(MixesContext);

export interface MixesProviderProps {
  readonly children: React.ReactNode;
}

/**
 * Stores mixes recorded in the Studio. Persisted on-device with AsyncStorage —
 * this is a local feed, not a networked one. Publishing to other users would
 * need a backend.
 */
export const MixesProvider: React.FC<MixesProviderProps> = ({ children }) => {
  const [mixes, setMixes] = useState<readonly RecordedMix[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setMixes(parsed as RecordedMix[]);
        }
      } catch {
        // Corrupt or unreadable store — start empty rather than crash
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next: readonly RecordedMix[]) => {
    setMixes(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep the in-memory list even if the write fails
    }
  }, []);

  const publish = useCallback(async (mix: RecordedMix) => {
    // Newest first
    await persist([mix, ...mixes]);
  }, [mixes, persist]);

  const remove = useCallback(async (id: string) => {
    await persist(mixes.filter((m) => m.id !== id));
  }, [mixes, persist]);

  const value = useMemo<MixesContextValue>(
    () => ({ mixes, loaded, publish, remove }),
    [mixes, loaded, publish, remove]
  );

  return <MixesContext.Provider value={value}>{children}</MixesContext.Provider>;
};
