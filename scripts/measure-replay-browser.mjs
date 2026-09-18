import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const anchor='  try {\n    await loadBadgePosition();';
const sources={before:execFileSync('git',['show','b4fe1c2:dist/itemx2.plugin.js'],{maxBuffer:4e6,encoding:'utf8'}),after:await readFile(new URL('../dist/itemx2.plugin.js',import.meta.url),'utf8')};
for(const key of Object.keys(sources)){
  if(!sources[key].includes(anchor))throw Error('bootstrap anchor missing');
  sources[key]=sources[key].replace(anchor,`let calls=0;for(const engine of [ITEMXCore,ITEMXCodex]){const original=engine.applyEvent;engine.applyEvent=(...args)=>{calls++;return original(...args)}};globalThis.benchAPI={core:ITEMXCore,store:ITEMXStorage,reset:()=>{calls=0},count:()=>calls};return;${anchor}`);
}
const script=`const {chromium}=require('playwright-core');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();console.log(JSON.stringify(await page.evaluate(async sources=>{
const result={engine:navigator.userAgent,fixture:{messages:3000,events:900},measurements:{}};let reference;
for(const [name,source] of Object.entries(sources)){
const frame=document.createElement('iframe');document.body.append(frame);frame.contentWindow.Risuai={};frame.contentWindow.eval(source);const {core,store,reset,count}=frame.contentWindow.benchAPI;
const item=core.normalizeItem({id:'tonic',name:'장기 채팅 검증 약',count:9999,rarity:'legendary'}).item;
const rows=Array.from({length:900},(_,i)=>({id:'item:i'+(i*3).toString(36)+'_0_sample'+i,ref:'i'+(i*3).toString(36)+'_0_sample'+i,domain:'item',messageId:'m'+i*3,messageIndex:i*3,offset:0,ordinal:0,code:'sample'+i,event:i?{kind:'patch',patch:{id:'tonic',action:'consume',quantity:1,fields:{}}}:{kind:'exam',item}}));
const fixture={message:Array.from({length:3000},(_,i)=>({chatId:'m'+i,data:i%3===0&&i/3<rows.length?'<!--ITEMX2@'+rows[i/3].ref+'-->':'장기 채팅의 일반 서술.'})),scriptstate:{'itemx:log':JSON.stringify({v:1,rows})}};
const saved=store.persist(fixture),appended=structuredClone(saved),doc=store.log(appended);doc.rows.push({...rows.at(-1),id:'item:new',ref:'new',messageId:'m3000',messageIndex:3000});appended.message.push({chatId:'m3000',data:'<!--ITEMX2@new-->'});appended.scriptstate[store.LOG]=JSON.stringify(doc);
const samples={};
for(const [scenario,chat] of [['unchanged',saved],['oneAppend',appended],['cacheLoss',{...saved,scriptstate:{...saved.scriptstate,[store.CACHE]:'{broken'}}]] ){
 const times=[],calls=[];for(let i=0;i<12;i++){reset();const start=performance.now();const projected=store.replay(store.hydrate(chat));times.push(performance.now()-start);calls.push(count());if(scenario==='unchanged'){const plain=JSON.stringify([projected.item,projected.codex,[...projected.payloads]]);if(!reference)reference=plain;if(plain!==reference)throw Error('projection changed')}}
 times.sort((a,b)=>a-b);samples[scenario]={medianMs:+times[6].toFixed(2),p95Ms:+times[11].toFixed(2),applyEventCalls:calls[0]};
}
const start=performance.now();const written=store.persist(store.hydrate(appended));samples.appendPersistMs=+(performance.now()-start).toFixed(2);samples.documentsUtf8Bytes=Object.fromEntries([store.LOG,store.PREFS,store.CACHE].map(key=>[key,new TextEncoder().encode(written.scriptstate[key]).length]));result.measurements[name]=samples;frame.remove();
}return result;
},${JSON.stringify(sources)})));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});`;
const result=JSON.parse(execFileSync('docker',['exec','-i','claudex-workhouse-browser-runtime','node'],{input:script,encoding:'utf8',timeout:120000,maxBuffer:4e6}));
await mkdir(new URL('../artifacts/performance/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/performance/replay-browser.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
