# Checks

Each `*.js` here is lifted verbatim out of `keylock.html` so it can run in Node.
If you change the app, re-extract them.

```bash
bash run.sh        # all six suites, 76 assertions
bash run.sh -v     # with full output
```

`run.sh` re-extracts the app script before running, so a stale copy cannot
report a false pass, and exits nonzero if any suite fails.

## Are the tests any good?

Passing tests prove nothing on their own, so each module was mutated on purpose
to check the suite bites. Eleven mutations, ten caught:

| Mutation | |
|---|---|
| bass-root tie-breaker removed | caught |
| BPM octave folding broken | caught |
| bar snapping off by three bars | caught |
| section merging collapses everything | caught |
| bass threshold far too low | caught |
| low-pass corner blown out | caught |
| clash penalty removed | caught |
| tempo penalty removed | caught |
| misfit exclusion disabled | caught |
| multi-start reduced to one seed | **not caught** |

The survivor is honest signal: on every crate tested, the 2-opt pass finds the
clean walk regardless of where the greedy started — so multi-start may be
redundant at these sizes. It was worth keeping when the crate had a hard
outlier, but nothing here proves it earns its place.

**dsp** synthesises chord progressions with a known key and tempo and checks
what comes back. Caught the relative-key bug: A minor read as C major.

**structure** builds a track with an arrangement we specify exactly — bass-less
intro, groove, drop, breakdown, second drop, outro — and checks the detector
recovers all six plus sane cue points.

**order** runs two crates: one with a deliberate outlier (wrong key, 145 BPM
against a 124–128 set) that should be excluded and named, and one coherent crate
that should come out clash-free with a proper energy arc. Caught the greedy
getting stranded from a fixed start.

**bulk** adds three tracks with known cue points in one go and checks each clip
overlaps the last, stays inside its source, and — the one that caught a real bug
— that every crossfade finishes by its own mix-in cue. It was running 31 seconds
into a track with a 24-second intro.

**tempo** checks the stretch rate maths, that timeline length and source span
stay correctly related under a rate, and that beat alignment puts downbeats on
the mix grid. Caught the start-of-mix case: a clip at time zero whose correction
went negative got clamped to 0 and stayed off-grid — it now steps a bar forward.

**arrange** places three clips and verifies each overlap matches its crossfade,
that `gainA² + gainB²` holds at 1 through every blend (equal-power — a linear
fade dips 3 dB), that the envelope is right at both edges, and that total length
accounts for the overlaps.
