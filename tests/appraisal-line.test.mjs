import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, setHost, Session, Style, Presentation } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { pendingAnchor } from './helpers/ledger.mjs';
import { findAppraisalLines, parseAppraisal } from '../src/ui/appraisal-line.js';

const pack = {
  id: 'merchant_pack',
  name: '장사꾼의 행낭',
  rarity: 'normal',
  durability: '100/100',
  possession: 'owned',
  location: 'equipped',
  count: 1,
  effects: [{ name: '수납 보조', desc: '잡동사니와 보급품을 흔들림 없이 메고 이동한다.' }]
};
const LINE =
  '[장사꾼의 행낭 (일반) - 내구도 100/100 | 효과: 수납 보조::잡동사니와 보급품을 흔들림 없이 메고 이동한다.]';

async function setup() {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession('appraisal');
  Presentation.applyVisualSettings({ effectsLevel: 'full', skin: 'dark', cardOpenLatest: true });
  return pendingAnchor({ event: { kind: 'exam', item: pack }, view: pack });
}
const show = (text) => rt.displayHandler(text);

test('the appraisal line splits into title, grade and rows with leaked separators tidied', () => {
  const parsed = parseAppraisal(LINE.slice(1, -1), pack.name);
  assert.equal(parsed.title, '장사꾼의 행낭');
  assert.equal(parsed.grade, '일반');
  assert.deepEqual(parsed.rows, [
    { key: '내구도', value: '100/100' },
    { key: '효과', value: '수납 보조 — 잡동사니와 보급품을 흔들림 없이 메고 이동한다.' }
  ]);
  const odd = parseAppraisal('정체불명의 문양이 새겨져 있다', '낡은 반지');
  assert.equal(odd.title, '낡은 반지');
  assert.equal(odd.rows[0].value, '정체불명의 문양이 새겨져 있다');
});

for (const [label, line] of [
  ['backticked', '`' + LINE + '`'],
  ['plain', LINE],
  ['bold', '**' + LINE + '**']
]) {
  test(`a ${label} appraisal line next to its item anchor becomes a system window and folds the card`, async () => {
    const anchor = await setup();
    const text = `배낭을 꺼내 메었다.\n\n${anchor}\n\n${line}\n\n어깨끈을 조였다.`;
    const html = await show(text);
    assert.match(html, /<div class="ixs">/);
    assert.ok(!html.includes('`'), 'no backtick survives');
    assert.ok(!html.includes('::'), 'no leaked separator');
    const open = html.match(/<details [^>]*data-itemx-id="merchant_pack"[^>]*>/)[0];
    assert.ok(!/\sopen(?:[\s>=]|$)/.test(open), 'the card stays folded beside its window');
    assert.match(html, /배낭을 꺼내 메었다\.[\s\S]*어깨끈을 조였다\./);
  });
}

test('brackets that are story text, another item or far from the anchor stay as written', async () => {
  const anchor = await setup();
  const other = '`[녹슨 단검 (일반) - 내구도 3/10]`';
  const far = `${LINE}\n\n멀리 떨어진 문장.\n\n${anchor}`;
  for (const text of [`${anchor}\n\n${other}`, far, `${anchor}\n[Status: 맑음 | 장사꾼의 행낭 착용]은 문장 속`]) {
    const html = await show(text);
    assert.ok(!html.includes('class="ixs"'), text);
  }
  assert.deepEqual(
    findAppraisalLines('[a]', [], () => ''),
    []
  );
});

test('without an appraisal line the newest card still opens as configured', async () => {
  const anchor = await setup();
  const html = await show(`배낭을 꺼내 메었다.\n\n${anchor}`);
  const open = html.match(/<details [^>]*data-itemx-id="merchant_pack"[^>]*>/)[0];
  assert.match(open, /\sopen(?:[\s>=]|$)/);
});
