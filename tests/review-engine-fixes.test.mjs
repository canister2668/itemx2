import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/engine/core.js';
import * as codex from '../src/engine/codex.js';
import * as lore from '../src/engine/lorebook.js';
import * as backup from '../src/engine/backup.js';

const run = (text, reg = core.newRegistry()) => core.extractResponse(text, reg);
const item = (id, name, extra = '') =>
  `[itemx: id=${id} | name=${name} | type=장검 | emoji=🗡️ | rarity=rare | display=레어 | possession=owned | location=inventory${extra}]`;
const RESERVED = ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf'];

test('reserved names are never item ids and never touch Object.prototype', () => {
  for (const id of RESERVED) {
    const patched = run(`[itemx: id=${id} | action=acquire]`);
    assert.equal(patched.events.length, 0, id);
    assert.deepEqual(patched.errors, ['patch_no_id'], id);
    const exam = run(item(id, '검'));
    assert.equal(exam.events.length, 1, id);
    assert.match(exam.events[0].item.id, /^itmx_/, id);
    assert.deepEqual(run(`[itemx: action=transform | inputs=${id}:1 | outputs=${id}:1]`).errors, [
      'patch_transform_shape'
    ]);
    assert.deepEqual(run(`[itemx: action=swap | unequip=${id} | equip=${id} | slot=main_hand]`).errors, [
      'patch_swap_shape'
    ]);
  }
  assert.equal({}.possession, undefined);
  // A stored event is replayed without the parser in front of it.
  const reg = core.newRegistry();
  const stored = (id) => ({ id, action: 'acquire', op: null, fields: {}, quantity: 1 });
  for (const id of RESERVED) {
    assert.equal(core.applyEvent(reg, { kind: 'patch', patch: stored(id) }), null, id);
    assert.equal(
      core.applyEvent(reg, { kind: 'exam', item: { ...core.normalizeItem({ name: '검' }).item, id } }),
      null
    );
  }
  assert.equal({}.possession, undefined);
  assert.deepEqual(reg.order, []);
  // A field key the model invents is not a field.
  assert.equal(run('[itemx: id=sword | name=검 | constructor=x | __proto__=y]').events[0].item.name, '검');
});

test('reserved names are never codex ids', () => {
  for (const id of RESERVED) {
    for (const tag of ['skillPatch', 'monsterPatch']) {
      const patched = codex.extractResponse(`<${tag}><id>${id}</id><op>merge</op><name>x</name></${tag}>`);
      assert.equal(patched.events.length, 0, `${tag} ${id}`);
      assert.match(patched.errors[0], /_patch_no_id$/);
    }
    const exam = codex.extractResponse(`<skillExam><id>${id}</id><name>월영참</name></skillExam>`);
    assert.match(exam.events[0].entity.id, /^skill_/, id);
    const state = codex.snapshot();
    const patch = { id, action: null, op: 'merge', fields: { name: 'x' } };
    assert.equal(codex.applyEvent(state, { domain: 'skill', kind: 'patch', patch }), null, id);
    assert.equal(
      codex.applyEvent(state, {
        domain: 'skill',
        kind: 'exam',
        entity: { id, name: 'x', type: 'active', status: 'learned', effects: [] }
      }),
      null,
      id
    );
  }
  assert.equal({}.name, undefined);
  assert.equal({}.status, undefined);
});

test('`-` clears text to an empty string and never removes a name or a type', () => {
  const base = run(item('sword', '강철검', ' | durability=80/100 | power=300 | affinity=fire')).registry;
  const cleared = run('[itemx: id=sword | op=merge | durability=- | power=- | affinity=-]', base);
  assert.deepEqual(cleared.errors, []);
  assert.equal(cleared.registry.items.sword.durability, '');
  assert.equal(cleared.registry.items.sword.power, '');
  assert.equal(cleared.registry.items.sword.affinity, null);
  const named = run('[itemx: id=sword | op=merge | name=- | type=- | rarity=- | trivia=-]', base);
  assert.equal(named.registry.items.sword.name, '강철검');
  assert.equal(named.registry.items.sword.itemType, '장검');
  assert.equal(named.registry.items.sword.rarity, 'rare');
  assert.equal(named.registry.items.sword.trivia, '');
  assert.deepEqual(run('[itemx: id=sword | op=merge | name=-]', base).errors, ['patch_empty_merge']);
  // An event stored by an older version still carries null.
  const reg = core.clone(base);
  const fields = { name: null, itemType: null, durability: null, displayRarity: null };
  core.applyEvent(reg, { kind: 'patch', patch: { id: 'sword', action: null, op: 'merge', fields } });
  assert.equal(reg.items.sword.name, '강철검');
  assert.equal(reg.items.sword.itemType, '장검');
  assert.equal(reg.items.sword.durability, '');
  assert.equal(reg.items.sword.displayRarity, '레어');
});

