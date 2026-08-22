import { requireOptionalNativeModule } from 'expo-modules-core';

export type DeckId = 'A' | 'B';

export interface DeckState {
  readonly loaded: boolean;
  readonly playing: boolean;
  readonly positionMs: number;
  readonly durationMs: number;
  /** True on the poll where playback reached the end of the track. */
  readonly finished: boolean;
}

export interface RecordingResult {
  readonly uri: string;
  readonly durationMs: number;
}

interface PhaseAudioNativeModule {
  prepare(): Promise<void>;
  loadDeck(deck: DeckId, uri: string): Promise<number>;
  play(deck: DeckId): Promise<void>;
  pause(deck: DeckId): Promise<void>;
  seek(deck: DeckId, positionMs: number): Promise<void>;
  setGain(deck: DeckId, value: number): Promise<void>;
  getDeckState(deck: DeckId): Promise<DeckState>;
  loadSample(name: string, uri: string): Promise<void>;
  triggerSample(name: string): Promise<void>;
  startRecording(): Promise<boolean>;
  stopRecording(): Promise<RecordingResult | null>;
  readonly isRecording: boolean;
}

/**
 * The native AVAudioEngine module. Absent in Expo Go — this package requires a
 * development build (`npx expo run:ios` or an EAS dev-client build).
 */
const native = requireOptionalNativeModule<PhaseAudioNativeModule>('PhaseAudio');

/** True when the native audio engine is linked into this binary. */
export const isPhaseAudioAvailable = native != null;

const MISSING =
  'PhaseAudio native module not found. The DJ engine needs a development build — ' +
  'run `npx expo run:ios` (or install an EAS dev-client build). It cannot run in Expo Go.';

function required(): PhaseAudioNativeModule {
  if (!native) throw new Error(MISSING);
  return native;
}

export const PhaseAudio = {
  available: isPhaseAudioAvailable,
  prepare: () => required().prepare(),
  loadDeck: (deck: DeckId, uri: string) => required().loadDeck(deck, uri),
  play: (deck: DeckId) => required().play(deck),
  pause: (deck: DeckId) => required().pause(deck),
  seek: (deck: DeckId, positionMs: number) => required().seek(deck, positionMs),
  setGain: (deck: DeckId, value: number) => required().setGain(deck, value),
  getDeckState: (deck: DeckId) => required().getDeckState(deck),
  loadSample: (name: string, uri: string) => required().loadSample(name, uri),
  triggerSample: (name: string) => required().triggerSample(name),
  startRecording: () => required().startRecording(),
  stopRecording: () => required().stopRecording(),
};
