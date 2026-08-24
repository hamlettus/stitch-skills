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

console.log('\n--- verdicts ---');
console.log('  '+(r1.split.misfits.length===1 && r1.split.misfits[0].id==='f' ? 'PASS':'FAIL'),
            'outlier excluded from set 1');
console.log('  '+(r1.clashes===0?'PASS':'FAIL'), 'set 1 clash-free once the misfit is out ->', r1.clashes);
console.log('  '+(r1.jumps===0?'PASS':'FAIL'), 'set 1 has no tempo jump >6% ->', r1.jumps);
console.log('  '+(r2.clashes===0?'PASS':'FAIL'), 'set 2 clash-free ->', r2.clashes);
console.log('  '+(r2.es[0]<=3?'PASS':'FAIL'), 'set 2 opens quiet ->', r2.es[0]);
console.log('  '+(r2.peakAt>=Math.floor(r2.es.length*0.4)&&r2.peakAt<r2.es.length-1?'PASS':'FAIL'),
            'set 2 peaks late-middle -> position', r2.peakAt+1);
console.log('  '+(r2.es[r2.es.length-1]<Math.max(...r2.es)?'PASS':'FAIL'),
            'set 2 comes down ->', r2.es[r2.es.length-1]);
