import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, setHost, Session } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { anchored, documentOf } from './helpers/ledger.mjs';
import { DOCUMENT_KEY } from '../src/store/document.js';

// The full projection a backup captures, of a chat whose fixtures may still
// carry transport markers.
const backupState = (ctx) => rt.project({ ...ctx, chat: anchored(ctx.chat) }, {}, { full: true });

let harnessId = 0;
async function harness() {
  const id = `bot${++harnessId}`;
  const fake = createFakeHost({
    chat: { id: 'chat', name: '새 채팅', message: [], scriptstate: { $other: 'keep' } },
    character: { name: '검증', chaId: id },
    llm: false,
    settings: {
      v: 1,
      global: { badgePosition: 'rm' },
      characters: { [id]: { itemsEnabled: true, skillsEnabled: true, encountersEnabled: true, auxOutput: 'always' } }
    }
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  return {
    p: rt,
    api: rt,
    get ctx() {
      return {
        key: `${id}:${fake.state.chat.id}`,
        characterIndex: 0,
        chatIndex: 0,
        character: fake.state.character,
        chat: fake.state.chat
      };
    },
    set ctx(value) {
      if (value.chat) fake.state.chat = value.chat;
      if (value.key && value.key !== `${id}:chat`) fake.state.chat.id = value.key;
    },
    get writes() {
      return fake.state.writes;
    },
    race() {
      fake.state.onRead = (state) => {
        state.chat = { ...state.chat, note: 'concurrent' };
      };
    }
  };
}
function source(h) {
  const { core, codex } = h.p;
  const item = {
    kind: 'exam',
    item: core.normalizeItem({
      id: 'pill',
      name: '약',
      type: 'elixir',
      count: 3,
      possession: 'owned',
      location: 'inventory',
      affinity: 'fire',
      affinity2: 'wind',
      effects: [{ name: '회복', desc: '기력 회복' }]
    }).item
  };
  const weapon = {
    kind: 'exam',
    item: core.normalizeItem({
      id: 'sword',
      name: '검',
      type: 'weapon',
      count: 1,
      possession: 'owned',
      location: 'equipped',
      slot: 'hand',
      pin: true
    }).item
  };
  const first = codex.extractResponse(
    '<skillExam><id>s</id><name>검법</name><status>equipped</status><level>7</level><mastery>75</mastery></skillExam><monsterExam><id>m</id><name>상대</name><portrait>HanTaerim_combat</portrait><relation>hostile</relation><status>defeated</status><outcome>승리</outcome></monsterExam>'
  ).events;
  const messages = [
    { role: 'user', data: '진행', chatId: 'u1' },
    {
      role: 'char',
      data:
        '본문' +
        core.marker({ v: 2, event: item }) +
        core.marker({ v: 2, event: weapon }) +
        first.map((event) => codex.marker({ v: 1, event })).join(''),
      chatId: 'a1'
    },
    { role: 'user', data: '진행', chatId: 'u2' },
    {
      role: 'char',
      data: core.marker({
        v: 2,
        event: { kind: 'patch', patch: { id: 'pill', action: 'consume', quantity: 'all', fields: {} } }
      }),
      chatId: 'a2'
    },
    { role: 'user', data: '진행', chatId: 'u3' },
    { role: 'char', data: '응답', chatId: 'a3' }
  ];
  const chat = { id: 'old', message: messages, scriptstate: { $other: 'secret' } };
  const loaded = backupState({ character: h.ctx.character, chat });
  return h.api.backup.capture(loaded);
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('portable backup round trips all domains, history ages, equipment, and portrait names without chat secrets', async () => {
  const h = await harness(),
    value = source(h);
  assert.deepEqual(Array.from(h.api.backup.counts(value)), [2, 1, 1]);
  assert.equal(value.records.item[0].entity.possession, 'removed');
  assert.equal(value.records.monster[0].history.age, 2);
  value.records.item[0].kept = true;
  value.records.monster[0].archived = true;
  const text = JSON.stringify(value);
  assert.doesNotMatch(text, /secret|scriptstate|chatId|본문/);
  h.ctx.chat.message = [{ role: 'char', data: '손요약과 인사말', chatId: 'greeting' }];
  const before = plain(h.ctx.chat);
  const preview = await h.api.prepareBackupImport(text, h.ctx.key);
  assert.equal(h.writes, 0);
  await h.api.commitBackupImport(preview);
  assert.equal(h.writes, 1);
  assert.deepEqual(plain(h.ctx.chat.message), before.message);
  assert.equal(h.ctx.chat.scriptstate.$other, 'keep');
  const again = await h.api.exportCurrentBackup(h.ctx.key);
  assert.deepEqual(plain(again.records), plain(value.records));
  assert.equal(again.records.item[1].entity.location, 'equipped');
  assert.equal(again.records.monster[0].entity.portrait, 'HanTaerim_combat');
  await assert.rejects(() => h.api.prepareBackupImport(text, h.ctx.key), /이미 ITEMX/);
  assert.equal(h.writes, 1);
});

test('restored state survives new patches, a long chat, restart-style rebuild and cleanup', async () => {
  const h = await harness(),
    value = source(h);
  const preview = await h.api.prepareBackupImport(JSON.stringify(value), h.ctx.key);
  await h.api.commitBackupImport(preview);
  h.ctx.chat.message.push(
    { role: 'user', data: '검법 수련' },
    {
      role: 'char',
      data:
        '수련 완료 ' +
        h.p.codex.marker({
          v: 1,
          event: { domain: 'skill', kind: 'patch', patch: { id: 's', action: 'mastery', fields: { mastery: 80 } } }
        })
    }
  );
  h.ctx = { chat: anchored(h.ctx.chat) };
  let loaded = backupState(h.ctx);
  assert.equal(loaded.codexSnapshot.skills.entries.s.mastery, 80);
  assert.equal(h.api.history.entries(loaded, 'monster')[0].age, 3);
  assert.equal(h.api.history.currentEntities(loaded, 'monster').length, 0);
  assert.equal(h.api.history.entries(loaded, 'item')[0].remaining, 8);
  for (let i = 0; i < 70; i++) h.ctx.chat.message.push({ role: 'user', data: '진행' }, { role: 'char', data: '응답' });
  loaded = backupState(h.ctx);
  assert.equal(loaded.snapshot.registry.items.sword.location, 'equipped');
  assert.equal(loaded.codexSnapshot.skills.entries.s.mastery, 80);
  assert.equal(h.api.history.entries(loaded, 'monster')[0].age, 73);
  const cleared = backupState({ ...h.ctx, chat: h.api.cleanChatPluginData(h.ctx.chat).chat });
  assert.equal(cleared.snapshot.registry.order.length, 0);
  assert.equal(cleared.codexSnapshot.monsters.order.length, 0);
});

test('import refuses streaming, changed chats and concurrent writes; preview and cancellation never write', async () => {
  const h = await harness(),
    text = JSON.stringify(source(h));
  h.ctx.chat.isStreaming = true;
  await assert.rejects(() => h.api.prepareBackupImport(text, h.ctx.key), /応答|응답/);
  h.ctx.chat.isStreaming = false;
  let preview = await h.api.prepareBackupImport(text, h.ctx.key);
  h.ctx.chat.message.push({ role: 'user', data: 'changed' });
  await assert.rejects(() => h.api.commitBackupImport(preview), /변경/);
  preview = await h.api.prepareBackupImport(text, h.ctx.key);
  h.ctx = { ...h.ctx, key: 'other' };
  await assert.rejects(() => h.api.commitBackupImport(preview), /변경/);
  preview = await h.api.prepareBackupImport(text, h.ctx.key);
  h.race();
  await assert.rejects(() => h.api.commitBackupImport(preview), /변경/);
  assert.equal(h.writes, 0);
});

test('malformed, duplicate, unsupported and prototype-shaped backup entries are rejected without writes', async () => {
  const h = await harness(),
    value = plain(source(h));
  const invalid = ['not json', JSON.stringify({ ...value, version: 2 }), JSON.stringify({ ...value, records: {} })];
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    const v = structuredClone(value);
    v.records.item[0].entity.id = id;
    invalid.push(JSON.stringify(v));
  }
  const duplicate = structuredClone(value);
  duplicate.records.item.push(duplicate.records.item[0]);
  invalid.push(JSON.stringify(duplicate));
  const wrong = structuredClone(value);
  wrong.records.monster[0].entity.moves = {};
  invalid.push(JSON.stringify(wrong));
  for (const text of invalid) await assert.rejects(() => h.api.prepareBackupImport(text, h.ctx.key));
  assert.equal(h.writes, 0);
  assert.match(h.api.backupSettingsHtml(), /itemx2-setting-backup/);
});

test('backup keeps registries larger than old storage limits and preserves unknown skill progression', async () => {
  const h = await harness(),
    value = plain(source(h));
  value.records.item = Array.from({ length: 600 }, (_, i) => ({
    ...structuredClone(value.records.item[1]),
    entity: { ...structuredClone(value.records.item[1].entity), id: `item_${i}` }
  }));
  value.records.skill[0].entity.level = null;
  value.records.skill[0].entity.mastery = null;
  await h.api.commitBackupImport(await h.api.prepareBackupImport(JSON.stringify(value), h.ctx.key));
  const again = await h.api.exportCurrentBackup(h.ctx.key);
  assert.equal(again.records.item.length, 600);
  assert.equal(again.records.skill[0].entity.mastery, null);
  assert.equal(again.records.skill[0].entity.level, null);
});

test('explicit overwrite replaces all records and replay sources, preserving prose and other module state', async () => {
  const h = await harness(),
    backup = source(h),
    text = JSON.stringify(backup);
  const oldItem = h.p.core.normalizeItem({
    id: 'old_item',
    name: '이전 물건',
    possession: 'owned',
    location: 'inventory',
    count: 99
  }).item;
  const oldCodex = h.p.codex.extractResponse(
    '<skillExam><id>old_skill</id><name>이전 기술</name></skillExam><monsterExam><id>old_foe</id><name>이전 상대</name><relation>hostile</relation><status>active</status></monsterExam>'
  ).events;
  h.ctx.chat.message = [
    { role: 'user', data: '원문\n\n  유지', chatId: 'u' },
    {
      role: 'char',
      chatId: 'a',
      data:
        '이전 응답\n' +
        h.p.core.marker({ v: 2, event: { kind: 'exam', item: oldItem } }) +
        oldCodex.map((event) => h.p.codex.marker({ v: 1, event })).join('') +
        '<!--ITEMX2@oldref-->\n끝'
    }
  ];
  // Stored as 2.4 stores it: anchors plus the document, one aux guard recorded.
  const seeded = anchored(h.ctx.chat);
  const doc = documentOf(seeded);
  doc.guards.aux.a = { k: 'guard', state: 'none', events: 0 };
  doc.lore = { v: 1, rows: { stale: { fields: {} } }, updatedAt: 1 };
  seeded.scriptstate[DOCUMENT_KEY] = JSON.stringify(doc);
  seeded.scriptstate.$__itemx2_message_events = 'left for 2.3';
  h.ctx = { chat: seeded };
  await assert.rejects(() => h.api.prepareBackupImport(text, h.ctx.key), /이미 ITEMX/);
  const preview = await h.api.prepareBackupImport(text, h.ctx.key, 'replace');
  assert.deepEqual(Array.from(preview.previousCounts), [1, 1, 1]);
  assert.equal(h.writes, 0);
  await h.api.commitBackupImport(preview);
  assert.equal(h.writes, 1);
  assert.deepEqual(plain((await h.api.exportCurrentBackup(h.ctx.key)).records), plain(backup.records));
  assert.equal(h.ctx.chat.message[0].data, '원문\n\n  유지');
  // Anchors go with the replaced events; a marker of 2.3 stays (hidden) for its own action.
  assert.equal(h.ctx.chat.message[1].data, '이전 응답\n<!--ITEMX2@oldref-->\n끝');
  assert.equal(h.ctx.chat.scriptstate.$other, 'keep');
  assert.equal(h.ctx.chat.scriptstate.$__itemx2_message_events, 'left for 2.3');
  const restored = documentOf(h.ctx.chat);
  assert.deepEqual(restored.events, {});
  assert.deepEqual(restored.lore.rows, {});
  assert.equal(restored.guards.aux.a.k, 'guard');
  await h.api.commitBackupImport(await h.api.prepareBackupImport(text, h.ctx.key, 'replace'));
  assert.deepEqual(plain((await h.api.exportCurrentBackup(h.ctx.key)).records), plain(backup.records));
  h.ctx.chat.message.pop();
  assert.equal(backupState(h.ctx).snapshot.registry.items.old_item, undefined);
});

test('overwrite preview expires on chat edits and invalid modes cannot bypass protection', async () => {
  const h = await harness(),
    text = JSON.stringify(source(h));
  await h.api.commitBackupImport(await h.api.prepareBackupImport(text, h.ctx.key));
  const preview = await h.api.prepareBackupImport(text, h.ctx.key, 'replace');
  h.ctx.chat.message.push({ role: 'char', data: '편집된 대화', chatId: 'edit' });
  await assert.rejects(() => h.api.commitBackupImport(preview), /변경/);
  await assert.rejects(() => h.api.prepareBackupImport(text, h.ctx.key, 'merge'), /방식/);
  assert.equal(h.writes, 1);
});

test('restored replies are not automatically recollected; explicit recovery and later replies remain eligible', async () => {
  const h = await harness(),
    text = JSON.stringify(source(h));
  h.ctx.chat.message = [{ role: 'char', data: '오래된 대화', chatId: 'old' }];
  await h.api.commitBackupImport(await h.api.prepareBackupImport(text, h.ctx.key, 'replace'));
  assert.equal((await h.api.recoverAuxiliaryOutputNow()).reason, 'restored');
  assert.equal(
    (await h.api.recoverAuxiliaryOutputNow({ force: true })).reason,
    'no-model',
    'explicit recovery passes the restore guard and reaches the unavailable-model check'
  );
  h.ctx.chat.message.push({ role: 'user', data: '진행' }, { role: 'char', data: '새 응답' });
  assert.equal((await h.api.recoverAuxiliaryOutputNow()).reason, 'no-model', 'new response passes the restore guard');
});

test('explicit overwrite accepts an empty backup to restore an empty inventory', async () => {
  const h = await harness(),
    empty = h.api.backup.capture(backupState(h.ctx));
  await h.api.commitBackupImport(await h.api.prepareBackupImport(JSON.stringify(source(h)), h.ctx.key));
  await h.api.commitBackupImport(await h.api.prepareBackupImport(JSON.stringify(empty), h.ctx.key, 'replace'));
  assert.deepEqual(Array.from(h.api.backup.counts(await h.api.exportCurrentBackup(h.ctx.key))), [0, 0, 0]);
});
