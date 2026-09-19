import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const chat = () => ({ message: ['a', 'b', 'c'].map(chatId => ({ chatId, data: '' })), scriptstate: { 'itemx:log': '{"v":1,"rows":[]}' } });
const event = { kind: 'exam', item: { id: 'sword', name: '검', itemType: '검', count: 1, possession: 'owned', location: 'inventory' } };
test('editing the middle message body invalidates replay memo', async () => {
  const { storage: s, core } = await presentationRuntime();
  const c = chat(); s.hydrate(c);
  c.message[1].data = core.marker({ v: core.VERSION, event });
  assert.match(s.hydrate(c).scriptstate[s.DTO.item], /sword/);
});
test('replacing a middle message identity invalidates history projection', async () => {
  const { storage: s } = await presentationRuntime();
  const c = chat();
  c.scriptstate[s.LOG] = JSON.stringify({ v: 1, rows: [{ id: 'manual:x', domain: 'item', afterIndex: 1, event }] });
  const first = s.hydrate(c);
  c.message[1].chatId = 'replacement';
  const second = s.hydrate(c);
  assert.notEqual(first.scriptstate[s.CACHE], second.scriptstate[s.CACHE]);
});
test('unpersisted DTO events participate in memo identity', async () => {
  const { storage: s } = await presentationRuntime();
  const c = chat(); s.hydrate(c);
  c.scriptstate[s.DTO.manual] = JSON.stringify([{ id: 'manual:x', afterIndex: 1, event }]);
  assert.match(s.hydrate(c).scriptstate[s.DTO.item], /sword/);
});
