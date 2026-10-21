import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, setHost, Session, Ledger, Pipeline, Quality, Replay } from './helpers/modules.mjs';
import { anchorKeys } from '../src/store/anchors.js';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf, itemExam, seedChat } from './helpers/ledger.mjs';
import {
  editEvent,
  editedFields,
  isLocked,
  lockAllEvent,
  parseLines,
  parseList,
  listText
} from '../src/ui/item-editor.js';

const { core } = rt;
const sword = (extra = {}) =>
  itemExam({
    id: 'old_sword',
    name: '낡은 검',
    type: '장검',
    internalrarity: 'normal',
    possession: 'owned',
    location: 'inventory',
    count: '1',
    effects: '날카로움::베기 피해 +1',
    trivia: '녹슨 검',
    ...extra
  });
const registryWith = (...events) => {
  const reg = core.newRegistry();
  for (const event of events) assert.ok(core.applyEvent(reg, event), JSON.stringify(event));
  return reg;
};
const edit = (fields, lock = Object.keys(fields)) => editEvent({ id: 'old_sword' }, fields, lock);
const flame = [{ name: '화염 부여', desc: '공격 시 화염 피해 +5' }];

test('a reader edit applies its fields and locks them', () => {
  const reg = registryWith(sword(), edit({ effects: flame, name: '불꽃 검' }));
  const item = reg.items.old_sword;
  assert.deepEqual(item.effects, flame);
  assert.equal(item.name, '불꽃 검');
  assert.deepEqual(item.locked, ['name', 'effects']);
});

test('a model reappraisal keeps locked fields and updates the rest', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  core.applyEvent(reg, sword({ effects: '무딤::피해 -1', trivia: '새로 감정한 검', power: '12' }));
  const item = reg.items.old_sword;
  assert.deepEqual(item.effects, flame);
  assert.equal(item.trivia, '새로 감정한 검');
  assert.equal(item.power, '12');
  assert.deepEqual(item.locked, ['effects']);
});

test('a model merge skips locked fields; a merge of only locked fields changes nothing', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  const patch = (fields) => ({ kind: 'patch', patch: { id: 'old_sword', action: null, op: 'merge', fields } });
  core.applyEvent(reg, patch({ effects: [{ name: '무딤', desc: '' }], trivia: '바뀐 설명' }));
  assert.deepEqual(reg.items.old_sword.effects, flame);
  assert.equal(reg.items.old_sword.trivia, '바뀐 설명');
  assert.ok(core.applyEvent(reg, patch({ effects: [] })));
  assert.deepEqual(reg.items.old_sword.effects, flame);
  assert.ok(reg.diagnostics.some((one) => one.code === 'patch_locked_field'));
});

test('a model never unlocks: transport tags cannot carry reader or lock', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  const parsed = core.extractResponse(
    '[itemx: id=old_sword | op=merge | effects=무딤::피해 -1 | reader=true | lock=]',
    reg
  );
  assert.equal(parsed.events[0].reader, undefined);
  assert.equal(parsed.events[0].patch.lock, undefined);
  assert.deepEqual(parsed.registry.items.old_sword.effects, flame);
});

test('possession still follows the story on a locked item', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  core.applyEvent(reg, { kind: 'patch', patch: { id: 'old_sword', action: 'equip', slot: 'main_hand', fields: {} } });
  assert.equal(reg.items.old_sword.location, 'equipped');
  core.applyEvent(reg, { kind: 'patch', patch: { id: 'old_sword', action: 'destroy', fields: {} } });
  assert.equal(reg.items.old_sword.possession, 'removed');
  assert.deepEqual(reg.items.old_sword.effects, flame);
});

test('a reader reappraisal rewrites locked fields and unlocking frees them', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  core.applyEvent(reg, { ...sword({ effects: '서리::냉기 피해 +3' }), reader: true });
  assert.equal(reg.items.old_sword.effects[0].name, '서리');
  assert.deepEqual(reg.items.old_sword.locked, ['effects']);
  core.applyEvent(reg, edit({}, []));
  assert.equal('locked' in reg.items.old_sword, false);
  core.applyEvent(reg, sword({ effects: '무딤::피해 -1' }));
  assert.equal(reg.items.old_sword.effects[0].name, '무딤');
});

