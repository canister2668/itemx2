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

test('catch-up counts every pass that reached the model; races before the call are retried soon', () => {
  assert.deepEqual(
    [
      { status: 'conflict', called: false },
      { status: 'fail', called: false },
      { status: 'fail', called: true },
      { status: 'conflict', called: true },
      { status: 'ok', called: true },
      { status: 'skip', called: false }
    ].map(Pipeline.auxVerdict),
    ['retry', 'retry', false, false, true, true]
  );
});

test('re-keyed anchors are the same narrative for the auxiliary pass', () => {
  const text = '검을 얻었다.\n\n<!--ix:abcde-->\n\n다음 문단.';
  assert.equal(Aux.narrativeHash(text), Aux.narrativeHash(text.replace('abcde', 'fghij')));
  assert.notEqual(Aux.narrativeHash(text), Aux.narrativeHash(text.replace('다음', '다른')));
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

test('cancelling a running pass settles the message; the automatic pass never calls it again', async () => {
  let answer;
  const fake = bot(() => new Promise((resolve) => (answer = resolve)));
  const running = Aux.recoverAuxiliaryOutputNow();
  for (let i = 0; i < 20 && !Aux.auxRunning(); i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(Aux.auxRunning(), true);
  assert.equal(await Aux.cancelAux(), true);
  const result = await running;
  assert.equal(result.status, 'skip');
  assert.equal(result.reason, 'cancelled');
  assert.equal(Aux.auxRunning(), false, 'the user sees nothing running');
  assert.equal(Aux.auxActive(), 1, 'the abandoned request still blocks a second paid request');
  assert.equal(documentOf(fake.state.chat).guards.aux.reply.state, 'cancelled');
  assert.equal(Pipeline.auxVerdict(result), true, 'a cancelled pass is not retried');
  answer('<itemExam><id>late</id><name>늦은 답</name></itemExam>');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(Aux.auxActive(), 0);
  const again = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(again.reason, 'guarded');
  assert.equal(fake.state.llmCalls.length, 1);
  assert.equal(documentOf(fake.state.chat).events && Object.keys(documentOf(fake.state.chat).events).length, 0);
  // A manual run from the settings tab still works.
  const manual = Aux.recoverAuxiliaryOutputNow({ force: true });
  for (let i = 0; i < 20 && !Aux.auxRunning(); i += 1) await new Promise((resolve) => setImmediate(resolve));
  answer('NONE');
  assert.equal((await manual).status, 'ok');
  assert.equal(fake.state.llmCalls.length, 2);
});

test('cancel does nothing when no pass runs', async () => {
  bot(async () => 'NONE');
  assert.equal(await Aux.cancelAux(), false);
});
