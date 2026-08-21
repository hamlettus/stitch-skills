import { useMemo } from 'react';
import { TRACKS } from '@/data/mockData';
import { compatibleKeys } from '@/utils/camelot';
import { Track } from '@/types';

/** Tracks in the crate that mix harmonically from `selectedKey`, best-first. */
export function useHarmonicMatches(selectedKey: string): Track[] {
  return useMemo(() => {
    const compatible = new Set(compatibleKeys(selectedKey));
    const others = TRACKS.filter((t) => compatible.has(t.key) && t.key !== selectedKey);
    const exact = TRACKS.filter((t) => t.key === selectedKey);
    return [...others, ...exact];
  }, [selectedKey]);
}
