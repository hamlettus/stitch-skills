var FRAME_SEC = 0.25;

var SMOOTH_SEC = 4;

var MIN_SECTION_SEC = 8;

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

function snapToBar(tSec, bpm, phase) {
    if (!bpm) return tSec;
    var bar = (60 / bpm) * 4;
    var n = Math.round((tSec - phase) / bar);
    return Math.max(0, phase + n * bar);
  }

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

module.exports={analyseStructure};
