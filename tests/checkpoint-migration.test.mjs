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

test('a current checkpoint reads back and does not freeze', async () => {
  const rt = await presentationRuntime();
  const chat = chatWith(sealed(rt));
  const record = rt.readCheckpointRecord(chat);
  assert.equal(record.status, 'ok');
  assert.equal(rt.checkpointFrozen(chat), false);
  assert.equal(rt.checkpointStatus(chat).valid, true);
});

test('a v1 checkpoint migrates forward instead of being discarded', async () => {
  const rt = await presentationRuntime();
  // The shape ITEMX actually wrote before 2.0.11: sealed by marker fingerprint.
  const legacy = { ...sealed(rt), v: 1, prefix: 'deadbeef' };
  delete legacy.sealedThroughId;
  const chat = chatWith(legacy);
  const record = rt.readCheckpointRecord(chat);
  assert.equal(record.status, 'ok', record.reason);
  assert.equal(record.value.v, 2);
  assert.equal(record.value.item.registry.items.sword.name, '검');
  assert.equal(rt.checkpointFrozen(chat), false);
  // The migrated checkpoint must still be usable, not merely parseable.
  assert.equal(rt.checkpointStatus(chat).valid, true);
});

test('a checkpoint from a newer build freezes instead of returning null', async () => {
  const rt = await presentationRuntime();
  const chat = chatWith(sealed(rt, { v: 99 }));
  const record = rt.readCheckpointRecord(chat);
  assert.equal(record.status, 'unreadable');
  assert.match(record.reason, /newer_build_v99/);
  assert.equal(rt.checkpointFrozen(chat), true);
});

test('an unparsable checkpoint freezes rather than rebuilding from a stripped prefix', async () => {
  const rt = await presentationRuntime();
  const chat = chatWith('{ not json');
  assert.equal(rt.readCheckpointRecord(chat).status, 'unreadable');
  assert.equal(rt.checkpointFrozen(chat), true);
});

test('a structurally broken checkpoint freezes', async () => {
  const rt = await presentationRuntime();
  const broken = sealed(rt);
  delete broken.item;
  const chat = chatWith(broken);
  const record = rt.readCheckpointRecord(chat);
  assert.equal(record.status, 'unreadable');
  assert.equal(record.reason, 'checkpoint_shape_invalid');
});

test('no checkpoint at all is absent, not frozen', async () => {
  const rt = await presentationRuntime();
  const chat = { message: [], scriptstate: {} };
  assert.equal(rt.readCheckpointRecord(chat).status, 'absent');
  assert.equal(rt.checkpointFrozen(chat), false);
});

test('a frozen chat is never resealed', async () => {
  const rt = await presentationRuntime();
  const chat = chatWith(sealed(rt, { v: 99 }));
  const before = JSON.stringify(chat);
  // force:true is the strongest reseal request the runtime makes anywhere.
  const result = rt.checkpointReplay(chat, { force: true, keepMessages: 0 });
  assert.equal(JSON.stringify(result), before, 'frozen chat must be returned untouched');
});

test('the freeze banner renders in both the drawer and the iframe fallback', async () => {
  const rt = await presentationRuntime();
  rt.checkpointFrozen(chatWith(sealed(rt, { v: 99 })));
  const native = rt.frozenBannerHtml(true);
  const fallback = rt.frozenBannerHtml(false);
  for (const html of [native, fallback]) {
    assert.match(html, /itemx2-frozen-banner/);
    assert.match(html, /읽기 전용으로 잠김/);
  }
  assert.match(native, /itemx2-root-frozen/);
  assert.match(fallback, /itemx-frozen/);
  // and disappears once the chat is readable again
  rt.checkpointFrozen({ message: [], scriptstate: {} });
  assert.equal(rt.frozenBannerHtml(true), '');
});
