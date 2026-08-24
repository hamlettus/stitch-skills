var MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];

var MINOR_CAMELOT = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

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

var PROF_MAJ = [0.238,0.006,0.111,0.006,0.137,0.094,0.016,0.214,0.009,0.080,0.008,0.081];

var PROF_MIN = [0.220,0.006,0.104,0.123,0.019,0.103,0.012,0.214,0.062,0.022,0.061,0.052];

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

module.exports={detectKey,detectBpm,detectEnergy};