test('a backup is captured from a chat that already stores null text', () => {
  const registry = run(item('sword', '강철검', ' | durability=80/100')).registry;
  Object.assign(registry.items.sword, { durability: null, trivia: null, name: null, itemType: null });
  const loaded = { snapshot: { registry }, codexSnapshot: codex.snapshot(), prefs: {}, character: { name: '검증' } };
  const saved = backup.capture(loaded).records.item[0].entity;
  assert.equal(saved.durability, '');
  assert.equal(saved.trivia, '');
  assert.equal(saved.itemType, '');
  assert.equal(saved.name, 'sword');
  // An imported file is still held to the strict shape.
  const file = JSON.parse(JSON.stringify(backup.capture(loaded)));
  file.records.item[0].entity.durability = null;
  assert.throws(() => backup.parse(JSON.stringify(file)));
});

test('a merge takes enum values in any case and keeps the old value over an invalid one', () => {
  const base = run(item('sword', '강철검', ' | theme=oriental | affinity=fire | condition=blessed')).registry;
  const merged = run('[itemx: id=sword | op=merge | rarity=Epic | theme=Forged | affinity=Ice]', base).registry.items
    .sword;
  assert.equal(merged.rarity, 'epic');
  assert.equal(merged.theme, 'forged');
  assert.equal(merged.affinity, 'ice');
  const kept = run(
    '[itemx: id=sword | op=merge | rarity=godlike | theme=steampunk | affinity=water | condition=odd]',
    base
  ).registry.items.sword;
  assert.equal(kept.rarity, 'rare');
  assert.equal(kept.theme, 'oriental');
  assert.equal(kept.affinity, 'fire');
  assert.equal(kept.condition, 'blessed');
});

test('scalar fields are read around nested effect and augment blocks', () => {
  const parsed = run(
    '<itemExam id="s1" name="강철검"><trivia>오래된 검</trivia><effects><effect><name>출혈</name><desc>피해</desc></effect></effects><augments><augment><name>룬</name><description>강화</description></augment></augments></itemExam>'
  ).registry.items.s1;
  assert.equal(parsed.name, '강철검');
  assert.equal(parsed.trivia, '오래된 검');
  assert.deepEqual(parsed.effects, [{ name: '출혈', desc: '피해' }]);
  assert.deepEqual(parsed.augments, [{ name: '룬', desc: '강화' }]);
  const inner = run(
    '<itemExam><id>s2</id><effects><effect><name>출혈</name><desc>피해</desc></effect></effects><name>철검</name></itemExam>'
  ).registry.items.s2;
  assert.equal(inner.name, '철검');
  assert.equal(inner.trivia, '');
  // The flat text form of an effect list still reads.
  const flat = run('<itemExam><id>s3</id><name>동검</name><effects>출혈::피해 ;; 화상::불</effects></itemExam>')
    .registry.items.s3;
  assert.deepEqual(
    flat.effects.map((one) => one.name),
    ['출혈', '화상']
  );
});

