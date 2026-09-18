import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const KEY = '$__itemx2_checkpoint';

function sealed(runtime, overrides = {}) {
  const { checkpoint } = runtime.createCheckpoint(
    { registry: { order: ['sword'], items: { sword: { id: 'sword', name: '검', count: 1 } } }, history: {} },
    { skills: { order: [], entries: [] }, monsters: { order: [], entries: [] }, history: { skill: {}, monster: {} } },
    1,
    'msg-1'
  );
  return { ...checkpoint, ...overrides };
}

const chatWith = (value) => ({
  message: [{ chatId: 'msg-0', role: 'user', data: 'a' }, { chatId: 'msg-1', role: 'char', data: 'b' }],
  scriptstate: { [KEY]: typeof value === 'string' ? value : JSON.stringify(value) }
});

test('a current imported baseline reads back and does not freeze', async () => {
  const rt = await presentationRuntime();
  const chat = rt.storage.hydrate(rt.storage.persist(chatWith(sealed(rt)), { legacy: true }));
  assert.equal(rt.readCheckpointRecord(chat).status, 'ok');
  assert.equal(rt.checkpointFrozen(chat), false);
  assert.equal(rt.checkpointStatus(chat).valid, true);
});

test('the one-time converter preserves a v1 final state', async () => {
  const rt = await presentationRuntime();
  const legacy = { ...sealed(rt), v: 1, prefix: 'deadbeef' };
  delete legacy.sealedThroughId;
  const chat = rt.storage.hydrate(rt.storage.persist(chatWith(legacy), { legacy: true }));
  assert.equal(rt.readCheckpointRecord(chat).value.v, 2);
  assert.equal(rt.readCheckpointRecord(chat).value.item.registry.items.sword.name, '검');
});

test('a future authoritative checkpoint aborts conversion without data loss', async () => {
  const rt = await presentationRuntime(), chat = chatWith(sealed(rt, { v: 99 })), before = JSON.stringify(chat);
  assert.throws(() => rt.storage.persist(chat, { legacy: true }), /unreadable/);
  assert.equal(JSON.stringify(chat), before);
});

test('an unparsable authoritative checkpoint cannot silently discard its prefix', async () => {
  const rt = await presentationRuntime(), chat = chatWith('{ not json');
  assert.throws(() => rt.storage.persist(chat, { legacy: true }));
  assert.equal(chat.scriptstate[KEY], '{ not json');
});

test('a structurally broken authoritative checkpoint aborts conversion', async () => {
  const rt = await presentationRuntime(), broken = sealed(rt);
  delete broken.item;
  assert.throws(() => rt.storage.persist(chatWith(broken), { legacy: true }), /unreadable/);
});

test('no baseline is absent and an empty cache is harmless', async () => {
  const rt = await presentationRuntime();
  const chat = rt.storage.hydrate(rt.storage.persist({ message: [], scriptstate: {} }));
  assert.equal(rt.readCheckpointRecord(chat).status, 'absent');
  assert.equal(rt.checkpointFrozen(chat), false);
});

test('an invalid canonical log is never overwritten by cache maintenance', async () => {
  const rt = await presentationRuntime(), chat = { message: [], scriptstate: { 'itemx:log': '{broken' } };
  const before = JSON.stringify(chat);
  assert.throws(() => rt.refreshReplayCache(chat));
  assert.equal(JSON.stringify(chat), before);
});

test('a discarded or corrupt cache rebuilds without freezing either UI surface', async () => {
  const rt = await presentationRuntime();
  const chat = rt.storage.persist(chatWith(sealed(rt)), { legacy: true });
  chat.scriptstate['itemx:cache'] = '{broken';
  const rebuilt = rt.storage.hydrate(chat);
  assert.equal(rt.readCheckpointRecord(rebuilt).value.item.registry.items.sword.name, '검');
  assert.equal(rt.checkpointFrozen(rebuilt), false);
  assert.equal(rt.frozenBannerHtml(true), '');
  assert.equal(rt.frozenBannerHtml(false), '');
});
