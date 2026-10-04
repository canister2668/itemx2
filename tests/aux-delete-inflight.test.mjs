import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Session, Pipeline } from './helpers/modules.mjs';
import { workQueue } from '../src/kernel.js';

async function automaticPass(t) {
  t.mock.timers.enable({ apis: ['Date'] });
  let answer, started;
  const requested = new Promise((resolve) => (started = resolve));
  const fake = createFakeHost({
    character: { chaId: 'auto-delete', name: 'T' },
    chat: {
      id: 'chat',
      message: [
        { chatId: 'old', role: 'char', data: '이전 AI 응답 전체.' },
        { chatId: 'user', role: 'user', data: '둘러본다.' },
        { chatId: 'reply', role: 'char', data: '완결된 AI 응답 전체. 방은 비어 있었다.' }
      ],
      scriptstate: {}
    },
    settings: {
      v: 1,
      global: {},
      characters: {
        'auto-delete': {
          enabled: true,
          auxOutput: 'missing',
          itemsEnabled: true,
          skillsEnabled: false,
          encountersEnabled: false
        }
      }
    },
    llm: () =>
      new Promise((resolve) => {
        answer = resolve;
        started();
      })
  });
  setHost(fake.api);
  Session.resetSession('auto-delete:chat');
  workQueue.forget('catch-up');
  workQueue.forget('aux-settle');
  // Watchdog observations only: no ITEMX button or forced/manual pass.
  await workQueue.enqueue({ kind: 'catch-up', work: () => Pipeline.catchUpLatestOutput({ syncUi: false }) });
  workQueue.clearTimer('auxSettleTimer');
  t.mock.timers.tick(2000);
  const running = workQueue
    .enqueue({ kind: 'catch-up', work: () => Pipeline.catchUpLatestOutput({ syncUi: false }) })
    .then(
      () => null,
      (error) => error
    );
  await requested;
  assert.equal(fake.state.llmCalls.length, 1);
  assert.equal(fake.state.writes, 0);
  return { fake, running, answer: (value = 'NONE') => answer(value) };
}

test('automatic auxiliary completion does not restore a response deleted while the model runs', async (t) => {
  const h = await automaticPass(t);
  h.fake.state.chat.message.splice(2, 1);
  h.answer();
  assert.equal(await h.running, null);
  assert.deepEqual(
    h.fake.state.chat.message.map((m) => m.chatId),
    ['old', 'user']
  );
  assert.equal(h.fake.state.writes, 0);
});

test('automatic auxiliary completion preserves deletion of an earlier response while the model runs', async (t) => {
  const h = await automaticPass(t);
  h.fake.state.chat.message.splice(0, 1);
  h.answer();
  assert.equal(await h.running, null);
  assert.deepEqual(
    h.fake.state.chat.message.map((m) => m.chatId),
    ['user', 'reply']
  );
  assert.equal(h.fake.state.writes, 0);
});

// Haejeok b7437 rm() keeps the chat object across alertConfirm(), splices it,
// then messageStore.deleteMessage(chat.id, id) filters the chat found by id.
test('automatic NONE guard write during the host delete confirmation keeps the deletion', async (t) => {
  const h = await automaticPass(t);
  const heldByDeleteHandler = h.fake.state.chat;
  h.answer();
  assert.equal(await h.running, null);
  assert.ok(h.fake.state.writes >= 1, 'the automatic pass replaced the chat object');
  assert.notEqual(h.fake.state.chat, heldByDeleteHandler);
  heldByDeleteHandler.message.splice(2, 1);
  h.fake.state.chat.message = h.fake.state.chat.message.filter((m) => m.chatId !== 'reply');
  assert.deepEqual(
    h.fake.state.chat.message.map((m) => m.chatId),
    ['old', 'user']
  );
});
