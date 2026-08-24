# DSP checks

`dsp.js` is the analysis code lifted verbatim out of `keylock.html` so it can be
exercised in Node. If you change the detectors in the app, re-copy them here.

`dsp.test.js` synthesises chord progressions with a known key and tempo —
additive tones with five harmonics, a bass root an octave down, and a kick on
each beat — then checks what the detectors report.

```bash
node examples/keylock/test/dsp.test.js
```
