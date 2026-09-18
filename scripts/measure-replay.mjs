import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

async function model(revision) {
  const context = vm.createContext({ TextEncoder, TextDecoder, Buffer });
  for (const name of ['core', 'codex', 'history', 'storage']) {
    const source = revision ? execFileSync('git', ['show', `${revision}:src/${name}.js`], { encoding: 'utf8' }) : await readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8');
    vm.runInContext(source, context);
  }
  return vm.runInContext(`(() => {
    let calls = 0;
    for (const engine of [ITEMXCore, ITEMXCodex]) { const original = engine.applyEvent; engine.applyEvent = (...args) => { calls++; return original(...args); }; }
    return { store: ITEMXStorage, core: ITEMXCore, reset: () => { calls = 0; }, count: () => calls };
  })()`, context);
}
const models = { before: await model('b4fe1c2'), after: await model() };
const item = models.before.core.normalizeItem({ id: 'tonic', name: '장기 채팅 검증 약', count: 9999, rarity: 'legendary' }).item;
const rows = Array.from({ length: 900 }, (_, i) => ({ id: `item:i${(i * 3).toString(36)}_0_sample${i}`, ref: `i${(i * 3).toString(36)}_0_sample${i}`, domain: 'item', messageId: `m${i * 3}`, messageIndex: i * 3, offset: 0, ordinal: 0, code: `sample${i}`, event: i ? { kind: 'patch', patch: { id: 'tonic', action: 'consume', quantity: 1, fields: {} } } : { kind: 'exam', item } }));
const fixture = { message: Array.from({ length: 3000 }, (_, i) => ({ chatId: `m${i}`, data: i % 3 === 0 && i / 3 < rows.length ? `<!--ITEMX2@${rows[i / 3].ref}-->` : '장기 채팅의 일반 서술.' })), scriptstate: { 'itemx:log': JSON.stringify({ v: 1, rows }) } };
const plain = value => JSON.parse(JSON.stringify(value));
const results = { fixture: { messages: 3000, events: 900 }, hostWriteCalls: 'not measured; this benchmark is the local storage boundary', measurements: {} };
let reference;
for (const [name, { store, reset, count }] of Object.entries(models)) {
  const saved = store.persist(fixture);
  const appended = structuredClone(saved);
  const doc = store.log(appended);
  doc.rows.push({ ...rows.at(-1), id: 'item:new', ref: 'new', messageId: 'm3000', messageIndex: 3000 });
  appended.message.push({ chatId: 'm3000', data: '<!--ITEMX2@new-->' });
  appended.scriptstate[store.LOG] = JSON.stringify(doc);
  const samples = {};
  for (const [scenario, chat] of [['unchanged', saved], ['oneAppend', appended], ['cacheLoss', { ...saved, scriptstate: { ...saved.scriptstate, [store.CACHE]: '{broken' } }]]) {
    const timings = [], calls = [];
    for (let i = 0; i < 9; i++) {
      reset(); const start = performance.now();
      const hydrated = store.hydrate(chat), projected = store.replay(hydrated);
      timings.push(performance.now() - start); calls.push(count());
      if (scenario === 'unchanged') {
        if (!reference) reference = plain(projected);
        assert.deepEqual(plain(projected.item), reference.item);
        assert.deepEqual(plain(projected.codex), reference.codex);
        assert.deepEqual(plain([...projected.payloads]), plain([...models.before.store.replay(saved).payloads]));
      }
    }
    timings.sort((a, b) => a - b);
    samples[scenario] = { medianMs: +timings[4].toFixed(2), p95Ms: +timings[8].toFixed(2), applyEventCalls: calls[0] };
  }
  const start = performance.now();
  const written = store.persist(store.hydrate(appended));
  samples.appendPersistMs = +(performance.now() - start).toFixed(2);
  samples.documentsUtf8Bytes = Object.fromEntries([store.LOG, store.PREFS, store.CACHE].map(key => [key, Buffer.byteLength(written.scriptstate[key]) ]));
  results.measurements[name] = samples;
}
await mkdir(new URL('../artifacts/performance/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/performance/replay.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
