// Tempo matching + beat-grid alignment, pulled out of keylock.html.
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'arrange-src.js'),'utf8');
function grab(m){
  const i=src.indexOf(m); if(i<0) throw new Error('missing '+m);
  let b=src.indexOf('{',i),d=0,k=b;
  for(;;){ if(src[k]==='{')d++; else if(src[k]==='}')d--; if(d===0)break; k++; }
  return src.slice(i,k+1);
}
// Line-scoped: these declarations end with a trailing comment, not a newline.
function line(m){ const i=src.indexOf(m); return src.slice(i, src.indexOf('\n',i)); }

const tracksById={};
function trackById(id){return tracksById[id]||null;}
eval(line('var MAX_STRETCH'));
eval(line('var mixBpm'));
eval(grab('function clipRate('));
eval(grab('function clipUnmatched('));
eval(grab('function clipSourceSpan('));
eval(grab('function alignToGrid('));
eval(grab('function medianBpm('));

tracksById.t124={id:'t124',bpm:124,beatPhase:0.31,durationSec:360};
tracksById.t128={id:'t128',bpm:128,beatPhase:1.07,durationSec:340};
tracksById.t145={id:'t145',bpm:145,beatPhase:0.00,durationSec:300};

let ok=true;
function check(cond,label,detail){ if(!cond)ok=false;
  console.log('  '+(cond?'PASS':'FAIL'),label,detail!==undefined?'-> '+detail:''); }

console.log('--- mix tempo off ---');
mixBpm=null;
check(clipRate({trackId:'t124'})===1,'rate is 1 with tempo off');

console.log('\n--- mix tempo 126 ---');
mixBpm=126;
const r124=clipRate({trackId:'t124'}), r128=clipRate({trackId:'t128'});
check(Math.abs(r124-126/124)<1e-9,'124 BPM track stretches to 126', '+'+((r124-1)*100).toFixed(2)+'%');
check(Math.abs(r128-126/128)<1e-9,'128 BPM track slows to 126', ((r128-1)*100).toFixed(2)+'%');
check(clipRate({trackId:'t145'})===1,'145 BPM is past ±8%, left alone', 'rate '+clipRate({trackId:'t145'}));
check(clipUnmatched({trackId:'t145'})===true,'and flagged off-tempo');
check(clipUnmatched({trackId:'t124'})===false,'124 is not flagged');

console.log('\n--- source span vs timeline length ---');
const c={trackId:'t124',startSec:0,offsetSec:0,lengthSec:100};
const span=clipSourceSpan(c);
check(Math.abs(span-100*r124)<1e-6,'100s of timeline eats 100*rate of source',
      span.toFixed(2)+'s source');
check(span>100,'sped-up clip consumes more source than timeline');

console.log('\n--- beat-grid alignment ---');
const mixBar=(60/mixBpm)*4;
console.log('  mix bar =',mixBar.toFixed(4)+'s');

[['t124',0,0],['t124',37.4,90],['t128',12.9,213.77],['t128',0,5.5]].forEach(([id,off,start])=>{
  const t=tracksById[id];
  const clip={trackId:id,startSec:start,offsetSec:off,lengthSec:120};
  const before=clip.startSec;
  alignToGrid(clip);
  const rate=clipRate(clip);
  const srcBar=(60/t.bpm)*4;
  const phase=t.beatPhase;
  // where the nearest source downbeat now lands in mix time
  let db=phase+Math.round((clip.offsetSec-phase)/srcBar)*srcBar;
  if(db<0) db+=srcBar;
  const atMix=clip.startSec+(db-clip.offsetSec)/rate;
  const offGrid=Math.abs(atMix-Math.round(atMix/mixBar)*mixBar);
  const moved=Math.abs(clip.startSec-before);
  check(offGrid<0.002, id+' @'+start+'s downbeat lands on the grid',
        'off by '+(offGrid*1000).toFixed(2)+'ms, nudged '+moved.toFixed(3)+'s');
  // Normally under half a bar. A clip at the very start is the exception:
  // nudging back would go negative, so it steps a full bar forward instead.
  const limit = (before < mixBar) ? mixBar+0.001 : mixBar/2+0.001;
  check(moved<=limit, '  nudge within '+(before<mixBar?'a bar (start-of-mix case)':'half a bar'),
        moved.toFixed(3)+'s');
});

console.log('\n--- two clips share one grid ---');
const a={trackId:'t124',startSec:0,offsetSec:30,lengthSec:180};
const b={trackId:'t128',startSec:160,offsetSec:24,lengthSec:180};
alignToGrid(a); alignToGrid(b);
function dbMix(c){
  const t=trackById(c.trackId), rate=clipRate(c), srcBar=(60/t.bpm)*4;
  let db=t.beatPhase+Math.round((c.offsetSec-t.beatPhase)/srcBar)*srcBar;
  if(db<0) db+=srcBar;
  return c.startSec+(db-c.offsetSec)/rate;
}
const da=dbMix(a), dbb=dbMix(b);
const diff=Math.abs(da-dbb);
const bars=diff/mixBar;
check(Math.abs(bars-Math.round(bars))<0.005,
      'both downbeats sit a whole number of bars apart',
      bars.toFixed(4)+' bars');

console.log('\n--- median tempo ---');
check(medianBpm([{bpm:124},{bpm:126},{bpm:128}])===126,'median of 124/126/128',
      medianBpm([{bpm:124},{bpm:126},{bpm:128}]));
check(medianBpm([{bpm:null},{bpm:130}])===130,'ignores missing BPM');
check(medianBpm([])===null,'null on empty');

console.log('\n  '+(ok?'ALL TEMPO CHECKS PASS':'FAILURES ABOVE'));

if (!ok) process.exitCode = 1;
