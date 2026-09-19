import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
async function harness() {
  const source = await readFile(new URL('../src/presentation.js', import.meta.url), 'utf8');
  let now = 1000, id = 0, wakes = 0;
  const timers = new Map(), classes = new Set();
  const sb = { Date: { now: () => now }, hostState: { unloading: false },
    presentationState: { bodyFxScrollActive: false, bodyFxClassOwner: {
      addClass: async c => classes.add(c), removeClass: async c => classes.delete(c)
    } },
    setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id), scheduleHostDomSync: () => {}, workQueue: { wake: () => wakes++ } };
  vm.runInNewContext(source.slice(source.indexOf('  let scrollStartTimer'), source.indexOf('  async function removeBodyEffectGovernor')) + '\nglobalThis.api={beginBodyScrollEffects,continueBodyScrollEffects,endBodyScrollEffects,clearScrollTimers};', sb);
  const tick = ms => { const until = now + ms; for (;;) { const next = [...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0]; if(!next)break; now=next[1].at;timers.delete(next[0]);next[1].fn(); } now=until; };
  return { ...sb.api, tick, classes, state: sb.presentationState, host: sb.hostState, timers, wakes: () => wakes };
}
for (const touch of [false,true]) test(`${touch ? 'touch' : 'wheel'} scrolling activates FX pause and releases queued work once`, async () => {
  const h = await harness(); if(touch)h.beginBodyScrollEffects();
  h.continueBodyScrollEffects(); h.tick(65); h.continueBodyScrollEffects(); h.tick(20);
  assert.equal(h.state.bodyFxScrollActive, true);
  assert.equal(h.classes.size, 1);
  h.tick(250);
  assert.equal(h.state.bodyFxScrollActive, false);
  assert.equal(h.classes.size, 0);
  assert.equal(h.wakes(),1);
});
test('cleared timers cannot reactivate effects in an old context', async () => {
  const h=await harness();h.beginBodyScrollEffects();h.clearScrollTimers();h.tick(1000);
  assert.equal(h.classes.size,0);assert.equal(h.timers.size,0);
});
test('queued host events after unload begins cannot arm new scroll timers', async () => {
  const h=await harness();h.host.unloading=true;h.beginBodyScrollEffects();h.continueBodyScrollEffects();h.endBodyScrollEffects();
  assert.equal(h.timers.size,0);
});
test('actual scroll pauses immediately even when the host sends scrollend for short increments', async () => {
 const h=await harness();
 for(let i=0;i<5;i++){h.continueBodyScrollEffects();h.endBodyScrollEffects(40);h.tick(16);}
 assert.equal(h.state.bodyFxScrollActive,true);
 h.tick(80);assert.equal(h.state.bodyFxScrollActive,false);
});
