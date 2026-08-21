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
