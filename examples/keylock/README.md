# Keylock

Reads the Camelot key, BPM and energy off your own audio files, on the phone,
then scores every transition as you put a set in order.

Open `keylock.html` in any browser — no build, no install, no server.

## Why the rewrite

The earlier build crashed on import. The cause was `decodeAudioData`: it decodes
an **entire** file to float32 PCM before it resolves. A six-minute stereo track
at 44.1 kHz is ~127 MB, and Safari on iOS kills the tab well before that lands.
Trimming the buffer afterwards can't help — the peak has already happened.

The fix is to never decode at full rate. `decodeAudioData` resamples to the
context's sample rate on the way out, so decoding into an
`OfflineAudioContext` at 11 kHz brings the same track in at roughly 16 MB.
Nothing above ~5 kHz matters for chroma or beat detection, so no accuracy is
lost. Peak memory per track drops about 8×.

Three smaller things support it: an `OfflineAudioContext` is used for decoding
rather than a live one (iOS caps live contexts at around four), only a 100 s
window is kept, and there is a short pause between files so the collector runs.

## Analysis

| | Method | Verified |
|---|---|---|
| **BPM** | RMS onset envelope → half-wave rectified difference → autocorrelation over 60–200 BPM, folded to a readable octave | 126 → 126.0, 174 → 172.3, 124 → 123.0, 140 → 139.7 |
| **Key** | Constant-window FFT → 12-bin chroma → correlation against Albrecht–Shanahan profiles for all 24 keys, plus a bass-root term | 5/5 on synthetic progressions |
| **Energy** | RMS in dB mapped to 1–10 | — |
| **Genre** | Not detected — type it in | — |

Run the checks with `node test/dsp.test.js`.

### The relative-key problem

A key and its relative minor/major contain identical notes, so a chroma
histogram alone cannot separate them — A minor and C major look the same. The
first pass got this wrong, calling an A minor progression C major.

The bass line is what breaks the tie: it states the real tonic. Scoring adds a
root term weighted by the low-band (40–260 Hz) energy at each candidate tonic.
When the top two readings are still relatives within a small margin, the track
is flagged: the chip shows `8A?` and the detail sheet names both readings.
Anything you set by hand is trusted and never overwritten.

## What it does

- **Library** — add files, get key / BPM / energy / duration per track, sorted
  around the Camelot wheel. Tap a row to correct anything.
- **Set** — order tracks and read the transition between each pair: `perfect`,
  `relative`, `+1 energy`, `−1 mood`, `2 steps`, `clash`, plus the BPM delta as
  a percentage (over 6% is flagged — that's past comfortable pitch range).
- **Preview** — plays from the same point the analysis sampled.
- Library and set order persist in `localStorage`.

## Known limits

- Audio itself isn't persisted, only the metadata. After a reload, previously
  analysed tracks are still listed with all their data, but previewing one needs
  the file re-added. Browsers can't re-open a file without the user picking it.
- Genre is manual. Nothing detects genre reliably from audio.
- Title and artist are parsed from the filename (`Artist - Title`), not ID3.
- Analysis reads a 100 s window from 22% in, not the whole track. A track that
  changes key partway through is reported on that window.

## Not built yet

Arranging and rendering — laying tracks on a timeline, setting overlaps and
automation, bouncing a finished audio file. That's the other half of the idea
and it needs this half to be solid first.