test('editor helpers: list lines round-trip and the grade label follows the grade', () => {
  assert.deepEqual(parseList('화염 부여 :: 공격 시 화염 피해 +5\n\n  가벼움  \n'), [
    ...flame,
    { name: '가벼움', desc: '' }
  ]);
  assert.equal(listText(flame), '화염 부여 :: 공격 시 화염 피해 +5');
  const item = registryWith(sword()).items.old_sword;
  const same = editedFields(item, {
    name: item.name,
    itemType: item.itemType,
    rarity: item.rarity,
    displayRarity: item.displayRarity,
    effects: item.effects,
    affinity: null
  });
  assert.deepEqual(same, {});
  const up = editedFields(item, { rarity: 'epic', displayRarity: item.displayRarity });
  assert.deepEqual(up, { rarity: 'epic', displayRarity: '에픽' });
  const custom = editedFields({ ...item, displayRarity: '전승' }, { rarity: 'epic', displayRarity: '전승' });
  assert.deepEqual(custom, { rarity: 'epic' });
});

test('a reader edit survives the ledger write, replay and a later model exam', async () => {
  const chat = seedChat([{ role: 'char', data: '검을 주웠다.', chatId: 'm0', events: [sword()] }]);
  const fake = createFakeHost({ chat, character: { chaId: 'edit', name: 'T' } });
  setHost(fake.api);
  Session.resetSession('edit:chat');
  const loaded = await Ledger.rebuildCurrent();
  await Ledger.commitManualEvents(loaded, [edit({ effects: flame })], '직접 수정', { source: 'manual' }, false);
  const written = fake.state.chat;
  const row = documentOf(written).manual.at(-1);
  assert.equal(row.e.reader, true);
  const later = seedChat(
    [
      ...written.message.map((message) => ({ ...message })),
      { role: 'char', data: '다시 감정했다.', chatId: 'm1', events: [sword({ effects: '무딤::피해 -1', power: '9' })] }
    ],
    { doc: documentOf(written) }
  );
  const item = Ledger.project({ chat: later, key: 'k' }).snapshot.registry.items.old_sword;
  assert.deepEqual(item.effects, flame);
  assert.equal(item.power, '9');
  assert.deepEqual(item.locked, ['effects']);
});

test('backups carry the lock list', () => {
  const reg = registryWith(sword(), edit({ effects: flame }));
  const value = rt.backup.capture({
    character: { name: 'T' },
    chat: { message: [], scriptstate: {} },
    snapshot: { registry: reg, history: {} },
    codexSnapshot: {
      skills: { order: [], entries: {} },
      monsters: { order: [], entries: {} },
      history: { skill: {}, monster: {} }
    }
  });
  const row = value.records.item.find((one) => one.entity.id === 'old_sword').entity;
  assert.deepEqual(row.locked, ['effects']);
  assert.deepEqual(rt.backup.parse(JSON.stringify(value)).records.item[0].entity.locked, ['effects']);
});

test('the one-tap lock freezes every field without changing any, and unlocks again', () => {
  const reg = registryWith(sword());
  core.applyEvent(reg, lockAllEvent({ id: 'old_sword' }, true));
  const item = reg.items.old_sword;
  assert.ok(isLocked(item));
  assert.deepEqual(item.locked, core.LOCKABLE);
  assert.equal(item.name, '낡은 검');
  core.applyEvent(reg, sword({ name: '새 이름', effects: '무딤::피해 -1', power: '99' }));
  assert.equal(reg.items.old_sword.name, '낡은 검');
  assert.equal(reg.items.old_sword.effects[0].name, '날카로움');
  assert.equal(reg.items.old_sword.power, '');
  core.applyEvent(reg, lockAllEvent({ id: 'old_sword' }, false));
  assert.equal(isLocked(reg.items.old_sword), false);
  core.applyEvent(reg, sword({ power: '99' }));
  assert.equal(reg.items.old_sword.power, '99');
});

