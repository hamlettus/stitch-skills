const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'arrange-src.js'),'utf8');
function grab(m){
  const i=src.indexOf(m); if(i<0) throw new Error('missing '+m);
  let b=src.indexOf('{',i),d=0,k=b;
  for(;;){ if(src[k]==='{')d++; else if(src[k]==='}')d--; if(d===0)break; k++; }
  return src.slice(i,k+1);
}
function stmt(m){ const i=src.indexOf(m); return src.slice(i, src.indexOf(';\n',i)+1); }

let clips=[]; const tracksById={}; let selectedClipId=null;
function trackById(id){return tracksById[id]||null;}
let idc=0; function newId(){return 'c'+(++idc);}
function renderAll(){} function save(){}
eval(stmt('var MAJOR_CAMELOT')); eval(stmt('var MINOR_CAMELOT'));
eval(grab('function relation(')); eval(grab('function clampXfade(')); eval(grab('function crossfadeFor('));
eval(grab('function addClips(')); eval(grab('function clipsForTrack('));
eval(grab('function arrangementEnd(')); eval(grab('function clipGainAt('));

// three tracks with cue points: 30s intro, body, outro at 240s
[['t1','8A',124,300,30,240],['t2','9A',125,280,24,220],['t3','9A',126,320,32,260]]
  .forEach(([id,key,bpm,dur,mi,mo])=>{
    tracksById[id]={id,key,bpm,durationSec:dur,mixInSec:mi,mixOutSec:mo,energy:5};
  });

const n = addClips(['t1','t2','t3']);
console.log('--- bulk add ---');
console.log('  added', n, 'clips\n');
clips.forEach((c,i)=>{
  const t=trackById(c.trackId);
  console.log('  '+(i+1)+'. start '+c.startSec.toFixed(1).padStart(7)+
    '  offset '+c.offsetSec.toFixed(1).padStart(6)+
    '  len '+c.lengthSec.toFixed(1).padStart(6)+
    '  fadeIn '+c.fadeInSec.toFixed(1).padStart(5)+
    '  fadeOut '+c.fadeOutSec.toFixed(1).padStart(5)+
    '   (cues '+t.mixInSec+'-'+t.mixOutSec+')');
});

let ok=true;
console.log('\n--- checks ---');

// no gaps: each clip must start before the previous one ends
for(let i=1;i<clips.length;i++){
  const prevEnd=clips[i-1].startSec+clips[i-1].lengthSec;
  const gap=clips[i].startSec-prevEnd;
  const good=gap<0;
  if(!good)ok=false;
  console.log('  '+(good?'PASS':'FAIL'),'clip'+(i+1)+' overlaps clip'+i,
              '-> overlap '+(-gap).toFixed(1)+'s');
}

// the mix-in cue should land at or after the incoming fade completes
clips.forEach((c,i)=>{
  if(i===0)return;
  const t=trackById(c.trackId);
  const cueAtMixTime = c.startSec + (t.mixInSec - c.offsetSec);
  const fadeDone = c.startSec + c.fadeInSec;
  const good = cueAtMixTime >= fadeDone - 0.5;
  if(!good)ok=false;
  console.log('  '+(good?'PASS':'FAIL'),'clip'+(i+1)+' fade completes by its mix-in cue',
              '-> fade ends '+fadeDone.toFixed(1)+'s, cue at '+cueAtMixTime.toFixed(1)+'s');
});

// clips must stay inside their source
clips.forEach((c,i)=>{
  const t=trackById(c.trackId);
  const good=c.offsetSec>=0 && c.offsetSec+c.lengthSec<=t.durationSec+0.01;
  if(!good)ok=false;
  console.log('  '+(good?'PASS':'FAIL'),'clip'+(i+1)+' inside source',
              '-> '+c.offsetSec.toFixed(1)+'+'+c.lengthSec.toFixed(1)+' <= '+t.durationSec);
});

// equal-power still holds across a bulk-added seam
const a=clips[0],b=clips[1];
const xs=Math.max(a.startSec,b.startSec), xe=Math.min(a.startSec+a.lengthSec,b.startSec+b.lengthSec);
let worst=0;
for(let x=xs;x<=xe;x+=(xe-xs)/6){
  const p=clipGainAt(a,x)**2+clipGainAt(b,x)**2;
  worst=Math.max(worst,Math.abs(p-1));
}
const powOk=worst<0.02; if(!powOk)ok=false;
console.log('  '+(powOk?'PASS':'FAIL'),'equal-power across the seam -> worst dev '+worst.toFixed(3));

// clipsForTrack reports correctly
const cft = clipsForTrack('t2')===1; if(!cft)ok=false;
console.log('  '+(cft?'PASS':'FAIL'),'clipsForTrack("t2") -> '+clipsForTrack('t2'));

console.log('\n  total '+arrangementEnd().toFixed(0)+'s');
console.log('  '+(ok?'ALL BULK-ADD CHECKS PASS':'FAILURES ABOVE'));
