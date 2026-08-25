const { analyseStructure } = require('./structure.js');
const RATE = 11025, BPM = 128, beat = 60/BPM;

// Build a track with a structure we know exactly:
//   0-32s    intro     drums only, no bass
//   32-64s   groove    bass in, medium
//   64-96s   drop      bass + full energy
//   96-128s  breakdown bass OUT, pads only
//   128-176s drop 2    bass + full energy
//   176-208s outro     drums thinning, no bass
const PLAN = [
  { from:0,   to:32,  kind:'intro',     bass:0,    energy:0.35 },
  { from:32,  to:64,  kind:'groove',    bass:0.75, energy:0.62 },
  { from:64,  to:96,  kind:'drop',      bass:1.0,  energy:1.0  },
  { from:96,  to:128, kind:'breakdown', bass:0,    energy:0.42 },
  { from:128, to:176, kind:'drop',      bass:1.0,  energy:1.0  },
  { from:176, to:208, kind:'outro',     bass:0,    energy:0.30 },
];
const DUR = 208;
const buf = new Float32Array(DUR*RATE);

function kick(at, amp){
  const s0=Math.floor(at*RATE), n=Math.floor(0.16*RATE);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=buf.length)break; const t=i/RATE;
    buf[x]+=Math.sin(2*Math.PI*(105*Math.exp(-t*36)+48)*t)*Math.exp(-t*20)*amp; }
}
function hat(at, amp){
  const s0=Math.floor(at*RATE), n=Math.floor(0.04*RATE);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=buf.length)break;
    buf[x]+=(Math.random()*2-1)*Math.exp(-(i/RATE)*90)*amp; }
}
function pad(from,to,amp){
  const s0=Math.floor(from*RATE), n=Math.floor((to-from)*RATE);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=buf.length)break; const t=i/RATE;
    // mid-range chord, deliberately no low content
    buf[x]+=(Math.sin(2*Math.PI*440*t)+Math.sin(2*Math.PI*554*t))*0.5*amp; }
}

PLAN.forEach(sec=>{
  pad(sec.from, sec.to, 0.22*sec.energy);
  for(let t=sec.from; t<sec.to; t+=beat){
    if (sec.bass>0) kick(t, 0.95*sec.bass);       // kick carries the low end
    hat(t+beat/2, 0.12*sec.energy);
  }
});

const res = analyseStructure(buf, RATE, BPM);
if(!res){ console.log('NULL result'); process.exit(1); }

console.log('--- detected sections ---');
res.sections.forEach(s=>console.log(
  '  '+String(Math.round(s.startSec)).padStart(4)+'s -'+
  String(Math.round(s.endSec)).padStart(5)+'s  '+s.kind.padEnd(11)+' energy '+s.energy));

console.log('\n--- vs plan ---');
let hits=0;
PLAN.forEach(p=>{
  const mid=(p.from+p.to)/2;
  const got=res.sections.find(s=>mid>=s.startSec&&mid<s.endSec);
  const ok = got && got.kind===p.kind;
  if(ok)hits++;
  console.log('  '+(ok?'PASS':'FAIL'), String(p.from).padStart(3)+'-'+String(p.to).padEnd(4),
              'want', p.kind.padEnd(11), 'got', got?got.kind:'(none)');
});

console.log('\n--- cue points ---');
console.log('  mixIn     ', res.mixInSec+'s', '(want ~32 — end of the bass-less intro)');
console.log('  mixOut    ', res.mixOutSec+'s', '(want ~176 — start of the outro)');
console.log('  drop      ', res.dropSec+'s', '(want 64 or 128)');
console.log('  breakdown ', res.breakdownSec+'s', '(want ~96)');

// Two independent checks: cues must land ON the bar grid, and near the right
// place. The grid check alone misses a whole-bar offset; position alone misses
// a cue that drifts off the beat.
const bar = (60/BPM)*4;
let snapOk = true;
console.log('\n--- cues sit on the bar grid ---');
console.log('  bar = '+bar.toFixed(4)+'s, detected beat phase = '+res.beatPhase+'s');
[['mixIn',res.mixInSec],['mixOut',res.mixOutSec],
 ['drop',res.dropSec],['breakdown',res.breakdownSec]].forEach(([name,t])=>{
  if(t==null) return;
  const bars=(t-res.beatPhase)/bar;
  const off=Math.abs(bars-Math.round(bars))*bar;
  // cue times are stored rounded to 0.1s, so allow that plus a hair
  const good=off<=0.06;
  if(!good) snapOk=false;
  console.log('  '+(good?'PASS':'FAIL')+' '+name.padEnd(10)+t+'s  = '+
    bars.toFixed(3)+' bars from phase, off grid by '+(off*1000).toFixed(0)+'ms');
});

