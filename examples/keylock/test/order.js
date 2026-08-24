var MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];

var MINOR_CAMELOT = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

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

var ARC_WEIGHT = 3.2;

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

function crossfadeFor(a, b) {
    var bpm = (a && a.bpm) || (b && b.bpm) || 124;
    var bar = (60 / bpm) * 4;
    var bars = 16;
    var rel = relation(a && a.key, b && b.key);
    if (rel.label === 'clash') bars = 4;            // get out fast
    else if (rel.label === '2 steps') bars = 8;
    return Math.max(4, Math.min(48, bar * bars));
  }

module.exports={orderTracks,relation,crossfadeFor,splitMisfits};
