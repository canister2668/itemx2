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

test('unfinished ITEMX transport is quarantined without eating later trailers or generic item HTML', () => {
  const result = core.extractResponse('서술 본문.\n<itemPatch><id>blade_a</id><op>merge</op><durability>30/100\n\n[Status: 정상]\n<state>keep</state>', core.newRegistry());
  assert.equal(result.content, '서술 본문.\n[Status: 정상]\n<state>keep</state>');
  const generic = core.extractResponse('일반 HTML <item>표시</item> 뒤 본문', core.newRegistry());
  assert.equal(generic.content, '일반 HTML <item>표시</item> 뒤 본문');
});

test('oversized derived snapshots are actually compacted below the storage ceiling', () => {
  const chat = { scriptstate: {} };
  const huge = { schema: 2, rev: 2, fingerprint: 'x', updatedAt: Date.now(), registry: { order: ['huge'], items: { huge: { id: 'huge', trivia: '가'.repeat(600000) } }, diagnostics: [] } };
  const written = core.writeSnapshot(chat, huge);
  const encoded = written.scriptstate.$__itemx2_state;
  const parsed = JSON.parse(encoded);
  assert.ok(encoded.length < 4096);
  assert.equal(parsed.compacted, true);
  assert.deepEqual(Array.from(parsed.registry.order), []);
});

test('unknown operations and state-changing merge fields are rejected', () => {
  const unknown = core.extractResponse('<itemPatch><id>x</id><action=teleport></itemPatch>', core.newRegistry());
  assert.equal(unknown.events.length, 0);
  const merge = core.extractResponse('<itemPatch><id>x</id><op>merge</op><location>equipped</location></itemPatch>', core.newRegistry());
  assert.equal(merge.events.length, 0);
  assert.match(merge.errors[0], /merge_state/);
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

test('filtered ambient and moving affinity visuals use static child layers without reducing effects', () => {
  const item = core.normalizeItem({ id: 'layered', name: '층 분리 검', type: '검', emoji: '⚔️', internalrarity: 'legendary', theme: 'oriental', affinity: 'fire', affinity2: 'wind' }).item;
  const html = renderer.renderCard(item, { motion: 'full' });
  assert.match(html, /current-fog"><span class="current-fog-visual"/);
  assert.equal((html.match(/affinity-signature-visual/g) || []).length, 2);
  assert.equal((html.match(/craft-mote /g) || []).length, 16);
});
