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

test('latest completed encounter outcome records the decisive resolution without accumulating history', () => {
  const first = codex.extractResponse('<monsterExam><id>wolf_king</id><name>흑랑왕</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  const defeated = codex.extractResponse('<monsterPatch><id>wolf_king</id><action>defeat</action><outcome>연화검의 결정타가 앞발을 부러뜨리며 흑랑왕을 무릎 꿇렸다.</outcome></monsterPatch>', first.snapshot);
  const entry = defeated.snapshot.monsters.entries.wolf_king;
  assert.equal(entry.status, 'defeated');
  assert.equal(entry.outcome, '연화검의 결정타가 앞발을 부러뜨리며 흑랑왕을 무릎 꿇렸다.');
  assert.equal(entry.outcomeStatus, 'defeated');
  assert.equal(entry.outcomeEncounter, 1);

  const again = codex.extractResponse('<monsterPatch><id>wolf_king</id><action>encounter</action></monsterPatch>', defeated.snapshot);
  assert.equal(again.snapshot.monsters.entries.wolf_king.outcome, entry.outcome);
  assert.equal(again.snapshot.monsters.entries.wolf_king.outcomeStatus, 'defeated');
  const killed = codex.extractResponse('<monsterPatch><id>wolf_king</id><action>kill</action><outcome>두 번째 교전에서 월영참이 심장을 관통했다.</outcome></monsterPatch>', again.snapshot);
  assert.equal(killed.snapshot.monsters.entries.wolf_king.outcomeStatus, 'dead');
  assert.equal(killed.snapshot.monsters.entries.wolf_king.outcomeEncounter, 2);
  assert.equal(killed.snapshot.monsters.entries.wolf_king.outcome, '두 번째 교전에서 월영참이 심장을 관통했다.');
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

test('portrait assets resolve exact names first and use only unambiguous normalized fallbacks', () => {
  const assets = codex.assetCatalog({
    additionalAssets: [['Wolf King.webp', 'asset-wolf', 'webp'], ['duplicate.png', 'asset-a', 'png'], ['DUPLICATE.PNG', 'asset-b', 'png']],
    emotionImages: [['angry', 'asset-angry'], ['smile', 'asset-smile']]
  }, 4, true);
  assert.equal(assets.length, 4);
  assert.equal(assets.some((row) => row.name === 'angry'), true, 'emotion assets retain reserved catalog capacity');
  assert.equal(codex.assetLookup(assets, 'wolf king.webp')?.id, 'asset-wolf');
  assert.equal(codex.assetLookup(assets, 'Wolf King')?.id, 'asset-wolf');
  assert.equal(codex.assetLookup(assets, 'duplicate.png')?.id, 'asset-a', 'exact match wins');
  assert.equal(codex.assetLookup(assets, 'Duplicate.PNG'), null, 'ambiguous normalized fallback is rejected');
});

test('encounter portrait prefers standing defaults, then recent matching module assets when transport says NONE', () => {
  const assets = codex.assetCatalog({ additionalAssets: [
    ['Amber_serious', 'assets/amber-serious.avif', 'avif'],
    ['Amber_determined', 'assets/amber-determined.avif', 'avif'],
    ['Amber_standing', 'assets/amber-standing.avif', 'avif'],
    ['Aria_serious', 'assets/aria-serious.avif', 'avif']
  ] });
  const amber = { id: 'amber', name: '엠버', aliases: [], portrait: 'NONE' };
  assert.equal(codex.assetForEntity(assets, amber, '<eomg="Amber_serious">old</eomg>\n<eomg="Amber_determined">now</eomg>')?.id, 'assets/amber-standing.avif');
  assert.equal(codex.assetForEntity(assets.filter((row) => !['Amber_standing', 'Amber_serious'].includes(row.name)), amber, '<eomg="Amber_serious">old</eomg>\n<eomg="Amber_determined">now</eomg>')?.id, 'assets/amber-determined.avif');
  assert.equal(codex.assetForEntity(assets, { ...amber, portrait: 'Amber_serious' }, '<eomg="Amber_determined">now</eomg>')?.id, 'assets/amber-serious.avif', 'explicit transport remains authoritative');
  assert.equal(codex.assetForEntity(assets, { id: 'unknown', name: '미상', aliases: [], portrait: 'NONE' }, '') ?? null, null);
});

test('module portrait catalog includes active scopes only and supports namespace and bound persona assets', () => {
  const database = {
    enabledModules: ['global'], moduleIntergration: 'integrated-ns', selectedPersona: 'persona-1',
    modules: [
      { id: 'global', assets: [['global.webp', 'asset-global', 'webp']] },
      { id: 'chat-only', assets: [['chat.webp', 'asset-chat', 'webp']] },
      { id: 'character-only', assets: [['character.webp', 'asset-character', 'webp']] },
      { id: 'integrated', namespace: 'integrated-ns', assets: [['integrated.webp', 'asset-integrated', 'webp']] },
      { id: 'disabled', assets: [['disabled.webp', 'asset-disabled', 'webp']] }
    ],
    personas: [{ id: 'persona-1', embeddedModule: { assets: [['persona.webp', 'asset-persona', 'webp']] } }]
  };
  const rows = codex.activeModuleAssetCatalog(database, { modules: ['character-only'] }, { modules: ['chat-only'], bindedPersona: 'persona-1' });
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map((row) => row.name).sort())), ['character.webp', 'chat.webp', 'global.webp', 'integrated.webp', 'persona.webp']);
  assert.equal(rows.some((row) => row.name === 'disabled.webp'), false);
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
  const first = codex.extractResponse('<skillExam><id>moon</id><name>월영참</name><type>active</type><status>equipped</status><level>9</level><mastery>73</mastery><cost>월광 집중</cost><cooldown>호흡 안정 후</cooldown></skillExam><monsterExam><id>wolf</id><name>흑랑왕</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  const defeated = codex.extractResponse('<monsterPatch><id>wolf</id><action>defeat</action></monsterPatch>', first.snapshot);
  const reexam = codex.extractResponse('<skillExam><id>moon</id><name>월영참 개</name><description>새 설명</description></skillExam><monsterExam><id>wolf</id><name>흑랑왕 개</name><description>새 설명</description></monsterExam>', defeated.snapshot);
  assert.equal(reexam.snapshot.skills.entries.moon.status, 'equipped');
  assert.equal(reexam.snapshot.skills.entries.moon.level, 9);
  assert.equal(reexam.snapshot.skills.entries.moon.mastery, 73);
  assert.equal(reexam.snapshot.skills.entries.moon.cost, '월광 집중');
  assert.equal(reexam.snapshot.skills.entries.moon.cooldown, '호흡 안정 후');
  assert.equal(reexam.snapshot.monsters.entries.wolf.status, 'defeated');
  assert.equal(reexam.snapshot.monsters.entries.wolf.active, false);
  assert.equal(reexam.snapshot.monsters.entries.wolf.encounterCount, 1);
});

test('repeat skill scans cannot downgrade progress or erase detailed cost and cooldown', () => {
  const first = codex.extractResponse('<skillExam><id>moon</id><name>월영참</name><type>active</type><level>40</level><mastery>88</mastery><cost>월광 30%</cost><cooldown>호흡이 완전히 안정된 뒤</cooldown></skillExam>', codex.snapshot());
  const repeated = codex.extractResponse('오랫동안 사용한 고수의 비전이다.\n<skillExam><id>moon</id><name>월영참</name><type>active</type><level>1</level><mastery>0</mastery><cost>NONE</cost><cooldown>none</cooldown></skillExam>', first.snapshot);
  const skill = repeated.snapshot.skills.entries.moon;
  assert.equal(skill.level, 40);
  assert.equal(skill.mastery, 88);
  assert.equal(skill.cost, '월광 30%');
  assert.equal(skill.cooldown, '호흡이 완전히 안정된 뒤');
  const replayed = codex.rebuild([{ role: 'char', data: first.content }, { role: 'char', data: repeated.content }]);
  assert.equal(replayed.skills.entries.moon.level, 40);
  assert.equal(replayed.skills.entries.moon.mastery, 88);
  assert.equal(replayed.skills.entries.moon.cost, '월광 30%');
  assert.equal(replayed.skills.entries.moon.cooldown, '호흡이 완전히 안정된 뒤');
});

test('malformed marker events are isolated instead of aborting replay', () => {
  const malformed = codex.marker({ v: codex.VERSION, event: { domain: 'skill', kind: 'exam' } });
  const state = codex.rebuild([{ role: 'char', data: malformed }]);
  assert.equal(state.skills.order.length, 0);
  assert.equal(state.skills.diagnostics[0].code, 'exam_invalid');
});

test('skill protocol uses real time cooldowns and world-native costs', () => {
  const protocol = codex.protocol([]);
  assert.match(protocol, /Always write informative cost and cooldown fields instead of bare NONE/);
  assert.match(protocol, /infer a conservative qualitative description/);
  assert.match(protocol, /Cooldowns must never use turns, rounds, actions or initiative/);
  const result = codex.extractResponse('<skillExam><id>flash</id><name>섬광</name><type>active</type><cost>기력 5%</cost><cooldown>30초</cooldown></skillExam>', codex.snapshot());
  assert.equal(result.snapshot.skills.entries.flash.cost, '기력 5%');
  assert.equal(result.snapshot.skills.entries.flash.cooldown, '30초');
  const legacy = codex.extractResponse('<skillExam><id>legacy</id><name>구식 기술</name><type>active</type><cooldown>3턴</cooldown></skillExam>', codex.snapshot());
  assert.equal(legacy.snapshot.skills.entries.legacy.cooldown, '상황 조건 충족 후');
  assert.equal(legacy.snapshot.skills.entries.legacy.cost, '발동 자원 · 서사 기준');
  const explicitNone = codex.extractResponse('<skillExam><id>free_cast</id><name>무영창</name><type>active</type><cost>NONE</cost><cooldown>none</cooldown></skillExam>', codex.snapshot());
  assert.equal(explicitNone.snapshot.skills.entries.free_cast.cost, '별도 소모 없음');
  assert.equal(explicitNone.snapshot.skills.entries.free_cast.cooldown, '재사용 제한 없음');
  const passive = codex.extractResponse('<skillExam><id>sense</id><name>기척 감지</name><type>passive</type></skillExam>', codex.snapshot());
  assert.equal(passive.snapshot.skills.entries.sense.cost, '상시 효과 · 별도 소모 없음');
  assert.equal(passive.snapshot.skills.entries.sense.cooldown, '상시 적용');
  assert.match(protocol, /Preserve the setting's own native rank/);
  const forced = codex.protocol([], { rarityMode: 'itemx' });
  assert.match(forced, /normal\|magic\|rare\|unique\|epic\|legendary\|mythical\|empyrean/);
  assert.doesNotMatch(protocol, /<level>1<\/level>/);
  assert.match(protocol, /Registry discovery is not the moment of learning/);
  assert.match(protocol, /infer a conservative normalized level from 1 to 10/);
});

test('veteran skill evidence corrects false novice defaults with conservative inferred mastery', () => {
  const narrative = [
    '존 팔루스티프 경은 수백 번의 실전과 수천 번의 둔기 스윙을 거친 고인물이다.',
    '[한손둔기 숙련도] (Grade 1 / Lv.39)',
    '전투가 끝나며 한손둔기 숙련도가 Lv.40에 도달했다.',
    '<skillExam><id>vibration_strike</id><name>진동타격</name><rank>액티브</rank><school>한손둔기</school><type>active</type><status>learned</status><level>1</level><mastery>0</mastery></skillExam>'
  ].join('\n');
  const result = codex.extractResponse(narrative, codex.snapshot(), { rarityMode: 'itemx' });
  const skill = result.snapshot.skills.entries.vibration_strike;
  assert.equal(skill.level, 40);
  assert.equal(skill.mastery, 75);
  assert.deepEqual([...skill._inferred], ['mastery']);
  assert.equal(skill.rank, 'normal');
});

test('qualitative skill evidence produces bounded progress while explicit novice values survive', () => {
  const veteran = codex.extractResponse('오랫동안 숙련한 고수의 비전이다.\n<skillExam><id>old_art</id><name>고법</name><type>passive</type><level>1</level><mastery>0</mastery></skillExam>', codex.snapshot());
  assert.equal(veteran.snapshot.skills.entries.old_art.level, 7);
  assert.equal(veteran.snapshot.skills.entries.old_art.mastery, 75);
  const baseline = codex.extractResponse('<skillExam><id>quiet_art</id><name>고요한 호흡</name><type>passive</type></skillExam>', codex.snapshot(), { skillEvidenceText: '고요한 호흡을 사용할 수 있다.' });
  assert.equal(baseline.snapshot.skills.entries.quiet_art.level, 4);
  assert.equal(baseline.snapshot.skills.entries.quiet_art.mastery, 35);
  const novice = codex.extractResponse('방금 처음 배운 초보 검술이다.\n<skillExam><id>new_art</id><name>초보 검술</name><type>active</type><level>1</level><mastery>0</mastery></skillExam>', codex.snapshot());
  assert.equal(novice.snapshot.skills.entries.new_art.level, 1);
  assert.equal(novice.snapshot.skills.entries.new_art.mastery, 0);
});

test('explicit progress patches replace inferred provenance without disturbing sibling fields', () => {
  const first = codex.extractResponse('<skillExam><id>form</id><name>유운보</name><type>active</type></skillExam>', codex.snapshot(), { skillEvidenceText: '유운보를 구사할 수 있다.' });
  assert.deepEqual([...first.snapshot.skills.entries.form._inferred].sort(), ['level', 'mastery']);
  const patched = codex.extractResponse('<skillPatch><id>form</id><op>merge</op><mastery>82</mastery></skillPatch>', first.snapshot);
  assert.equal(patched.snapshot.skills.entries.form.mastery, 82);
  assert.deepEqual([...patched.snapshot.skills.entries.form._inferred], ['level']);
});

test('skill and encounter records derive safe emoji fallbacks and request free model-selected glyphs', () => {
  const result = codex.extractResponse('<skillExam><id>flash</id><name>섬광</name><type>active</type></skillExam><monsterExam><id>wolf</id><name>늑대</name><relation>hostile</relation><status>active</status></monsterExam>', codex.snapshot());
  assert.equal(result.snapshot.skills.entries.flash.glyph, '✨');
  assert.equal(result.snapshot.monsters.entries.wolf.glyph, '🐺');
  const protocol = codex.protocol([]);
  assert.match(protocol, /choose one fitting emoji that reflects the skill identity/);
  assert.match(protocol, /choose one fitting emoji that reflects the creature identity/);
  assert.match(protocol, /never use ❔/);
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
