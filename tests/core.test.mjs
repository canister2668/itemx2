import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console, Buffer, TextEncoder, TextDecoder, setTimeout, clearTimeout });
vm.runInContext(await readFile(resolve(root, 'src/core.js'), 'utf8'), context);
vm.runInContext(await readFile(resolve(root, 'src/renderer.js'), 'utf8'), context);
const core = context.ITEMXCore;
const renderer = context.ITEMXRenderer;

const exam = (id, name, extra = '') => `<itemExam><id>${id}</id><name>${name}</name><type>장검</type><emoji>⚔️</emoji><internalrarity>legendary</internalrarity><displayrarity>전설</displayrarity><power>7600-9400</power><required>레벨 42</required><durability>77/100</durability><cost>48000 G</cost><possession>owned</possession><location>inventory</location>${extra}<trivia>검증용 아이템.</trivia></itemExam>`;

test('multiple items are extracted in order and raw transports never survive', () => {
  const input = `첫 아이템.\n${exam('blade_a', '첫 번째 검')}\n둘째.\n[itemx: id=blade_b | name=두 번째 검 | type=장검 | emoji=🗡️ | rarity=epic | display=에픽 | possession=owned | location=inventory | power=2400-3200 | durability=90/100]\n셋째.\n${exam('blade_c', '세 번째 검')}`;
  const result = core.extractResponse(input, core.newRegistry());
  assert.equal(result.events.length, 3);
  assert.deepEqual(Array.from(result.registry.order), ['blade_a', 'blade_b', 'blade_c']);
  assert.equal(/<\/?item|\[itemx:/i.test(result.content), false);
  assert.equal(core.eventsFromText(result.content).length, 3);
});

test('exam provenance stays on the event but never leaks into registry or view', () => {
  const result = core.extractResponse('<itemExam><id>plain_ore</id><name>무쇠 광석</name><type>재료</type><emoji>❔</emoji><possession>owned</possession><location>inventory</location></itemExam>', core.newRegistry());
  assert.ok(result.events[0].item._provided.includes('emoji'));
  assert.equal(result.events[0].item._provided.includes('effects'), false);
  assert.equal('_provided' in result.registry.items.plain_ore, false);
  assert.equal(result.registry.items.plain_ore.emoji, '🧱');
  const payload = core.decodePayload(result.content.match(/<!--ITEMX2:([A-Za-z0-9_-]+)-->/)[1]);
  assert.equal('_provided' in payload.view, false);
});

test('valid model emoji is preserved while missing or question-mark glyphs get deterministic domain fallbacks', () => {
  assert.equal(core.resolveItemEmoji({ name: '심연검', itemType: '장검', emoji: '🌌' }), '🌌');
  assert.equal(core.resolveItemEmoji({ name: '심연검', itemType: '장검', emoji: '❔' }), '🗡️');
  assert.equal(core.resolveSkillGlyph({ name: '빙결 폭풍', glyph: '❔' }), '❄️');
  assert.equal(core.resolveMonsterGlyph({ name: '고대 용', glyph: '' }), '🐉');
});

test('an unfinished tag is quarantined while prose before it remains', () => {
  const result = core.extractResponse('검이 부딪혀 금이 갔다.\n<itemPatch><id>blade_a</id><op>merge</op><durability>30/100', core.newRegistry());
  assert.equal(result.content, '검이 부딪혀 금이 갔다.');
  assert.equal(/itemPatch|durability/.test(result.content), false);
});

test('damage, stack consumption and disappearance are replayed deterministically', () => {
  const first = core.extractResponse(exam('blade_a', '시험검'), core.newRegistry());
  const damaged = core.extractResponse('<itemPatch><id>blade_a</id><op>merge</op><durability>31/100</durability></itemPatch>', first.registry);
  const destroyed = core.extractResponse('[itemx: id=blade_a | action=destroy | quantity=all | reason=완전히 부서짐]', damaged.registry);
  assert.equal(damaged.registry.items.blade_a.durability, '31/100');
  assert.equal(destroyed.registry.items.blade_a.possession, 'removed');
  assert.equal(destroyed.registry.items.blade_a.location, 'unknown');
  const replay = core.rebuild([{ role: 'char', data: first.content }, { role: 'char', data: damaged.content }, { role: 'char', data: destroyed.content }]);
  assert.equal(replay.registry.items.blade_a.possession, 'removed');
});

test('reroll replacement does not retain the removed response events', () => {
  const oldResult = core.extractResponse(exam('old_blade', '사라질 검'), core.newRegistry());
  const newResult = core.extractResponse(exam('new_blade', '남을 검'), core.newRegistry());
  const oldState = core.rebuild([{ role: 'char', data: oldResult.content }]);
  const rerolled = core.rebuild([{ role: 'char', data: newResult.content }]);
  assert.ok(oldState.registry.items.old_blade);
  assert.equal(rerolled.registry.items.old_blade, undefined);
  assert.ok(rerolled.registry.items.new_blade);
});

test('reappraising an existing id preserves stack, ownership, equipment and pin state', () => {
  const first = core.extractResponse(exam('blade_a', '시험검', '<count>3</count><slot>main_hand</slot><pin>true</pin>').replace('<location>inventory</location>', '<location>equipped</location>'), core.newRegistry());
  const corrected = core.extractResponse(exam('blade_a', '교정된 시험검'), first.registry);
  const item = corrected.registry.items.blade_a;
  assert.equal(item.name, '교정된 시험검');
  assert.equal(item.count, 3);
  assert.equal(item.possession, 'owned');
  assert.equal(item.location, 'equipped');
  assert.equal(item.slot, 'main_hand');
  assert.equal(item.pin, true);
});

test('a partial reappraisal preserves omitted authoritative item details', () => {
  const first = core.extractResponse(exam('abyss_book', '심연의 묵시록', '<effects><effect><name>심연 개방</name><desc>봉인을 해제한다.</desc></effect></effects><augments><augment><name>+12</name><desc>극한 강화</desc></augment></augments>'), core.newRegistry());
  const partial = core.extractResponse('<itemExam><id>abyss_book</id><name>심연의 묵시록 · 진본</name><type>마도서</type><possession>owned</possession><location>inventory</location></itemExam>', first.registry);
  const item = partial.registry.items.abyss_book;
  assert.equal(item.name, '심연의 묵시록 · 진본');
  assert.equal(item.itemType, '마도서');
  assert.equal(item.power, '7600-9400');
  assert.equal(item.cost, '48000 G');
  assert.equal(item.effects[0].name, '심연 개방');
  assert.equal(item.augments[0].name, '+12');
});

test('unfinished ITEMX transport is quarantined without eating later trailers or generic item HTML', () => {
  const result = core.extractResponse('서술 본문.\n<itemPatch><id>blade_a</id><op>merge</op><durability>30/100\n\n[Status: 정상]\n<state>keep</state>', core.newRegistry());
  assert.equal(result.content, '서술 본문.\n[Status: 정상]\n<state>keep</state>');
  const generic = core.extractResponse('일반 HTML <item>표시</item> 뒤 본문', core.newRegistry());
  assert.equal(generic.content, '일반 HTML <item>표시</item> 뒤 본문');
});

test('oversized derived snapshots are omitted instead of masquerading as an empty registry', () => {
  const chat = { scriptstate: { unrelated: 'keep' } };
  const huge = { schema: 2, rev: 2, fingerprint: 'x', updatedAt: Date.now(), registry: { order: ['huge'], items: { huge: { id: 'huge', trivia: '가'.repeat(600000) } }, diagnostics: [] } };
  const written = core.writeSnapshot(chat, huge);
  assert.equal(written.scriptstate.$__itemx2_state, undefined);
  assert.equal(core.readSnapshot(written), null);
  assert.equal(written.scriptstate.unrelated, 'keep');
});

test('unknown operations and state-changing merge fields are rejected', () => {
  const unknown = core.extractResponse('<itemPatch><id>x</id><action=teleport></itemPatch>', core.newRegistry());
  assert.equal(unknown.events.length, 0);
  const merge = core.extractResponse('<itemPatch><id>x</id><op>merge</op><location>equipped</location></itemPatch>', core.newRegistry());
  assert.equal(merge.events.length, 0);
  assert.match(merge.errors[0], /merge_state/);
  const conflicting = core.extractResponse('<itemPatch><id>x</id><action>consume</action><op>remove</op><quantity>1</quantity></itemPatch>', core.newRegistry());
  assert.equal(conflicting.events.length, 0);
  assert.match(conflicting.errors[0], /conflicting_operation/);
  const direct = core.newRegistry();
  core.applyEvent(direct, { kind: 'exam', item: { id: 'x', name: '시험품', possession: 'owned', location: 'inventory', count: 1 } });
  assert.equal(core.applyEvent(direct, { kind: 'patch', patch: { id: 'x', action: 'consume', op: 'remove', fields: {}, quantity: 1 } }), null);
  assert.equal(direct.items.x.count, 1);
});

test('a zero-count item cannot be consumed as a phantom unit', () => {
  const reg = core.newRegistry();
  core.applyEvent(reg, { kind: 'exam', item: { id: 'empty_stack', name: '빈 병', itemType: '소모품', emoji: '🧪', rarity: 'normal', displayRarity: '일반', possession: 'owned', location: 'inventory', count: 0, effects: [], augments: [] } });
  const result = core.applyEvent(reg, { kind: 'patch', patch: { id: 'empty_stack', action: 'consume', op: null, fields: {}, quantity: 1 } });
  assert.equal(result, null);
  assert.equal(reg.items.empty_stack.count, 0);
  assert.equal(reg.diagnostics.at(-1).code, 'action_insufficient_quantity');
});

test('apply failures are quarantined instead of being emitted as valid events', () => {
  const result = core.extractResponse('<itemPatch><id>missing</id><action>equip</action><slot>main_hand</slot></itemPatch>', core.newRegistry());
  assert.equal(result.events.length, 0);
  assert.equal(result.errors.at(-1), 'patch_unknown_id');
  const payload = core.decodePayload(result.content.match(/<!--ITEMX2:([A-Za-z0-9_-]+)-->/)[1]);
  assert.equal(payload.event, undefined);
  assert.equal(payload.error, 'patch_unknown_id');
});

test('zero-count equipment and swap targets are rejected without mutation', () => {
  const reg = core.newRegistry();
  const put = (item) => core.applyEvent(reg, { kind: 'exam', item: { itemType: '장비', emoji: '⚔️', rarity: 'normal', displayRarity: '일반', effects: [], augments: [], ...item } });
  put({ id: 'old', name: '기존 검', possession: 'owned', location: 'equipped', slot: 'main_hand', count: 1 });
  put({ id: 'empty', name: '빈 검', possession: 'owned', location: 'inventory', slot: null, count: 0 });
  assert.equal(core.applyEvent(reg, { kind: 'patch', patch: { id: 'empty', action: 'equip', op: null, fields: {}, slot: 'off_hand' } }), null);
  assert.equal(reg.items.empty.location, 'inventory');
  assert.equal(core.applyEvent(reg, { kind: 'patch', patch: { id: null, action: 'swap', op: null, fields: {}, equip: 'empty', unequip: 'old', slot: 'main_hand' } }), null);
  assert.equal(reg.items.old.location, 'equipped');
  assert.equal(reg.items.empty.location, 'inventory');
});

test('duplicate transform inputs are aggregated and failure is atomic', () => {
  const initial = core.extractResponse(`${exam('ore', '광석', '<count>3</count>')}\n${exam('ingot', '주괴', '<count>0</count>')}`, core.newRegistry());
  const result = core.extractResponse('<itemPatch><action>transform</action><inputs>ore:2,ore:2</inputs><outputs>ingot:1</outputs></itemPatch>', initial.registry);
  assert.equal(result.events.length, 0);
  assert.equal(result.errors.at(-1), 'action_invalid_transform');
  assert.equal(result.registry.items.ore.count, 3);
  assert.equal(result.registry.items.ingot.count, 0);
});

test('renderer escapes model content and uses one shared card renderer', () => {
  const item = core.normalizeItem({ id: 'safe', name: '<img src=x onerror=alert(1)>', type: '검', emoji: '⚔️', internalrarity: 'epic', theme: 'oriental', affinity: 'ice', effects: [{ name: '<script>', desc: 'x&y' }] }).item;
  const html = renderer.renderCard(item, { motion: 'off' });
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;img/);
  assert.match(html, /craft-oriental/);
  assert.match(renderer.renderMarkerPayload({ v: 2, view: item }, { motion: 'off' }), /itemx-card/);
});

