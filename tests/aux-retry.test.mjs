import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf } from './helpers/ledger.mjs';
import { setHost, Session, Aux, Pipeline } from './helpers/modules.mjs';
import { workQueue } from '../src/kernel.js';

let unique = 0;
function bot(llm, extra = {}) {
  const id = `retry-${++unique}`;
  const fake = createFakeHost({
    chat: {
      id: 'chat',
      message: [
        { chatId: 'u', role: 'user', data: '둘러본다' },
        { chatId: 'reply', role: 'char', data: '완결된 서술. 방 안에는 아무것도 없었다.' }
      ],
      scriptstate: {}
    },
    character: { chaId: id, name: 'T' },
    settings: {
      v: 1,
      global: {},
      characters: {
        [id]: { enabled: true, auxOutput: 'always', itemsEnabled: true, skillsEnabled: false, encountersEnabled: false }
      }
    },
    llm,
    ...extra
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  return fake;
}

test('a failed model call is counted in the document; the limit survives a reload', async () => {
  const fake = bot(async () => {
    throw new Error('provider down');
  });
  for (let i = 1; i <= 3; i += 1) {
    const result = await Aux.recoverAuxiliaryOutputNow();
    assert.equal(result.status, 'fail');
    assert.equal(result.called, true);
    assert.equal(documentOf(fake.state.chat).guards.aux.reply.attempts, i);
  }
  // A fresh runtime (nothing in memory) still sees the exhausted guard.
  Session.resetSession(Session.activeContextKey());
  workQueue.forget('catch-up');
  const again = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(again.reason, 'guarded');
  assert.equal(fake.state.llmCalls.length, 3);
});

test('a failure before any model call is not counted', async () => {
  const fake = bot(async () => 'NONE');
  fake.state.onRead = (state) => {
    // The message changes between the first read and the pass's own read.
    if (state.reads === 2) state.chat.message[1].data += ' 수정됨';
  };
  const result = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(result.status, 'conflict');
  assert.equal(result.called, false);
  assert.equal(fake.state.llmCalls.length, 0);
  assert.equal(documentOf(fake.state.chat).guards.aux.reply, undefined);
});

test('catch-up counts only failed model calls; lost races are retried soon', () => {
  assert.deepEqual(
    [
      { status: 'conflict', called: false },
      { status: 'fail', called: false },
      { status: 'fail', called: true },
      { status: 'ok', called: true },
      { status: 'skip', called: false }
    ].map(Pipeline.auxVerdict),
    ['retry', 'retry', false, true, true]
  );
});

test('a timed-out model request stays in flight until the provider answers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let answer;
  bot(() => new Promise((resolve) => (answer = resolve)));
  const running = Aux.runAuxModel('prompt').catch((error) => error);
  await Promise.resolve();
  assert.equal(Aux.auxActive(), 1);
  t.mock.timers.tick(240001);
  const error = await running;
  assert.match(String(error?.message || error), /.+/);
  assert.equal(Aux.auxActive(), 1, 'the abandoned request is still billing');
  answer('NONE');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(Aux.auxActive(), 0);
});
