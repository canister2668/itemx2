import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console, Buffer, TextEncoder, TextDecoder });
vm.runInContext(await readFile(resolve(root, 'src/core.js'), 'utf8'), context);
vm.runInContext(await readFile(resolve(root, 'src/codex.js'), 'utf8'), context);
const codex = context.ITEMXCodex;

test('multiple skill and encounter transports are hidden and replayed in order', () => {
  const raw = `검결을 깨우쳤다.<skillExam><id>moon_slash</id><name>월영참</name><rank>절정</rank><type>active</type><status>equipped</status><mastery>47</mastery><effects>달빛 참격 ;; 출혈</effects></skillExam> 늑대왕이 덮쳤다.<monsterExam><id>wolf_king</id><name>흑랑왕</name><type>요수</type><threat>상</threat><relation>hostile</relation><status>active</status><portrait>wolf_king.webp</portrait><weaknesses>화염 ;; 성광</weaknesses></monsterExam>`;
  const result = codex.extractResponse(raw, codex.snapshot());
  assert.equal(result.events.length, 2);
  assert.equal(/skillExam|monsterExam/.test(result.content), false);
  const replay = codex.rebuild([{ role: 'char', data: result.content }]);
  assert.equal(replay.skills.entries.moon_slash.mastery, 47);
  assert.equal(replay.monsters.entries.wolf_king.active, true);
});

