import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// These were the exact literals duplicated across six files before the schema
// existed. They are pinned here so the derivation can never drift from the
// behaviour that shipped.
const ALIASES_AT_2_1_1 = {
  id: 'id', name: 'name', 이름: 'name', type: 'type', 분류: 'type', 종류: 'type', emoji: 'emoji',
  rarity: 'internalrarity', internalrarity: 'internalrarity', grade: 'internalrarity', 등급: 'internalrarity',
  display: 'displayrarity', displayrarity: 'displayrarity', 표기: 'displayrarity',
  power: 'power', 위력: 'power', required: 'required', 요구: 'required',
  durability: 'durability', 내구: 'durability', 내구도: 'durability',
  cost: 'cost', price: 'cost', value: 'cost', 가치: 'cost',
  possession: 'possession', location: 'location', count: 'count', slot: 'slot', pin: 'pin',
  theme: 'theme', craft: 'theme', affinity: 'affinity', affinity2: 'affinity2', condition: 'condition',
  effects: 'effects', effect: 'effects', augments: 'augments', augment: 'augments',
  trivia: 'trivia', desc: 'trivia', description: 'trivia',
  action: 'action', op: 'op', quantity: 'quantity', destination: 'destination',
  reason: 'reason', 사유: 'reason', inputs: 'inputs', outputs: 'outputs', equip: 'equip', unequip: 'unequip'
};
const TAGS_AT_2_1_1 =
  'id|name|type|emoji|internalrarity|displayrarity|power|required|durability|cost|possession|location|count|slot|pin|theme|craft|affinity2?|condition|trivia|effects?|effectname|effectdesc|augments?|augmentname|augmentdesc|action|op|quantity|destination|reason|inputs|outputs|equip|unequip';

test('the schema derives exactly the alias map that shipped', async () => {
  const { core } = await presentationRuntime();
  const derived = Object.fromEntries(
    core.ITEM_FIELDS.flatMap((f) => [f.transport, ...(f.aliases || [])].map((n) => [n, f.transport]))
  );
  assert.equal(Object.keys(derived).length, Object.keys(ALIASES_AT_2_1_1).length);
  for (const [alias, canonical] of Object.entries(ALIASES_AT_2_1_1))
    assert.equal(derived[alias], canonical, `alias ${alias} drifted`);
});

test('the schema derives exactly the residual-tag cleanup list that shipped', async () => {
  const { core } = await presentationRuntime();
  assert.equal(core.TRANSPORT_TAG_ALT, TAGS_AT_2_1_1);
});

test('anchor, backup and quality field orders are unchanged', async () => {
  const { core } = await presentationRuntime();
  assert.equal([...core.ANCHOR_OPTIONAL].join(','), 'slot,power,durability,theme,affinity,affinity2,condition');
  assert.equal(
    [...core.BACKUP_FIELDS].join(' '),
    'id name itemType emoji rarity displayRarity power required durability cost possession location count slot pin trivia theme affinity affinity2 condition effects augments'
  );
  assert.equal([...core.DETAIL_FIELDS].join(','), 'power,effects,augments,required,durability,cost');
});

test('every consumer reads the schema instead of its own copy', async () => {
  const [backup, quality, core] = await Promise.all(
    ['backup.js', 'quality.js', 'core.js'].map((f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'))
  );
  assert.ok(backup.includes('ITEMXCore.BACKUP_FIELDS'), 'backup.js must derive its whitelist');
  assert.ok(!/item: '[a-z]+ [a-z]/i.test(backup), 'backup.js still holds a literal field list');
  assert.ok(quality.includes('ITEMXCore.DETAIL_FIELDS'), 'quality.js must derive its detail fields');
  assert.ok(core.includes('${TRANSPORT_TAG_ALT}'), 'residual cleanup must derive its tag list');
  assert.ok(core.includes('for (const key of ANCHOR_OPTIONAL)'), 'anchor must derive its optional keys');
});

test('an order list that is not a permutation of the schema fails loudly', async () => {
  const core = await readFile(new URL('../src/core.js', import.meta.url), 'utf8');
  // The guard is what stops a new field being added without placing it.
  assert.match(core, /order is not a permutation of the schema/);
  const guard = core.slice(core.indexOf('const ordered ='), core.indexOf('const ANCHOR_OPTIONAL ='));
  const ordered = new Function(`${guard} return ordered;`)();
  assert.throws(() => ordered(['a'], ['a', 'b'], 'test'), /permutation/);
  assert.throws(() => ordered(['a', 'c'], ['a', 'b'], 'test'), /permutation/);
  assert.deepEqual(ordered(['b', 'a'], ['a', 'b'], 'test'), ['b', 'a']);
});

test('a backup still round-trips every schema field', async () => {
  const { core } = await presentationRuntime();
  for (const field of core.ITEM_FIELDS.filter((f) => f.backup))
    assert.ok(core.BACKUP_FIELDS.includes(field.key), `${field.key} missing from backups`);
});

test('a backup captures and restores every schema-carried field', async () => {
  const { core, backup } = await presentationRuntime();
  const item = {
    id: 'flame_sword', name: '화염검', itemType: '한손검', emoji: '🗡️', rarity: 'legendary',
    displayRarity: '전설', power: '4200', required: '레벨 40', durability: '80/100', cost: '1200 Gold',
    possession: 'owned', location: 'equipped', count: 1, slot: 'main_hand', pin: true, trivia: '오래된 검',
    theme: 'forged', affinity: 'fire', affinity2: null, condition: 'blessed',
    effects: [{ name: '화염', desc: '불태운다' }], augments: [{ name: '예리함', desc: '+10' }]
  };
  const loaded = {
    character: { name: '테스트' },
    chat: { message: [], scriptstate: {} },
    snapshot: { registry: { order: ['flame_sword'], items: { flame_sword: item } }, history: {} },
    codexSnapshot: {
      skills: { order: [], entries: {} },
      monsters: { order: [], entries: {} },
      history: { skill: {}, monster: {} }
    }
  };
  const value = backup.capture(loaded);
  const restored = value.records.item.find((row) => row.entity.id === 'flame_sword').entity;
  for (const key of core.BACKUP_FIELDS) {
    if (item[key] === null || item[key] === undefined) continue;
    assert.deepEqual(
      JSON.parse(JSON.stringify(restored[key])),
      JSON.parse(JSON.stringify(item[key])),
      `${key} did not survive the backup round-trip`
    );
  }
  // Nullable fields are preserved as null rather than dropped, and the exported
  // key order is the one every existing backup file already uses.
  assert.equal(restored.affinity2, null);
  assert.equal(
    Object.keys(restored).join(' '),
    core.BACKUP_FIELDS.filter((k) => item[k] !== undefined).join(' ')
  );
});