// Two bars is the tolerance that means something: a cue a bar out is still
// usable, three bars out is wrong. Anything looser lets a snapping bug through.
const TOL = bar * 2;
let cueOk = true;
console.log('\n--- cue accuracy (tolerance '+TOL.toFixed(2)+'s = 2 bars) ---');
[['mixIn', res.mixInSec, [32]],
 ['mixOut', res.mixOutSec, [176]],
 ['drop', res.dropSec, [64,128]],
 ['breakdown', res.breakdownSec, [96]]].forEach(([name,got,wants])=>{
  const best = got==null ? Infinity : Math.min(...wants.map(w=>Math.abs(got-w)));
  const good = best <= TOL;
  if(!good) cueOk = false;
  console.log('  '+(good?'PASS':'FAIL')+' '+name.padEnd(10)+
    (got==null?'(none)':got+'s')+'  want '+wants.join(' or ')+
    '  off by '+(best===Infinity?'-':best.toFixed(2)+'s'));
});

// ---------------------------------------------------------------
// Second track: a section that stays LOUD but drops its bass.
// Energy alone cannot see this — it is exactly why the detector tracks a
// low band separately. Busy mids and highs, no low end.
// ---------------------------------------------------------------
const b2 = new Float32Array(DUR*RATE);
const PLAN2 = [
  { from:0,   to:40,  kind:'intro',     bass:0,   energy:0.35 },
  { from:40,  to:100, kind:'drop',      bass:1.0, energy:1.0  },
  { from:100, to:150, kind:'breakdown', bass:0,   energy:0.95 },  // loud, no bass
  { from:150, to:208, kind:'drop',      bass:1.0, energy:1.0  },
];
function kick2(at, amp){
  const s0=Math.floor(at*RATE), n=Math.floor(0.16*RATE);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=b2.length)break; const t=i/RATE;
    b2[x]+=Math.sin(2*Math.PI*(105*Math.exp(-t*36)+48)*t)*Math.exp(-t*20)*amp; }
}
PLAN2.forEach(sec=>{
  const s0=Math.floor(sec.from*RATE), n=Math.floor((sec.to-sec.from)*RATE);
  // Dense upper-register content carries the energy in every section.
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=b2.length)break; const t=i/RATE;
    b2[x]+=(Math.sin(2*Math.PI*440*t)+Math.sin(2*Math.PI*660*t)+
            Math.sin(2*Math.PI*880*t))*0.30*sec.energy; }
  for(let t=sec.from;t<sec.to;t+=beat){
    if(sec.bass>0) kick2(t, 0.95*sec.bass);
    hat(t+beat/2, 0.14*sec.energy);
  }
});

const res2 = analyseStructure(b2, RATE, BPM);
console.log('\n=== second track: loud breakdown with no bass ===');
let hits2 = 0;
if (res2) {
  res2.sections.forEach(s=>console.log(
    '  '+String(Math.round(s.startSec)).padStart(4)+'s -'+
    String(Math.round(s.endSec)).padStart(5)+'s  '+s.kind.padEnd(11)+' energy '+s.energy));
  console.log('');
  PLAN2.forEach(p=>{
    const mid=(p.from+p.to)/2;
    const got=res2.sections.find(s=>mid>=s.startSec&&mid<s.endSec);
    const ok = got && got.kind===p.kind;
    if(ok)hits2++;
    console.log('  '+(ok?'PASS':'FAIL'), String(p.from).padStart(3)+'-'+String(p.to).padEnd(4),
                'want', p.kind.padEnd(11), 'got', got?got.kind:'(none)');
  });
  console.log('  The 100-150s section is as loud as the drops around it.');
  console.log('  Only the missing low end marks it as a breakdown.');
} else {
  console.log('  FAIL analyseStructure returned null');
}

console.log('\n  track 1: sections '+hits+'/'+PLAN.length+' | cues '+(cueOk?'PASS':'FAIL')+
            ' | grid '+(snapOk?'PASS':'FAIL'));
console.log('  track 2: sections '+hits2+'/'+PLAN2.length);
if (hits !== PLAN.length || !cueOk || !snapOk || hits2 !== PLAN2.length) process.exitCode = 1;
