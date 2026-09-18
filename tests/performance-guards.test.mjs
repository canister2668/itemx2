import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

test('post-commit remount quiet period lasts 1200 ms and never blocks a different context',async()=>{
  let now=0;const state={key:'same',changed:false,installs:0};
  const p=await presentationRuntime({guardState:state,Date:class extends Date{static now(){return now}},console:{...console,error:()=>{}}},`
    context=async()=>({key:guardState.key,chat:{message:[],scriptstate:{}}});
    resetRuntimeForContext=async()=>guardState.changed;
    installPipelineHooks=async()=>{guardState.installs++;throw Error('stop after throttle probe')};
    runtime.ensureForTest=ensureRootInventoryNow;
    runtime.markCommit=key=>workQueue.remember('host-settling',key);
  `);
  p.runtime.markCommit('same');await p.runtime.ensureForTest();assert.equal(state.installs,0);
  now=1199;await p.runtime.ensureForTest();assert.equal(state.installs,0);
  now=1200;await p.runtime.ensureForTest();assert.equal(state.installs,1);
  p.runtime.markCommit('same');state.key='other';state.changed=true;
  await p.runtime.ensureForTest();assert.equal(state.installs,2);
});

test('marker and detail HTML caches retain their 64 and 60 entry limits',async()=>{
  const p=await presentationRuntime();
  for(let i=0;i<75;i++){
    const item=p.core.normalizeItem({id:'cache'+i,name:'cache '+i,count:1}).item;
    p.displayHandler(p.core.marker({v:2,event:{kind:'exam',item},view:item}));
    p.itemDetailHtml(item);
  }
  assert.equal(p.runtime.markerHtmlCache.size,64);
  assert.equal(p.runtime.detailHtmlCache.size,60);
});

test('portrait caches keep the 24 image, 16 MiB and 64 thumbnail limits',async()=>{
  for(const [count,image] of [[70,'data:image/png;base64,AA=='],[12,'data:image/png;base64,'+'A'.repeat(2*1024*1024)]]){
    const p=await presentationRuntime({Risuai:{readImage:async()=>image}},'runtime.loadPortraitsForTest=loadCodexPortraits;');
    const assets=Array.from({length:count},(_,i)=>['Face'+i,'asset'+i,'png']);
    const monsters=Object.fromEntries(assets.map(([portrait],i)=>['m'+i,{id:'m'+i,name:portrait,portrait,status:'active',relation:'hostile'}]));
    await p.runtime.loadPortraitsForTest({chaId:'cache',additionalAssets:assets},{message:[]},{monsters:{order:Object.keys(monsters),entries:monsters}},{moduleAssetsEnabled:false});
    assert.ok(p.runtime.portraitCache.size>0);
    assert.ok(p.runtime.portraitCache.size<=24);
    assert.ok([...p.runtime.portraitCache.values()].reduce((sum,value)=>sum+value.length,0)<=16*1024*1024);
    assert.ok(p.runtime.portraitThumbnailCache.size<=64);
  }
});
