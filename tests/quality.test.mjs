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
vm.runInContext(await readFile(resolve(root, 'src/quality.js'), 'utf8'), context);
const core = context.ITEMXCore;
const quality = context.ITEMXQuality;

test('auxiliary item identity absent from committed narrative is rejected', () => {
  const parsed = core.normalizeItem({ id: 'phantom_blade', name: '없는검', type: '검', possession: 'owned', location: 'inventory' });
  const evidence = quality.detectItemEvidence('전혀 다른 이야기입니다.', parsed.item);
  assert.equal(evidence.segment, '');
  assert.equal(quality.validateRecoveredItem({ kind: 'exam', item: parsed.item }, evidence).status, 'rejected');
});

test('existing partial keeps newly verified fields instead of rolling the whole item back', () => {
  const registry = core.newRegistry();
  const prior = core.normalizeItem({ id: 'blade', name: '화염검', type: '검', rarity: 'normal', power: '10', possession: 'owned', location: 'inventory', effects: [{ name: '옛 효과', desc: '보존' }] }).item;
  core.applyEvent(registry, { kind: 'exam', item: prior });
  const source = core.normalizeItem({ id: 'blade', name: '화염검', type: '검', rarity: 'rare', power: '300', possession: 'owned', location: 'inventory' }).item;
  const evidence = quality.detectItemEvidence('화염검의 공격력: 300. 특수 효과 [불꽃]이 깃들었다.', source);
  const result = quality.validateRecoveredItem({ kind: 'exam', item: source }, evidence);
  assert.equal(result.status, 'partial');
  const projected = quality.projectSafePartial({ kind: 'exam', item: source }, result, registry).item;
  assert.equal(projected.power, '300');
  assert.equal(projected.rarity, 'rare');
  assert.equal(projected.effects[0].name, '옛 효과');
});

test('repair values must match the evidence before a missing field is considered repaired', () => {
  const item = core.normalizeItem({ id: 'blade', name: '화염검', type: '검', possession: 'owned', location: 'inventory' }).item;
  const evidence = quality.detectItemEvidence('화염검 공격력: 300', item);
  const partial = { event: { kind: 'exam', item }, missing: ['power'], evidence };
  const map = new Map([['blade', partial]]), registry = core.newRegistry();
  core.applyEvent(registry, { kind: 'exam', item });
  const patch = (power) => ({ kind: 'patch', patch: { id: 'blade', op: 'merge', action: null, fields: { power } } });
  assert.equal(quality.acceptRepair(patch('999'), map, registry), null);
  assert.ok(quality.acceptRepair(patch('300'), map, registry));
});

test('same-paragraph sibling evidence is isolated and first-character boundaries are exact', () => {
  const a = { name: '검A' }, b = { name: '검B' };
  const text = '검A 특수 효과 [불꽃]이 있다. 검B 공격력: 50.';
  const evidence = quality.detectItemEvidence(text, b, [a, b]);
  assert.equal(evidence.effects, false);
  assert.deepEqual(Array.from(evidence.powerValues), ['50']);
  assert.equal(quality.relevantItemNarrative('화염검 공격력: 300', { name: '화염검' }).startsWith('화염검'), true);
});

test('earlier context can establish a named identity when committed prose uses only a pronoun', () => {
  const item = { name: '흑철검' };
  assert.equal(quality.detectItemEvidence('그 검을 허리에 찼다.', item).segment, '');
  assert.match(quality.detectItemEvidence('앞서 흑철검을 받았다.\n\n그 검을 허리에 찼다.', item).segment, /흑철검/);
});

test('explicit required durability and cost numbers must match on the initial appraisal', () => {
  const wrong = core.normalizeItem({
    id: 'measured_blade', name: '계측검', type: '검', possession: 'owned', location: 'inventory',
    power: '300', required: '레벨 1', durability: '1/1', cost: '999 Gold'
  }).item;
  const evidence = quality.detectItemEvidence(
    '계측검 · 공격력 300 / 요구 레벨 10 / 내구도 80/100 / 가격 1200 Gold', wrong
  );
  assert.deepEqual(Array.from(evidence.requiredValues), ['10']);
  assert.deepEqual(Array.from(evidence.durabilityValues), ['80', '100']);
  assert.deepEqual(Array.from(evidence.costValues), ['1200']);
  const result = quality.validateRecoveredItem({ kind: 'exam', item: wrong }, evidence);
  assert.equal(result.status, 'partial');
  assert.deepEqual(Array.from(result.missing), ['required', 'durability', 'cost']);

  const correct = core.normalizeItem({
    id: 'measured_blade', name: '계측검', type: '검', possession: 'owned', location: 'inventory',
    power: '300', required: '레벨 10', durability: '80/100', cost: '1200 Gold'
  }).item;
  assert.equal(quality.validateRecoveredItem({ kind: 'exam', item: correct }, evidence).status, 'complete');
});

test('qualitative requirements accept supported wording and reject arbitrary repairs', () => {
  const item = core.normalizeItem({ id: 'blood_blade', name: '혈약검', type: '검', possession: 'owned', location: 'inventory' }).item;
  const evidence = quality.detectItemEvidence('혈약검의 요구 조건: 피의 계약 완료', item);
  const result = quality.validateRecoveredItem({ kind: 'exam', item }, evidence);
  assert.equal(result.status, 'partial');
  assert.deepEqual(Array.from(result.missing), ['required']);
  const partial = { ...result, event: { kind: 'exam', item } };
  const map = new Map([['blood_blade', partial]]), registry = core.newRegistry();
  core.applyEvent(registry, { kind: 'exam', item });
  const patch = (required) => ({ kind: 'patch', patch: { id: 'blood_blade', op: 'merge', action: null, fields: { required } } });
  assert.equal(quality.acceptRepair(patch('아무 조건'), map, registry), null);
  assert.ok(quality.acceptRepair(patch('피의 계약을 완료해야 함'), map, registry));
});
