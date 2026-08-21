import { FeedItem, PadDef, Track } from '@/types';

export const TRACKS: readonly Track[] = [
  { id: 't1', title: 'Neon Tide', artist: 'Khāl', key: '8A', bpm: 124, energy: 6 },
  { id: 't2', title: 'Midnight Protocol', artist: 'Vessel', key: '9A', bpm: 126, energy: 7 },
  { id: 't3', title: 'Afterglow', artist: 'Sona', key: '8B', bpm: 122, energy: 5 },
  { id: 't4', title: 'Gravity Well', artist: 'Dax Mercer', key: '7A', bpm: 128, energy: 8 },
  { id: 't5', title: 'Paper Lanterns', artist: 'Mira Vale', key: '8A', bpm: 120, energy: 4 },
  { id: 't6', title: 'Concrete Bloom', artist: 'Fault Line', key: '5A', bpm: 130, energy: 9 },
  { id: 't7', title: 'Slow Static', artist: 'Odile', key: '9A', bpm: 125, energy: 6 },
  { id: 't8', title: 'Ember Drift', artist: 'Two Rivers', key: '7A', bpm: 127, energy: 7 },
  { id: 't9', title: 'Halcyon', artist: 'Nocturne Kids', key: '8B', bpm: 121, energy: 5 },
  { id: 't10', title: 'Pressure Drop', artist: 'Kilowatt', key: '10A', bpm: 132, energy: 9 },
  { id: 't11', title: 'Velvet Hours', artist: 'June Sky', key: '6A', bpm: 118, energy: 3 },
  { id: 't12', title: 'Ultraviolet', artist: 'Sona', key: '9A', bpm: 128, energy: 8 },
];

export const CRATE_FILTERS: readonly string[] = [
  'All',
  'Analyzed',
  '120–128',
  'High energy',
  '8A · 8B',
  'Recent',
];

export const PADS: readonly PadDef[] = [
  { label: 'KICK', accent: 'energy', sound: 'kick' },
  { label: 'SNARE', accent: 'key', sound: 'snare' },
  { label: 'HAT', accent: 'violet', sound: 'hat' },
  { label: 'CLAP', accent: 'energy', sound: 'clap' },
  { label: 'TOM', accent: 'key', sound: 'tom' },
  { label: 'RIM', accent: 'violet', sound: 'hat' },
  { label: 'SUB', accent: 'energy', sound: 'kick' },
  { label: 'STAB', accent: 'key', sound: 'snare' },
  { label: 'PERC', accent: 'violet', sound: 'clap' },
  { label: 'ROLL', accent: 'key', sound: 'hat' },
  { label: 'BOOM', accent: 'energy', sound: 'tom' },
  { label: 'AIR', accent: 'violet', sound: 'hat' },
];

export const FEED: readonly FeedItem[] = [
  {
    id: 'f1', user: 'Odile', initials: 'OD', accent: 'key',
    subtitle: '2h · dropped a mix', title: 'Rooftop, 3am',
    key: '6A', bpm: 118, energy: 7, plays: 342, likes: 58,
  },
  {
    id: 'f2', user: 'Kilowatt', initials: 'KW', accent: 'energy',
    subtitle: '5h · dropped a mix', title: 'Warehouse Cut',
    key: '10A', bpm: 132, energy: 9, plays: 1204, likes: 190,
  },
  {
    id: 'f3', user: 'June Sky', initials: 'JS', accent: 'violet',
    subtitle: '1d · remixed you', title: 'Velvet Hours (Kai V. flip)',
    key: '6A', bpm: 120, energy: 4, plays: 876, likes: 143,
  },
];

export const PROFILE = {
  name: 'Kai Vega',
  handle: '@kaivega',
  joined: 'joined 2024',
  followers: '1.2k',
  mixes: 63,
  analyzed: 248,
  avgEnergy: 7.4,
  weekEnergy: [5, 7, 4, 8, 6, 9, 7] as readonly number[],
  dominantKeys: ['8A', '9A', '5A'] as readonly string[],
} as const;
