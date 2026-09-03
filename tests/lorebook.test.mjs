import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'src/lorebook.js'), 'utf8');
const lore = vm.runInNewContext(`${source}\nITEMXLorebook;`);

const snapshot = (monster = {}) => ({
  fingerprint: 'base',
  monsters: {
    order: ['hakurei_reimu'],
    entries: { hakurei_reimu: { id: 'hakurei_reimu', name: '하쿠레이 레이무', aliases: [], kind: '미분류', portrait: 'NONE', description: '', ...monster } }
  }
});

test('lorebook scan enriches only an exact unambiguous encounter match', () => {
  const entries = [{
    id: 'reimu-public', key: '하쿠레이 레이무, 레이무', comment: 'Hakurei Reimu',
    content: '[ITEMX-PUBLIC]\n종류: 인간 무녀\n별칭: 낙원의 멋진 무녀\n초상화: hakurei_reimu_standing\n설명: 환상향의 결계를 관리하는 무녀.'
  }];
  const scanned = lore.scan(snapshot(), entries, lore.emptyLedger());
  assert.equal(scanned.result.enriched, 1);
  const applied = lore.apply(snapshot(), scanned.ledger);
  const monster = applied.monsters.entries.hakurei_reimu;
  assert.equal(monster.kind, '인간 무녀');
  assert.equal(monster.portrait, 'hakurei_reimu_standing');
  assert.equal(monster.description, '환상향의 결계를 관리하는 무녀.');
  assert.deepEqual([...monster.aliases], ['Hakurei Reimu', '낙원의 멋진 무녀']);
});

test('active module lorebook entry shape enriches a registered encounter', () => {
  const moduleLore = [{
    id: 'module-reimu',
    key: '하쿠레이 레이무',
    secondkey: '',
    mode: 'constant',
    alwaysActive: true,
    selective: false,
    activationPercent: 100,
    comment: 'Hakurei Reimu',
    content: '[ITEMX-PUBLIC]\n종류: 인간 무녀\n별칭: 낙원의 멋진 무녀\n초상화: hakurei_reimu_standing'
  }];
  const scanned = lore.scan(snapshot(), moduleLore, lore.emptyLedger());
  const monster = lore.apply(snapshot(), scanned.ledger).monsters.entries.hakurei_reimu;
  assert.equal(scanned.result.enriched, 1);
  assert.equal(monster.kind, '인간 무녀');
  assert.equal(monster.portrait, 'hakurei_reimu_standing');
  assert.deepEqual([...monster.aliases], ['Hakurei Reimu', '낙원의 멋진 무녀']);
});

test('unsafe activation modes and ambiguous exact matches are ignored', () => {
  const unsafe = [
    { id: 'regex', key: '하쿠레이 레이무', useRegex: true, content: '[ITEMX-PUBLIC]\n종류: 비밀' },
    { id: 'selective', key: '하쿠레이 레이무', selective: true, secondkey: '숨은 조건', content: '[ITEMX-PUBLIC]\n종류: 비밀' },
    { id: 'chance', key: '하쿠레이 레이무', activationPercent: 50, content: '[ITEMX-PUBLIC]\n종류: 비밀' }
  ];
  const ignored = lore.scan(snapshot(), unsafe, lore.emptyLedger());
  assert.equal(ignored.result.notFound, 1);
  const ambiguous = lore.scan(snapshot(), [
    { id: 'a', key: '하쿠레이 레이무', content: '[ITEMX-PUBLIC]\n종류: 인간' },
    { id: 'b', key: '하쿠레이 레이무', content: '[ITEMX-PUBLIC]\n종류: 무녀' }
  ], lore.emptyLedger());
  assert.equal(ambiguous.result.ambiguous, 1);
  assert.equal(ambiguous.result.enriched, 0);
});

test('event-provided encounter fields outrank lorebook enrichment', () => {
  const base = snapshot({ kind: '신령', portrait: 'event_asset', description: '본문에서 확인됨', aliases: ['레이무'] });
  const scanned = lore.scan(base, [{ id: 'lore', key: '하쿠레이 레이무', content: '[ITEMX-PUBLIC]\n종류: 인간\n초상화: lore_asset\n설명: 로어 설명' }], lore.emptyLedger());
  const monster = lore.apply(base, scanned.ledger).monsters.entries.hakurei_reimu;
  assert.equal(monster.kind, '신령');
  assert.equal(monster.portrait, 'event_asset');
  assert.equal(monster.description, '본문에서 확인됨');
});

test('ordinary lore prose is never copied into the visible encounter record', () => {
  const secret = '실은 최종 흑막이며 숨겨진 약점은 붉은 달이다.';
  const scanned = lore.scan(snapshot(), [{ id: 'secret', key: '하쿠레이 레이무', content: secret }], lore.emptyLedger());
  const monster = lore.apply(snapshot(), scanned.ledger).monsters.entries.hakurei_reimu;
  assert.equal(monster.description, '');
  assert.equal(JSON.stringify(scanned.ledger).includes(secret), false);
});

test('rescanning removes stale enrichment when its exact safe source disappears', () => {
  const first = lore.scan(snapshot(), [{ id: 'public', key: '하쿠레이 레이무', content: '[ITEMX-PUBLIC]\n종류: 인간 무녀' }], lore.emptyLedger());
  assert.equal(first.result.enriched, 1);
  const rescanned = lore.scan(snapshot(), [], first.ledger);
  assert.equal(rescanned.result.removed, 1);
  assert.equal(rescanned.ledger.rows.hakurei_reimu, undefined);
});
