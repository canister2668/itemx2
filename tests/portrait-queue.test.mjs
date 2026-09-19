import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';
test('a stalled portrait RPC yields to a host output hook', async () => {
 let release,started;
 const begun=new Promise(resolve=>started=resolve);
 const p=await presentationRuntime({Risuai:{readImage:()=>{started();return new Promise(resolve=>release=resolve)}}},
 'runtime.load=loadCodexPortraits;runtime.dispatch=dispatch;runtime.queue=workQueue;');
 p.runtime.activeContextKey='ctx';
 const character={chaId:'c',additionalAssets:[['Mayuri','assets/mayuri.png','png']]};
 const entity={id:'mayuri',name:'Mayuri',portrait:'Mayuri'};
 const pending=p.runtime.dispatch('portraits',()=>p.runtime.load(character,{message:[]},{monsters:{order:['mayuri'],entries:{mayuri:entity}}},{moduleAssetsEnabled:false},true));
 await begun;
 let handled=false;
 const hook=p.runtime.dispatch('output',()=>{handled=true});
 await new Promise(resolve=>setTimeout(resolve,20));
 const before=handled;
 release('data:image/png;base64,AAAA');await pending;await hook;await p.runtime.queue.close();
 assert.equal(before,true,'host hook must run before the image returns');
});
test('all missing portraits share one finite I/O budget', async () => {
 let now=1000,reads=0;
 class Clock extends Date {static now(){return now;}}
 const p=await presentationRuntime({Date:Clock,setTimeout:(fn,ms)=>{queueMicrotask(()=>{now+=ms;fn()});return -1},clearTimeout:()=>{},Risuai:{readImage:()=>{reads++;return new Promise(()=>{})}}},'runtime.load=loadCodexPortraits;');
 p.runtime.activeContextKey='ctx';
 const character={chaId:'c',additionalAssets:Array.from({length:20},(_,i)=>['M'+i,'assets/'+i+'.png','png'])};
 const entities=Array.from({length:20},(_,i)=>({id:'m'+i,name:'M'+i,portrait:'M'+i}));
 const result=await p.runtime.load(character,{message:[]},{monsters:{order:entities.map(e=>e.id),entries:Object.fromEntries(entities.map(e=>[e.id,e]))}},{moduleAssetsEnabled:false},true);
 assert.equal(Object.keys(result).length,0);
 assert.ok(reads<=4,'timeout does not start the remaining image batches');
});
