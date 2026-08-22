export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly key: string; // Camelot code, e.g. "8A"
  readonly bpm: number;
  readonly energy: number; // 1..10
}

export interface FeedItem {
  readonly id: string;
  readonly user: string;
  readonly initials: string;
  readonly accent: 'key' | 'energy' | 'violet';
  readonly subtitle: string;
  readonly title: string;
  readonly key: string;
  readonly bpm: number;
  readonly energy: number;
  readonly plays: number;
  readonly likes: number;
}

export interface PadDef {
  readonly label: string;
  readonly accent: 'key' | 'energy' | 'violet';
  readonly sound: 'kick' | 'snare' | 'hat' | 'clap' | 'tom';
}

/** A track loaded onto a deck from the device's file system. */
export interface LoadedTrack {
  readonly uri: string;
  /** Display name, typically the file name without extension. */
  readonly name: string;
}

/** An audio asset read from the device's media library. */
export interface LibraryTrack {
  readonly id: string;
  readonly uri: string;
  readonly name: string;
  readonly durationMs: number;
}

/** A mix recorded in the Studio and published to the local feed. */
export interface RecordedMix {
  readonly id: string;
  readonly uri: string;
  readonly title: string;
  readonly durationMs: number;
  /** Epoch millis when the recording finished. */
  readonly createdAt: number;
  readonly keyA: string | null;
  readonly keyB: string | null;
  readonly bpm: number | null;
}
