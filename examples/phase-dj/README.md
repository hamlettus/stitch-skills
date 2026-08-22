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
- **Recording** — capture the mix through the mic and publish it to your Feed,
  tagged with both decks' keys and the BPM (`src/hooks/useRecorder.ts`).
- **Camelot wheel** — tap any of the 24 keys; compatible keys light up and the
  match list recomputes live. Deck A / Deck B shortcut buttons snap the wheel to
  whatever is loaded.
- **Crate** — search, filter chips, and dynamic **♥ Deck A / ♥ Deck B** chips that
  narrow the list to harmonically compatible tracks only. Tapping a track jumps
  to the Wheel on that key.
- **Sampler** — 12 pads trigger synthesized drum one-shots (`expo-av` + haptics).
  Audio is generated, bundled WAVs in `app/assets/audio/`.

### The loop

Load a track → tap its tempo → set its key → the Wheel and Crate both react →
find a compatible track → load it on Deck B → crossfade → record → it appears in
your Feed. Shared state lives in `src/context/DeckContext.tsx` (deck keys/BPM,
cross-tab wheel jumps) and `src/context/MixesContext.tsx` (recorded mixes).

### Known platform limits

- **DRM'd streaming tracks** (Apple Music, Spotify) are not readable by third-party
  apps. The library picker surfaces downloaded and purchased files only; use the
  file picker fallback for anything else.
- **Recording captures the microphone**, not the internal audio bus — iOS does not
  expose internal capture to third-party apps. Play the mix out loud, or route it
  through an audio interface.
- **The Feed is local.** Mixes persist on-device via AsyncStorage. Sharing to other
  users needs a backend (see below).

### Run it on your iPhone (no App Store needed)

1. Install the **Expo Go** app from the App Store on your iPhone.
2. On your computer:
   ```bash
   cd examples/phase-dj/app
   npm install
   npx expo start
   ```
3. Scan the QR code in the terminal with your iPhone camera → it opens in Expo Go.

> Pinned to Expo SDK 51. If your Expo Go is on a newer SDK, run
> `npx expo install expo@latest && npx expo install --fix` to realign versions.

### Still to build (staged)

1. **On-device analysis** — automatic key / BPM / energy detection on load
   (Essentia/aubio-style DSP or a Core ML model), replacing tap tempo and the
   manual key picker with real detection.
2. **Beat-matching** — time-stretch and key-lock so the crossfader blends
   tempo-aligned tracks rather than mixing raw volumes.
3. **Backend** — accounts, a networked feed, mix hosting, and remix lineage, so
   the Feed reaches beyond this device.
4. **Export** — render a mix to a shareable file rather than a mic capture.

---

Prototype and app scaffolded with Google Stitch design skills.
