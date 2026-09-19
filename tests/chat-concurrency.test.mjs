import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function harness() {
  const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../src/work-queue.js', import.meta.url), 'utf8');
  let host = { message: [{ chatId: 'a', data: 'original' }], scriptstate: {} };
  let writes = 0;
  const sandbox = { setTimeout, clearTimeout, structuredClone,
    Risuai: { getChatFromIndex: async () => structuredClone(host),
      setChatToIndex: async (_, __, value) => { writes++; host = structuredClone(value); } } };
  const begin = source.indexOf('  // Reading a chat');
  const end = source.indexOf('  const stateOwners =');
  vm.runInNewContext(`${queue}\nconst workQueue = ITEMXWorkQueue.create();
    const timed = async (_, work) => work(), timedSync = (_, work) => work(), phaseCount = () => {};
    const ITEMXStorage = { hydrate: c => c, persist: c => c };
    ${source.slice(begin, end)}
    globalThis.api = { readChat, saveChat, workQueue };`, sandbox);
  return { ...sandbox.api, host: () => host, writes: () => writes,
    change: () => { host.message.push({ chatId: 'b', data: 'host appended' }); host.scriptstate.other = 'kept'; } };
}

for (const external of [false, true]) test(`fresh host changes survive ${external ? 'external model yield' : 'same job'}`, async () => {
  const h = await harness();
  await h.workQueue.enqueue({ kind: 'aux', work: async () => {
    await h.readChat(0, 0);
    if (external) await h.workQueue.external(async () => h.change()); else h.change();
    const latest = await h.readChat(0, 0);
    latest.scriptstate.itemx = 'update';
    await h.saveChat(0, 0, latest, latest);
  }});
  assert.equal(h.host().message.length, 2, 'host message must not be overwritten');
  assert.equal(h.host().scriptstate.other, 'kept');
});

test('host change after read refuses a stale write', async () => {
  const h = await harness();
  await assert.rejects(h.workQueue.enqueue({ kind: 'aux', work: async () => {
    const base = await h.readChat(0, 0);
    const next = structuredClone(base); next.scriptstate.itemx = 'update';
    h.change();
    await h.saveChat(0, 0, next, base);
  }}), /changed|conflict/i);
  assert.equal(h.writes(), 0);
  assert.equal(h.host().message.length, 2);
});

test('mutating caller after save begins cannot change submitted messages', async () => {
  const h = await harness();
  await h.workQueue.enqueue({ kind: 'aux', work: async () => {
    const base = await h.readChat(0, 0), next = structuredClone(base);
    const saving = h.saveChat(0, 0, next, base);
    next.message[0].data = 'later mutation';
    await saving;
  }});
  assert.equal(h.host().message[0].data, 'original');
});
