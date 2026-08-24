// Pull the pure arrangement functions out of the app and exercise them.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname,'arrange-src.js'),'utf8');

function grab(marker){
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('not found: '+marker);
  let b = src.indexOf('{', i), d = 0, k = b;
  for(;;){ if(src[k]==='{')d++; else if(src[k]==='}')d--; if(d===0)break; k++; }
  return src.slice(i, k+1);
}

let clips = [];
const tracksById = {};
function trackById(id){ return tracksById[id] || null; }
function newId(){ return 'c'+(clips.length+1); }
function renderAll(){}
function save(){}
let selectedClipId = null;
const DEFAULT_XFADE = 12;

eval(grab('function addClip('));
eval(grab('function arrangementEnd('));
eval(grab('function sortedClips('));
eval(grab('function clipGainAt('));

// three tracks
[['t1',300],['t2',240],['t3',200]].forEach(([id,d])=>{ tracksById[id]={id,durationSec:d,key:'8A'}; });

addClip('t1'); addClip('t2'); addClip('t3');

console.log('--- placement ---');
clips.forEach((c,i)=>console.log(
  '  clip'+(i+1), 'start', c.startSec.toFixed(1), 'len', c.lengthSec.toFixed(1),
  'fadeIn', c.fadeInSec.toFixed(1), 'fadeOut', c.fadeOutSec.toFixed(1)));

let ok = true;
// each clip after the first should overlap the previous by the crossfade
for (let i=1;i<clips.length;i++){
  const prev=clips[i-1], cur=clips[i];
  const overlap = (prev.startSec+prev.lengthSec) - cur.startSec;
  const match = Math.abs(overlap - cur.fadeInSec) < 0.01;
  console.log('  overlap '+i+'->'+(i+1)+':', overlap.toFixed(1)+'s',
              'fadeIn', cur.fadeInSec.toFixed(1), match?'MATCH':'MISMATCH');
  if(!match) ok=false;
}

console.log('\n--- crossfade power stays constant? ---');
const a = clips[0], b = clips[1];
const xs = Math.max(a.startSec, b.startSec);
const xe = Math.min(a.startSec+a.lengthSec, b.startSec+b.lengthSec);
let worst = 0;
for (let s=xs; s<=xe; s+=(xe-xs)/8){
  const ga = clipGainAt(a,s), gb = clipGainAt(b,s);
  const pow = ga*ga + gb*gb;
  worst = Math.max(worst, Math.abs(pow-1));
  console.log('   t='+s.toFixed(1), 'A='+ga.toFixed(2), 'B='+gb.toFixed(2),
              'power='+pow.toFixed(3), 'dB='+(10*Math.log10(pow)).toFixed(2));
}
console.log('  worst deviation from unity:', worst.toFixed(3), worst<0.02?'(equal-power holds)':'(GAP/BUMP)');
if(worst>=0.02) ok=false;

console.log('\n--- envelope edges ---');
const checks = [
  ['before start', clipGainAt(a, a.startSec-1), 0],
  ['at start (no fade)', clipGainAt(a, a.startSec), 1],
  ['b at start (fade)',  clipGainAt(b, b.startSec), 0],
  ['mid',          clipGainAt(a, a.startSec+a.lengthSec/2), 1],
  ['past end',     clipGainAt(a, a.startSec+a.lengthSec+1), 0],
];
checks.forEach(([n,got,want])=>{
  const good = Math.abs(got-want)<0.02;
  if(!good) ok=false;
  console.log('  '+(good?'PASS':'FAIL'), n.padEnd(14), got.toFixed(2), 'want', want);
});

console.log('\n--- total length ---');
console.log('  arrangementEnd =', arrangementEnd().toFixed(1)+'s',
            '(raw sum 740s minus 2 crossfades of 12s = 716s expected)');
if (Math.abs(arrangementEnd()-716) > 0.5) ok=false;

console.log('\n' + (ok ? '  ALL ARRANGEMENT CHECKS PASS' : '  FAILURES ABOVE'));
