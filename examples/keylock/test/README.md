# Checks

Both files are lifted out of `keylock.html` so they can run in Node. If you
change the app, re-copy them.

```bash
node examples/keylock/test/dsp.test.js       # key + BPM detection
node examples/keylock/test/arrange.test.js   # clip placement + crossfade math
```

`dsp.test.js` synthesises chord progressions with a known key and tempo —
additive tones with five harmonics, a bass root an octave down, a kick on each
beat — then checks what the detectors report.

`arrange.test.js` places three clips, then verifies each overlap matches its
crossfade length, that `gainA² + gainB²` stays at 1 through every blend (the
equal-power property — a linear fade would dip 3 dB), that the envelope is right
at both edges, and that total length accounts for the overlaps.
