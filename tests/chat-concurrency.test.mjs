import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost } from '../src/host.js';
import { readChat, saveChat } from '../src/chat-io.js';
import { workQueue } from '../src/kernel.js';

// Haejeok b7437 Chat.svelte rm(): the handler keeps the chat object it read
// across `await alertConfirm()`, splices that object, then calls
// messageStore.deleteMessage(chat.id, messageId), which finds the chat again
// by id and filters the message out of whatever object is current.
function haejeokDelete(fake, heldChat, messageId) {
  const index = heldChat.message.findIndex((message) => message.chatId === messageId);
  if (index >= 0) heldChat.message.splice(index, 1);
  const current = fake.state.chat;
  if (current?.id === heldChat.id) current.message = current.message.filter((message) => message.chatId !== messageId);
}

test('a write landing while the host delete confirmation is open does not keep the deleted response', async () => {
  const fake = createFakeHost({
    chat: {
      id: 'delete-chat',
      message: [{ chatId: 'reply', role: 'char', data: 'Entire AI response' }],
      scriptstate: {}
    }
  });
  setHost(fake.api);
  const heldByDeleteHandler = fake.state.chat;
  const base = await readChat(0, 0);
  await saveChat(0, 0, { ...base, scriptstate: { itemx: 'guard' } }, base);
  assert.notEqual(fake.state.chat, heldByDeleteHandler, 'the write replaced the host chat object');
  haejeokDelete(fake, heldByDeleteHandler, 'reply');
  assert.equal(fake.state.chat.message.length, 0, 'the deleted response must stay deleted');
  assert.equal(fake.state.chat.scriptstate.itemx, 'guard');
});

test('deleting an entire response before saving rejects the stale proposal', async () => {
  const fake = createFakeHost({
    chat: {
      id: 'gone-chat',
      message: [{ chatId: 'reply', data: 'Delete this response' }],
      scriptstate: {}
    }
  });
  setHost(fake.api);
  const base = await readChat(0, 0);
  fake.state.chat.message = [];
  await assert.rejects(saveChat(0, 0, { ...base, scriptstate: { itemx: 'pending' } }, base), /changed|conflict/i);
  assert.equal(fake.state.writes, 0);
  assert.equal(fake.state.chat.message.length, 0);
});

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
        // The base stays as read; the change is a new object.
        await h.saveChat(0, 0, { ...latest, scriptstate: { ...latest.scriptstate, itemx: 'update' } }, latest);
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