test('encounter endings and skill mastery are deterministic patches', () => {
  const first = codex.extractResponse('<skillExam><id>moon_slash</id><name>월영참</name><type>active</type><status>learned</status></skillExam><monsterExam><id>wolf_king</id><name>흑랑왕</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  const next = codex.extractResponse('<skillPatch><id>moon_slash</id><action>mastery</action><mastery>88</mastery></skillPatch><monsterPatch><id>wolf_king</id><action>defeat</action></monsterPatch>', first.snapshot);
  assert.equal(next.snapshot.skills.entries.moon_slash.mastery, 88);
  assert.equal(next.snapshot.monsters.entries.wolf_king.status, 'defeated');
  assert.equal(next.snapshot.monsters.entries.wolf_king.active, false);
});

test('bounded context excludes inactive unmentioned encounters and assets stay references', () => {
  const state = codex.snapshot();
  codex.applyEvent(state, { domain: 'monster', kind: 'exam', entity: { id: 'old', name: '지난 적', aliases: [], active: false, status: 'ended', relation: 'hostile', threat: '하', weaknesses: [], encounterCount: 1 } });
  codex.applyEvent(state, { domain: 'monster', kind: 'exam', entity: { id: 'now', name: '현재 적', aliases: [], active: true, status: 'active', relation: 'hostile', threat: '상', weaknesses: [], encounterCount: 1, portrait: 'enemy.webp' } });
  const anchor = codex.anchor(state, '전투가 계속된다');
  assert.equal(anchor.includes('지난 적'), false);
  assert.equal(anchor.includes('현재 적'), true);
  const assets = codex.assetCatalog({ additionalAssets: [['enemy.webp', 'asset-id-1', 'webp']] });
  assert.deepEqual(JSON.parse(JSON.stringify(assets)), [{ name: 'enemy.webp', id: 'asset-id-1', ext: 'webp' }]);
});

test('incomplete codex transport never leaks raw tags', () => {
  const result = codex.extractResponse('본문은 유지.<monsterExam><id>broken</id><name>미완성', codex.snapshot());
  assert.equal(result.content, '본문은 유지.');
  assert.equal(result.events.length, 0);
});

test('incomplete codex transport preserves later status trailers and item markers', () => {
  const itemMarker = context.ITEMXCore.marker({ v: context.ITEMXCore.VERSION, event: { kind: 'exam', item: { id: 'blade', name: '검' } } });
  const result = codex.extractResponse(`서술.\n${itemMarker}\n<monsterExam><id>broken</id>\n\n[Status: HP 12]\n<state>keep</state>`, codex.snapshot());
  assert.equal(result.content.includes(itemMarker), true);
  assert.equal(result.content.includes('[Status: HP 12]'), true);
  assert.equal(result.content.includes('<state>keep</state>'), true);
  assert.equal(result.content.includes('monsterExam'), false);
});

test('re-exam preserves live skill and encounter state unless explicitly supplied', () => {
  const first = codex.extractResponse('<skillExam><id>moon</id><name>월영참</name><type>active</type><status>equipped</status><level>9</level><mastery>73</mastery></skillExam><monsterExam><id>wolf</id><name>흑랑왕</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  const defeated = codex.extractResponse('<monsterPatch><id>wolf</id><action>defeat</action></monsterPatch>', first.snapshot);
  const reexam = codex.extractResponse('<skillExam><id>moon</id><name>월영참 개</name><description>새 설명</description></skillExam><monsterExam><id>wolf</id><name>흑랑왕 개</name><description>새 설명</description></monsterExam>', defeated.snapshot);
  assert.equal(reexam.snapshot.skills.entries.moon.status, 'equipped');
  assert.equal(reexam.snapshot.skills.entries.moon.level, 9);
  assert.equal(reexam.snapshot.skills.entries.moon.mastery, 73);
  assert.equal(reexam.snapshot.monsters.entries.wolf.status, 'defeated');
  assert.equal(reexam.snapshot.monsters.entries.wolf.active, false);
  assert.equal(reexam.snapshot.monsters.entries.wolf.encounterCount, 1);
});

test('malformed marker events are isolated instead of aborting replay', () => {
  const malformed = codex.marker({ v: codex.VERSION, event: { domain: 'skill', kind: 'exam' } });
  const state = codex.rebuild([{ role: 'char', data: malformed }]);
  assert.equal(state.skills.order.length, 0);
  assert.equal(state.skills.diagnostics[0].code, 'exam_invalid');
});

test('skill protocol uses real time cooldowns and world-native costs', () => {
  const protocol = codex.protocol([]);
  assert.match(protocol, /cost preserves the setting's actual resource/);
  assert.match(protocol, /cooldown must never use turns, rounds, actions, or initiative/);
  assert.match(protocol, /seconds, minutes, hours, days/);
  const result = codex.extractResponse('<skillExam><id>flash</id><name>섬광</name><type>active</type><cost>기력 5%</cost><cooldown>30초</cooldown></skillExam>', codex.snapshot());
  assert.equal(result.snapshot.skills.entries.flash.cost, '기력 5%');
  assert.equal(result.snapshot.skills.entries.flash.cooldown, '30초');
  const legacy = codex.extractResponse('<skillExam><id>legacy</id><name>구식 기술</name><type>active</type><cooldown>3턴</cooldown></skillExam>', codex.snapshot());
  assert.equal(legacy.snapshot.skills.entries.legacy.cooldown, '상황 조건 충족 후');
});

test('skill and encounter records use emoji defaults and request emoji glyphs', () => {
  const result = codex.extractResponse('<skillExam><id>flash</id><name>섬광</name><type>active</type></skillExam><monsterExam><id>wolf</id><name>늑대</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  assert.equal(result.snapshot.skills.entries.flash.glyph, '✨');
  assert.equal(result.snapshot.monsters.entries.wolf.glyph, '⚔️');
  const protocol = codex.protocol([]);
  assert.match(protocol, /one fitting emoji such as ✨/);
  assert.match(protocol, /one fitting encounter emoji such as ⚔️/);
});

test('domain switches omit disabled protocol, context and events without leaking tags', () => {
  const raw = '<skillExam><id>flash</id><name>섬광</name><type>active</type></skillExam><monsterExam><id>wolf</id><name>늑대</name><relation>hostile</relation><status>active</status></monsterExam>';
  const result = codex.extractResponse(raw, codex.snapshot(), { enabledDomains: ['skill'] });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].domain, 'skill');
  assert.equal(result.snapshot.monsters.order.length, 0);
  assert.equal(/skillExam|monsterExam/.test(result.content), false);
  const protocol = codex.protocol([], { enabledDomains: ['skill'] });
  assert.match(protocol, /<skillExam>/);
  assert.equal(protocol.includes('<monsterExam>'), false);
  const anchor = codex.anchor(result.snapshot, '섬광', 9000, { enabledDomains: ['monster'] });
  assert.equal(anchor.includes('섬광'), false);
});
