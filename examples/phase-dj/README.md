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

## Suggested build path (next steps)

This prototype is design-only. A real iOS build would layer on:

1. **Audio engine** — AVAudioEngine for playback, time-stretch/pitch (key-lock),
   and dual-deck crossfade.
2. **Analysis** — on-device key/BPM/energy detection (e.g. an aubio/Essentia-style
   pipeline or a Core ML model) run on import.
3. **Library** — MediaPlayer / Files import, local metadata store.
4. **Backend** — accounts, the social feed, mix hosting, and remix lineage.

React Native (Expo) is a viable path too and lines up with this repo's
`stitch::react-native` skill for turning these screens into components.

---

Prototype generated with Google Stitch design skills.