test('decorated skill numbers are read by their leading number', () => {
  const first = codex.extractResponse(
    '<skillExam><id>slash</id><name>월영참</name><level>Lv.4</level><mastery>60%</mastery></skillExam>'
  );
  assert.equal(first.snapshot.skills.entries.slash.level, 4);
  assert.equal(first.snapshot.skills.entries.slash.mastery, 60);
  const next = codex.extractResponse(
    '<skillPatch><id>slash</id><action>mastery</action><mastery>75 %</mastery><level>Lv. 5</level></skillPatch>',
    first.snapshot
  );
  assert.deepEqual(next.events[0].patch.fields, { level: 5, mastery: 75 });
  assert.equal(next.snapshot.skills.entries.slash.level, 5);
  assert.equal(next.snapshot.skills.entries.slash.mastery, 75);
  const none = codex.extractResponse(
    '<skillPatch><id>slash</id><op>merge</op><mastery>높음</mastery></skillPatch>',
    next.snapshot
  );
  assert.equal(none.snapshot.skills.entries.slash.mastery, 75);
});

test('a number in the narrative does not override the number the tag gives', () => {
  const text =
    'Lv.30 오우거를 향해 화염구를 날렸다. 화염구 숙련도 90%의 마법사도 있다지만.\n<skillExam><id>fireball</id><name>화염구</name><level>3</level><mastery>20</mastery></skillExam>';
  const skill = codex.extractResponse(text).snapshot.skills.entries.fireball;
  assert.equal(skill.level, 3);
  assert.equal(skill.mastery, 20);
  assert.deepEqual(skill._inferred || [], []);
  // Without a number in the tag the narrative still supplies one.
  const bare = codex.extractResponse(
    '화염구 Lv.7, 숙련도 45%.\n<skillExam><id>fireball</id><name>화염구</name></skillExam>'
  ).snapshot.skills.entries.fireball;
  assert.equal(bare.level, 7);
  assert.equal(bare.mastery, 45);
});

const monsters = (monster = {}) => ({
  fingerprint: 'base',
  monsters: {
    order: ['ogre'],
    entries: {
      ogre: { id: 'ogre', name: '오우거', aliases: [], kind: '미분류', portrait: 'NONE', description: '', ...monster }
    }
  }
});

test('only the block below the public marker is public lore', () => {
  const content = '설명: 사실은 왕의 숨겨진 아들이다.\n종류: 비밀\n[ITEMX-PUBLIC]\n종류: 거인\n별칭: 숲의 주인';
  assert.deepEqual(lore.publicFields({ content }), { kind: '거인', aliases: ['숲의 주인'] });
  assert.deepEqual(lore.publicFields({ content: '설명: 비밀\n[ITEMX-PUBLIC]' }), {});
  assert.deepEqual(lore.publicFields({ content: '[ITEMX-PUBLIC]\n설명: 숲에 산다.' }), { description: '숲에 산다.' });
});

test('a matched lore entry without a comment adds no empty alias', () => {
  const plain = lore.scan(monsters(), [{ key: '오우거', content: '비공개 설정.' }], lore.emptyLedger());
  assert.equal(plain.result.matched, 1);
  assert.equal(plain.result.enriched, 0);
  assert.deepEqual(plain.ledger.rows, {});
  const described = lore.scan(
    monsters(),
    [{ key: '오우거', content: '[ITEMX-PUBLIC]\n종류: 거인' }],
    lore.emptyLedger()
  );
  assert.deepEqual(described.ledger.rows.ogre.fields, { kind: '거인' });
});

test('removing money leaves an empty balance in the wallet', () => {
  const gold = run(
    '[itemx: id=money_gold | name=골드 | type=재화 | emoji=🪙 | rarity=normal | display=일반 | possession=owned | location=inventory | count=1200]'
  ).registry;
  const removed = run('[itemx: id=money_gold | op=remove | reason=강탈]', gold);
  assert.deepEqual(removed.errors, []);
  const money = removed.registry.items.money_gold;
  assert.equal(money.possession, 'owned');
  assert.equal(money.location, 'inventory');
  assert.equal(money.count, 0);
  assert.equal(money.removedReason, null);
  assert.match(core.walletLine(removed.registry), /money_gold=0 골드/);
  // Anything else is still removed.
  const sword = run('[itemx: id=sword | op=remove]', run(item('sword', '검')).registry).registry.items.sword;
  assert.equal(sword.possession, 'removed');
});

