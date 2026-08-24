
(function () {
  "use strict";

  // ============================================================
  //  Camelot wheel
  // ============================================================

  // Camelot number for each pitch class (C=0), per ring.
  var MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
  var MINOR_CAMELOT = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

  var PC_NAMES = ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];

  // Musical name for each Camelot code, indexed [number][ring]
  var CAMELOT_NAME = {};
  (function buildNames() {
    for (var pc = 0; pc < 12; pc++) {
      CAMELOT_NAME[MAJOR_CAMELOT[pc] + 'B'] = PC_NAMES[pc] + ' maj';
      CAMELOT_NAME[MINOR_CAMELOT[pc] + 'A'] = PC_NAMES[pc] + ' min';
    }
  })();

  var ALL_KEYS = (function () {
    var out = [];
    for (var n = 1; n <= 12; n++) { out.push(n + 'A'); out.push(n + 'B'); }
    return out;
  })();

  function keyColor(code) {
    if (!code) return '#2A2E3A';
    var n = parseInt(code, 10);
    var ring = code.slice(-1);
    var hue = ((n - 1) * 30 + 150) % 360;
    return 'hsl(' + hue + ',' + (ring === 'A' ? 58 : 68) + '%,' + (ring === 'A' ? 62 : 68) + '%)';
  }

  /**
   * How track B sits against track A harmonically.
   * Camelot rules: same key, +/-1 on the same ring, or the relative
   * major/minor (same number, other ring) all mix cleanly.
   */
  function relation(a, b) {
    if (!a || !b) return { label: 'unknown', cls: 'v-caution' };
    if (a === b) return { label: 'perfect', cls: 'v-perfect' };
    var na = parseInt(a, 10), ra = a.slice(-1);
    var nb = parseInt(b, 10), rb = b.slice(-1);
    if (na === nb && ra !== rb) return { label: 'relative', cls: 'v-smooth' };
    if (ra === rb) {
      var up = (na % 12) + 1;
      var down = na === 1 ? 12 : na - 1;
      if (nb === up) return { label: '+1 energy', cls: 'v-smooth' };
      if (nb === down) return { label: '−1 mood', cls: 'v-smooth' };
      var dist = Math.min((nb - na + 12) % 12, (na - nb + 12) % 12);
      if (dist === 2) return { label: '2 steps', cls: 'v-caution' };
    }
    return { label: 'clash', cls: 'v-clash' };
  }

  // ============================================================
  //  Analysis
  //
  //  The whole memory story lives here. decodeAudioData decodes an
  //  ENTIRE file to float32 before it resolves — a 6 min stereo track
  //  at 44.1kHz is ~127MB, which is what kills the tab on iOS.
  //  Decoding into a low-rate OfflineAudioContext makes the decoder
  //  resample on the way out, so the same track lands at ~16MB.
  //  Nothing above ~5kHz matters for chroma or beat detection.
  // ============================================================

  var RATE = 11025;
  var WINDOW_SEC = 100;   // analysed slice
  var SKIP_FRAC = 0.22;   // start this far in, past intros

  function makeDecodeCtx() {
    var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!C) return null;
    try {
      return new C(1, 1, RATE);
    } catch (e) {
      try { return new C(1, 1, 44100); } catch (e2) { return null; }
    }
  }

  function decodeAudio(ctx, arrayBuffer) {
    return new Promise(function (resolve, reject) {
      // Safari still wants the callback form in some versions.
      var p;
      try {
        p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      } catch (e) {
        reject(e);
        return;
      }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  /**
   * Full mono mixdown at the low analysis rate. Structure detection needs the
   * whole track, not a slice — at 11kHz mono a six-minute track is ~16MB,
   * still an eighth of what a full-rate decode would have cost.
   */
  function extractMono(buf) {
    var sr = buf.sampleRate;
    var total = buf.length;
    var out = new Float32Array(total);
    var chans = Math.min(buf.numberOfChannels, 2);
    for (var c = 0; c < chans; c++) {
      var data = buf.getChannelData(c);
      for (var i = 0; i < total; i++) out[i] += data[i];
    }
    if (chans > 1) for (var j = 0; j < total; j++) out[j] /= chans;
    return { samples: out, sampleRate: sr, durationSec: total / sr };
  }

  /** The stretch used for key and tempo: past the intro, capped in length. */
  function keyWindow(samples, sr) {
    var want = Math.min(Math.floor(WINDOW_SEC * sr), samples.length);
    var start = Math.floor(samples.length * SKIP_FRAC);
    if (start + want > samples.length) start = Math.max(0, samples.length - want);
    return samples.subarray(start, start + want);
  }

  // ---- FFT (iterative radix-2) ----

  function fft(re, im) {
    var n = re.length, i, j, bit, len, ang, wr, wi, k, tr, ti;
    for (i = 1, j = 0; i < n; i++) {
      bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        tr = re[i]; re[i] = re[j]; re[j] = tr;
        ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (len = 2; len <= n; len <<= 1) {
      ang = -2 * Math.PI / len;
      wr = Math.cos(ang); wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len >> 1; k++) {
          var ar = re[i + k], ai = im[i + k];
          var br = re[i + k + (len >> 1)], bi = im[i + k + (len >> 1)];
          var vr = br * cr - bi * ci;
          var vi = br * ci + bi * cr;
          re[i + k] = ar + vr; im[i + k] = ai + vi;
          re[i + k + (len >> 1)] = ar - vr; im[i + k + (len >> 1)] = ai - vi;
          var ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  var FFT_N = 4096;
  var HANN = (function () {
    var w = new Float32Array(FFT_N);
    for (var i = 0; i < FFT_N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_N - 1));
    return w;
  })();

  // Albrecht & Shanahan profiles — derived from a large corpus and much better
  // at telling major from its relative minor than Krumhansl–Kessler.
  var PROF_MAJ = [0.238,0.006,0.111,0.006,0.137,0.094,0.016,0.214,0.009,0.080,0.008,0.081];
  var PROF_MIN = [0.220,0.006,0.104,0.123,0.019,0.103,0.012,0.214,0.062,0.022,0.061,0.052];

  // A key and its relative share every note, so the profile match alone can't
  // separate them. The bass almost always states the real tonic, so a root
  // term breaks the tie.
  var BASS_WEIGHT = 0.55;

  function correlate(a, b) {
    var n = a.length, ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var num = 0, da = 0, db = 0;
    for (i = 0; i < n; i++) {
      var x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    if (da === 0 || db === 0) return 0;
    return num / Math.sqrt(da * db);
  }

  function yieldUI() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  /** Chroma vector + Camelot key. */
  async function detectKey(samples, sr) {
    var chroma = new Float64Array(12);
    var bass = new Float64Array(12);
    var hop = FFT_N;                      // no overlap: plenty of frames already
    var frames = Math.floor((samples.length - FFT_N) / hop);
    if (frames < 1) return null;

    var re = new Float64Array(FFT_N);
    var im = new Float64Array(FFT_N);

    // Precompute bin -> pitch class. binOk marks the harmonic band used for the
    // profile match; binBass marks the low band used to find the root.
    var binPc = new Int8Array(FFT_N / 2);
    var binOk = new Uint8Array(FFT_N / 2);
    var binBass = new Uint8Array(FFT_N / 2);
    for (var b = 1; b < FFT_N / 2; b++) {
      var freq = b * sr / FFT_N;
      if (freq < 40 || freq > 2000) { binOk[b] = 0; binBass[b] = 0; continue; }
      var midi = 69 + 12 * Math.log2(freq / 440);
      binPc[b] = ((Math.round(midi) % 12) + 12) % 12;
      binOk[b] = freq >= 65 ? 1 : 0;
      binBass[b] = freq <= 260 ? 1 : 0;
    }

    for (var f = 0; f < frames; f++) {
      var off = f * hop;
      for (var i = 0; i < FFT_N; i++) { re[i] = samples[off + i] * HANN[i]; im[i] = 0; }
      fft(re, im);
      for (var k = 1; k < FFT_N / 2; k++) {
        if (!binOk[k] && !binBass[k]) continue;
        var mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        if (binOk[k]) chroma[binPc[k]] += mag;
        if (binBass[k]) bass[binPc[k]] += mag;
      }
      if ((f & 7) === 0) await yieldUI();
    }

    var sum = 0, bsum = 0, c;
    for (c = 0; c < 12; c++) { sum += chroma[c]; bsum += bass[c]; }
    if (sum <= 0) return null;
    for (c = 0; c < 12; c++) {
      chroma[c] /= sum;
      bass[c] = bsum > 0 ? bass[c] / bsum : 0;
    }

    var scored = [];
    for (var tonic = 0; tonic < 12; tonic++) {
      var rot = new Float64Array(12);
      for (var d = 0; d < 12; d++) rot[d] = chroma[(tonic + d) % 12];
      // The root term rewards a tonic the bass actually plays.
      var root = bass[tonic] * BASS_WEIGHT;
      scored.push({ corr: correlate(rot, PROF_MAJ), score: correlate(rot, PROF_MAJ) + root, pc: tonic, minor: false });
      scored.push({ corr: correlate(rot, PROF_MIN), score: correlate(rot, PROF_MIN) + root, pc: tonic, minor: true });
    }
    scored.sort(function (x, y) { return y.score - x.score; });

    var best = scored[0];
    var runner = scored[1];
    var num = best.minor ? MINOR_CAMELOT[best.pc] : MAJOR_CAMELOT[best.pc];
    var altNum = runner.minor ? MINOR_CAMELOT[runner.pc] : MAJOR_CAMELOT[runner.pc];
    var alt = altNum + (runner.minor ? 'A' : 'B');

    // A close second that is the relative key means the call is a coin-flip.
    var margin = best.score - runner.score;
    var relativeTie = (num === altNum) && margin < 0.08;

    return {
      code: num + (best.minor ? 'A' : 'B'),
      alt: alt,
      relativeTie: relativeTie,
      confidence: Math.max(0, Math.min(1, best.corr))
    };
  }

  /** Onset-envelope autocorrelation. */
  async function detectBpm(samples, sr) {
    var hop = 256;
    var frames = Math.floor(samples.length / hop);
    if (frames < 64) return null;

    // RMS envelope
    var env = new Float32Array(frames);
    for (var f = 0; f < frames; f++) {
      var s = 0, off = f * hop;
      for (var i = 0; i < hop; i++) { var v = samples[off + i]; s += v * v; }
      env[f] = Math.sqrt(s / hop);
      if ((f & 1023) === 0) await yieldUI();
    }

    // Half-wave rectified difference = onset strength
    var odf = new Float32Array(frames);
    for (var g = 1; g < frames; g++) {
      var d = env[g] - env[g - 1];
      odf[g] = d > 0 ? d : 0;
    }

    // Remove DC so autocorrelation isn't dominated by the mean
    var mean = 0, j;
    for (j = 0; j < frames; j++) mean += odf[j];
    mean /= frames;
    for (j = 0; j < frames; j++) odf[j] -= mean;

    var fps = sr / hop;
    var minLag = Math.floor(fps * 60 / 200);
    var maxLag = Math.ceil(fps * 60 / 60);
    if (maxLag >= frames) maxLag = frames - 1;
    if (minLag < 2 || maxLag <= minLag) return null;

    var bestLag = -1, bestVal = -Infinity;
    for (var lag = minLag; lag <= maxLag; lag++) {
      var acc = 0;
      for (var n = 0; n + lag < frames; n++) acc += odf[n] * odf[n + lag];
      acc /= (frames - lag);
      if (acc > bestVal) { bestVal = acc; bestLag = lag; }
      if ((lag & 63) === 0) await yieldUI();
    }
    if (bestLag < 0) return null;

    var bpm = 60 * fps / bestLag;
    // Fold into the range DJs actually read
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return Math.round(bpm * 10) / 10;
  }

  /** Loudness + brightness folded into a 1..10 feel. */
  function detectEnergy(samples) {
    var n = samples.length, s = 0, peak = 0, i;
    for (i = 0; i < n; i++) {
      var v = samples[i];
      s += v * v;
      var a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    var rms = Math.sqrt(s / n);
    if (rms <= 0) return 1;
    var db = 20 * Math.log10(rms);
    // -30dB -> 1, -8dB -> 10
    var e = Math.round(1 + (db + 30) * (9 / 22));
    return Math.max(1, Math.min(10, e));
  }

  function peaksFor(samples, buckets) {
    var out = new Float32Array(buckets);
    var per = Math.floor(samples.length / buckets);
    if (per < 1) return out;
    for (var b = 0; b < buckets; b++) {
      var m = 0, off = b * per;
      for (var i = 0; i < per; i += 3) {
        var a = samples[off + i];
        if (a < 0) a = -a;
        if (a > m) m = a;
      }
      out[b] = m;
    }
    return out;
  }

  function parseName(filename) {
    var base = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    // Strip a leading track number: "03 " or "03. " or "03 - "
    base = base.replace(/^\d{1,3}\s*[-.]?\s+/, '');
    var parts = base.split(/\s+-\s+/);
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: '', title: base };
  }

  // ============================================================
  //  Structure — sections and cue points
  //
  //  In dance music the bass is the structural marker: it drops out for a
  //  breakdown and slams back for the drop. Tracking a low band separately
  //  from overall loudness segments a track far more reliably than energy
  //  alone, which mostly just drifts.
  // ============================================================

  var FRAME_SEC = 0.25;
  var SMOOTH_SEC = 4;
  var MIN_SECTION_SEC = 8;

  /** One-pole low-pass, used to isolate the sub/bass band. */
  function lowpass(samples, sr, fc) {
    var a = 1 - Math.exp(-2 * Math.PI * fc / sr);
    var out = new Float32Array(samples.length);
    var y = 0;
    for (var i = 0; i < samples.length; i++) {
      y += a * (samples[i] - y);
      out[i] = y;
    }
    return out;
  }

  function movingAvg(arr, win) {
    var n = arr.length, out = new Float32Array(n);
    var half = Math.max(1, Math.floor(win / 2));
    var sum = 0, count = 0, i;
    for (i = 0; i < Math.min(half, n); i++) { sum += arr[i]; count++; }
    for (i = 0; i < n; i++) {
      var add = i + half, drop = i - half - 1;
      if (add < n) { sum += arr[add]; count++; }
      if (drop >= 0) { sum -= arr[drop]; count--; }
      out[i] = count > 0 ? sum / count : 0;
    }
    return out;
  }

  function percentile(arr, p) {
    var c = Array.prototype.slice.call(arr).sort(function (a, b) { return a - b; });
    if (!c.length) return 0;
    return c[Math.min(c.length - 1, Math.floor(c.length * p))];
  }

  /**
   * Beat phase: the offset that best lines the beat grid up with the onsets.
   * Cues snapped to this land on a downbeat instead of mid-bar.
   */
  function beatPhase(samples, sr, bpm) {
    if (!bpm) return 0;
    var period = 60 / bpm;
    var hop = 256;
    var frames = Math.floor(samples.length / hop);
    if (frames < 32) return 0;

    var env = new Float32Array(frames), i;
    for (i = 0; i < frames; i++) {
      var s = 0, off = i * hop;
      for (var j = 0; j < hop; j++) { var v = samples[off + j]; s += v * v; }
      env[i] = Math.sqrt(s / hop);
    }
    var odf = new Float32Array(frames);
    for (i = 1; i < frames; i++) { var d = env[i] - env[i - 1]; odf[i] = d > 0 ? d : 0; }

    var fps = sr / hop;
    var steps = 24, best = 0, bestScore = -1;
    for (var k = 0; k < steps; k++) {
      var phase = (k / steps) * period;
      var score = 0;
      for (var t = phase; t < frames / fps; t += period) {
        var fi = Math.round(t * fps);
        if (fi >= 0 && fi < frames) score += odf[fi];
      }
      if (score > bestScore) { bestScore = score; best = phase; }
    }
    return best;
  }

  /** Snap a time to the nearest bar line (4 beats) on the detected grid. */
  function snapToBar(tSec, bpm, phase) {
    if (!bpm) return tSec;
    var bar = (60 / bpm) * 4;
    var n = Math.round((tSec - phase) / bar);
    return Math.max(0, phase + n * bar);
  }

  /**
   * Segment a track and pick the cue points a DJ actually needs:
   * where it is safe to mix in, where to start mixing out, the drop, and
   * the breakdown.
   */
  function analyseStructure(samples, sr, bpm) {
    var dur = samples.length / sr;
    var hop = Math.max(1, Math.round(sr * FRAME_SEC));
    var n = Math.floor(samples.length / hop);
    if (n < 8) return null;

    var bassSig = lowpass(samples, sr, 180);
    var rms = new Float32Array(n), bass = new Float32Array(n);
    for (var f = 0; f < n; f++) {
      var off = f * hop, sA = 0, sB = 0;
      for (var i = 0; i < hop; i++) {
        var a = samples[off + i]; sA += a * a;
        var b = bassSig[off + i]; sB += b * b;
      }
      rms[f] = Math.sqrt(sA / hop);
      bass[f] = Math.sqrt(sB / hop);
    }
    bassSig = null;

    var win = Math.round(SMOOTH_SEC / FRAME_SEC);
    var rmsS = movingAvg(rms, win);
    var bassS = movingAvg(bass, win);

    // Normalise against a high percentile so one loud transient can't skew it
    var rMax = percentile(rmsS, 0.95) || 1;
    var bMax = percentile(bassS, 0.95) || 1;
    for (var k = 0; k < n; k++) {
      rmsS[k] = Math.min(1, rmsS[k] / rMax);
      bassS[k] = Math.min(1, bassS[k] / bMax);
    }

    // Two-state description per frame: bass present, and a coarse energy band
    var state = new Int8Array(n);
    for (var m = 0; m < n; m++) {
      var hasBass = bassS[m] > 0.34 ? 1 : 0;
      var band = rmsS[m] > 0.72 ? 2 : rmsS[m] > 0.38 ? 1 : 0;
      state[m] = hasBass * 3 + band;
    }

    // Boundaries where the state changes and holds
    var bounds = [0];
    for (var p = 1; p < n; p++) {
      if (state[p] !== state[p - 1]) bounds.push(p);
    }
    bounds.push(n);

    var segs = [];
    for (var q = 0; q < bounds.length - 1; q++) {
      var a0 = bounds[q], a1 = bounds[q + 1];
      if (a1 <= a0) continue;
      var eSum = 0, bSum = 0;
      for (var r = a0; r < a1; r++) { eSum += rmsS[r]; bSum += bassS[r]; }
      segs.push({
        startSec: a0 * FRAME_SEC,
        endSec: a1 * FRAME_SEC,
        energy: eSum / (a1 - a0),
        bass: bSum / (a1 - a0)
      });
    }

    // Merge anything too short to be a real section into its neighbour
    var merged = [];
    segs.forEach(function (s) {
      var last = merged[merged.length - 1];
      if (last && (s.endSec - s.startSec) < MIN_SECTION_SEC) {
        var w1 = last.endSec - last.startSec, w2 = s.endSec - s.startSec;
        last.energy = (last.energy * w1 + s.energy * w2) / (w1 + w2);
        last.bass = (last.bass * w1 + s.bass * w2) / (w1 + w2);
        last.endSec = s.endSec;
      } else {
        merged.push(s);
      }
    });
    if (merged.length > 1 && (merged[0].endSec - merged[0].startSec) < MIN_SECTION_SEC) {
      merged[1].startSec = merged[0].startSec;
      merged.shift();
    }

    // Label
    var peakE = 0;
    merged.forEach(function (s) { peakE = Math.max(peakE, s.energy); });
    merged.forEach(function (s, idx) {
      var first = idx === 0, last = idx === merged.length - 1;
      if (s.bass < 0.3) {
        s.kind = first ? 'intro' : last ? 'outro' : 'breakdown';
      } else if (s.energy >= peakE * 0.88) {
        s.kind = 'drop';
      } else if (first && s.energy < peakE * 0.6) {
        s.kind = 'intro';
      } else if (last && s.energy < peakE * 0.7) {
        s.kind = 'outro';
      } else {
        s.kind = 'groove';
      }
    });

    // ---- cues ----
    var phase = beatPhase(samples, sr, bpm);

    // Mix in: the first point with bass and real energy. Anything before it is
    // intro, which is exactly the part you play under the outgoing track.
    var mixIn = 0;
    for (var x = 0; x < merged.length; x++) {
      if (merged[x].bass >= 0.34 && merged[x].energy > 0.35) { mixIn = merged[x].startSec; break; }
    }

    // Mix out: the start of the closing outro, or a sensible tail if it just ends.
    var mixOut = dur;
    for (var y = merged.length - 1; y >= 0; y--) {
      if (merged[y].kind === 'outro') { mixOut = merged[y].startSec; break; }
    }
    if (mixOut >= dur - 1) {
      var tail = bpm ? (60 / bpm) * 32 : 45;      // 32 beats
      mixOut = Math.max(mixIn + 30, dur - tail);
    }
    if (mixOut <= mixIn + 20) mixOut = Math.min(dur, mixIn + Math.max(30, dur * 0.5));

    var cues = [];
    merged.forEach(function (s) {
      cues.push({ tSec: snapToBar(s.startSec, bpm, phase), kind: s.kind });
    });

    // Named highlights, useful on their own
    var drop = null, bd = null, bdLen = 0;
    merged.forEach(function (s, idx) {
      if (s.kind === 'drop' && (drop === null || s.energy > drop.energy)) {
        drop = { tSec: s.startSec, energy: s.energy };
      }
      if (s.kind === 'breakdown' && idx > 0 && idx < merged.length - 1) {
        var len = s.endSec - s.startSec;
        if (len > bdLen) { bdLen = len; bd = { tSec: s.startSec }; }
      }
    });

    return {
      sections: merged.map(function (s) {
        return {
          startSec: Math.round(s.startSec * 10) / 10,
          endSec: Math.round(s.endSec * 10) / 10,
          kind: s.kind,
          energy: Math.round(s.energy * 100) / 100
        };
      }),
      cues: cues,
      mixInSec: Math.round(snapToBar(mixIn, bpm, phase) * 10) / 10,
      mixOutSec: Math.round(snapToBar(mixOut, bpm, phase) * 10) / 10,
      dropSec: drop ? Math.round(snapToBar(drop.tSec, bpm, phase) * 10) / 10 : null,
      breakdownSec: bd ? Math.round(snapToBar(bd.tSec, bpm, phase) * 10) / 10 : null,
      beatPhase: Math.round(phase * 1000) / 1000
    };
  }

  // ============================================================
  //  Storage — metadata in localStorage, audio in IndexedDB
  //
  //  An arrangement is worthless if the audio vanishes on reload, and a
  //  browser cannot reopen a file the user picked in an earlier session.
  //  So the File objects themselves go into IndexedDB.
  // ============================================================

  var DB_NAME = 'keylock', DB_STORE = 'audio', db = null;

  function openDb() {
    return new Promise(function (resolve) {
      if (db) return resolve(db);
      var req;
      try { req = indexedDB.open(DB_NAME, 1); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { resolve(null); };
    });
  }

  async function putBlob(id, file) {
    var d = await openDb();
    if (!d) return;
    return new Promise(function (resolve) {
      try {
        var tx = d.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(file, id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  async function getBlob(id) {
    var d = await openDb();
    if (!d) return null;
    return new Promise(function (resolve) {
      try {
        var tx = d.transaction(DB_STORE, 'readonly');
        var r = tx.objectStore(DB_STORE).get(id);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  async function delBlob(id) {
    var d = await openDb();
    if (!d) return;
    try {
      var tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
    } catch (e) { /* nothing to do */ }
  }

  var undoStack = [];
  var UNDO_DEPTH = 25;

  /** Snapshot the arrangement before a mutation so it can be walked back. */
  function pushUndo() {
    try {
      undoStack.push(JSON.stringify({ clips: clips, mixBpm: mixBpm }));
      if (undoStack.length > UNDO_DEPTH) undoStack.shift();
    } catch (e) { /* nothing worth breaking over */ }
    refreshUndoBtn();
  }

  function undo() {
    if (!undoStack.length) return;
    var snap = undoStack.pop();
    try {
      var st = JSON.parse(snap);
      clips = st.clips || [];
      mixBpm = st.mixBpm != null ? st.mixBpm : null;
    } catch (e) { return; }
    stopPlayback(false);
    selectedClipId = null;
    renderAll();
    save();
    refreshUndoBtn();
  }

  function refreshUndoBtn() {
    var b = document.getElementById('a-undo');
    if (b) b.disabled = undoStack.length === 0;
  }

  var query = '';       // library filter
  var selection = {};   // track id -> true, for bulk actions
  var tracks = [];   // analysed library metadata
  var clips = [];    // the arrangement
  var blobs = {};    // id -> File, hydrated from IndexedDB on load
  var cancelFlag = false;

  var STORE_KEY = 'keylock.library.v2';
  var ARR_KEY = 'keylock.arrangement.v1';

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(tracks.map(function (t) {
        return {
          id: t.id, title: t.title, artist: t.artist, genre: t.genre,
          key: t.key, keyAlt: t.keyAlt, confidence: t.confidence,
          bpm: t.bpm, energy: t.energy, filename: t.filename,
          sizeBytes: t.sizeBytes, durationSec: t.durationSec,
          sections: t.sections, mixInSec: t.mixInSec, mixOutSec: t.mixOutSec,
          dropSec: t.dropSec, breakdownSec: t.breakdownSec, beatPhase: t.beatPhase,
          peaks: t.peaks ? Array.from(t.peaks).map(function (p) { return Math.round(p * 255); }) : null
        };
      })));
      localStorage.setItem(ARR_KEY, JSON.stringify({ clips: clips, mixBpm: mixBpm }));
    } catch (e) { /* quota / private mode — still fine in memory */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tracks = parsed.map(function (t) {
            if (t.peaks) t.peaks = Float32Array.from(t.peaks, function (p) { return p / 255; });
            return t;
          });
        }
      }
      var rawArr = localStorage.getItem(ARR_KEY);
      if (rawArr) {
        var a = JSON.parse(rawArr);
        if (Array.isArray(a)) {
          clips = a;                      // pre-tempo format
        } else if (a && Array.isArray(a.clips)) {
          clips = a.clips;
          mixBpm = a.mixBpm != null ? a.mixBpm : null;
        }
      }
    } catch (e) { tracks = []; clips = []; }
  }

  async function hydrateBlobs() {
    for (var i = 0; i < tracks.length; i++) {
      var f = await getBlob(tracks[i].id);
      if (f) blobs[tracks[i].id] = f;
    }
    renderAll();
  }

  /** Remove tracks from the library, their audio, and any clips using them. */
  function deleteTracks(ids, opts) {
    if (!ids.length) return;
    opts = opts || {};
    var used = ids.filter(function (id) { return clipsForTrack(id) > 0; });

    if (!opts.skipConfirm) {
      var what = ids.length === 1
        ? '"' + ((trackById(ids[0]) || {}).title || 'this track') + '"'
        : ids.length + ' tracks';
      var msg = 'Remove ' + what + ' from the library?';
      if (used.length) {
        msg += '\n\n' + (used.length === 1 ? 'It is' : used.length + ' of them are') +
          ' in the arrangement — those clips go too.';
      }
      if (!confirm(msg)) return;
    }

    if (used.length) pushUndo();

    var set = {};
    ids.forEach(function (id) { set[id] = true; });

    clips = clips.filter(function (c) { return !set[c.trackId]; });
    tracks = tracks.filter(function (t) { return !set[t.id]; });
    ids.forEach(function (id) {
      delete blobs[id];
      delete selection[id];
      delBlob(id);
    });
    if (selectedClipId && !clips.some(function (c) { return c.id === selectedClipId; })) {
      selectedClipId = null;
    }
    renderAll();
    save();
  }

  function trackById(id) {
    for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return tracks[i];
    return null;
  }

  // ============================================================
  //  DOM handles
  // ============================================================

  var el = {
    library: document.getElementById('library'),
    count: document.getElementById('count'),
    barIdle: document.getElementById('bar-idle'),
    barBusy: document.getElementById('bar-busy'),
    pfill: document.getElementById('pfill'),
    ptext: document.getElementById('ptext'),
    pcount: document.getElementById('pcount'),
    input: document.getElementById('file-input'),
    viewLib: document.getElementById('view-library'),
    viewArr: document.getElementById('view-arrange'),
    tabLib: document.getElementById('tab-library'),
    tabArr: document.getElementById('tab-arrange'),
    player: document.getElementById('player'),
    detail: document.getElementById('detail'),
    timeline: document.getElementById('timeline'),
    canvasarea: document.getElementById('canvasarea'),
    ruler: document.getElementById('ruler'),
    lanes: document.getElementById('lanes'),
    xfades: document.getElementById('xfades'),
    playhead: document.getElementById('playhead'),
    inspector: document.getElementById('inspector'),
    arrEmpty: document.getElementById('arrange-empty'),
    clock: document.getElementById('a-clock'),
    zoom: document.getElementById('a-zoom'),
    playBtn: document.getElementById('a-play'),
    bounceBtn: document.getElementById('a-bounce')
  };

  // ============================================================
  //  Import
  // ============================================================

  async function importFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (f) {
      return !tracks.some(function (t) { return t.filename === f.name && t.sizeBytes === f.size; });
    });
    if (!files.length) { flash('Already in the library'); return; }

    cancelFlag = false;
    el.barIdle.classList.add('hidden');
    el.barBusy.classList.remove('hidden');

    var done = 0;
    for (var i = 0; i < files.length; i++) {
      if (cancelFlag) break;
      var file = files[i];
      el.ptext.textContent = file.name;
      el.pcount.textContent = (done + 1) + ' / ' + files.length;
      el.pfill.style.width = ((done / files.length) * 100).toFixed(1) + '%';
      await yieldUI();

      try {
        await analyseOne(file);
      } catch (err) {
        var nm = parseName(file.name);
        tracks.push({
          id: newId(), title: nm.title, artist: nm.artist, genre: '',
          key: null, keyAlt: null, confidence: 0, bpm: null, energy: null,
          filename: file.name, sizeBytes: file.size, durationSec: null,
          peaks: null, error: String(err && err.message ? err.message : err)
        });
      }
      done++;
      renderAll();
      save();
      await new Promise(function (r) { setTimeout(r, 140); });
    }

    el.pfill.style.width = '100%';
    el.barBusy.classList.add('hidden');
    el.barIdle.classList.remove('hidden');
    el.input.value = '';
    renderAll();
    save();
  }

  function newId() {
    return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function analyseOne(file) {
    var ctx = makeDecodeCtx();
    if (!ctx) throw new Error('Web Audio unavailable');

    var arr = await file.arrayBuffer();
    var buf = await decodeAudio(ctx, arr);
    arr = null;

    var win = extractMono(buf);
    buf = null;                      // release before analysis allocates
    await yieldUI();

    var samples = win.samples, sr = win.sampleRate;
    var kw = keyWindow(samples, sr);

    var key = await detectKey(kw, sr);
    var bpm = await detectBpm(kw, sr);
    var energy = detectEnergy(kw);
    var peaks = peaksFor(samples, 300);
    await yieldUI();
    var struct = analyseStructure(samples, sr, bpm);

    var nm = parseName(file.name);
    var id = newId();
    blobs[id] = file;
    await putBlob(id, file);

    tracks.push({
      id: id, title: nm.title, artist: nm.artist, genre: '',
      key: key ? key.code : null,
      keyAlt: key && key.relativeTie ? key.alt : null,
      confidence: key ? key.confidence : 0,
      bpm: bpm, energy: energy,
      filename: file.name, sizeBytes: file.size,
      durationSec: win.durationSec, peaks: peaks, error: null,
      sections: struct ? struct.sections : null,
      mixInSec: struct ? struct.mixInSec : null,
      mixOutSec: struct ? struct.mixOutSec : null,
      dropSec: struct ? struct.dropSec : null,
      breakdownSec: struct ? struct.breakdownSec : null,
      beatPhase: struct ? struct.beatPhase : 0
    });
  }

  // ============================================================
  //  Arrangement model
  //
  //  A clip is a window onto a source file placed on the timeline:
  //    startSec   where it begins in the mix
  //    offsetSec  where it begins inside the source
  //    lengthSec  how much of the source plays
  //  Fades are seconds of ramp at each end. Overlap two clips and the
  //  fades become a crossfade.
  // ============================================================

  var DEFAULT_XFADE = 12;
  var MAX_STRETCH = 0.08;      // ±8%; past this, time-stretch artefacts show
  var mixBpm = null;           // null = every clip plays at its own tempo

  /**
   * Playback rate for a clip under the mix tempo.
   *
   * `lengthSec` is TIMELINE time. Source consumed is `lengthSec * rate`, so a
   * clip sped up covers more of its file in the same span. Everything that
   * maps between mix time and source time goes through here.
   */
  function clipRate(c) {
    if (!mixBpm) return 1;
    var t = trackById(c.trackId);
    if (!t || !t.bpm) return 1;
    var r = mixBpm / t.bpm;
    if (Math.abs(r - 1) > MAX_STRETCH) return 1;   // too far to stretch cleanly
    return r;
  }

  /** True when the mix tempo is on but this track is too far away to match. */
  function clipUnmatched(c) {
    if (!mixBpm) return false;
    var t = trackById(c.trackId);
    if (!t || !t.bpm) return true;
    return Math.abs(mixBpm / t.bpm - 1) > MAX_STRETCH;
  }

  /** Source seconds this clip consumes. */
  function clipSourceSpan(c) { return c.lengthSec * clipRate(c); }

  /**
   * Nudge a clip (by under a bar) so one of its downbeats lands on the mix
   * grid. Matched tempo alone still sounds wrong if the bar lines are offset —
   * this is what makes a transition read as beatmatched rather than layered.
   */
  function alignToGrid(c) {
    if (!mixBpm) return;
    var t = trackById(c.trackId);
    if (!t || !t.bpm) return;
    var rate = clipRate(c);
    var srcBar = (60 / t.bpm) * 4;
    var mixBar = (60 / mixBpm) * 4;
    var phase = t.beatPhase || 0;

    // Downbeat of the source nearest this clip's in-point
    var db = phase + Math.round((c.offsetSec - phase) / srcBar) * srcBar;
    if (db < 0) db += srcBar;

    var atMix = c.startSec + (db - c.offsetSec) / rate;
    var resid = atMix - Math.round(atMix / mixBar) * mixBar;
    var next = c.startSec - resid;
    // Nudging back would cross zero for a clip at the very start, so step
    // forward a bar instead — the mix just begins a fraction of a bar later.
    while (next < 0) next += mixBar;
    c.startSec = Math.round(next * 1000) / 1000;
  }

  function medianBpm(list) {
    var bs = list.map(function (t) { return t.bpm; })
      .filter(function (b) { return b; })
      .sort(function (a, b) { return a - b; });
    if (!bs.length) return null;
    return Math.round(bs[Math.floor(bs.length / 2)] * 10) / 10;
  }

  function addClip(trackId) {
    var t = trackById(trackId);
    if (!t) return;
    var dur = t.durationSec || 240;

    // Land it against whatever currently ends last, overlapped by a crossfade.
    var tail = 0, last = null;
    clips.forEach(function (c) {
      var end = c.startSec + c.lengthSec;
      if (end >= tail) { tail = end; last = c; }
    });

    var xf = last ? Math.min(DEFAULT_XFADE, last.lengthSec * 0.4, dur * 0.4) : 0;
    var start = Math.max(0, tail - xf);

    var clip = {
      id: newId(),
      trackId: trackId,
      startSec: start,
      offsetSec: 0,
      lengthSec: dur,
      fadeInSec: xf,
      fadeOutSec: last ? Math.min(DEFAULT_XFADE, dur * 0.4) : Math.min(6, dur * 0.2),
      gain: 1
    };
    if (last) last.fadeOutSec = xf;

    clips.push(clip);
    selectedClipId = clip.id;
    renderAll();
    save();
  }

  /**
   * Append several tracks at once, each crossfaded into the one before, using
   * their mix-in / mix-out cues where the analysis found them.
   */
  function addClips(trackIds) {
    var added = 0;
    if (trackIds.length) pushUndo();
    trackIds.forEach(function (id) {
      var t = trackById(id);
      if (!t || !t.durationSec) return;

      var tail = 0, last = null;
      clips.forEach(function (c) {
        var end = c.startSec + c.lengthSec;
        if (end >= tail) { tail = end; last = c; }
      });
      var lastTrack = last ? trackById(last.trackId) : null;

      var inSec = (t.mixInSec != null) ? t.mixInSec : 0;
      var outSec = (t.mixOutSec != null) ? t.mixOutSec : t.durationSec;
      if (outSec <= inSec + 20) { inSec = 0; outSec = t.durationSec; }

      var xf = last ? crossfadeFor(lastTrack || t, t) : 0;
      if (last) {
        xf = clampXfade(xf, inSec);
        xf = Math.min(xf, (outSec - inSec) * 0.4, last.lengthSec * 0.4);
      }

      var lead = Math.min(xf, inSec);
      var offset = inSec - lead;
      var length = Math.min(t.durationSec - offset, (outSec - offset) + 12);
      if (length < 20) { offset = 0; length = Math.min(t.durationSec, 120); }

      var start = last ? Math.max(0, tail - xf) : 0;
      if (last) last.fadeOutSec = Math.min(xf, last.lengthSec * 0.5);

      clips.push({
        id: newId(),
        trackId: id,
        startSec: Math.round(start * 100) / 100,
        offsetSec: Math.round(offset * 100) / 100,
        lengthSec: Math.round(length * 100) / 100,
        fadeInSec: Math.round(Math.min(xf, length * 0.5) * 100) / 100,
        fadeOutSec: Math.round(Math.min(last ? xf : Math.min(12, length * 0.25), length * 0.5) * 100) / 100,
        gain: 1
      });
      added++;
    });
    if (added) {
      if (mixBpm) clips.forEach(function (c) { alignToGrid(c); });
      selectedClipId = null;
      renderAll();
      save();
    }
    return added;
  }

  function clipsForTrack(id) {
    return clips.filter(function (c) { return c.trackId === id; }).length;
  }

  function removeClip(id) {
    clips = clips.filter(function (c) { return c.id !== id; });
    if (selectedClipId === id) selectedClipId = null;
    renderAll();
    save();
  }

  function arrangementEnd() {
    var end = 0;
    clips.forEach(function (c) { end = Math.max(end, c.startSec + c.lengthSec); });
    return end;
  }

  function sortedClips() {
    return clips.slice().sort(function (a, b) { return a.startSec - b.startSec; });
  }

  /**
   * Fade envelope for a clip at an absolute mix time.
   *
   * Equal-power (quarter-sine), not linear. Two different tracks are
   * uncorrelated, so their powers add rather than their amplitudes — a linear
   * crossfade sits at 0.5+0.5 amplitude in the middle, which is only half the
   * power, an audible ~3dB dip on every transition. sin/cos ramps keep
   * gainA² + gainB² at 1 right through the blend.
   */
  function clipGainAt(c, tSec) {
    var rel = tSec - c.startSec;
    if (rel < 0 || rel > c.lengthSec) return 0;
    var g = c.gain;
    if (c.fadeInSec > 0 && rel < c.fadeInSec) {
      g *= Math.sin((rel / c.fadeInSec) * Math.PI / 2);
    }
    var fromEnd = c.lengthSec - rel;
    if (c.fadeOutSec > 0 && fromEnd < c.fadeOutSec) {
      g *= Math.sin((fromEnd / c.fadeOutSec) * Math.PI / 2);
    }
    return Math.max(0, Math.min(1, g));
  }

  // ============================================================
  //  Auto-arrange
  //
  //  Orders the tracks so each transition is harmonically sound and the
  //  tempo barely moves, shaped into an energy arc — build, peak, come
  //  down — then places each clip so the incoming track's mix-in cue lands
  //  on the outgoing track's mix-out cue.
  // ============================================================

  /** How well b follows a. Higher is better; harmonics dominate. */
  function transitionScore(a, b, positionFrac) {
    var s = 0;

    var rel = relation(a.key, b.key);
    if (rel.label === 'perfect') s += 3.0;
    else if (rel.label === 'relative') s += 2.6;
    else if (rel.label === '+1 energy') s += 2.8;
    else if (rel.label === '−1 mood') s += 2.4;
    else if (rel.label === '2 steps') s += 0.4;
    else s -= 4.0;                                  // clash
    if (!a.key || !b.key) s -= 0.5;                 // unknown: mildly discouraged

    // Tempo: past ~6% is outside comfortable pitch range on most gear.
    if (a.bpm && b.bpm) {
      var pct = Math.abs((b.bpm - a.bpm) / a.bpm) * 100;
      s -= pct * 0.45;
      if (pct > 6) s -= 2.5;
    } else {
      s -= 0.4;
    }

    // Energy arc: climb through the first ~65%, ease off after.
    if (a.energy && b.energy) {
      var step = b.energy - a.energy;
      var wantRising = positionFrac < 0.65;
      if (wantRising) s += step >= 0 && step <= 2 ? 1.0 : step > 2 ? 0.1 : -0.5;
      else s += step <= 0 && step >= -2 ? 0.9 : step < -2 ? 0.1 : -0.6;
    }
    return s;
  }

  var lastMisfits = [];
  var ARC_WEIGHT = 3.2;

  /**
   * How closely the energy sequence traces a set: climb to a peak around
   * two-thirds through, then come down. Scored across the whole chain rather
   * than seam by seam, so it shapes the set instead of just each handover.
   * Weighted below a clash — a bad key change is worse than a flat arc.
   */
  function arcScore(order) {
    var n = order.length;
    if (n < 3) return 0;
    var es = order.map(function (x) { return x.energy || 5; });
    var lo = Math.min.apply(null, es), hi = Math.max.apply(null, es);
    if (hi === lo) return 0;

    var err = 0;
    for (var i = 0; i < n; i++) {
      var frac = i / (n - 1);
      var ideal = frac <= 0.68 ? (frac / 0.68) : 1 - ((frac - 0.68) / 0.32) * 0.7;
      var actual = (es[i] - lo) / (hi - lo);
      err += (actual - ideal) * (actual - ideal);
    }
    return ARC_WEIGHT * (1 - (err / n) * 2.2);
  }

  function chainTotal(order) {
    var t = 0;
    for (var i = 1; i < order.length; i++) {
      t += transitionScore(order[i - 1], order[i], i / order.length);
    }
    return t + arcScore(order);
  }

  function greedyFrom(seed, pool) {
    var remaining = pool.filter(function (x) { return x !== seed; });
    var chain = [seed];
    while (remaining.length) {
      var frac = chain.length / pool.length;
      var bestIdx = 0, bestScore = -Infinity;
      for (var i = 0; i < remaining.length; i++) {
        var sc = transitionScore(chain[chain.length - 1], remaining[i], frac);
        if (sc > bestScore) { bestScore = sc; bestIdx = i; }
      }
      chain.push(remaining.splice(bestIdx, 1)[0]);
    }
    return chain;
  }

  function twoOpt(chain) {
    var best = chain, bestT = chainTotal(chain), improved = true, guard = 0;
    while (improved && guard++ < 5) {
      improved = false;
      for (var i = 0; i < best.length - 1; i++) {
        for (var j = i + 1; j < best.length; j++) {
          var cand = best.slice(0, i)
            .concat(best.slice(i, j + 1).reverse())
            .concat(best.slice(j + 1));
          var t2 = chainTotal(cand);
          if (t2 > bestT + 0.001) { best = cand; bestT = t2; improved = true; }
        }
      }
    }
    return best;
  }

  /**
   * Greedy is only as good as where it starts — anchored to one track it can
   * strand a key with nowhere clean to go. So run it from several seeds and
   * keep the best chain, then refine with 2-opt.
   */
  /**
   * A track that can only be reached through a key clash *and* a tempo jump
   * past pitch range does not belong in this set. Better to leave it out and
   * say so than to bury a jarring transition in the middle of the mix.
   */
  function splitMisfits(pool) {
    if (pool.length < 4) return { core: pool.slice(), misfits: [] };
    var core = [], misfits = [];
    pool.forEach(function (t) {
      var reachable = pool.some(function (o) {
        if (o === t) return false;
        var okKey = relation(o.key, t.key).label !== 'clash';
        var okBpm = !o.bpm || !t.bpm ||
          Math.abs((t.bpm - o.bpm) / o.bpm) * 100 <= 6;
        return okKey || okBpm;
      });
      (reachable ? core : misfits).push(t);
    });
    // Never strand the whole set on this rule.
    if (core.length < 2) return { core: pool.slice(), misfits: [] };
    return { core: core, misfits: misfits };
  }

  function orderTracks(pool) {
    if (pool.length <= 2) return pool.slice();

    var seeds;
    if (pool.length <= 24) {
      seeds = pool.slice();                       // small crate: try them all
    } else {
      seeds = pool.slice().sort(function (a, b) {
        return (a.energy || 5) - (b.energy || 5);
      }).slice(0, 8);                             // large crate: quiet starts only
    }

    var best = null, bestT = -Infinity;
    seeds.forEach(function (seed) {
      var chain = twoOpt(greedyFrom(seed, pool));
      var t = chainTotal(chain);
      if (t > bestT) { bestT = t; best = chain; }
    });
    return best || pool.slice();
  }

  /**
   * A crossfade should be finished by the time the incoming track's mix-in cue
   * lands, so the track is at full level when its body starts. That caps the
   * fade at the length of the intro it hides under — a track with a short
   * intro simply gets a shorter blend.
   */
  function clampXfade(xf, introSec) {
    var room = introSec > 0 ? introSec : 0;
    return Math.max(4, Math.min(xf, room > 4 ? room : 4));
  }

  /** Crossfade length for a pair, in seconds, rounded to whole bars. */
  function crossfadeFor(a, b) {
    var bpm = (a && a.bpm) || (b && b.bpm) || 124;
    var bar = (60 / bpm) * 4;
    var bars = 16;
    var rel = relation(a && a.key, b && b.key);
    if (rel.label === 'clash') bars = 4;            // get out fast
    else if (rel.label === '2 steps') bars = 8;
    return Math.max(4, Math.min(48, bar * bars));
  }

  function autoArrange(subset) {
    var pool = (subset && subset.length ? subset : tracks)
      .filter(function (t) { return blobs[t.id] && t.durationSec; });
    if (pool.length < 2) { flash('Add at least two analysed tracks first'); return; }
    if (clips.length && !confirm('Replace the current arrangement with an auto-built one?')) return;

    stopPlayback(false);
    pushUndo();
    var split = splitMisfits(pool);
    var order = orderTracks(split.core);
    lastMisfits = split.misfits;

    // Run the whole set at one tempo, taken from the middle of the pack so the
    // least stretching is needed overall.
    mixBpm = medianBpm(order);

    clips = [];
    var cursor = 0;
    for (var i = 0; i < order.length; i++) {
      var t = order[i];
      var inSec = (t.mixInSec != null) ? t.mixInSec : 0;
      var outSec = (t.mixOutSec != null) ? t.mixOutSec : t.durationSec;
      if (outSec <= inSec) { inSec = 0; outSec = t.durationSec; }

      var prev = order[i - 1];
      var xfIn = i === 0 ? 0 : clampXfade(crossfadeFor(prev, t), inSec);
      var xfOut = i === order.length - 1
        ? Math.min(12, (outSec - inSec) * 0.25)
        : crossfadeFor(t, order[i + 1]);

      // Play from the mix-in cue, but start early enough that the incoming
      // fade is over by the time the cue itself lands.
      var lead = Math.min(xfIn, inSec);
      var offset = inSec - lead;
      var length = (outSec - offset) + xfOut;
      length = Math.min(length, t.durationSec - offset);
      if (length < 20) { offset = 0; length = Math.min(t.durationSec, 120); }

      var start = i === 0 ? 0 : Math.max(0, cursor - xfIn);
      clips.push({
        id: newId(),
        trackId: t.id,
        startSec: Math.round(start * 100) / 100,
        offsetSec: Math.round(offset * 100) / 100,
        lengthSec: Math.round(length * 100) / 100,
        fadeInSec: Math.round(Math.min(xfIn, length * 0.5) * 100) / 100,
        fadeOutSec: Math.round(Math.min(xfOut, length * 0.5) * 100) / 100,
        gain: 1,
        auto: true
      });
      cursor = start + length;
    }

    if (mixBpm) clips.forEach(function (c) { alignToGrid(c); });

    selectedClipId = null;
    renderAll();
    save();
    selectTab('arrange');
    var msg = 'Arranged ' + order.length + ' tracks · ' + fmtTime(arrangementEnd());
    if (mixBpm) msg += ' @ ' + mixBpm + ' BPM';
    if (lastMisfits.length) {
      msg += ' · left out ' + lastMisfits.length +
        (lastMisfits.length === 1 ? ' misfit' : ' misfits');
    }
    flash(msg);
  }

  // ============================================================
  //  Playback
  //
  //  Media elements stream from disk rather than holding decoded PCM, so a
  //  long mix costs almost no memory. A small voice pool keeps the number
  //  of live elements low, which iOS cares about.
  // ============================================================

  var actx = null, master = null, voices = [], VOICES = 4;
  var playing = false, startedAtCtx = 0, startedAtMix = 0, schedTimer = null, rafId = null;

  function ensureAudio() {
    if (actx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 1;
    master.connect(actx.destination);

    for (var i = 0; i < VOICES; i++) {
      var a = document.createElement('audio');
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      var src = actx.createMediaElementSource(a);
      var g = actx.createGain();
      g.gain.value = 0;
      src.connect(g);
      g.connect(master);
      voices.push({ audio: a, gain: g, clipId: null, url: null });
    }
    return true;
  }

  function mixTime() {
    if (!playing) return startedAtMix;
    return startedAtMix + (actx.currentTime - startedAtCtx);
  }

  function voiceFor(clipId) {
    for (var i = 0; i < voices.length; i++) if (voices[i].clipId === clipId) return voices[i];
    return null;
  }

  function freeVoice() {
    for (var i = 0; i < voices.length; i++) if (!voices[i].clipId) return voices[i];
    return null;
  }

  function releaseVoice(v) {
    try { v.audio.pause(); } catch (e) {}
    v.gain.gain.value = 0;
    if (v.url) { URL.revokeObjectURL(v.url); v.url = null; }
    v.clipId = null;
  }

  /**
   * Runs a few times a second: start clips that should be sounding, stop
   * those that shouldn't, and track each fade envelope.
   */
  function schedule() {
    if (!playing) return;
    var t = mixTime();

    // Retire finished clips first so their voices can be reused.
    voices.forEach(function (v) {
      if (!v.clipId) return;
      var c = clips.filter(function (x) { return x.id === v.clipId; })[0];
      if (!c || t < c.startSec - 0.15 || t > c.startSec + c.lengthSec) releaseVoice(v);
    });

    clips.forEach(function (c) {
      var active = t >= c.startSec - 0.15 && t < c.startSec + c.lengthSec;
      if (!active) return;
      var v = voiceFor(c.id);

      if (!v) {
        var f = blobs[c.trackId];
        if (!f) return;
        v = freeVoice();
        if (!v) return;                       // all voices busy; skip this pass
        v.clipId = c.id;
        v.url = URL.createObjectURL(f);
        v.audio.src = v.url;
        var rate = clipRate(c);
        var seek = c.offsetSec + Math.max(0, t - c.startSec) * rate;
        try { v.audio.currentTime = seek; } catch (e) {}
        try {
          v.audio.preservesPitch = true;          // keep the key the app reported
          v.audio.playbackRate = rate;
        } catch (e) {}
        var p = v.audio.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        // Nudge back into sync if the element has drifted.
        var rate2 = clipRate(c);
        try {
          if (Math.abs(v.audio.playbackRate - rate2) > 0.001) {
            v.audio.preservesPitch = true;
            v.audio.playbackRate = rate2;
          }
        } catch (e) {}
        var want = c.offsetSec + (t - c.startSec) * rate2;
        if (isFinite(v.audio.currentTime) && Math.abs(v.audio.currentTime - want) > 0.35) {
          try { v.audio.currentTime = want; } catch (e) {}
        }
      }
      v.gain.gain.value = clipGainAt(c, t);
    });

    if (t >= arrangementEnd()) stopPlayback(true);
  }

  function tickPlayhead() {
    if (!playing) return;
    updatePlayhead();
    rafId = requestAnimationFrame(tickPlayhead);
  }

  async function startPlayback() {
    if (!clips.length) return;
    if (!ensureAudio()) { flash('Web Audio unavailable'); return; }
    if (actx.state === 'suspended') { try { await actx.resume(); } catch (e) {} }

    var missing = clips.filter(function (c) { return !blobs[c.trackId]; });
    if (missing.length === clips.length) { flash('Re-add the audio files first'); return; }

    if (startedAtMix >= arrangementEnd()) startedAtMix = 0;
    startedAtCtx = actx.currentTime;
    playing = true;
    el.playBtn.textContent = '❙❙ Pause';
    el.playhead.classList.remove('hidden');
    schedule();
    schedTimer = setInterval(schedule, 120);
    rafId = requestAnimationFrame(tickPlayhead);
  }

  function pausePlayback() {
    if (!playing) return;
    startedAtMix = mixTime();
    playing = false;
    clearInterval(schedTimer); schedTimer = null;
    if (rafId) cancelAnimationFrame(rafId); rafId = null;
    voices.forEach(releaseVoice);
    el.playBtn.textContent = '▶ Play';
    updateClock();
  }

  function stopPlayback(atEnd) {
    pausePlayback();
    startedAtMix = atEnd ? arrangementEnd() : 0;
    updatePlayhead();
    updateClock();
  }

  // ============================================================
  //  Bounce
  //
  //  Rendered in real time through a MediaStream rather than offline:
  //  an OfflineAudioContext would need every track decoded to PCM at once,
  //  which is exactly the memory wall that broke importing.
  // ============================================================

  var recorder = null, recChunks = [], recording = false;

  function pickMime() {
    var opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    for (var i = 0; i < opts.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(opts[i])) return opts[i];
    }
    return '';
  }

  async function bounce() {
    if (recording) { stopBounce(); return; }
    if (!clips.length) return;
    if (!window.MediaRecorder) { flash('This browser cannot record'); return; }
    if (!ensureAudio()) return;
    if (actx.state === 'suspended') { try { await actx.resume(); } catch (e) {} }

    var mime = pickMime();
    var dest = actx.createMediaStreamDestination();
    master.connect(dest);

    try {
      recorder = mime ? new MediaRecorder(dest.stream, { mimeType: mime }) : new MediaRecorder(dest.stream);
    } catch (e) { flash('Recording failed to start'); return; }

    recChunks = [];
    recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) recChunks.push(ev.data); };
    recorder.onstop = function () {
      try { master.disconnect(dest); } catch (e) {}
      var blob = new Blob(recChunks, { type: recorder.mimeType || 'audio/mp4' });
      recChunks = [];
      recording = false;
      el.bounceBtn.textContent = '● Bounce';
      el.barBusy.classList.add('hidden');
      el.barIdle.classList.remove('hidden');
      showBounced(blob);
    };

    stopPlayback(false);
    recording = true;
    el.bounceBtn.textContent = '■ Stop bounce';
    recorder.start();
    await startPlayback();

    el.barIdle.classList.add('hidden');
    el.barBusy.classList.remove('hidden');
    el.ptext.textContent = 'Bouncing in real time — keep this screen open';
    el.pcount.textContent = '';

    (function watch() {
      if (!recording) return;
      var total = arrangementEnd();
      var t = mixTime();
      el.pfill.style.width = Math.min(100, (t / total) * 100).toFixed(1) + '%';
      el.pcount.textContent = fmtTime(t) + ' / ' + fmtTime(total);
      if (!playing) { stopBounce(); return; }
      setTimeout(watch, 400);
    })();
  }

  function stopBounce() {
    if (!recording || !recorder) return;
    try { recorder.stop(); } catch (e) { recording = false; }
    pausePlayback();
  }

  var bouncedBlob = null;

  function showBounced(blob) {
    bouncedBlob = blob;
    var dlg = document.getElementById('bounced');
    var au = document.getElementById('b-audio');
    au.src = URL.createObjectURL(blob);

    var mb = blob.size / 1048576;
    document.getElementById('b-info').textContent =
      fmtTime(arrangementEnd()) + '  ·  ' + mb.toFixed(1) + ' MB  ·  ' + blob.type;

    var note = document.getElementById('b-note');
    note.className = 'note';
    if (mb > 16) {
      note.className = 'note warn';
      note.textContent = 'This mix is ' + mb.toFixed(1) + ' MB. Saving from inside the Claude viewer ' +
        'is capped at 16 MB — it will refuse. To keep a mix this long, open keylock.html directly in ' +
        'Safari and bounce there. You can still audition it above.';
    } else {
      note.textContent = 'Have a listen through the transitions before you keep it.';
    }
    dlg.showModal();
  }

  /** Extension has to be one the viewer allows: mp4 and webm are, m4a is not. */
  function bounceFilename(blob) {
    var ext = blob.type.indexOf('webm') !== -1 ? 'webm' : 'mp4';
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '-' +
      String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    return 'keylock-mix-' + stamp + '.' + ext;
  }

  document.getElementById('b-save').addEventListener('click', async function () {
    if (!bouncedBlob) return;
    var btn = this;
    var name = bounceFilename(bouncedBlob);
    var note = document.getElementById('b-note');

    // Inside the Claude viewer the host mediates the save; opened as a plain
    // file it does not exist, and an anchor works.
    var downloads = null;
    if (window.claude && typeof window.claude.use === 'function') {
      try { downloads = await window.claude.use('downloads'); } catch (e) { downloads = null; }
    }

    if (!downloads) {
      try {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(bouncedBlob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 1000);
      } catch (e) {
        note.className = 'note warn';
        note.textContent = 'This browser would not take the file. Long-press the player above to save it instead.';
      }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await downloads.save({ filename: name, data: bouncedBlob });
      btn.textContent = 'Saved';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save file';
      note.className = 'note warn';
      var code = err && err.code;
      if (code === 'declined') {
        note.textContent = 'Save cancelled.';
        note.className = 'note';
      } else if (code === 'too_large') {
        note.textContent = 'Too big to save from here — the limit is 16 MB and this mix is ' +
          (bouncedBlob.size / 1048576).toFixed(1) + ' MB. Open keylock.html directly in Safari and ' +
          'bounce there, or bounce a shorter stretch.';
      } else if (code === 'rate_limited') {
        note.textContent = 'A save prompt is already open. Finish that one, then try again.';
      } else if (code === 'rejected_extension' || code === 'extension_not_enabled') {
        note.textContent = 'This viewer will not accept a ' + name.split('.').pop() +
          ' file. Open keylock.html directly in Safari to keep the bounce.';
      } else {
        note.textContent = 'Could not save here. You can still audition the mix above, or open ' +
          'keylock.html directly in Safari and bounce there.';
      }
    }
  });

  document.getElementById('b-close').addEventListener('click', function () {
    document.getElementById('bounced').close();
  });

  /** Plain-text running order, for notes or a tracklist post. */
  function setlistText() {
    var ordered = sortedClips();
    var lines = [];
    lines.push('KEYLOCK SETLIST');
    lines.push('Total ' + fmtTime(arrangementEnd()) +
      (mixBpm ? '   ·   mix tempo ' + mixBpm + ' BPM' : '') +
      '   ·   ' + ordered.length + ' tracks');
    lines.push('');
    ordered.forEach(function (c, i) {
      var t = trackById(c.trackId);
      if (!t) return;
      var num = String(i + 1).padStart(2, '0');
      var head = num + '.  ' + fmtTime(c.startSec) + '   ' +
        (t.artist ? t.artist + ' — ' : '') + (t.title || t.filename);
      var meta = '      ' + (t.key || '--') +
        (t.key ? ' ' + CAMELOT_NAME[t.key] : '') +
        '   ' + (t.bpm ? t.bpm.toFixed(1) + ' BPM' : 'BPM ?');
      var rate = clipRate(c);
      if (mixBpm && Math.abs(rate - 1) > 0.001) {
        meta += ' → ' + mixBpm + ' (' + (rate > 1 ? '+' : '−') +
          (Math.abs(rate - 1) * 100).toFixed(1) + '%)';
      }
      if (t.energy) meta += '   energy ' + t.energy;
      lines.push(head);
      lines.push(meta);
      if (i > 0) {
        var prev = trackById(ordered[i - 1].trackId);
        if (prev) {
          var rel = relation(prev.key, t.key);
          lines.push('      ↑ ' + rel.label + ', ' +
            Math.round(ordered[i - 1].startSec + ordered[i - 1].lengthSec - c.startSec) +
            's blend');
        }
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  function showSetlist() {
    if (!clips.length) { flash('Nothing arranged yet'); return; }
    var txt = setlistText();
    document.getElementById('sl-body').textContent = txt;
    document.getElementById('sl-sub').textContent =
      clips.length + ' tracks · ' + fmtTime(arrangementEnd());
    var dlg = document.getElementById('setlist');

    document.getElementById('sl-copy').onclick = function () {
      var b = this;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          b.textContent = 'Copied';
          setTimeout(function () { b.textContent = 'Copy'; }, 1500);
        }).catch(function () { b.textContent = 'Select it above'; });
      } else {
        b.textContent = 'Select it above';
      }
    };
    document.getElementById('sl-save').onclick = async function () {
      var b = this;
      var name = 'keylock-setlist.txt';
      var dl = null;
      if (window.claude && typeof window.claude.use === 'function') {
        try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
      }
      if (dl) {
        b.disabled = true; b.textContent = 'Saving…';
        try { await dl.save({ filename: name, data: txt }); b.textContent = 'Saved'; }
        catch (err) {
          b.disabled = false;
          b.textContent = (err && err.code === 'declined') ? 'Save .txt' : 'Could not save';
        }
        return;
      }
      try {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
        a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      } catch (e) { b.textContent = 'Could not save'; }
    };
    dlg.showModal();
  }

  // ============================================================
  //  Timeline rendering
  // ============================================================

  var pxPerSec = 9;
  var selectedClipId = null;

  function fmtTime(sec) {
    if (!isFinite(sec)) return '0:00';
    var s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function renderTimeline() {
    var total = Math.max(arrangementEnd() + 30, 120);
    var width = Math.max(total * pxPerSec, 320);
    el.canvasarea.style.width = width + 'px';

    // ---- ruler ----
    el.ruler.textContent = '';
    var step = pxPerSec > 22 ? 15 : pxPerSec > 10 ? 30 : pxPerSec > 5 ? 60 : 120;
    for (var s = 0; s <= total; s += step) {
      var tk = document.createElement('div');
      tk.className = 'tick';
      tk.style.left = (s * pxPerSec) + 'px';
      tk.textContent = fmtTime(s);
      el.ruler.appendChild(tk);
    }

    // ---- lanes: alternate so overlaps stay visible ----
    el.lanes.textContent = '';
    var ordered = sortedClips();
    var laneCount = ordered.length ? 2 : 0;
    var laneEls = [];
    for (var L = 0; L < laneCount; L++) {
      var lane = document.createElement('div');
      lane.className = 'lane';
      el.lanes.appendChild(lane);
      laneEls.push(lane);
    }

    ordered.forEach(function (c, i) {
      var t = trackById(c.trackId);
      var node = buildClip(c, t, i);
      laneEls[i % 2].appendChild(node);
    });

    // ---- transition verdicts at each overlap ----
    el.xfades.textContent = '';
    for (var k = 1; k < ordered.length; k++) {
      var prev = ordered[k - 1], cur = ordered[k];
      var overlapStart = Math.max(prev.startSec, cur.startSec);
      var overlapEnd = Math.min(prev.startSec + prev.lengthSec, cur.startSec + cur.lengthSec);
      if (overlapEnd <= overlapStart) continue;
      var pt = trackById(prev.trackId), ct = trackById(cur.trackId);
      var rel = relation(pt && pt.key, ct && ct.key);
      var chip = document.createElement('div');
      chip.className = 'xf ' + rel.cls;
      var mid = (overlapStart + overlapEnd) / 2;
      chip.style.left = (mid * pxPerSec) + 'px';
      var txt = rel.label;
      if (pt && ct && pt.bpm && ct.bpm) {
        var pct = ((ct.bpm - pt.bpm) / pt.bpm) * 100;
        txt += '  ' + (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(1) + '%';
      }
      chip.textContent = txt;
      chip.title = 'Transition ' + k + ': ' + rel.label;
      el.xfades.appendChild(chip);
    }

    // keep the tempo field and undo button honest
    var bi = document.getElementById('a-bpm');
    if (bi && document.activeElement !== bi) bi.value = mixBpm != null ? mixBpm : '';
    var bw = document.querySelector('.bpmwrap');
    if (bw) bw.classList.toggle('on', mixBpm != null);
    refreshUndoBtn();

    updatePlayhead();
    updateClock();
    renderInspector();

    el.arrEmpty.textContent = '';
    if (!clips.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.innerHTML = '<b>Nothing arranged yet</b><p>In the Library, <b>Add all →</b> drops every track on the timeline in key order, and <b>✦ Auto-arrange all</b> works out the running order first. Tick individual tracks to do just those.</p>';
      el.arrEmpty.appendChild(e);
    } else if (lastMisfits.length) {
      var m = document.createElement('div');
      m.className = 'empty';
      m.style.borderColor = 'var(--warn)';
      var names = lastMisfits.map(function (t) {
        return (t.title || t.filename) + ' (' + (t.key || '?') + ' · ' +
          (t.bpm ? t.bpm.toFixed(0) : '?') + ')';
      }).join(', ');
      m.innerHTML = '<b>Left out of the auto-arrangement</b><p>' + names +
        '<br>Nothing in the set reaches ' + (lastMisfits.length === 1 ? 'it' : 'them') +
        ' without both a key clash and a tempo jump past pitch range. Add ' +
        (lastMisfits.length === 1 ? 'it' : 'them') + ' by hand from the Library if you want ' +
        (lastMisfits.length === 1 ? 'it' : 'them') + ' anyway.</p>';
      el.arrEmpty.appendChild(m);
    }
  }

  function buildClip(c, t, index) {
    var node = document.createElement('div');
    node.className = 'clip' + (c.id === selectedClipId ? ' sel' : '');
    node.style.left = (c.startSec * pxPerSec) + 'px';
    node.style.width = Math.max(26, c.lengthSec * pxPerSec) + 'px';
    node.style.background = t && t.key ? keyColor(t.key) : '#5A6076';
    node.dataset.clip = c.id;

    var cv = document.createElement('canvas');
    node.appendChild(cv);

    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = t ? (t.title || t.filename) : 'missing file';
    node.appendChild(label);

    var meta = document.createElement('div');
    meta.className = 'meta';
    var mbits = [];
    if (t && t.key) mbits.push(t.key);
    if (t && t.bpm) mbits.push(t.bpm.toFixed(1));
    var rate = clipRate(c);
    if (mixBpm && Math.abs(rate - 1) > 0.001) {
      mbits.push((rate > 1 ? '+' : '−') + (Math.abs(rate - 1) * 100).toFixed(1) + '%');
    } else if (clipUnmatched(c)) {
      mbits.push('OFF-TEMPO');
    }
    mbits.push(fmtTime(c.lengthSec));
    if (!blobs[c.trackId]) mbits.push('NO AUDIO');
    meta.textContent = mbits.join(' · ');
    node.appendChild(meta);

    if (c.id === selectedClipId) {
      var x = document.createElement('button');
      x.className = 'clipdel';
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Remove this clip');
      x.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        pushUndo();
        removeClip(c.id);
      });
      node.appendChild(x);
    }

    var hl = document.createElement('div'); hl.className = 'handle l';
    var hr = document.createElement('div'); hr.className = 'handle r';
    node.appendChild(hl); node.appendChild(hr);

    attachDrag(node, c, hl, hr);

    // Draw the waveform slice and fade ramps once the box has a size.
    requestAnimationFrame(function () { drawClipCanvas(cv, c, t); });
    return node;
  }

  function drawClipCanvas(cv, c, t) {
    var w = cv.offsetWidth, h = cv.offsetHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    var g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    // section tint for the stretch this clip covers
    if (t && t.sections && t.durationSec) {
      t.sections.forEach(function (sec) {
        var a = Math.max(sec.startSec, c.offsetSec);
        var span = clipSourceSpan(c);
        var b = Math.min(sec.endSec, c.offsetSec + span);
        if (b <= a) return;
        var x0 = ((a - c.offsetSec) / span) * w;
        var x1 = ((b - c.offsetSec) / span) * w;
        g.fillStyle = SECTION_COLOR[sec.kind] || '#3A4050';
        g.globalAlpha = 0.34;
        g.fillRect(x0, 0, Math.max(1, x1 - x0), h);
        g.globalAlpha = 1;
      });
    }

    // waveform slice
    if (t && t.peaks && t.peaks.length && t.durationSec) {
      g.fillStyle = 'rgba(8,9,12,0.30)';
      var n = t.peaks.length;
      var srcSpan = clipSourceSpan(c);
      for (var x = 0; x < w; x++) {
        var srcSec = c.offsetSec + (x / w) * srcSpan;
        var pi = Math.floor((srcSec / t.durationSec) * n);
        if (pi < 0 || pi >= n) continue;
        var mag = Math.pow(t.peaks[pi], 0.7);
        var bh = Math.max(1, mag * h * 0.7);
        g.fillRect(x, (h - bh) / 2, 1, bh);
      }
    }

    // fade ramps
    g.fillStyle = 'rgba(8,9,12,0.42)';
    var fi = (c.fadeInSec / c.lengthSec) * w;
    if (fi > 1) { g.beginPath(); g.moveTo(0, 0); g.lineTo(fi, 0); g.lineTo(0, h); g.closePath(); g.fill(); }
    var fo = (c.fadeOutSec / c.lengthSec) * w;
    if (fo > 1) { g.beginPath(); g.moveTo(w, 0); g.lineTo(w - fo, 0); g.lineTo(w, h); g.closePath(); g.fill(); }
  }

  function updatePlayhead() {
    var t = mixTime();
    el.playhead.style.left = (t * pxPerSec) + 'px';
    if (playing) {
      updateClock();
      // keep the head on screen without fighting a manual scroll
      var x = t * pxPerSec;
      var view = el.timeline.scrollLeft, w = el.timeline.clientWidth;
      if (x < view + 40 || x > view + w - 60) el.timeline.scrollLeft = Math.max(0, x - w * 0.35);
    }
  }

  function updateClock() {
    el.clock.innerHTML = fmtTime(mixTime()) + '<em> / ' + fmtTime(arrangementEnd()) + '</em>';
  }

  // ---- dragging: body moves, edges trim ----

  function attachDrag(node, c, hl, hr) {
    function begin(mode) {
      return function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        selectedClipId = c.id;
        pushUndo();
        var startX = ev.clientX;
        var orig = { start: c.startSec, off: c.offsetSec, len: c.lengthSec };
        var t = trackById(c.trackId);
        var srcDur = (t && t.durationSec) || c.lengthSec;
        node.setPointerCapture && node.setPointerCapture(ev.pointerId);

        var rate = clipRate(c);
        function move(e2) {
          var d = (e2.clientX - startX) / pxPerSec;
          if (mode === 'move') {
            c.startSec = Math.max(0, orig.start + d);
          } else if (mode === 'in') {
            // Trimming the head keeps the tail put: move start and offset together.
            var maxIn = orig.len - 2;
            var dd = Math.max(-orig.off / rate, Math.min(d, maxIn));
            c.startSec = Math.max(0, orig.start + dd);
            c.offsetSec = Math.max(0, orig.off + dd * rate);
            c.lengthSec = Math.max(2, orig.len - dd);
          } else {
            var maxLen = (srcDur - c.offsetSec) / rate;
            c.lengthSec = Math.max(2, Math.min(orig.len + d, maxLen));
          }
          c.fadeInSec = Math.min(c.fadeInSec, c.lengthSec * 0.5);
          c.fadeOutSec = Math.min(c.fadeOutSec, c.lengthSec * 0.5);

          node.style.left = (c.startSec * pxPerSec) + 'px';
          node.style.width = Math.max(26, c.lengthSec * pxPerSec) + 'px';
        }
        function end() {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          if (mixBpm) alignToGrid(c);      // land on a bar line
          renderAll();
          save();
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      };
    }

    node.addEventListener('pointerdown', begin('move'));
    hl.addEventListener('pointerdown', begin('in'));
    hr.addEventListener('pointerdown', begin('out'));
  }

  // ---- inspector ----

  function renderInspector() {
    el.inspector.textContent = '';
    var c = clips.filter(function (x) { return x.id === selectedClipId; })[0];
    if (!c) return;
    var t = trackById(c.trackId);

    var box = document.createElement('div');
    box.className = 'inspector';

    var h = document.createElement('h3');
    h.textContent = t ? (t.title || t.filename) : 'Missing file';
    box.appendChild(h);

    var who = document.createElement('p');
    who.className = 'who';
    var wbits = [];
    if (t && t.artist) wbits.push(t.artist);
    if (t && t.key) wbits.push(t.key + ' ' + CAMELOT_NAME[t.key]);
    if (t && t.bpm) wbits.push(t.bpm.toFixed(1) + ' BPM');
    wbits.push('at ' + fmtTime(c.startSec));
    who.textContent = wbits.join('  ·  ');
    box.appendChild(who);

    box.appendChild(slider('Fade in', c.fadeInSec, 0, Math.min(60, c.lengthSec * 0.5), 0.5, 's',
      function (v) { c.fadeInSec = v; }));
    box.appendChild(slider('Fade out', c.fadeOutSec, 0, Math.min(60, c.lengthSec * 0.5), 0.5, 's',
      function (v) { c.fadeOutSec = v; }));
    box.appendChild(slider('Level', c.gain, 0, 1, 0.01, '',
      function (v) { c.gain = v; }, function (v) { return Math.round(v * 100) + '%'; }));
    box.appendChild(slider('Start in track', c.offsetSec, 0,
      Math.max(0, ((t && t.durationSec) || 0) - clipSourceSpan(c)), 1, 's',
      function (v) { c.offsetSec = v; }, function (v) { return fmtTime(v); }));

    if (mixBpm && t && t.bpm) {
      var note = document.createElement('p');
      note.className = 'who';
      note.style.marginTop = '2px';
      var r = clipRate(c);
      note.textContent = clipUnmatched(c)
        ? 'Too far from ' + mixBpm + ' BPM to stretch cleanly — playing at its own tempo.'
        : 'Stretched ' + (r > 1 ? '+' : '−') + (Math.abs(r - 1) * 100).toFixed(1) +
          '% to ' + mixBpm + ' BPM, key held.';
      box.appendChild(note);
    }

    var acts = document.createElement('div');
    acts.className = 'insp-actions';

    var goto = document.createElement('button');
    goto.className = 'tbtn';
    goto.type = 'button';
    goto.textContent = 'Cue here';
    goto.addEventListener('click', function () {
      var was = playing;
      pausePlayback();
      startedAtMix = c.startSec;
      updatePlayhead(); updateClock();
      if (was) startPlayback();
    });
    acts.appendChild(goto);

    var del = document.createElement('button');
    del.className = 'tbtn';
    del.type = 'button';
    del.textContent = 'Remove';
    del.addEventListener('click', function () { pushUndo(); removeClip(c.id); });
    acts.appendChild(del);

    box.appendChild(acts);
    el.inspector.appendChild(box);
  }

  function slider(name, value, min, max, step, unit, onInput, fmt) {
    var wrap = document.createElement('div');
    wrap.className = 'ctrl';
    var lab = document.createElement('label');
    var span = document.createElement('span');
    span.textContent = name;
    var b = document.createElement('b');
    var show = function (v) { return fmt ? fmt(v) : (Math.round(v * 10) / 10) + unit; };
    b.textContent = show(value);
    lab.appendChild(span); lab.appendChild(b);
    wrap.appendChild(lab);

    var inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min; inp.max = Math.max(min + step, max); inp.step = step;
    inp.value = value;
    inp.addEventListener('input', function () {
      var v = parseFloat(inp.value);
      b.textContent = show(v);
      onInput(v);
      renderTimeline();
    });
    inp.addEventListener('change', save);
    wrap.appendChild(inp);
    return wrap;
  }

  // ============================================================
  //  Library rendering
  // ============================================================

  function energyBars(n) {
    var wrap = document.createElement('span');
    wrap.className = 'energy';
    for (var i = 1; i <= 10; i++) {
      var b = document.createElement('i');
      if (n && i <= n) b.className = 'on';
      wrap.appendChild(b);
    }
    return wrap;
  }

  function trackRow(t) {
    var row = document.createElement('div');
    row.className = 'row';

    var chip = document.createElement('div');
    chip.className = 'keychip' + (t.key ? '' : ' pending');
    if (t.key) chip.style.background = keyColor(t.key);
    chip.textContent = (t.key || '--') + (t.keyAlt ? '?' : '');
    chip.title = t.key
      ? CAMELOT_NAME[t.key] + (t.keyAlt ? ' — could also be ' + t.keyAlt + ' (' + CAMELOT_NAME[t.keyAlt] + ')' : '')
      : 'Key not detected';
    row.appendChild(chip);

    var main = document.createElement('div');
    main.className = 'rowmain';
    var title = document.createElement('div');
    title.className = 'title';
    title.textContent = t.title || t.filename;
    var nClips = clipsForTrack(t.id);
    if (nClips) {
      var badge = document.createElement('span');
      badge.className = 'inmix';
      badge.textContent = nClips > 1 ? 'IN MIX ×' + nClips : 'IN MIX';
      title.appendChild(badge);
    }
    main.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'sub';
    var bits = [];
    if (t.artist) bits.push(t.artist);
    if (t.bpm) bits.push(t.bpm.toFixed(1) + ' BPM');
    if (t.key) bits.push(CAMELOT_NAME[t.key]);
    bits.push(fmtTime(t.durationSec));
    if (t.genre) bits.push(t.genre);
    if (!blobs[t.id]) bits.push('re-add to play');
    sub.textContent = bits.join('  ·  ');
    if (t.energy) { sub.appendChild(document.createTextNode(' ')); sub.appendChild(energyBars(t.energy)); }
    main.appendChild(sub);

    if (t.error) {
      var er = document.createElement('div');
      er.className = 'sub';
      er.style.color = 'var(--bad)';
      er.textContent = 'Could not analyse: ' + t.error;
      main.appendChild(er);
    }
    main.addEventListener('click', function () { openDetail(t.id); });
    row.appendChild(main);

    var act = document.createElement('div');
    act.className = 'rowact';

    var chk = document.createElement('button');
    chk.className = 'check';
    chk.type = 'button';
    chk.textContent = '✓';
    var on = !!selection[t.id];
    if (on) chk.dataset.on = '1';
    chk.setAttribute('aria-label', (on ? 'Deselect ' : 'Select ') + (t.title || t.filename));
    chk.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!blobs[t.id]) { chk.disabled = true; chk.title = 'Re-add this file first'; }
    chk.addEventListener('click', function (e) {
      e.stopPropagation();
      if (selection[t.id]) delete selection[t.id]; else selection[t.id] = true;
      renderLibrary();
    });
    act.appendChild(chk);

    var play = document.createElement('button');
    play.className = 'iconbtn'; play.type = 'button'; play.textContent = '▶';
    play.setAttribute('aria-label', 'Preview ' + (t.title || t.filename));
    if (!blobs[t.id]) { play.disabled = true; play.title = 'Re-add this file to preview'; }
    play.addEventListener('click', function (e) { e.stopPropagation(); preview(t.id, play); });
    act.appendChild(play);

    var add = document.createElement('button');
    add.className = 'iconbtn'; add.type = 'button'; add.textContent = '→';
    add.setAttribute('aria-label', 'Add to arrangement');
    add.title = 'Add to arrangement';
    add.addEventListener('click', function (e) {
      e.stopPropagation();
      addClips([t.id]);
      selectTab('arrange');
    });
    act.appendChild(add);

    var del = document.createElement('button');
    del.className = 'iconbtn danger'; del.type = 'button'; del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete ' + (t.title || t.filename));
    del.title = 'Delete from library';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteTracks([t.id]);
    });
    act.appendChild(del);

    row.appendChild(act);
    return row;
  }

  function matchesQuery(t) {
    if (!query) return true;
    var q = query.toLowerCase();
    return [t.title, t.artist, t.genre, t.key, t.filename,
            t.bpm ? t.bpm.toFixed(0) : '']
      .some(function (f) { return f && String(f).toLowerCase().indexOf(q) !== -1; });
  }

  function libSorted() {
    return tracks.filter(matchesQuery).sort(function (a, b) {
      var ka = a.key ? parseInt(a.key, 10) * 2 + (a.key.slice(-1) === 'B' ? 1 : 0) : 999;
      var kb = b.key ? parseInt(b.key, 10) * 2 + (b.key.slice(-1) === 'B' ? 1 : 0) : 999;
      return ka - kb;
    });
  }

  function selectedTracks() {
    return libSorted().filter(function (t) { return selection[t.id] && blobs[t.id]; });
  }

  function buildLibBar() {
    var loadable = libSorted().filter(function (t) { return blobs[t.id] && t.durationSec; });
    if (!loadable.length) return null;

    var sel = selectedTracks();
    var bar = document.createElement('div');
    bar.className = 'libbar' + (sel.length ? ' active' : '');

    var lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = sel.length
      ? sel.length + ' of ' + loadable.length + ' selected'
      : loadable.length + ' ready to arrange';
    bar.appendChild(lbl);

    function btn(text, cls, fn) {
      var b = document.createElement('button');
      b.className = 'tbtn' + (cls ? ' ' + cls : '');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }

    var allOn = sel.length === loadable.length;
    btn(allOn ? 'Select none' : 'Select all', '', function () {
      selection = {};
      if (!allOn) loadable.forEach(function (t) { selection[t.id] = true; });
      renderLibrary();
    });

    if (sel.length) {
      btn('Add ' + sel.length + ' →', '', function () {
        var n = addClips(sel.map(function (t) { return t.id; }));
        selection = {};
        renderAll();
        selectTab('arrange');
        flash('Added ' + n + ' to the arrangement');
      });
      btn('✦ Auto-arrange ' + sel.length, 'auto', function () {
        var pick = sel.slice();
        selection = {};
        autoArrange(pick);
      });
      btn('Delete ' + sel.length, 'danger', function () {
        deleteTracks(sel.map(function (t) { return t.id; }));
      });
    } else {
      btn('Add all →', '', function () {
        var pending = loadable.filter(function (t) { return !clipsForTrack(t.id); });
        if (!pending.length) { flash('Everything is already in the arrangement'); return; }
        var n = addClips(pending.map(function (t) { return t.id; }));
        renderAll();
        selectTab('arrange');
        flash('Added ' + n + ' to the arrangement');
      });
      btn('✦ Auto-arrange all', 'auto', function () { autoArrange(); });
    }
    return bar;
  }

  function renderLibrary() {
    el.library.textContent = '';
    if (!tracks.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.innerHTML = '<b>No tracks yet</b><p>Add audio files from your phone. Keylock reads the key, tempo and energy off each one, then you arrange them.</p>';
      el.library.appendChild(e);
      return;
    }
    // search
    var sb = document.createElement('div');
    sb.className = 'searchbar';
    var icon = document.createElement('span');
    icon.textContent = '⌕';
    icon.style.color = 'var(--muted)';
    sb.appendChild(icon);
    var qi = document.createElement('input');
    qi.type = 'search';
    qi.value = query;
    qi.placeholder = 'Filter by title, artist, key, BPM…';
    qi.setAttribute('aria-label', 'Filter the library');
    qi.addEventListener('input', function () {
      query = qi.value.trim();
      renderLibrary();
      var again = el.library.querySelector('.searchbar input');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
    sb.appendChild(qi);
    if (query) {
      var clr = document.createElement('button');
      clr.className = 'clr'; clr.type = 'button'; clr.textContent = '✕';
      clr.setAttribute('aria-label', 'Clear filter');
      clr.addEventListener('click', function () { query = ''; renderLibrary(); });
      sb.appendChild(clr);
    }
    el.library.appendChild(sb);

    var bar = buildLibBar();
    if (bar) el.library.appendChild(bar);

    var shown = libSorted();
    if (!shown.length) {
      var none = document.createElement('div');
      none.className = 'empty';
      none.innerHTML = '<b>Nothing matches</b><p>No track in the library matches “' +
        query.replace(/</g, '&lt;') + '”.</p>';
      el.library.appendChild(none);
      return;
    }
    shown.forEach(function (t) { el.library.appendChild(trackRow(t)); });
  }

  function renderAll() {
    renderLibrary();
    renderTimeline();
    var analysed = tracks.filter(function (t) { return t.key; }).length;
    el.count.innerHTML = tracks.length
      ? analysed + ' of ' + tracks.length + ' keyed<br>' + clips.length + ' clips · ' + fmtTime(arrangementEnd())
      : '';
  }

  // ============================================================
  //  Preview (library only)
  // ============================================================

  var playingId = null, playingBtn = null;

  function preview(id, btn) {
    var f = blobs[id];
    if (!f) return;
    if (playingId === id) { el.player.pause(); resetPlayBtn(); return; }
    resetPlayBtn();
    try {
      if (el.player.src) URL.revokeObjectURL(el.player.src);
      el.player.src = URL.createObjectURL(f);
      var t = trackById(id);
      el.player.play();
      if (t && t.durationSec) {
        el.player.addEventListener('loadedmetadata', function once() {
          el.player.removeEventListener('loadedmetadata', once);
          try { el.player.currentTime = t.durationSec * SKIP_FRAC; } catch (e) {}
        });
      }
      playingId = id; playingBtn = btn;
      btn.textContent = '■'; btn.dataset.on = '1';
    } catch (e) { /* ignore */ }
  }

  function resetPlayBtn() {
    if (playingBtn) { playingBtn.textContent = '▶'; delete playingBtn.dataset.on; }
    playingId = null; playingBtn = null;
  }
  el.player.addEventListener('ended', resetPlayBtn);
  el.player.addEventListener('pause', resetPlayBtn);

  // ============================================================
  //  Detail sheet
  // ============================================================

  var editingId = null;

  (function fillKeySelect() {
    var sel = document.getElementById('d-key');
    var none = document.createElement('option');
    none.value = ''; none.textContent = '— not set —';
    sel.appendChild(none);
    ALL_KEYS.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = k + '  ·  ' + CAMELOT_NAME[k];
      sel.appendChild(o);
    });
  })();

  function openDetail(id) {
    var t = trackById(id);
    if (!t) return;
    editingId = id;
    document.getElementById('d-heading').textContent = t.title || t.filename;
    document.getElementById('d-fname').textContent = t.filename;
    document.getElementById('d-title').value = t.title || '';
    document.getElementById('d-artist').value = t.artist || '';
    document.getElementById('d-key').value = t.key || '';
    document.getElementById('d-bpm').value = t.bpm != null ? t.bpm : '';
    document.getElementById('d-energy').value = t.energy != null ? t.energy : '';
    document.getElementById('d-genre').value = t.genre || '';

    var note = document.getElementById('d-note');
    note.className = 'note';
    if (t.key && t.keyAlt) {
      note.className = 'note warn';
      note.textContent = 'Close call between ' + t.key + ' (' + CAMELOT_NAME[t.key] + ') and ' +
        t.keyAlt + ' (' + CAMELOT_NAME[t.keyAlt] + '). Relative keys share every note, so only the ' +
        'bass separates them — worth a listen. Pick what the track resolves to.';
    } else if (t.key) {
      note.textContent = 'Detected ' + t.key + ' (' + CAMELOT_NAME[t.key] + ') at ' +
        Math.round(t.confidence * 100) + '% profile match. Under about 55% is worth checking by ear. ' +
        'Anything you set by hand is kept.';
    } else {
      note.textContent = 'No key detected. Set it by hand and the arrangement will use it.';
    }
    renderCues(t);
    drawWave(t);
    el.detail.showModal();
  }

  var SECTION_COLOR = {
    intro:     '#4A5470',
    groove:    '#3D8FB5',
    build:     '#C99A3A',
    drop:      '#D9544F',
    breakdown: '#6E5BA6',
    outro:     '#41545E'
  };

  function renderCues(t) {
    var legend = document.getElementById('d-legend');
    var cues = document.getElementById('d-cues');
    legend.textContent = '';
    cues.textContent = '';
    if (!t.sections) return;

    var kinds = [];
    t.sections.forEach(function (s) { if (kinds.indexOf(s.kind) === -1) kinds.push(s.kind); });
    kinds.forEach(function (k) {
      var span = document.createElement('span');
      var sw = document.createElement('i');
      sw.style.background = SECTION_COLOR[k] || '#3A4050';
      span.appendChild(sw);
      span.appendChild(document.createTextNode(k));
      legend.appendChild(span);
    });

    [['Mix in', t.mixInSec], ['Mix out', t.mixOutSec],
     ['Drop', t.dropSec], ['Breakdown', t.breakdownSec]].forEach(function (pair) {
      if (pair[1] == null) return;
      var d = document.createElement('div');
      var lab = document.createElement('span');
      lab.textContent = pair[0] + ' ';
      var v = document.createElement('b');
      v.textContent = fmtTime(pair[1]);
      d.appendChild(lab); d.appendChild(v);
      cues.appendChild(d);
    });
  }

  function drawWave(t) {
    var cv = document.getElementById('detail-wave');
    var g = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!t.durationSec) return;

    // section bands behind the waveform
    if (t.sections) {
      t.sections.forEach(function (sec) {
        var x0 = (sec.startSec / t.durationSec) * W;
        var x1 = (sec.endSec / t.durationSec) * W;
        g.fillStyle = (SECTION_COLOR[sec.kind] || '#3A4050');
        g.globalAlpha = 0.30;
        g.fillRect(x0, 0, Math.max(1, x1 - x0), H);
        g.globalAlpha = 1;
      });
    }

    if (t.peaks && t.peaks.length) {
      var n = t.peaks.length, bw = W / n;
      g.fillStyle = t.key ? keyColor(t.key) : '#3A4050';
      for (var i = 0; i < n; i++) {
        var bh = Math.max(2, Math.pow(t.peaks[i], 0.7) * H * 0.86);
        g.fillRect(i * bw, (H - bh) / 2, Math.max(1, bw - 1), bh);
      }
    }

    // cue markers
    function mark(tSec, color, glyph) {
      if (tSec == null) return;
      var x = (tSec / t.durationSec) * W;
      g.strokeStyle = color; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      g.fillStyle = color;
      g.font = 'bold 13px ui-monospace, monospace';
      g.fillText(glyph, Math.min(W - 16, x + 3), 13);
    }
    mark(t.mixInSec, '#4ADE80', 'IN');
    mark(t.mixOutSec, '#F87171', 'OUT');
    mark(t.dropSec, '#FBBF24', '▼');
  }

  document.getElementById('detail-form').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value !== 'save') return;
    var t = trackById(editingId);
    if (!t) return;
    t.title = document.getElementById('d-title').value.trim() || t.filename;
    t.artist = document.getElementById('d-artist').value.trim();
    t.key = document.getElementById('d-key').value || null;
    var bpmVal = parseFloat(document.getElementById('d-bpm').value);
    t.bpm = isFinite(bpmVal) ? bpmVal : null;
    var enVal = parseInt(document.getElementById('d-energy').value, 10);
    t.energy = isFinite(enVal) ? Math.max(1, Math.min(10, enVal)) : null;
    t.genre = document.getElementById('d-genre').value.trim();
    if (t.key) { t.confidence = 1; t.keyAlt = null; }
    renderAll();
    save();
  });

  // ============================================================
  //  Wiring
  // ============================================================

  function flash(msg) {
    el.ptext.textContent = msg;
    el.pcount.textContent = '';
    el.barIdle.classList.add('hidden');
    el.barBusy.classList.remove('hidden');
    el.pfill.style.width = '100%';
    setTimeout(function () {
      el.barBusy.classList.add('hidden');
      el.barIdle.classList.remove('hidden');
      el.pfill.style.width = '0%';
    }, 1700);
  }

  document.getElementById('btn-import').addEventListener('click', function () { el.input.click(); });
  el.input.addEventListener('change', function () {
    if (el.input.files && el.input.files.length) importFiles(el.input.files);
  });
  document.getElementById('btn-cancel').addEventListener('click', function () {
    if (recording) { stopBounce(); return; }
    cancelFlag = true;
  });
  document.getElementById('btn-clear').addEventListener('click', function () {
    if (!tracks.length) return;
    if (!confirm('Remove all ' + tracks.length + ' tracks and clear the arrangement?')) return;
    stopPlayback(false);
    tracks.forEach(function (t) { delBlob(t.id); });
    tracks = []; clips = []; blobs = {}; selectedClipId = null; selection = {};
    renderAll(); save();
  });

  el.playBtn.addEventListener('click', function () {
    if (playing) pausePlayback(); else startPlayback();
  });
  document.getElementById('a-stop').addEventListener('click', function () { stopPlayback(false); });
  el.bounceBtn.addEventListener('click', function () { bounce(); });
  document.getElementById('a-auto').addEventListener('click', function () { autoArrange(); });
  document.getElementById('a-undo').addEventListener('click', function () { undo(); });
  document.getElementById('a-list').addEventListener('click', function () { showSetlist(); });
  document.getElementById('sl-close').addEventListener('click', function () {
    document.getElementById('setlist').close();
  });

  var bpmInput = document.getElementById('a-bpm');
  bpmInput.addEventListener('change', function () {
    pushUndo();
    var v = parseFloat(bpmInput.value);
    mixBpm = (isFinite(v) && v >= 60 && v <= 200) ? Math.round(v * 10) / 10 : null;
    if (!isFinite(v)) bpmInput.value = '';
    if (mixBpm) clips.forEach(function (c) { alignToGrid(c); });
    stopPlayback(false);
    renderAll();
    save();
  });

  el.zoom.addEventListener('input', function () {
    pxPerSec = parseFloat(el.zoom.value);
    renderTimeline();
  });

  // Tap the ruler to move the playhead
  el.ruler.addEventListener('pointerdown', function (ev) {
    var rect = el.canvasarea.getBoundingClientRect();
    var t = Math.max(0, (ev.clientX - rect.left) / pxPerSec);
    var was = playing;
    pausePlayback();
    startedAtMix = t;
    updatePlayhead(); updateClock();
    if (was) startPlayback();
  });

  // Tapping empty timeline clears the selection
  el.lanes.addEventListener('pointerdown', function (ev) {
    if (ev.target === el.lanes || ev.target.classList.contains('lane')) {
      selectedClipId = null;
      renderTimeline();
    }
  });

  function selectTab(which) {
    var lib = which === 'library';
    el.tabLib.setAttribute('aria-selected', lib ? 'true' : 'false');
    el.tabArr.setAttribute('aria-selected', lib ? 'false' : 'true');
    el.viewLib.classList.toggle('hidden', !lib);
    el.viewArr.classList.toggle('hidden', lib);
    if (!lib) renderTimeline();
  }
  el.tabLib.addEventListener('click', function () { selectTab('library'); });
  el.tabArr.addEventListener('click', function () { selectTab('arrange'); });

  window.addEventListener('beforeunload', function () {
    if (recording) try { recorder.stop(); } catch (e) {}
  });

  load();
  renderAll();
  hydrateBlobs();
})();
