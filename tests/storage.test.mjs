import test from 'node:test';
import assert from 'node:assert/strict';
import { storageModel as store } from './helpers/storage.mjs';
import { rt } from './helpers/modules.mjs';
const plain = (value) => JSON.parse(JSON.stringify(value));

test('event-only canonical log regenerates both payload sides after cache loss and never truncates', async () => {
  const { core } = rt;
  const reg = core.newRegistry();
  const item = core.normalizeItem({ id: 'sword', name: '검', count: 2 }).item;
  const events = [
    { kind: 'exam', item },
    { kind: 'patch', patch: { id: 'sword', action: 'consume', quantity: 1, fields: {} } }
  ];
  const rows = events.map((event, index) => {
    const previous = core.comparisonView(reg.items.sword);
    const view = plain(core.applyEvent(reg, event));
    return { domain: 'item', ref: `i0_${index}_abc${index}`, payload: { v: 2, event, view, previous } };
  });
  const chat = {
    message: [{ chatId: 'a', data: rows.map((row) => `<!--ITEMX2@${row.ref}-->`).join('') }],
    scriptstate: { $__itemx2_message_events: JSON.stringify(rows) }
  };
  const persisted = store.persist(chat, { legacy: true }),
    document = store.log(persisted);
  assert.equal(document.rows.length, 2);
  assert.ok(document.rows.every((row) => !('payload' in row) && !('view' in row) && !('previous' in row)));
  persisted.scriptstate['itemx:cache'] = '{broken';
  const replayed = store.hydrate(persisted),
    derived = JSON.parse(replayed.scriptstate.$__itemx2_message_events);
  assert.deepEqual(
    derived.map((row) => row.payload.view),
    rows.map((row) => row.payload.view)
  );
  assert.deepEqual(
    derived.map((row) => row.payload.previous),
    plain(rows.map((row) => row.payload.previous))
  );
  persisted.message = [];
  assert.equal(store.replay(persisted).item.registry.items.sword.count, 1);
  assert.equal(store.persist(persisted).scriptstate['itemx:log'], persisted.scriptstate['itemx:log']);
});

test('legacy orphan refs remain historical facts without resurrecting removed entities', () => {
  const source = {
    message: [],
    scriptstate: {
      $__itemx2_message_events: JSON.stringify([
        {
          ref: 'i0_0_dead',
          domain: 'item',
          payload: { event: { kind: 'exam', item: { id: 'gone', name: 'gone', count: 1 } } }
        }
      ])
    }
  };
  const chat = store.persist(source, { legacy: true });
  assert.equal(store.log(chat).rows.length, 1);
  assert.equal(store.replay(chat).item.registry.order.length, 0);
});

test('reimporting an identical backup appends a fresh reset without discarding earlier facts', async () => {
  const { core, codex } = rt;
  const registry = core.newRegistry();
  core.applyEvent(registry, { kind: 'exam', item: core.normalizeItem({ id: 'pill', name: '약', count: 1 }).item });
  const checkpoint = {
    v: 2,
    item: { registry, history: {} },
    codex: { ...codex.snapshot(), history: { skill: {}, monster: {} } },
    boundary: -1,
    sealedThroughId: '',
    restored: true,
    rows: [],
    manual: []
  };
  let chat = store.persist({ message: [], scriptstate: { [store.DTO.baseline]: JSON.stringify(checkpoint) } });
  chat = store.hydrate(chat);
  chat.scriptstate[store.DTO.manual] = JSON.stringify([
    {
      at: 1,
      afterIndex: -1,
      event: { kind: 'patch', patch: { id: 'pill', action: 'consume', quantity: 1, fields: {} } }
    }
  ]);
  chat = store.persist(chat);
  assert.equal(store.replay(chat).item.registry.items.pill.count, 0);
  const before = plain(store.log(chat).rows);
  chat = store.hydrate(chat);
  chat.scriptstate[store.DTO.baseline] = JSON.stringify(checkpoint);
  chat.scriptstate[store.DTO.manual] = '[]';
  chat = store.persist(chat);
  assert.equal(store.replay(chat).item.registry.items.pill.count, 1);
  assert.deepEqual(plain(store.log(chat).rows.slice(0, before.length)), before);
  assert.equal(store.log(chat).rows.length, before.length + 1);
  assert.equal(store.persist(store.hydrate(chat)).scriptstate[store.LOG], chat.scriptstate[store.LOG]);
});