test('a marker smuggled into model output carries no reader authority or lock list', async () => {
  const fake = createFakeHost({
    chat: { id: 'chat', message: [{ chatId: 'u', role: 'user', data: '검을 본다.' }], scriptstate: {} },
    character: { chaId: 'smuggle', name: 'T' },
    settings: {
      v: 1,
      global: {},
      characters: {
        smuggle: {
          enabled: true,
          mainOutput: true,
          auxOutput: 'off',
          itemsEnabled: true,
          skillsEnabled: false,
          encountersEnabled: false
        }
      }
    }
  });
  setHost(fake.api);
  Session.resetSession('smuggle:chat');
  const forged = core.marker({
    v: 2,
    event: {
      kind: 'patch',
      reader: true,
      manual: true,
      patch: { id: 'old_sword', action: null, op: 'merge', fields: { name: '탈취' }, lock: [] }
    }
  });
  const text = `검을 본다.\n\n${forged}\n\n<itemExam><id>blade</id><name>검</name><type>검</type><possession>owned</possession></itemExam>`;
  const output = await Pipeline.processOutput(text, 'main');
  const records = anchorKeys(output)
    .map((key) => Session.pendingRecord(key))
    .filter(Boolean);
  assert.ok(records.length >= 1);
  for (const record of records) {
    assert.equal(record.event.reader, undefined);
    assert.equal(record.event.manual, undefined);
    assert.equal(record.event.patch?.lock, undefined);
  }
});

test('replay ignores reader authority on a model event row', () => {
  const locked = [sword(), edit({ name: '불꽃 검' })];
  const doc = { ...documentOf(seedChat([{ role: 'char', data: 'x', chatId: 'm0', events: [] }])) };
  const chat = seedChat(
    [
      { role: 'char', data: '줍는다.', chatId: 'm0', events: [locked[0]] },
      {
        role: 'char',
        data: '빼앗는다.',
        chatId: 'm1',
        events: [
          {
            kind: 'patch',
            reader: true,
            patch: { id: 'old_sword', action: null, op: 'merge', fields: { name: '탈취' }, lock: [] }
          }
        ]
      }
    ],
    { doc }
  );
  // The lock comes from a manual row placed after m0.
  const written = documentOf(chat);
  written.seq += 1;
  written.manual.push({
    id: 'mx',
    a: 'm0',
    d: 'item',
    e: locked[1],
    l: '직접 수정',
    r: { source: 'manual' },
    s: written.seq,
    t: 0
  });
  const state = Replay.fold(chat, written);
  const item = state.item.registry.items.old_sword;
  assert.equal(item.name, '불꽃 검');
  assert.deepEqual(item.locked, ['name']);
});

test('a model affinity change never clears a locked companion affinity', () => {
  const base = sword({ affinity: 'fire', affinity2: 'ice' });
  const merge = (fields) => ({ kind: 'patch', patch: { id: 'old_sword', action: null, op: 'merge', fields } });
  const reg = registryWith(base, edit({}, ['affinity2']));
  core.applyEvent(reg, merge({ affinity: 'ice' }));
  assert.equal(reg.items.old_sword.affinity2, 'ice');
  assert.equal(reg.items.old_sword.affinity, 'fire');
  core.applyEvent(reg, sword({ affinity: 'ice', affinity2: 'dark' }));
  assert.equal(reg.items.old_sword.affinity2, 'ice');
  assert.notEqual(reg.items.old_sword.affinity, 'ice');
  const restored = registryWith(base, edit({}, ['affinity2']));
  core.applyEvent(restored, {
    kind: 'patch',
    patch: { id: 'old_sword', action: null, op: 'restore', fields: { affinity: 'ice' } }
  });
  assert.equal(restored.items.old_sword.affinity2, 'ice');
  assert.equal(restored.items.old_sword.affinity, 'fire');
});

