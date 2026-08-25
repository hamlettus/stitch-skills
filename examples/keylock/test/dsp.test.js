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
function build(prog,bpm,pedal){
  const buf=new Float32Array(DUR*RATE), beat=60/bpm, bar=beat*4;
  for(let b=0;b*bar<DUR;b++){ const ch=prog[b%prog.length];
    ch.forEach(m=>addNote(buf,m,b*bar,bar,0.30));
    // Either each chord's own root in the bass, or a fixed pedal note.
    addNote(buf, pedal!==undefined ? pedal : ch[0]-12, b*bar, bar, 0.46); }
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

// Same chords, but an A pedal in the bass. Note content alone cannot separate
// A minor from C major here — only the root does. This is the case the
// bass-weighting term exists for; without it the answer flips to 8B.
const PEDAL = { name:'Am-F-C-G over an A pedal', bpm:126, want:'8A', pedal:57-24,
  prog:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]] };

(async()=>{
  let pass=0;
  for (const c of cases){
    const buf = build(c.prog, c.bpm, c.pedal);
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
  if (pass !== cases.length) process.exitCode = 1;

  // The bass-root case, reported separately because it isolates one mechanism.
  console.log('\n--- bass root decides the relative pair ---');
  const pk = await detectKey(build(PEDAL.prog, PEDAL.bpm, PEDAL.pedal), RATE);
  const got = pk ? pk.code : 'null';
  const good = got === PEDAL.want;
  console.log('  '+(good?'PASS':'FAIL')+' reads as '+got+', want '+PEDAL.want+
    '   ('+PEDAL.name+')');
  // The pedal also feeds the main chroma, so the answer can land on 8A without
  // the bass term — but only marginally, and it gets flagged as a coin-flip.
  // A confident call is what the bass weighting actually buys.
  const confident = pk && !pk.relativeTie;
  console.log('  '+(confident?'PASS':'FAIL')+' called confidently, not flagged as a relative tie');
  console.log('  Identical notes to the ambiguous case above — only the pedal in');
  console.log('  the bass separates A minor from C major, and only the bass-root');
  console.log('  term makes that separation decisive.');
  if (!good || !confident) process.exitCode = 1;

  // Half-time feel: kick on 1 and 3 rather than every beat, offbeat hats.
  // The strongest periodicity is now two beats, so the reading can land an
  // octave down — folding is what returns something a DJ can read.
  console.log('\n--- half-time pattern ---');
  const SP_BPM = 140, spBeat = 60/SP_BPM;
  const sp = new Float32Array(DUR*RATE);
  for (let k=0; k*spBeat<DUR; k++){
    if (k % 2 === 0) addKick(sp, k*spBeat, 1.0);     // beats 1 and 3
    else addNote(sp, 69, k*spBeat, spBeat*0.4, 0.16); // light offbeat
  }
  for (let b=0; b*spBeat*4<DUR; b++) addNote(sp, 45, b*spBeat*4, spBeat*4, 0.30);
  const spOut = await detectBpm(sp, RATE);
  const inRange = spOut !== null && spOut >= 70 && spOut <= 180;
  // Either the beat rate or the half-time rate is a defensible reading; both
  // must come back inside the usable range rather than as 35 or 280.
  const musical = inRange && [SP_BPM, SP_BPM/2].some(function (v) {
    return Math.abs(spOut - v) < 4;
  });
  console.log('  '+(inRange?'PASS':'FAIL')+' reported '+spOut+' BPM, inside the readable 70-180 range');
  console.log('  '+(musical?'PASS':'FAIL')+' and either '+SP_BPM+' or its half-time '+(SP_BPM/2));
  if (!inRange || !musical) process.exitCode = 1;
})();
