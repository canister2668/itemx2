import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Ledger, Session } from './helpers/modules.mjs';
import { displayHandler } from '../src/ui/presentation.js';

test('an anchor the ledger never had loads the chat once, not once per render', async () => {
  const fake = createFakeHost({
    chat: {
      id: 'chat',
      message: [{ chatId: 'r1', role: 'char', data: '사라진 카드가 있던 답변.\n\n<!--ix:lost1-->' }],
      scriptstate: {}
    },
    character: { chaId: 'miss', name: 'Test' }
  });
  setHost(fake.api);
  Session.resetSession('miss:chat');
  await Ledger.rebuildCurrent();
  const before = fake.state.reads;
  for (let index = 0; index < 10; index += 1) await displayHandler(fake.state.chat.message[0].data);
  assert.ok(fake.state.reads - before <= 1, `host reads: ${fake.state.reads - before}`);
});