test('a potion is not a cannon', () => {
  assert.equal(core.itemEmojiFallback({ name: '체력 포션' }), '🧪');
  assert.equal(core.itemEmojiFallback({ itemType: '소모품', name: '마나 포션' }), '🧪');
  assert.equal(core.itemEmojiFallback({ name: '포대' }), '📦');
  assert.equal(core.itemEmojiFallback({ name: '대포' }), '🔫');
  assert.equal(core.itemEmojiFallback({ itemType: '포', name: '철갑탄 발사기' }), '🔫');
  assert.equal(core.itemEmojiFallback({ name: '권총' }), '🔫');
});

const mat = (id, name, count) =>
  `[itemx: id=${id} | name=${name} | type=재료 | emoji=🪨 | rarity=normal | display=일반 | possession=owned | location=inventory | count=${count}]`;
const TRANSFORM = '[itemx: action=transform | inputs=ore:3,coal:1 | outputs=ingot:1 | reason=제련]';

test('a transform makes an output the same response appraises, in either order', () => {
  const base = run(`${mat('ore', '광석', 5)}\n${mat('coal', '석탄', 2)}`).registry;
  for (const text of [
    `${TRANSFORM}\n${mat('ingot', '강철 주괴', 1)}`,
    `${mat('ingot', '강철 주괴', 1)}\n${TRANSFORM}`
  ]) {
    const result = run(text, base);
    assert.deepEqual(result.errors, [], text);
    assert.equal(result.events.length, 2);
    const reg = result.registry;
    assert.equal(reg.items.ore.count, 2);
    assert.equal(reg.items.coal.count, 1);
    assert.equal(reg.items.ingot.count, 1);
    assert.equal(reg.items.ingot.name, '강철 주괴');
    assert.equal(reg.items.ingot.itemType, '재료');
    assert.equal(reg.items.ingot.possession, 'owned');
    assert.deepEqual(reg.order, ['ore', 'coal', 'ingot']);
    // The stored events alone rebuild the same state.
    const replayed = core.clone(base);
    for (const event of result.events) assert.ok(core.applyEvent(replayed, event));
    assert.deepEqual(replayed.items, reg.items);
    assert.deepEqual(replayed.order, reg.order);
  }
  // Two transforms into the same new output add up.
  const twice = run(
    `${mat('ingot', '강철 주괴', 1)}\n${TRANSFORM}\n[itemx: action=transform | inputs=ore:2 | outputs=ingot:2]`,
    base
  );
  assert.equal(twice.registry.items.ingot.count, 3);
  assert.equal(twice.registry.items.ore.count, 0);
});

test('a transform into an unknown output is refused whole, with its own diagnostic', () => {
  const base = run(`${mat('ore', '광석', 5)}\n${mat('coal', '석탄', 2)}`).registry;
  const result = run(TRANSFORM, base);
  assert.deepEqual(result.errors, ['action_transform_unknown_output']);
  assert.deepEqual(result.registry.diagnostics.at(-1), { code: 'action_transform_unknown_output', detail: 'ingot' });
  assert.equal(result.registry.items.ore.count, 5);
  assert.equal(result.registry.items.ingot, undefined);
  // An output already held adds up as before.
  const held = run(mat('ingot', '강철 주괴', 2), base).registry;
  assert.equal(run(TRANSFORM, held).registry.items.ingot.count, 3);
  assert.equal(run(`${mat('ingot', '강철 주괴', 9)}\n${TRANSFORM}`, held).registry.items.ingot.count, 3);
});

const many = (count, size = 0) => {
  const reg = core.newRegistry();
  for (let i = 0; i < count; i += 1) {
    const one = core.normalizeItem({
      id: `item_${i}`,
      name: `물건 ${i}${'가'.repeat(size)}`,
      type: '재료',
      possession: 'owned',
      location: i === 1 ? 'equipped' : 'inventory',
      slot: i === 1 ? 'main_hand' : ''
    }).item;
    delete one._provided;
    core.applyEvent(reg, { kind: 'exam', item: one });
  }
  return reg;
};
const rowIds = (text) => [...text.matchAll(/^- id=([^ ]+)/gm)].map((match) => match[1]);

