const { detectKey, detectBpm } = require('./dsp.js');
const RATE = 11025, DUR = 60;
const midiHz = m => 440*Math.pow(2,(m-69)/12);

function addNote(buf,midi,st,dur,amp){
  const s0=Math.floor(st*RATE), n=Math.floor(dur*RATE), f=midiHz(midi);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=buf.length)break;
    const t=i/RATE, env=Math.min(1,t*40)*Math.exp(-t*1.1); let v=0;
    for(let h=1;h<=5;h++) v+=Math.sin(2*Math.PI*f*h*t)/(h*h);
    buf[x]+=v*env*amp; }
}
function addKick(buf,at){
  const s0=Math.floor(at*RATE), n=Math.floor(0.13*RATE);
  for(let i=0;i<n;i++){ const x=s0+i; if(x>=buf.length)break; const t=i/RATE;
    buf[x]+=Math.sin(2*Math.PI*(110*Math.exp(-t*38)+45)*t)*Math.exp(-t*24)*0.95; }
}
function build(prog,bpm){
  const buf=new Float32Array(DUR*RATE), beat=60/bpm, bar=beat*4;
  for(let b=0;b*bar<DUR;b++){ const ch=prog[b%prog.length];
    ch.forEach(m=>addNote(buf,m,b*bar,bar,0.30));
    addNote(buf,ch[0]-12,b*bar,bar,0.42); }   // bass root
  for(let k=0;k*beat<DUR;k++) addKick(buf,k*beat);
  return buf;
}

const cases = [
  // Am - Dm - E - Am : the E major has G#, which is not in C major.
  { name:'A minor (harmonic, w/ E maj)', bpm:126, want:'8A',
    prog:[[57,60,64],[50,53,57],[52,56,59],[57,60,64]] },
  // C - F - G - C : plainly major
  { name:'C major',                      bpm:174, want:'8B',
    prog:[[48,52,55],[53,57,60],[55,59,62],[48,52,55]] },
  // F minor : Fm - Bbm - C - Fm
  { name:'F minor',                      bpm:124, want:'4A',
    prog:[[53,56,60],[58,61,65],[48,52,55],[53,56,60]] },
  // G major : G - C - D - G
  { name:'G major',                      bpm:140, want:'9B',
    prog:[[55,59,62],[48,52,55],[50,54,57],[55,59,62]] },
  // Genuinely ambiguous: Am-F-C-G shares all notes with C major
  { name:'Am-F-C-G (ambiguous)',         bpm:128, want:'8A|8B',
    prog:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]] },
];

(async()=>{
  let pass=0;
  for (const c of cases){
    const buf = build(c.prog, c.bpm);
    const k = await detectKey(buf, RATE);
    const b = await detectBpm(buf, RATE);
    const got = k?k.code:'null';
    const ok = c.want.split('|').includes(got);
    const bok = b && Math.abs(b-c.bpm) < 3;
    if(ok) pass++;
    console.log(
      (ok?'  PASS':'  FAIL'), c.name.padEnd(30),
      'key', String(got).padEnd(4), 'want', c.want.padEnd(8),
      '| bpm', String(b).padEnd(6), (bok?'ok':'OFF(want '+c.bpm+')'),
      k&&k.relativeTie?'| relative-tie':''
    );
  }
  console.log('\n  key: '+pass+'/'+cases.length+' correct');
})();
