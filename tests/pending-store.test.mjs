import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf } from './helpers/ledger.mjs';
import { setHost, Pipeline, Session } from './helpers/modules.mjs';
import { PENDING_STORE_KEY, resetPendingRestore } from '../src/pending-store.js';

const settings = (id) => ({
  v: 1,
  global: { badgePosition: 'rm' },
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: false
    }
  }
});
const sword =
  '검을 얻었다.\n\n[itemx: id=blade | name=검 | type=무기 | emoji=🗡️ | rarity=normal | display=커먼 | possession=owned | location=inventory | count=1]';
const potion =
  '포션을 얻었다.\n\n[itemx: id=potion | name=포션 | type=소모품 | emoji=🧪 | rarity=normal | display=커먼 | possession=owned | location=inventory | count=2]';

async function reply(fake, user, text) {
  fake.state.chat.message.push({ chatId: `u-${user}`, role: 'user', data: user });
  const output = await Pipeline.processOutput(text, 'main');
  fake.state.chat.message.push({ chatId: `r-${user}`, role: 'char', data: output });
}

function setup(id) {
  const fake = createFakeHost({
    chat: { id: 'chat', message: [], scriptstate: {} },
    character: { chaId: id, name: 'Test' },
    settings: settings(id)
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  resetPendingRestore();
  return fake;
}

test('a failed commit keeps its cards in plugin storage and a reload lands them', async () => {
  const fake = setup('p1');
  await reply(fake, '검', sword);
  fake.state.onWrite = () => {
    throw new Error('PostgreSQL data changed in another session');
  };
  await assert.rejects(Pipeline.catchUpLatestOutput({ syncUi: false }));
  const stored = JSON.parse(fake.state.storage.get(PENDING_STORE_KEY));
  assert.equal(Object.keys(stored['p1:chat']).length, 1);
  assert.equal(Object.keys(documentOf(fake.state.chat).events).length, 0);
  // Reload: memory is gone, storage is not.
  Session.resetSession('p1:chat');
  resetPendingRestore();
  fake.state.onWrite = null;
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const doc = documentOf(fake.state.chat);
  assert.equal(Object.values(doc.events)[0].e.item.id, 'blade');
  assert.equal(Object.values(doc.events)[0].c, 'r-검');
  assert.deepEqual(JSON.parse(fake.state.storage.get(PENDING_STORE_KEY)), {});
});

test('cards of an earlier reply whose commit failed land with the next reply', async () => {
  const fake = setup('p2');
  await reply(fake, '검', sword);
  fake.state.onWrite = () => {
    throw new Error('rejected');
  };
  await assert.rejects(Pipeline.catchUpLatestOutput({ syncUi: false }));
  fake.state.onWrite = null;
  await reply(fake, '포션', potion);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const doc = documentOf(fake.state.chat);
  const owners = Object.fromEntries(Object.values(doc.events).map((row) => [row.e.item.id, row.c]));
  assert.deepEqual(owners, { blade: 'r-검', potion: 'r-포션' });
});
