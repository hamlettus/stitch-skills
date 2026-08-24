
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

  /** Mono mixdown of just the analysis window, so the big buffer can go. */
  function extractWindow(buf) {
    var sr = buf.sampleRate;
    var total = buf.length;
    var want = Math.min(Math.floor(WINDOW_SEC * sr), total);
    var start = Math.floor(total * SKIP_FRAC);
    if (start + want > total) start = Math.max(0, total - want);

    var out = new Float32Array(want);
    var chans = Math.min(buf.numberOfChannels, 2);
    for (var c = 0; c < chans; c++) {
      var data = buf.getChannelData(c);
      for (var i = 0; i < want; i++) out[i] += data[start + i];
    }
    if (chans > 1) {
      for (var j = 0; j < want; j++) out[j] /= chans;
    }
    return { samples: out, sampleRate: sr, durationSec: total / sr };
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
          peaks: t.peaks ? Array.from(t.peaks).map(function (p) { return Math.round(p * 255); }) : null
        };
      })));
      localStorage.setItem(ARR_KEY, JSON.stringify(clips));
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
        if (Array.isArray(a)) clips = a;
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

    var win = extractWindow(buf);
    buf = null;                      // release before analysis allocates
    await yieldUI();

    var samples = win.samples, sr = win.sampleRate;
    var key = await detectKey(samples, sr);
    var bpm = await detectBpm(samples, sr);
    var energy = detectEnergy(samples);
    var peaks = peaksFor(samples, 300);

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
      durationSec: win.durationSec, peaks: peaks, error: null
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
        var seek = c.offsetSec + Math.max(0, t - c.startSec);
        try { v.audio.currentTime = seek; } catch (e) {}
        var p = v.audio.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        // Nudge back into sync if the element has drifted.
        var want = c.offsetSec + (t - c.startSec);
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

  function showBounced(blob) {
    var dlg = document.getElementById('bounced');
    var au = document.getElementById('b-audio');
    var link = document.getElementById('b-save');
    var url = URL.createObjectURL(blob);
    au.src = url;
    link.href = url;
    var ext = (blob.type.indexOf('mp4') !== -1) ? 'm4a' : 'webm';
    link.download = 'keylock-mix.' + ext;
    document.getElementById('b-info').textContent =
      fmtTime(arrangementEnd()) + '  ·  ' + (blob.size / 1048576).toFixed(1) + ' MB  ·  ' + blob.type;
    document.getElementById('b-note').textContent =
      'Play it back above to check the transitions. If Save file does nothing, the page is running ' +
      'in a sandboxed viewer that blocks downloads — open keylock.html directly in Safari and bounce ' +
      'there to keep the file.';
    dlg.showModal();
  }

  document.getElementById('b-close').addEventListener('click', function () {
    document.getElementById('bounced').close();
  });

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

    updatePlayhead();
    updateClock();
    renderInspector();

    el.arrEmpty.textContent = '';
    if (!clips.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.innerHTML = '<b>Nothing arranged yet</b><p>Go to Library and tap → on a track to drop it on the timeline. Each one lands crossfaded into the last.</p>';
      el.arrEmpty.appendChild(e);
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
    mbits.push(fmtTime(c.lengthSec));
    if (!blobs[c.trackId]) mbits.push('NO AUDIO');
    meta.textContent = mbits.join(' · ');
    node.appendChild(meta);

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

    // waveform slice
    if (t && t.peaks && t.peaks.length && t.durationSec) {
      g.fillStyle = 'rgba(8,9,12,0.30)';
      var n = t.peaks.length;
      for (var x = 0; x < w; x++) {
        var srcSec = c.offsetSec + (x / w) * c.lengthSec;
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
        var startX = ev.clientX;
        var orig = { start: c.startSec, off: c.offsetSec, len: c.lengthSec };
        var t = trackById(c.trackId);
        var srcDur = (t && t.durationSec) || c.lengthSec;
        node.setPointerCapture && node.setPointerCapture(ev.pointerId);

        function move(e2) {
          var d = (e2.clientX - startX) / pxPerSec;
          if (mode === 'move') {
            c.startSec = Math.max(0, orig.start + d);
          } else if (mode === 'in') {
            // Trimming the head keeps the tail put: move start and offset together.
            var maxIn = orig.len - 2;
            var dd = Math.max(-orig.off, Math.min(d, maxIn));
            c.startSec = Math.max(0, orig.start + dd);
            c.offsetSec = Math.max(0, orig.off + dd);
            c.lengthSec = Math.max(2, orig.len - dd);
          } else {
            var maxLen = srcDur - c.offsetSec;
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
      Math.max(0, ((t && t.durationSec) || c.lengthSec) - c.lengthSec), 1, 's',
      function (v) { c.offsetSec = v; }, function (v) { return fmtTime(v); }));

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
    del.addEventListener('click', function () { removeClip(c.id); });
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
      addClip(t.id);
      selectTab('arrange');
    });
    act.appendChild(add);

    row.appendChild(act);
    return row;
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
    tracks.slice().sort(function (a, b) {
      var ka = a.key ? parseInt(a.key, 10) * 2 + (a.key.slice(-1) === 'B' ? 1 : 0) : 999;
      var kb = b.key ? parseInt(b.key, 10) * 2 + (b.key.slice(-1) === 'B' ? 1 : 0) : 999;
      return ka - kb;
    }).forEach(function (t) { el.library.appendChild(trackRow(t)); });
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
    drawWave(t);
    el.detail.showModal();
  }

  function drawWave(t) {
    var cv = document.getElementById('detail-wave');
    var g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if (!t.peaks || !t.peaks.length) return;
    var n = t.peaks.length, bw = cv.width / n;
    g.fillStyle = t.key ? keyColor(t.key) : '#3A4050';
    for (var i = 0; i < n; i++) {
      var bh = Math.max(2, Math.pow(t.peaks[i], 0.7) * cv.height * 0.92);
      g.fillRect(i * bw, (cv.height - bh) / 2, Math.max(1, bw - 1), bh);
    }
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
    tracks = []; clips = []; blobs = {}; selectedClipId = null;
    renderAll(); save();
  });

  el.playBtn.addEventListener('click', function () {
    if (playing) pausePlayback(); else startPlayback();
  });
  document.getElementById('a-stop').addEventListener('click', function () { stopPlayback(false); });
  el.bounceBtn.addEventListener('click', function () { bounce(); });

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