test('rarity particle budgets keep rare and below restrained', () => {
  assert.deepEqual({ ...renderer.particleBudget }, { normal: 4, magic: 6, rare: 8, unique: 16, epic: 16, legendary: 16, mythical: 16, empyrean: 16 });
});

test('skill detail reuses the item weapon FX engine with its resolved affinity', () => {
  const html = renderer.renderSkillFx({ id: 'skill_flame', name: '홍련참', affinity: 'fire' }, 'legendary', 'full');
  assert.match(html, /itemx2-skill-weapon-fx/);
  assert.match(html, /current-fx/);
  assert.match(html, /affinity-fx/);
  assert.match(html, /afx-fire/);
});

test('filtered ambient and moving affinity visuals use static child layers without reducing effects', () => {
  const item = core.normalizeItem({ id: 'layered', name: '층 분리 검', type: '검', emoji: '⚔️', internalrarity: 'legendary', theme: 'oriental', affinity: 'fire', affinity2: 'wind' }).item;
  const html = renderer.renderCard(item, { motion: 'full' });
  assert.match(html, /current-fog"><span class="current-fog-visual"/);
  assert.equal((html.match(/affinity-signature-visual/g) || []).length, 2);
  assert.equal((html.match(/craft-mote /g) || []).length, 16);
});

test('inline lite motion preserves the theme while bounding animated particle DOM', () => {
  const item = core.normalizeItem({ id: 'scroll_lite', name: '홍련검', type: '검', emoji: '⚔️', internalrarity: 'legendary', theme: 'forged', affinity: 'fire' }).item;
  const full = renderer.renderCard(item, { inline: true, motion: 'full' });
  const lite = renderer.renderCard(item, { inline: true, motion: 'lite' });
  const off = renderer.renderCard(item, { inline: true, motion: 'off' });
  assert.equal((full.match(/craft-mote /g) || []).length, 16);
  assert.equal((lite.match(/craft-mote /g) || []).length, 10);
  assert.equal((full.match(/afx-fire i/g) || []).length, 0);
  assert.equal((full.match(/<i style=/g) || []).length >= 16, true);
  assert.equal((lite.match(/<i style=/g) || []).length < (full.match(/<i style=/g) || []).length, true);
  assert.match(lite, /motion-lite/);
  assert.equal(off.includes('craft-mote'), false);
  assert.equal(off.includes('affinity-signature'), false);
  assert.equal(off.includes('itemx-fx'), false);
  assert.equal(off.includes('itemx-cond'), false);
});
