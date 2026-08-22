# PHASE — DJ app concept

> Mix in key. Make it yours.

An iPhone app that fuses the two things DJs currently pay for separately:

- **Mixed In Key 11** — harmonic analysis: musical key (Camelot), BPM, energy
  rating, cue points, and "what mixes next" suggestions.
- **BandLab** — a mobile studio + a social feed: create, layer, record, publish,
  follow, and remix other people's work.

`prototype.html` is a self-contained, tappable iPhone prototype (open it in any
browser or on your phone — no build step). It demonstrates the five core tabs and
the signature interaction: the **Camelot wheel**, where tapping any key lights up
every harmonically compatible mix and surfaces the tracks in your crate that fit.

## The five tabs

| Tab | Borrowed from | What it does |
|-----|---------------|--------------|
| **Crate** | Mixed In Key | Your library. Every track shows its Camelot key (color-coded), BPM, a 10-step energy meter, and a waveform. Filter by key range, tempo, or energy. |
| **Wheel** | Mixed In Key | Interactive Camelot wheel. Tap a key → compatible keys light up (same key, ±1, relative major/minor). Below, ranked next-track suggestions labelled *perfect / +− key / energy shift / blend*. |
| **Studio** | BandLab | Two decks + transport, plus a 12-pad sampler and layer stack. Record a mix or build one from loops. |
| **Feed** | BandLab | A social feed of mixes. Each post carries its key/BPM/energy tags, and a one-tap **Remix** to open it in your Studio. |
| **You** | both | Profile, stats, your dominant keys, and weekly energy trend. |

## Why the fusion matters

Mixed In Key tells you *what* to play next but stops at analysis — you export to
another app to actually mix. BandLab lets you build and share but is
harmonically blind. PHASE closes the loop: analysis → mix → publish → someone
remixes it → back into analysis, all in one place.

## Design language

Committed dark "booth" palette. Two signal colors carry meaning everywhere:
**cyan = key & harmonic**, **amber = energy & tempo**; **violet = remix &
collaboration**. Display type is Chakra Petch; all numbers (BPM, key, time) are
set in Space Mono, tabular. The Camelot wheel carries the full 12-hue spectrum.

## The real app — `app/`

`app/` is a working **Expo (React Native + TypeScript)** build of PHASE that runs
on a real iPhone. It follows this repo's `stitch::react-native` architecture:
theme tokens in `src/theme.ts`, atomic components (`atoms/` → `molecules/` →
`organisms/`), typed `Props` interfaces on every component, mock data isolated in
`src/data/`, logic in `src/hooks/`, and React Navigation for the tabs. Every
component passes the skill's `scripts/validate.js`, and `tsc --noEmit` is clean.

### What actually works right now

- **Two real decks** — load any track from your **music library** (or the file
  picker), with live playhead, timecodes, and independent play/pause per deck.
- **Crossfader** — drag to blend the decks with a standard DJ linear taper.
- **Tap tempo** — tap the beat 3+ times per deck; a rolling 8-tap average sets
  the BPM (`src/hooks/useDeck.ts`).
- **Key picker** — assign any of the 24 Camelot keys to a deck; the deck's
  waveform recolours to that key's hue.
- **Recording** — capture the internal mix (decks + crossfader + sampler, no
  mic) and publish it to your Feed, tagged with both decks' keys and the BPM.
- **Camelot wheel** — tap any of the 24 keys; compatible keys light up and the
  match list recomputes live. Deck A / Deck B shortcut buttons snap the wheel to
  whatever is loaded.
- **Crate** — search, filter chips, and dynamic **♥ Deck A / ♥ Deck B** chips that
  narrow the list to harmonically compatible tracks only. Tapping a track jumps
  to the Wheel on that key.
- **Sampler** — 12 pads trigger synthesized drum one-shots through the engine's
  8-voice pool, so hits land in the recording. Bundled WAVs in `app/assets/audio/`.

### The loop

Load a track → tap its tempo → set its key → the Wheel and Crate both react →
find a compatible track → load it on Deck B → crossfade → record → it appears in
your Feed. Shared state lives in `src/context/DeckContext.tsx` (deck keys/BPM,
cross-tab wheel jumps) and `src/context/MixesContext.tsx` (recorded mixes).

### Known platform limits

- **DRM'd streaming tracks** (Apple Music, Spotify) are not readable by third-party
  apps. The library picker surfaces downloaded and purchased files only; use the
  file picker fallback for anything else.
- **Requires a development build.** The native audio engine cannot load in Expo Go.
- **The Feed is local.** Mixes persist on-device via AsyncStorage. Sharing to other
  users needs a backend (see below).

### The audio engine — `app/modules/phase-audio/`

PHASE runs a custom **AVAudioEngine** graph written in Swift, not a stock player:

```
deckA.player → deckA.gain ┐
deckB.player → deckB.gain ┼→ mainMixerNode → output
sampler voices ───────────┘         │
                                    └─ tap → AAC file (the recorded mix)
```

Two consequences matter:

- **Recording captures the internal mix**, not a microphone. The tap sits on the
  main mixer, so it hears the decks, the crossfader position, and sampler hits
  exactly as you do — no room noise, and **no microphone permission**.
- **It exposes PCM**, which is the prerequisite for on-device key/BPM detection
  (the next stage). `expo-av` never hands you sample buffers.

### Run it on your iPhone

This needs a **development build** — Expo Go cannot load custom native modules.
The app detects this and shows an in-app notice rather than failing silently.

```bash
cd examples/phase-dj/app
npm install
npx expo run:ios          # builds + installs a dev client (needs Xcode + a Mac)
```

No Mac? Use an EAS cloud build instead:

```bash
npx eas build --profile development --platform ios
```

After the first native build, day-to-day JS changes reload normally with
`npx expo start` — you only rebuild when native code or dependencies change.

> Pinned to Expo SDK 51.

### Still to build (staged)

1. **On-device analysis** — automatic key / BPM / energy detection on load,
   replacing tap tempo and the manual key picker. The engine already exposes the
   PCM this needs.
2. **Beat-matching** — an `AVAudioUnitTimePitch` per deck for time-stretch and
   key-lock, so the crossfader blends tempo-aligned tracks.
3. **Backend** — accounts, a networked feed, mix hosting, and remix lineage, so
   the Feed reaches beyond this device.
4. **Export** — offline (faster-than-realtime) render of a mix, plus share sheet.

---

Prototype and app scaffolded with Google Stitch design skills.