test('locked empty fields are not appraisal gaps and a repair of them is refused', () => {
  const gear = (extra) =>
    itemExam({
      id: 'plain_ring',
      name: '반지',
      type: '장신구',
      internalrarity: 'rare',
      possession: 'owned',
      location: 'inventory',
      count: '1',
      ...extra
    });
  const reg = registryWith(gear({}));
  assert.ok(Quality.appraisalGaps(reg.items.plain_ring).includes('effects'));
  core.applyEvent(reg, editEvent({ id: 'plain_ring' }, {}, ['effects', 'required', 'durability']));
  assert.deepEqual(Quality.appraisalGaps(reg.items.plain_ring), []);
  const fill = {
    kind: 'patch',
    patch: { id: 'plain_ring', action: null, op: 'merge', fields: { effects: [{ name: '빛', desc: '' }] } }
  };
  const rows = new Map([['plain_ring', { item: reg.items.plain_ring, gaps: ['effects'] }]]);
  assert.equal(Quality.acceptAppraisal(fill, rows, reg), null);
  assert.deepEqual(core.openMissing(reg.items.plain_ring, ['effects', 'power']), ['power']);
});

const skillExam = (extra = {}) => ({
  domain: 'skill',
  kind: 'exam',
  entity: {
    id: 'fire_bolt',
    name: '화염구',
    glyph: '🔥',
    rank: '중급',
    school: '화염 마법',
    type: 'active',
    status: 'learned',
    level: 3,
    mastery: 40,
    cost: '마나 10',
    cooldown: '짧은 휴식',
    target: '단일',
    affinity: '화염',
    description: '불덩이를 던진다.',
    effects: ['화상 부여'],
    growth: '',
    ...extra,
    // An exam only rewrites the fields it provides, as the transport parser marks them.
    _provided: ['name', 'type', 'status', ...Object.keys(extra)]
  }
});
const skillState = (...events) => {
  const state = rt.codex.snapshot();
  for (const event of events) assert.ok(rt.codex.applyEvent(state, event), JSON.stringify(event));
  return state;
};
const skillOf = (state) => state.skills.entries.fire_bolt;

test('a skill edit applies and locks; model exams and merges keep the locked fields', () => {
  const state = skillState(
    skillExam(),
    editEvent({ id: 'fire_bolt' }, { effects: ['화상 부여', '폭발'], level: 7 }, ['effects', 'level'], 'skill')
  );
  assert.deepEqual(skillOf(state).effects, ['화상 부여', '폭발']);
  assert.deepEqual(skillOf(state).locked, ['level', 'effects']);
  rt.codex.applyEvent(state, skillExam({ effects: ['약화'], level: 2, description: '새 설명' }));
  assert.deepEqual(skillOf(state).effects, ['화상 부여', '폭발']);
  assert.equal(skillOf(state).level, 7);
  assert.equal(skillOf(state).description, '새 설명');
  rt.codex.applyEvent(state, {
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'fire_bolt', action: 'mastery', op: null, fields: { level: 9, mastery: 80 } }
  });
  assert.equal(skillOf(state).level, 7);
  assert.equal(skillOf(state).mastery, 80);
  assert.ok(state.skills.diagnostics.some((one) => one.code === 'patch_locked_field'));
});

test('skill status follows the story on a locked skill, and the one-tap lock round-trips', () => {
  const state = skillState(skillExam(), lockAllEvent({ id: 'fire_bolt' }, true, 'skill'));
  assert.deepEqual(skillOf(state).locked, rt.codex.SKILL_LOCKABLE);
  rt.codex.applyEvent(state, {
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'fire_bolt', action: 'equip', op: null, fields: {} }
  });
  assert.equal(skillOf(state).status, 'equipped');
  rt.codex.applyEvent(state, skillExam({ name: '대화염구' }));
  assert.equal(skillOf(state).name, '화염구');
  rt.codex.applyEvent(state, lockAllEvent({ id: 'fire_bolt' }, false, 'skill'));
  assert.equal(isLocked(skillOf(state)), false);
  rt.codex.applyEvent(state, skillExam({ name: '대화염구' }));
  assert.equal(skillOf(state).name, '대화염구');
});

