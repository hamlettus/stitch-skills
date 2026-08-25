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
| **Structure** | Low band (<180 Hz) tracked separately from overall loudness; state changes segment the track into intro / groove / drop / breakdown / outro | 6/6 sections on a synthetic arrangement |
| **Cue points** | Mix-in, mix-out, drop and breakdown derived from the sections, snapped to the bar via onset-aligned beat phase | all within tolerance |
| **Genre** | Not detected — type it in | — |

Run the checks with `node test/dsp.test.js`.

### Why the bass, not the energy

Overall loudness mostly drifts — it does not tell you where a track changes.
The bass does: it drops out for a breakdown and slams back for the drop. So
structure detection low-passes at 140 Hz (three cascaded poles, 18 dB/octave)
and tracks that band separately, then
segments where the bass-present / energy-band state changes and holds. On a
synthetic track with a known arrangement it recovers all six sections with
boundaries inside a second or two.

Cue points fall out of the sections. **Mix in** is the first point with bass and
real energy — everything before it is intro, which is exactly what you play
under the outgoing track. **Mix out** is the start of the outro, or 32 beats
from the end if the track just stops. Both are snapped to the bar using a beat
phase estimated from onset alignment, so a cue lands on a downbeat rather than
mid-bar.

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

**Library** — add files, get key / BPM / energy / duration per track, sorted
around the Camelot wheel. Tap a row to correct anything.

**Tempo matching** — set a **Mix BPM** (Auto-arrange fills it in from the median
of the set) and every clip is time-stretched to it with `preservesPitch`, so the
key each track was labelled with stays true. Anything more than ±8% away is left
at its own tempo and marked `OFF-TEMPO` rather than stretched into artefacts.

**Beat alignment** — matched tempo is only half of it; if the bar lines don't
coincide the tracks still fight. Each clip is nudged by under a bar so one of its
downbeats lands on the mix grid, using the beat phase found during analysis.
`test/tempo.test.js` measures the result: downbeats land within 0.5 ms of the
grid, and any two clips sit a whole number of bars apart.

**Deleting** — ✕ on any library row removes the track, its audio and any clips
using it; with a selection, **Delete N** does the lot. A selected clip has its
own ✕ on the timeline. **↶ Undo** walks back the last 25 arrangement changes.

**Search** — filter the library by title, artist, key, genre or BPM. The bulk
buttons act on whatever the filter is showing.

**Setlist** — the running order as plain text: position, time, artist, title,
key, BPM, stretch amount, energy, and the transition into each track. Copy it or
save a `.txt`.

**Moving tracks across** — a bar at the top of the Library handles the whole
crate at once: **Add all →** drops every track on the timeline in key order,
**✦ Auto-arrange all** works out the running order first. Tick individual tracks
and both buttons narrow to just those. Anything already on the timeline is
badged **IN MIX**, and *Add all* skips it.

**Auto-arrange** — one tap orders the whole crate and cuts it cue to cue.
Ordering balances three things: harmonic compatibility (a clash costs more than
anything else can earn), tempo proximity (past 6% is outside pitch range), and
an energy arc that climbs to a peak about two-thirds through and comes down.
Greedy chaining runs from every plausible start — anchored to one track it
strands keys with nowhere clean to go — then a 2-opt pass refines it. Tracks
that can only be reached through *both* a key clash and a tempo jump past pitch
range are left out and named, rather than buried mid-mix.

**Arrange** — tracks go on a timeline as clips:

- Drag a clip to move it; drag either edge to trim. Trimming the head keeps the
  tail in place, so the mix doesn't shift under you.
- Overlap two clips and you get a crossfade. New clips land crossfaded into
  whatever currently ends last.
- Per clip: fade in, fade out, level, and where in the source it starts.
- Each overlap is labelled with its harmonic verdict — `perfect`, `relative`,
  `+1 energy`, `−1 mood`, `2 steps`, `clash` — and the BPM gap as a percentage.
- Tap the ruler to move the playhead; **Cue here** jumps to a clip.

**Bounce** — renders the arrangement to an audio file you can keep.

Library and arrangement persist in `localStorage`; the audio itself lives in
IndexedDB, so a mix survives a reload.

## Two audio decisions worth knowing

**Playback streams, it doesn't decode.** Clips play through a pool of four
`<audio>` elements wired into the Web Audio graph via
`MediaElementAudioSourceNode`. A media element streams from disk instead of
holding decoded PCM, so an hour-long mix costs almost nothing in memory — the
same constraint that broke importing would otherwise break playback.

**Crossfades are equal-power, not linear.** Two different tracks are
uncorrelated, so their *powers* add, not their amplitudes. A linear crossfade
sits at 0.5 + 0.5 amplitude in the middle, which is only half the power — an
audible ~3 dB dip on every transition. Quarter-sine ramps hold
`gainA² + gainB² = 1` right through the blend. `test/arrange.test.js` checks
this: 0.00 dB across the whole crossfade.

**A crossfade never outruns the intro it hides in.** The blend has to be
finished by the time the incoming track's mix-in cue lands, so the track is at
full level when its body starts. A 30-second crossfade into a track with a
24-second intro would leave the meat playing underneath — so the fade is capped
at the intro length. Short intro, shorter blend. `test/bulk.test.js` checks
every fade completes exactly on its cue.

**Bouncing is real-time**, via `MediaRecorder` on a `MediaStreamDestination`.
Rendering offline would mean decoding every track to PCM at once, which is
exactly the memory wall that broke importing. So a 40-minute mix takes 40
minutes to bounce, with the screen open.

## Known limits

- **Bouncing runs in real time** — a 40-minute mix takes 40 minutes, screen on.
- **Saving from inside the Claude artifact viewer is capped at 16 MB**, which a
  long mix will exceed. Open `keylock.html` directly in Safari to bounce without
  that limit. The app says so rather than failing quietly.
- **Time-stretch quality is the browser's.** `preservesPitch` is fine for the
  few percent a set needs; it is not a studio algorithm. Past ±8% Keylock stops
  rather than pretending.
- **Structure detection assumes dance music.** It keys off bass dropping in and
  out. On material without that shape — live recordings, ambient, most rock —
  sections will be vague and the cues want checking by hand.
- **Tempo detection needs beat-level movement.** The autocorrelation searches
  60–200 BPM, so periods longer than a second are invisible to it. A track with
  nothing but a downbeat kick — no hats, no offbeats — reports noise. Half-time
  patterns are fine; genuinely empty bars are not.
- Genre is manual. Nothing detects genre reliably from audio.
- Title and artist are parsed from the filename (`Artist - Title`), not ID3.
- Analysis reads a 100 s window from 22% in, not the whole track. A track that
  changes key partway through is reported on that window.

## Not built yet

- **Bass-swap transitions.** A filter per clip automated across the overlap,
  rather than gain alone — the usual fix for two kicks fighting mid-blend.
- **Reordering clips as a list**, rather than dragging them along the timeline.
- **Loop / repeat a section** to extend a short track.
