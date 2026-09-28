import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, setHost, Session, Ledger } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { anchored, documentOf } from './helpers/ledger.mjs';

// Commits `events` as manual rows through the real ledger write and returns
// the replayed codex state of the written chat.
async function commitManual(chat, events, id) {
  const fake = createFakeHost({ chat: anchored(chat), character: { chaId: id, name: 'T' } });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  const loaded = await Ledger.rebuildCurrent();
  await Ledger.commitManualEvents(loaded, events, '수동 삭제', { source: 'manual' }, false);
  return { chat: fake.state.chat, codex: Ledger.project({ chat: fake.state.chat, key: 'k' }).codexSnapshot, loaded };
}

// Duplicate skills (one weapon mastery recorded under several ids) are removed by hand.
// The removal is a manual ledger row and must replay through the codex engine.
test('a manual skill removal survives persist and replay and hides only that skill', async () => {
  const { codex } = rt;
  const exam = (id, name, cost) =>
    codex.marker({
      v: 1,
      event: {
        domain: 'skill',
        kind: 'exam',
        entity: { id, name, type: 'passive', status: 'learned', cost, effects: [] }
      },
      view: null
    });
  const text = [
    exam('sword_mastery', '검 숙련', '상시 적용'),
    exam('sword_mastery_2', '검 숙련', '지속 적용'),
    exam('bow_mastery', '활 숙련', '상시 적용')
  ].join('\n');
  const chat = { message: [{ role: 'char', data: text, chatId: 'm0' }], scriptstate: {} };
  const before = Ledger.project({ chat: anchored(chat), key: 'k' }).codexSnapshot.skills.entries;
  assert.deepEqual(Object.keys(before).sort(), ['bow_mastery', 'sword_mastery', 'sword_mastery_2']);

  const removal = {
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'sword_mastery_2', action: null, op: 'remove', fields: {} }
  };
  const written = await commitManual(chat, [removal], 'skilldel');
  const after = written.codex.skills.entries;
  assert.equal(after.sword_mastery_2.status, 'lost');
  assert.equal(after.sword_mastery.status, 'learned');
  assert.equal(after.bow_mastery.status, 'learned');
  const manual = documentOf(written.chat).manual;
  assert.equal(manual.find((row) => row.e?.patch?.id === 'sword_mastery_2')?.d, 'codex');
  assert.equal(manual[0].a, 'm0');
  // The model is shown current skills only, so it is not handed the deleted id to revive.
  const anchor = codex.anchor(written.codex, '검 숙련과 활 숙련을 쓴다');
  assert.ok(anchor.includes('id=sword_mastery |'));
  assert.ok(!anchor.includes('sword_mastery_2'));
  assert.ok(anchor.includes('id=bow_mastery'));
});

test('a manual encounter purge removes the entry everywhere; a model purge is refused', async () => {
  const { codex } = rt;
  const exam = (id, name) =>
    codex.marker({
      v: 1,
      event: {
        domain: 'monster',
        kind: 'exam',
        entity: {
          id,
          name,
          relation: 'hostile',
          status: 'active',
          weaknesses: [],
          resistances: [],
          moves: [],
          aliases: []
        }
      },
      view: null
    });
  const chat = {
    message: [{ role: 'char', data: [exam('rika', '리카'), exam('rika_tank', '리카')].join('\n'), chatId: 'm0' }],
    scriptstate: {}
  };
  const state = Ledger.project({ chat: anchored(chat), key: 'k' }).codexSnapshot;
  assert.equal(
    codex.applyEvent(state, {
      domain: 'monster',
      kind: 'patch',
      patch: { id: 'rika_tank', action: null, op: 'purge', fields: {} }
    }),
    null
  );
  assert.ok(state.monsters.entries.rika_tank, 'a transport purge must not delete');

  const purge = {
    domain: 'monster',
    kind: 'patch',
    manual: true,
    patch: { id: 'rika_tank', action: null, op: 'purge', fields: {} }
  };
  const written = await commitManual(chat, [purge], 'purge');
  const monsters = written.codex.monsters;
  assert.deepEqual([...monsters.order], ['rika']);
  assert.equal(monsters.entries.rika_tank, undefined);
  assert.ok(!codex.anchor(written.codex, '리카가 전차를 몬다').includes('rika_tank'));
});
