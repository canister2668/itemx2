import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost } from '../src/host.js';
import { readChat, saveChat } from '../src/chat-io.js';
import { workQueue } from '../src/kernel.js';

function harness() {
  const fake = createFakeHost({ chat: { message: [{ chatId: 'a', data: 'original' }], scriptstate: {} } });
  setHost(fake.api);
  return {
    readChat,
    saveChat,
    workQueue,
    host: () => fake.state.chat,
    writes: () => fake.state.writes,
    change: () => {
      fake.state.chat.message.push({ chatId: 'b', data: 'host appended' });
      fake.state.chat.scriptstate.other = 'kept';
    }
  };
}

for (const external of [false, true])
  test(`fresh host changes survive ${external ? 'external model yield' : 'same job'}`, async () => {
    const h = harness();
    await h.workQueue.enqueue({
      kind: 'aux',
      work: async () => {
        await h.readChat(0, 0);
        if (external) await h.workQueue.external(async () => h.change());
        else h.change();
        const latest = await h.readChat(0, 0);
        latest.scriptstate.itemx = 'update';
        await h.saveChat(0, 0, latest, latest);
      }
    });
    assert.equal(h.host().message.length, 2, 'host message must not be overwritten');
    assert.equal(h.host().scriptstate.other, 'kept');
  });

test('host change after read refuses a stale write', async () => {
  const h = harness();
  await assert.rejects(
    h.workQueue.enqueue({
      kind: 'aux',
      work: async () => {
        const base = await h.readChat(0, 0);
        const next = structuredClone(base);
        next.scriptstate.itemx = 'update';
        h.change();
        await h.saveChat(0, 0, next, base);
      }
    }),
    /changed|conflict/i
  );
  assert.equal(h.writes(), 0);
  assert.equal(h.host().message.length, 2);
});

test('mutating caller after save begins cannot change submitted messages', async () => {
  const h = harness();
  await h.workQueue.enqueue({
    kind: 'aux',
    work: async () => {
      const base = await h.readChat(0, 0),
        next = structuredClone(base);
      const saving = h.saveChat(0, 0, next, base);
      next.message[0].data = 'later mutation';
      await saving;
    }
  });
  assert.equal(h.host().message[0].data, 'original');
});
