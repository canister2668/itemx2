import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const sources = await Promise.all(['core','codex','history','storage'].map(name => readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8')));
function model() {
  return vm.runInNewContext(sources.join('\n') + `\n(() => {
    let calls=0; const original=ITEMXCore.applyEvent;
    ITEMXCore.applyEvent=(...args)=>{calls++;return original(...args)};
    return {store:ITEMXStorage,core:ITEMXCore,calls:()=>calls,reset:()=>{calls=0}};
  })()`, { TextEncoder,TextDecoder,Buffer });
}
const plain = value => JSON.parse(JSON.stringify(value));
const patch = (i, afterIndex=i) => ({ id:`manual:${i}`, domain:'item', afterIndex, event:{kind:'patch',patch:{id:'potion',action:'consume',quantity:1,fields:{}}} });
function fixture(core) {
  const rows=[{id:'exam',domain:'item',messageIndex:0,event:{kind:'exam',item:core.normalizeItem({id:'potion',name:'약',count:1000}).item}},...Array.from({length:99},(_,i)=>patch(i+1))];
  return {message:Array.from({length:110},(_,i)=>({chatId:`m${i}`,data:'text'})),scriptstate:{'itemx:log':JSON.stringify({v:1,rows})}};
}
function append(store, chat, row) {
  const next=structuredClone(chat),document=store.log(next);
  document.rows.push(row); next.scriptstate[store.LOG]=JSON.stringify(document); return next;
}
function withoutCache(store,chat) {return {...chat,scriptstate:{...chat.scriptstate,[store.CACHE]:'{corrupt'}};}
function assertProjection(actual,expected) {
  for(const field of ['item','codex','manuals'])assert.deepEqual(plain(actual[field]),plain(expected[field]));
  assert.deepEqual(plain([...actual.payloads]),plain([...expected.payloads]));
}
test('persisted checkpoint folds zero unchanged events and only the appended tail, including after hydration',()=>{
  const {store,core,calls,reset}=model(); const saved=store.persist(fixture(core));
  reset(); const unchanged=store.replay(saved); assert.equal(calls(),0);
  const next=append(store,saved,patch(100)); reset();
  const replayed=store.replay(store.hydrate(next)); assert.equal(calls(),1);
  assert.equal(replayed.item.registry.items.potion.count,900);
  assertProjection(replayed,store.replay(withoutCache(store,next)));
  assert.equal(store.log(store.persist(next)).rows.length,101);
  assert.equal(unchanged.payloads.size,100);
});
test('late historical events and message identity changes invalidate the ordered checkpoint prefix',()=>{
  const {store,core,calls,reset}=model();const saved=store.persist(fixture(core));
  const retro=append(store,saved,patch(100,5));reset();const replayed=store.replay(retro);
  assert.equal(calls(),101);assertProjection(replayed,store.replay(withoutCache(store,retro)));
  const renamed=structuredClone(saved);renamed.message[10].chatId='renamed';reset();
  const result=store.replay(renamed);assert.equal(calls(),100);assertProjection(result,store.replay(withoutCache(store,renamed)));
});
test('valid JSON with corrupted snapshot or presentation cache regenerates from untouched facts',()=>{
  const {store,core,calls,reset}=model();const saved=store.persist(fixture(core));
  for(const mutate of [cache=>{cache.replay.item.registry.items.potion.count=999999},cache=>{cache.replay.payloads[0].view.name='broken'},cache=>{cache.replay.count=200}]){
    const chat=structuredClone(saved),cache=store.cache(chat);mutate(cache);chat.scriptstate[store.CACHE]=JSON.stringify(cache);
    reset();const result=store.replay(chat);assert.equal(calls(),100);assertProjection(result,store.replay(withoutCache(store,saved)));
    assert.equal(chat.scriptstate[store.LOG],saved.scriptstate[store.LOG]);
  }
});
test('a later compact alias invalidates the inline checkpoint instead of applying the event twice',()=>{
  const {store,core}=model(),event={kind:'exam',item:core.normalizeItem({id:'potion',name:'약',count:2}).item};
  const marker=core.marker({v:2,event});
  const saved=store.persist({message:[{chatId:'m',data:marker}],scriptstate:{}});
  const row=store.log(saved).rows[0];
  const next=append(store,saved,{...row,id:'item:i0_0_alias',ref:'i0_0_alias'});
  const result=store.replay(next);assert.equal(result.payloads.size,1);
  assertProjection(result,store.replay(withoutCache(store,next)));
});

test('snapshot DTOs regenerate from the checkpoint without storing duplicate or stale snapshots',()=>{
  const {store,core}=model();const saved=store.persist(fixture(core)),hydrated=store.hydrate(saved);
  hydrated.scriptstate[store.DTO.item]=JSON.stringify({registry:{items:{wrong:{count:999}}}});
  const persisted=store.persist(hydrated),cache=store.cache(persisted);
  assert.equal(cache.item,undefined);assert.equal(cache.codex,undefined);
  const rebuilt=store.hydrate(persisted);
  assert.equal(JSON.parse(rebuilt.scriptstate[store.DTO.item]).registry.items.potion.count,901);
  assert.equal(JSON.parse(rebuilt.scriptstate[store.DTO.item]).registry.items.wrong,undefined);
});