test('the request inventory prints only what differs from owned / inventory and money once', () => {
  let reg = run(
    '[itemx: id=money_gold | name=골드 | type=재화 | emoji=🪙 | rarity=normal | display=일반 | possession=owned | location=inventory | count=1200]'
  ).registry;
  reg = run(item('sword', '검'), reg).registry;
  reg = run('[itemx: id=sword | action=equip | slot=main_hand]', reg).registry;
  reg = run('[itemx: id=relic | name=유물 | type=기타 | emoji=🏺 | rarity=rare | display=레어]', reg).registry;
  reg = run(item('herb', '약초', ' | count=3'), reg).registry;
  const text = core.anchor({ registry: reg });
  const lines = text.split('\n');
  assert.equal(lines[1], '- WALLET (money; reuse these ids): money_gold=1200 골드');
  assert.deepEqual(lines.slice(2, 5), [
    '- id=sword | name=검 | type=장검 | rarity=rare | location=equipped | count=1 | slot=main_hand',
    '- id=relic | name=유물 | type=기타 | rarity=rare | possession=observed | location=unknown | count=1',
    '- id=herb | name=약초 | type=장검 | rarity=rare | count=3'
  ]);
  assert.equal(text.match(/money_gold/g).length, 1);
  assert.match(lines[5], /^Rows without possession\/location are owned, in inventory\. /);
  assert.equal(core.stripInventoryEcho(`앞 문단.\n${text}\n뒤 문단.`), '앞 문단.\n뒤 문단.');
});

test('over budget the request inventory drops the oldest rows, never the newest', () => {
  const reg = many(40, 40);
  const full = core.anchor({ registry: reg });
  assert.deepEqual(rowIds(full), ['item_1', 'item_0', ...Array.from({ length: 38 }, (_, i) => `item_${i + 2}`)]);
  assert.doesNotMatch(full, /not listed/);
  const max = 1500;
  const text = core.anchor({ registry: reg }, max);
  const ids = rowIds(text);
  const dropped = 40 - ids.length;
  assert.ok(dropped > 0 && ids.length > 2);
  // Worn gear first, then the newest items in registration order.
  assert.deepEqual(ids, ['item_1', ...Array.from({ length: ids.length - 1 }, (_, i) => `item_${dropped + 1 + i}`)]);
  assert.ok(text.includes(`\n- (${dropped} older items not listed)\n`));
  assert.ok(text.split('\nRows without')[0].length <= max);
  assert.equal(core.stripInventoryEcho(text), '');
  // Worn gear goes last of all, and a single omission reads as one item.
  assert.deepEqual(rowIds(core.anchor({ registry: many(2, 40) }, 260)), ['item_1']);
  assert.match(core.anchor({ registry: many(2, 40) }, 260), /\n- \(1 older item not listed\)\n/);
});

test('text without a transport returns the caller state without copying it', () => {
  const reg = run(item('sword', '검')).registry;
  const before = JSON.stringify(reg);
  const plain = core.extractResponse('그는 검을 뽑았다. [이름] <b>굵게</b>', reg);
  assert.equal(plain.registry, reg);
  assert.deepEqual([plain.content, plain.events, plain.errors], ['그는 검을 뽑았다. [이름] <b>굵게</b>', [], []]);
  const tagged = core.extractResponse('[itemx: id=sword | op=merge | power=10]', reg);
  assert.notEqual(tagged.registry, reg);
  assert.equal(JSON.stringify(reg), before);
  assert.notEqual(core.extractResponse('잘린 <itemExam', reg).registry, reg);

  const state = codex.extractResponse('<skillExam><id>slash</id><name>월영참</name></skillExam>').snapshot;
  const frozen = JSON.stringify(state);
  const quiet = codex.extractResponse('평범한 문단. <b>굵게</b>', state, { reconcileExistingSkills: true });
  assert.equal(quiet.snapshot, state);
  assert.deepEqual([quiet.content, quiet.events, quiet.errors], ['평범한 문단. <b>굵게</b>', [], []]);
  const changed = codex.extractResponse(
    '<skillPatch><id>slash</id><action>mastery</action><mastery>50</mastery></skillPatch>',
    state
  );
  assert.notEqual(changed.snapshot, state);
  assert.equal(JSON.stringify(state), frozen);
});
