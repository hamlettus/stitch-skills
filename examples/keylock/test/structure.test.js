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

const cueOk =
  Math.abs(res.mixInSec-32)<8 &&
  Math.abs(res.mixOutSec-176)<10 &&
  res.dropSec!==null && (Math.abs(res.dropSec-64)<8 || Math.abs(res.dropSec-128)<8) &&
  res.breakdownSec!==null && Math.abs(res.breakdownSec-96)<10;

console.log('\n  sections '+hits+'/'+PLAN.length+' | cues '+(cueOk?'PASS':'FAIL'));
