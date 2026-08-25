const { orderTracks, relation, crossfadeFor, splitMisfits } = require('./order.js');

function run(name, pool){
  const split = splitMisfits(pool);
  const order = orderTracks(split.core);
  console.log('\n=== '+name+' ===');
  order.forEach((t,i)=>{
    let seam='';
    if(i>0){
      const p=order[i-1], r=relation(p.key,t.key);
      const pct=((t.bpm-p.bpm)/p.bpm*100).toFixed(1);
      seam='   <- '+r.label.padEnd(11)+(pct>=0?'+':'')+pct+'%  xfade '+crossfadeFor(p,t).toFixed(0)+'s';
    }
    console.log('  '+(i+1)+'. '+t.title.padEnd(13)+t.key.padEnd(4)+String(t.bpm).padEnd(5)+'E'+t.energy+seam);
  });
  if(split.misfits.length)
    console.log('  left out: '+split.misfits.map(m=>m.title+' ('+m.key+' '+m.bpm+')').join(', '));

  const es=order.map(t=>t.energy);
  const clashes=order.slice(1).filter((t,i)=>relation(order[i].key,t.key).label==='clash').length;
  const jumps=order.slice(1).filter((t,i)=>Math.abs((t.bpm-order[i].bpm)/order[i].bpm*100)>6).length;
  const peakAt=es.indexOf(Math.max(...es));
  console.log('  arc:', es.join('->'), '| clashes', clashes, '| tempo jumps>6%', jumps,
              '| peak at', (peakAt+1)+'/'+es.length);
  return {order,split,clashes,jumps,es,peakAt};
}

const r1 = run('scrambled crate with one outlier', [
  { id:'a', title:'Peak Hitter',  key:'9A',  bpm:128, energy:9 },
  { id:'b', title:'Opener',       key:'8A',  bpm:124, energy:3 },
  { id:'c', title:'Warm Up',      key:'8B',  bpm:125, energy:5 },
  { id:'d', title:'Closer',       key:'10A', bpm:127, energy:4 },
  { id:'e', title:'Builder',      key:'9A',  bpm:126, energy:7 },
  { id:'f', title:'Odd One Out',  key:'3B',  bpm:145, energy:8 },
]);

const r2 = run('coherent crate, no outliers', [
  { id:'1', title:'Low',   key:'8A',  bpm:124, energy:2 },
  { id:'2', title:'Rise',  key:'9A',  bpm:125, energy:4 },
  { id:'3', title:'Mid',   key:'9A',  bpm:126, energy:6 },
  { id:'4', title:'Peak',  key:'10A', bpm:127, energy:9 },
  { id:'5', title:'Ease',  key:'10A', bpm:126, energy:7 },
  { id:'6', title:'Land',  key:'11A', bpm:125, energy:4 },
]);

// Two crates that isolate single scoring terms.
const r3 = run('tempo proximity decides (both candidates 9A)', [
  { id:'x', title:'Anchor',    key:'8A', bpm:126, energy:4 },
  { id:'y', title:'Near BPM',  key:'9A', bpm:127, energy:6 },
  { id:'z', title:'Far BPM',   key:'9A', bpm:133, energy:7 },
]);

// A key chain 8A-9A-10A-11A, listed middle-first. Greedy anchored to the first
// element strands itself; trying several seeds walks the chain cleanly.
const r4 = run('seed choice decides (chain listed middle-first)', [
  { id:'m', title:'Middle',  key:'10A', bpm:126, energy:6 },
  { id:'n', title:'Upper',   key:'11A', bpm:127, energy:8 },
  { id:'o', title:'Lower',   key:'9A',  bpm:125, energy:4 },
  { id:'p', title:'Lowest',  key:'8A',  bpm:124, energy:2 },
]);

// A ten-track crate whose keys form one long Camelot path, listed scrambled.
// Small crates get rescued by the 2-opt pass; at this size the starting seed
// genuinely decides whether the walk comes out clean.
const r5 = run('ten-track chain, scrambled', [
  { id:'k5', title:'Five',  key:'12A', bpm:127, energy:9 },
  { id:'k1', title:'One',   key:'8A',  bpm:124, energy:2 },
  { id:'k8', title:'Eight', key:'3A',  bpm:125, energy:4 },
  { id:'k3', title:'Three', key:'10A', bpm:126, energy:6 },
  { id:'k9', title:'Nine',  key:'4A',  bpm:124, energy:3 },
  { id:'k6', title:'Six',   key:'1A',  bpm:127, energy:8 },
  { id:'k2', title:'Two',   key:'9A',  bpm:125, energy:4 },
  { id:'k10',title:'Ten',   key:'5A',  bpm:124, energy:2 },
  { id:'k4', title:'Four',  key:'11A', bpm:127, energy:8 },
  { id:'k7', title:'Seven', key:'2A',  bpm:126, energy:6 },
]);

console.log('\n--- verdicts ---');
let allOk = true;
const V = (cond, label, detail) => {
  if (!cond) allOk = false;
  console.log('  '+(cond?'PASS':'FAIL'), label, detail!==undefined?String(detail):'');
};
V(r1.split.misfits.length===1 && r1.split.misfits[0].id==='f',
  'outlier excluded from set 1');
V((r1.clashes===0), 'set 1 clash-free once the misfit is out ->', r1.clashes);
V((r1.jumps===0), 'set 1 has no tempo jump >6% ->', r1.jumps);
V((r2.clashes===0), 'set 2 clash-free ->', r2.clashes);
V((r2.es[0]<=3), 'set 2 opens quiet ->', r2.es[0]);
V((r2.peakAt>=Math.floor(r2.es.length*0.4)&&r2.peakAt<r2.es.length-1), 'set 2 peaks late-middle -> position', r2.peakAt+1);
V((r2.es[r2.es.length-1]<Math.max(...r2.es)), 'set 2 comes down ->', r2.es[r2.es.length-1]);

// r3 isolates the tempo term: both candidates are 9A, so only BPM proximity
// can decide which follows the anchor.
const ai = r3.order.findIndex(t=>t.id==='x');
const afterAnchor = r3.order[ai+1];
V(afterAnchor && afterAnchor.id === 'y',
  'closer tempo follows the anchor (127 not 133)',
  afterAnchor ? afterAnchor.title+' @'+afterAnchor.bpm : '(anchor placed last)');

// r4 isolates seed choice: the crate is a key chain listed middle-first, so a
// greedy anchored to element 0 strands itself and leaves a rough seam.
const rough = r4.order.slice(1).filter((t,i)=>{
  const l = relation(r4.order[i].key, t.key).label;
  return l === 'clash' || l === '2 steps';
}).length;
V(rough === 0, 'key chain walked end to end, no rough seam ->', rough+' rough seams');

// Every key here has a neighbour, so a clean walk exists; finding it is the test.
const rough5 = r5.order.slice(1).filter((t,i)=>{
  const l = relation(r5.order[i].key, t.key).label;
  return l === 'clash' || l === '2 steps';
}).length;
V(rough5 === 0, 'ten-track chain walked without a rough seam ->', rough5+' rough seams');
V(r5.jumps === 0, 'ten-track chain has no tempo jump >6% ->', r5.jumps);

if (!allOk) process.exitCode = 1;
