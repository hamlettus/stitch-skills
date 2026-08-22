import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface DeckInfo {
  /** Camelot key code (e.g. "8A"), null if not characterised. */
  key: string | null;
  bpm: number | null;
}

export interface DeckContextValue {
  deckA: DeckInfo;
  deckB: DeckInfo;
  /** Key the Wheel should jump to on next render, null = no pending jump. */
  wheelJumpKey: string | null;
  setDeckAKey: (k: string | null) => void;
  setDeckABpm: (b: number | null) => void;
  setDeckBKey: (k: string | null) => void;
  setDeckBBpm: (b: number | null) => void;
  /** Trigger the Wheel to snap to `key`. WheelScreen clears it after consuming. */
  jumpWheel: (key: string) => void;
  clearWheelJump: () => void;
}

const DeckContext = createContext<DeckContextValue>({
  deckA: { key: null, bpm: null },
  deckB: { key: null, bpm: null },
  wheelJumpKey: null,
  setDeckAKey: () => undefined,
  setDeckABpm: () => undefined,
  setDeckBKey: () => undefined,
  setDeckBBpm: () => undefined,
  jumpWheel: () => undefined,
  clearWheelJump: () => undefined,
});

export const useDeckContext = () => useContext(DeckContext);

export interface DeckProviderProps {
  readonly children: React.ReactNode;
}

export const DeckProvider: React.FC<DeckProviderProps> = ({ children }) => {
  const [deckAKey, setDeckAKeyState] = useState<string | null>(null);
  const [deckABpm, setDeckABpmState] = useState<number | null>(null);
  const [deckBKey, setDeckBKeyState] = useState<string | null>(null);
  const [deckBBpm, setDeckBBpmState] = useState<number | null>(null);
  const [wheelJumpKey, setWheelJumpKey] = useState<string | null>(null);

  const setDeckAKey = useCallback((k: string | null) => setDeckAKeyState(k), []);
  const setDeckABpm = useCallback((b: number | null) => setDeckABpmState(b), []);
  const setDeckBKey = useCallback((k: string | null) => setDeckBKeyState(k), []);
  const setDeckBBpm = useCallback((b: number | null) => setDeckBBpmState(b), []);
  const jumpWheel = useCallback((key: string) => setWheelJumpKey(key), []);
  const clearWheelJump = useCallback(() => setWheelJumpKey(null), []);

  const value = useMemo<DeckContextValue>(
    () => ({
      deckA: { key: deckAKey, bpm: deckABpm },
      deckB: { key: deckBKey, bpm: deckBBpm },
      wheelJumpKey,
      setDeckAKey,
      setDeckABpm,
      setDeckBKey,
      setDeckBBpm,
      jumpWheel,
      clearWheelJump,
    }),
    [deckAKey, deckABpm, deckBKey, deckBBpm, wheelJumpKey,
     setDeckAKey, setDeckABpm, setDeckBKey, setDeckBBpm, jumpWheel, clearWheelJump]
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
};
