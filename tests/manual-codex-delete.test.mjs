import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// Duplicate skills (one weapon mastery recorded under several ids) are removed by hand.
// The removal is a manual ledger row and must replay through the codex engine.
test('a manual skill removal survives persist and replay and hides only that skill', async () => {
  const { core, codex, storage } = await presentationRuntime();
  const exam = (id, name, cost) =>
    codex.marker({ v: 1, event: { domain: 'skill', kind: 'exam', entity: { id, name, type: 'passive', status: 'learned', cost, effects: [] } }, view: null });
  const text = [exam('sword_mastery', '검 숙련', '상시 적용'), exam('sword_mastery_2', '검 숙련', '지속 적용'), exam('bow_mastery', '활 숙련', '상시 적용')].join('\n');
  let chat = { message: [{ role: 'char', data: text, chatId: 'm0' }], scriptstate: {} };
  chat = storage.hydrate(storage.persist(chat));
  const before = storage.replay(chat).codex.skills.entries;
  assert.deepEqual(Object.keys(before).sort(), ['bow_mastery', 'sword_mastery', 'sword_mastery_2']);

  const removal = { domain: 'skill', kind: 'patch', patch: { id: 'sword_mastery_2', action: null, op: 'remove', fields: {} } };
  const manual = [{ at: 1, afterIndex: 0, label: '스킬 수동 삭제', event: removal, presentation: { previous: null, view: null } }];
  chat.scriptstate = { ...chat.scriptstate, [storage.DTO.manual]: JSON.stringify(manual) };
  chat = storage.hydrate(storage.persist(chat));
  const after = storage.replay(chat).codex.skills.entries;
  assert.equal(after.sword_mastery_2.status, 'lost');
  assert.equal(after.sword_mastery.status, 'learned');
  assert.equal(after.bow_mastery.status, 'learned');
  const log = JSON.parse(chat.scriptstate[storage.LOG]);
  assert.equal(log.rows.find((row) => row.event?.patch?.id === 'sword_mastery_2')?.domain, 'codex');
  // The model is shown current skills only, so it is not handed the deleted id to revive.
  const anchor = codex.anchor(storage.replay(chat).codex, '검 숙련과 활 숙련을 쓴다');
  assert.ok(anchor.includes('id=sword_mastery |'));
  assert.ok(!anchor.includes('sword_mastery_2'));
  assert.ok(anchor.includes('id=bow_mastery'));
});

test('a manual encounter purge removes the entry everywhere; a model purge is refused', async () => {
  const { codex, storage } = await presentationRuntime();
  const exam = (id, name) =>
    codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity: { id, name, relation: 'hostile', status: 'active', weaknesses: [], resistances: [], moves: [], aliases: [] } }, view: null });
  let chat = { message: [{ role: 'char', data: [exam('rika', '리카'), exam('rika_tank', '리카')].join('\n'), chatId: 'm0' }], scriptstate: {} };
  chat = storage.hydrate(storage.persist(chat));

  const state = storage.replay(chat).codex;
  assert.equal(codex.applyEvent(state, { domain: 'monster', kind: 'patch', patch: { id: 'rika_tank', action: null, op: 'purge', fields: {} } }), null);
  assert.ok(state.monsters.entries.rika_tank, 'a transport purge must not delete');

  const purge = { domain: 'monster', kind: 'patch', manual: true, patch: { id: 'rika_tank', action: null, op: 'purge', fields: {} } };
  chat.scriptstate = { ...chat.scriptstate, [storage.DTO.manual]: JSON.stringify([{ at: 1, afterIndex: 0, label: '수동 삭제', event: purge, presentation: { previous: null, view: null } }]) };
  chat = storage.hydrate(storage.persist(chat));
  const monsters = storage.replay(chat).codex.monsters;
  assert.deepEqual([...monsters.order], ['rika']);
  assert.equal(monsters.entries.rika_tank, undefined);
  assert.ok(!codex.anchor(storage.replay(chat).codex, '리카가 전차를 몬다').includes('rika_tank'));
});