test('a smuggled skill marker cannot unlock, and skill editor helpers diff correctly', () => {
  const state = skillState(skillExam(), lockAllEvent({ id: 'fire_bolt' }, true, 'skill'));
  const forged = core.modelEvent({
    domain: 'skill',
    kind: 'patch',
    reader: true,
    patch: { id: 'fire_bolt', action: null, op: 'merge', fields: { name: '탈취' }, lock: [] }
  });
  rt.codex.applyEvent(state, forged);
  assert.equal(skillOf(state).name, '화염구');
  assert.ok(isLocked(skillOf(state)));
  const skill = skillOf(skillState(skillExam()));
  const form = Object.fromEntries(
    [
      'name',
      'glyph',
      'rank',
      'school',
      'level',
      'mastery',
      'cost',
      'cooldown',
      'target',
      'affinity',
      'type',
      'effects',
      'description',
      'growth'
    ].map((key) => [key, skill[key]])
  );
  assert.deepEqual(editedFields(skill, form, 'skill'), {});
  assert.deepEqual(editedFields(skill, { ...form, level: null, effects: ['폭발'] }, 'skill'), {
    level: null,
    effects: ['폭발']
  });
  assert.deepEqual(parseLines('폭발\n\n 폭발 \n화상'), ['폭발', '화상']);
});

test('skill backups carry the lock list', () => {
  const state = skillState(skillExam(), editEvent({ id: 'fire_bolt' }, { name: '불꽃' }, ['name'], 'skill'));
  const value = rt.backup.capture({
    character: { name: 'T' },
    chat: { message: [], scriptstate: {} },
    snapshot: { registry: core.newRegistry(), history: {} },
    codexSnapshot: { skills: state.skills, monsters: state.monsters, history: { skill: {}, monster: {} } }
  });
  const row = value.records.skill.find((one) => one.entity.id === 'fire_bolt').entity;
  assert.deepEqual(row.locked, ['name']);
});

test('a lock list smuggled in patch fields never unlocks, even for the next event', () => {
  const rename = (name) => ({
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'fire_bolt', action: null, op: 'merge', fields: { name } }
  });
  const state = skillState(skillExam(), editEvent({ id: 'fire_bolt' }, { name: '불꽃' }, ['name'], 'skill'));
  const smuggled = {
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'fire_bolt', action: null, op: 'merge', fields: { locked: [], description: '바뀐 설명' } }
  };
  rt.codex.applyEvent(state, smuggled);
  rt.codex.applyEvent(state, rename('모델 이름'));
  assert.equal(skillOf(state).name, '불꽃');
  assert.deepEqual(skillOf(state).locked, ['name']);
  assert.equal(core.modelEvent(smuggled).patch.fields.locked, undefined);

  const reg = registryWith(sword(), edit({ name: '불꽃 검' }));
  const merge = (fields) => ({ kind: 'patch', patch: { id: 'old_sword', action: null, op: 'merge', fields } });
  core.applyEvent(reg, merge({ locked: [], trivia: '바뀜' }));
  core.applyEvent(reg, merge({ name: '모델 이름' }));
  assert.equal(reg.items.old_sword.name, '불꽃 검');
  assert.deepEqual(reg.items.old_sword.locked, ['name']);
});

test('a refused level or mastery change keeps the estimate mark of the locked value', () => {
  const state = skillState(skillExam(), lockAllEvent({ id: 'fire_bolt' }, true, 'skill'));
  skillOf(state)._inferred = ['level', 'mastery'];
  rt.codex.applyEvent(state, {
    domain: 'skill',
    kind: 'patch',
    patch: { id: 'fire_bolt', action: 'mastery', op: null, fields: { level: 20, mastery: 99 } }
  });
  assert.equal(skillOf(state).level, 3);
  assert.equal(skillOf(state).mastery, 40);
  assert.deepEqual(skillOf(state)._inferred, ['level', 'mastery']);
  rt.codex.applyEvent(state, skillExam({ level: 20, mastery: 99 }));
  assert.equal(skillOf(state).level, 3);
  assert.deepEqual([...skillOf(state)._inferred].sort(), ['level', 'mastery']);
  // The reader's own number is not an estimate.
  rt.codex.applyEvent(state, editEvent({ id: 'fire_bolt' }, { level: 5 }, rt.codex.SKILL_LOCKABLE, 'skill'));
  assert.deepEqual(skillOf(state)._inferred, ['mastery']);
});
