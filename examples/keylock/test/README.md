# Checks

Each `*.js` here is lifted verbatim out of `keylock.html` so it can run in Node.
If you change the app, re-extract them.

```bash
node dsp.test.js        # key + BPM detection
node structure.test.js  # section segmentation + cue points
node order.test.js      # set ordering
node arrange.test.js    # clip placement + crossfade math
```

**dsp** synthesises chord progressions with a known key and tempo and checks
what comes back. Caught the relative-key bug: A minor read as C major.

**structure** builds a track with an arrangement we specify exactly — bass-less
intro, groove, drop, breakdown, second drop, outro — and checks the detector
recovers all six plus sane cue points.

**order** runs two crates: one with a deliberate outlier (wrong key, 145 BPM
against a 124–128 set) that should be excluded and named, and one coherent crate
that should come out clash-free with a proper energy arc. Caught the greedy
getting stranded from a fixed start.

**arrange** places three clips and verifies each overlap matches its crossfade,
that `gainA² + gainB²` holds at 1 through every blend (equal-power — a linear
fade dips 3 dB), that the envelope is right at both edges, and that total length
accounts for the overlaps.
