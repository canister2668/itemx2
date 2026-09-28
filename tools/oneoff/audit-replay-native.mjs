// Native V8 execution, not vm.Context. Raw live chats never enter the report.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
function api(source) {
  const stop=source.indexOf('\n(async () => {'); assert.ok(stop>0);
  return new Function(source.slice(0,stop)+'\nreturn {store:ITEMXStorage,core:ITEMXCore,codex:ITEMXCodex};')();
}
const sources={before:execFileSync('git',['show','f289864:dist/itemx2.plugin.js'],{encoding:'utf8',maxBuffer:4e6}),after:await readFile('dist/itemx2.plugin.js','utf8')};
const clean=value=>JSON.parse(JSON.stringify(value,(key,val)=>['updatedAt','fingerprint','rev'].includes(key)?undefined:val));
const summary={engine:process.version,execution:'native Function, no vm',benchmarks:{}};
for(const [version,source] of Object.entries(sources)) {
 const {store,core,codex}=api(source); let calls=0;
 const host={},anchor='  try {\n    await loadBadgePosition();';
 new Function('Risuai',source.replace(anchor,'Risuai.audit={footprint:itemxStorageFootprint,store:ITEMXStorage};return;'+anchor))(host);
 let footprintPersists=0;const persist=host.audit.store.persist;host.audit.store.persist=(...args)=>{footprintPersists++;return persist(...args)};
 for(const engine of [core,codex]){const original=engine.applyEvent;engine.applyEvent=(...args)=>{calls++;return original(...args)};}
 summary.benchmarks[version]=[];
 for(const size of [90,900,3000]) {
  const rows=Array.from({length:size},(_,i)=>({id:'item:r'+i,ref:'r'+i,domain:'item',messageIndex:i,messageId:'m'+i,event:i?{kind:'patch',patch:{id:'tonic',action:'consume',quantity:1,fields:{}}}:{kind:'exam',item:{id:'tonic',name:'약',count:9999,itemType:'소모품',possession:'owned',location:'inventory'}}}));
  const c={message:rows.map((r,i)=>({chatId:'m'+i,data:'<!--ITEMX2@'+r.ref+'-->'})),scriptstate:{[store.LOG]:JSON.stringify({v:1,rows})}};
  const saved=store.persist(c),hydrated=store.hydrate(saved),times=[];
  for(let i=0;i<3;i++){store.persist(hydrated);host.audit.footprint(hydrated);}
  calls=0;
  for(let i=0;i<8;i++){const start=performance.now();store.persist(hydrated);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);const folds=calls/8;
  const appended=structuredClone(saved),log=store.log(appended);log.rows.push({...rows.at(-1),id:'item:tail',ref:'tail',messageId:'tail',messageIndex:size});appended.scriptstate[store.LOG]=JSON.stringify(log);appended.message.push({chatId:'tail',data:'<!--ITEMX2@tail-->'});calls=0;store.replay(appended);const tailFolds=calls;
  calls=0;const uncached=structuredClone(saved);delete uncached.scriptstate[store.CACHE];store.replay(uncached);
  const footprintTimes=[];footprintPersists=0;
  for(let i=0;i<8;i++){const start=performance.now();host.audit.footprint(hydrated);footprintTimes.push(performance.now()-start);}
  footprintTimes.sort((a,b)=>a-b);
  summary.benchmarks[version].push({events:size,footprintMedianMs:+footprintTimes[4].toFixed(2),footprintPersistCalls:footprintPersists/8,persistMedianMs:+times[4].toFixed(2),persistFolds:folds,oneAppendFolds:tailFolds,cacheLossFolds:calls,logBytes:Buffer.byteLength(saved.scriptstate[store.LOG]),cacheBytes:Buffer.byteLength(saved.scriptstate[store.CACHE])});
 }
}
if(process.argv[2]) {
 const snapshot=JSON.parse(await readFile(process.argv[2],'utf8'));
 const converted=JSON.parse(await readFile('/volume2/risu/backups/itemx2-production/storage-20260919-074148/converted.json','utf8'));
 const {store}=api(sources.after);let oldRows=0,preserved=0,baselines=0,cacheEqual=0;const missing=[];
 for(const original of converted.chats){const current=snapshot.chats.find(c=>c.id===original.id);if(!current){missing.push(original.id);continue;}
  const old=store.log(original).rows,now=new Map(store.log(current).rows.map(row=>[row.id,row]));oldRows+=old.length;baselines+=old.filter(r=>r.domain==='baseline').length;
  for(const row of old){assert.deepEqual(now.get(row.id),row,'migrated authoritative row changed');preserved++;}
 }
 assert.equal(missing.length,0,'migrated chat missing');
 for(const c of snapshot.chats){assert.ok(c.scriptstate[store.LOG]&&c.scriptstate[store.PREFS]&&c.scriptstate[store.CACHE]);const cached=store.replay(c);const without=structuredClone(c);delete without.scriptstate[store.CACHE];const fresh=store.replay(without);
  assert.deepEqual(clean([cached.item,cached.codex,[...cached.payloads]]),clean([fresh.item,fresh.codex,[...fresh.payloads]]),'derived cache changes authoritative projection');cacheEqual++;}
 summary.live={currentChats:snapshot.chats.length,migratedChats:converted.chats.length,oldRows,preserved,baselineRows:baselines,cacheEqual,binaryMessages:snapshot.binaryMessages};
}
await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/adversarial-native.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
