import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Pipeline, Session, Anchors } from './helpers/modules.mjs';
import { hasRawTransport, positionMarkersByNarrative } from '../src/transport.js';
import * as Core from '../src/engine/core.js';

const settings = {
  v: 1,
  global: {},
  characters: {
    flow: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: false
    }
  }
};
const tag = (id, name) =>
  `<itemExam><id>${id}</id><name>${name}</name><type>검</type><possession>owned</possession></itemExam>`;
// A response that opens with planning which mentions the protocol, then a
// header and a status line, and names each item further down.
const response = [
  '<Thoughts>\n아이템 태그 `<itemExam>` 와 `[itemx: ...]` 를 쓴다.\n</Thoughts>',
  '# 응답',
  '[Status: 낮 | 낙양]',
  '첫 문단. 아무것도 없다.',
  `적룡검이 모습을 드러냈다.\n${tag('red', '적룡검')}`,
  '중간 문단.',
  `청명검이 빛났다.\n${tag('blue', '청명검')}`,
  '마지막 문단.',
  '[Request Profile| A, B]'
].join('\n\n');

function fresh() {
  const fake = createFakeHost({
    chat: { id: 'chat', message: [{ chatId: 'u', role: 'user', data: '보여줘' }], scriptstate: {} },
    character: { chaId: 'flow', name: 'T' },
    settings
  });
  setHost(fake.api);
  Session.resetSession('flow:chat');
  return fake;
}

test('a status line at the top of a response is a header, not a trailer: cards stay by their paragraphs', () => {
  const marker = (id, name) =>
    Core.marker({ v: Core.VERSION, event: { kind: 'exam', item: Core.normalizeItem({ id, name, count: 1 }).item } });
  const text = ['[Status: 낮]', '첫 문단.', '적룡검이 나왔다.', '끝.', marker('red', '적룡검')].join('\n\n');
  const out = positionMarkersByNarrative(text);
  const paragraphs = out.split(/\n{2,}/);
  const at = paragraphs.findIndex((one) => one.includes('<!--ITEMX2:'));
  assert.ok(paragraphs[at - 1]?.includes('적룡검') || paragraphs[at]?.includes('적룡검'), out);
  // A status block that closes the response still keeps cards above it.
  const closing = positionMarkersByNarrative(
    ['적룡검이 나왔다.', '[Status: 밤]', marker('red', '적룡검')].join('\n\n')
  );
  assert.ok(closing.indexOf('<!--ITEMX2:') < closing.indexOf('[Status: 밤]'));
});

test('an encounter named in the opening or a header keeps its card at the fight, not at the top', () => {
  const entity = { id: 'goblin', name: '고블린 족장' };
  const marker = Core.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity }, view: entity }).replace(
    '<!--ITEMX2:',
    '<!--CODEX2:'
  );
  const text = [
    '[Status: 숲 | 적: 고블린 족장]',
    '멀리서 고블린 족장의 북소리가 들려왔다.',
    '한참을 걸었다.',
    '고블린 족장이 도끼를 들고 덤벼들었다.',
    marker,
    '전투가 이어졌다.'
  ].join('\n\n');
  const paragraphs = positionMarkersByNarrative(text).split(/\n{2,}/);
  const at = paragraphs.findIndex((one) => one.includes('<!--CODEX2:'));
  assert.ok(paragraphs[at - 1]?.includes('덤벼들었다'), paragraphs.join(' / '));
  // Full name in the opening, a shorter one at the fight: nearness wins.
  const full = { id: 'chief', name: '붉은 눈의 고블린 족장' };
  const fullMarker = Core.marker({
    v: 1,
    event: { domain: 'monster', kind: 'exam', entity: full },
    view: full
  }).replace('<!--ITEMX2:', '<!--CODEX2:');
  const short = positionMarkersByNarrative(
    [
      '붉은 눈의 고블린 족장이 산다는 소문이 돌았다.',
      '한참을 걸었다.',
      '고블린 족장이 덤벼들었다.',
      fullMarker,
      '끝.'
    ].join('\n\n')
  ).split(/\n{2,}/);
  assert.ok(
    short[short.findIndex((one) => one.includes('<!--CODEX2:')) - 1]?.includes('덤벼들었다'),
    short.join(' / ')
  );
  // Batched at the end, it follows the latest mention before it.
  const batched = positionMarkersByNarrative(
    ['[Status: 숲]', '고블린 족장의 북소리.', '고블린 족장이 덤벼들었다.', '끝.', marker].join('\n\n')
  ).split(/\n{2,}/);
  const atBatched = batched.findIndex((one) => one.includes('<!--CODEX2:'));
  assert.ok(batched[atBatched - 1]?.includes('덤벼들었다'), batched.join(' / '));
  // Placed before any mention, it moves down to the first mention.
  const early = positionMarkersByNarrative(['첫 문단.', marker, '고블린 족장이 나타났다.', '끝.'].join('\n\n')).split(
    /\n{2,}/
  );
  assert.ok(early[early.findIndex((one) => one.includes('<!--CODEX2:')) - 1]?.includes('나타났다'), early.join(' / '));
});

test('a transport mentioned only in planning or inline code is not pending raw output', () => {
  assert.equal(hasRawTransport('<Thoughts>`<itemExam>` 를 쓴다</Thoughts>\n\n본문.'), false);
  assert.equal(hasRawTransport('본문에서 `[itemx: id=a]` 를 설명한다.'), false);
  assert.equal(hasRawTransport(`본문.\n${tag('red', '적룡검')}`), true);
});

test('the live response: anchors land below the header, and catch-ups do not rewrite the chat', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const fake = fresh();
  const out = await Pipeline.processOutput(response, 'main');
  const keys = Anchors.anchorKeys(out);
  assert.equal(keys.length, 2);
  assert.ok(out.indexOf('<!--ix:') > out.indexOf('적룡검이 모습을'), 'first card follows its paragraph');
  assert.ok(out.indexOf('[Status:') < out.indexOf('<!--ix:'), 'no card above the header');
  fake.state.chat.message.push({ chatId: 'reply', role: 'char', data: out });
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  t.mock.timers.tick(2000);
  await Pipeline.scheduleCommittedOutputSync();
  const writes = fake.state.writes;
  for (let i = 0; i < 4; i += 1) {
    t.mock.timers.tick(6000);
    await Pipeline.catchUpLatestOutput({ syncUi: false });
  }
  assert.equal(fake.state.writes, writes, 'a planning mention must not re-run the commit');
});

test('the host re-running the output hook after the commit keeps the same anchors', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const fake = fresh();
  const out = await Pipeline.processOutput(response, 'main');
  fake.state.chat.message.push({ chatId: 'reply', role: 'char', data: out });
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  t.mock.timers.tick(2000);
  await Pipeline.scheduleCommittedOutputSync();
  assert.equal(await Pipeline.processOutput(response, 'main'), out);
  // A reroll replaces the message: the committed anchors no longer stand, so
  // the same text gets fresh keys owned by the new message.
  fake.state.chat.message.pop();
  // The host removes the old reply before it sends the request again.
  await Pipeline.beforeRequest([{ role: 'user', content: '보여줘' }], 'main');
  const rerolled = await Pipeline.processOutput(response, 'main');
  assert.equal(Anchors.anchorKeys(rerolled).filter((key) => Anchors.anchorKeys(out).includes(key)).length, 0);
});

test('raw tags written back into a stored message never show; anchors beside them still render', async () => {
  const { Style, Presentation } = await import('./helpers/modules.mjs');
  const fake = createFakeHost({
    document: true,
    chat: { id: 'chat', message: [{ chatId: 'u', role: 'user', data: '정산' }], scriptstate: {} },
    character: { chaId: 'flow', name: 'T' },
    settings
  });
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession('flow:chat');
  const raw = [
    '마정석을 트레이에 올렸다.',
    '[itemx: id=lowest_mana_stone | action=transfer | quantity=3 | destination=hunter_association | reason=정산 창구 매각]\n[itemx: id=money_krw | action=acquire | quantity=380000 | reason=마정석 정산 대금]',
    '<itemPatch><id>x</id><action>consume</action></itemPatch>잔고가 바뀌었다.'
  ].join('\n\n');
  const shown = await Presentation.displayHandler(raw);
  assert.doesNotMatch(shown, /itemx:|itemPatch|action=/, shown);
  assert.match(shown, /마정석을 트레이에 올렸다\./);
  assert.match(shown, /잔고가 바뀌었다\./);
  // Planning keeps its literal mention.
  assert.match(await Presentation.displayHandler('<Thoughts>`[itemx: id=a]`</Thoughts>\n\n본문.'), /\[itemx: id=a\]/);
});

test('a marker block on its own lines stays after the paragraph it follows', () => {
  const marker = (id, name) =>
    Core.marker({ v: Core.VERSION, event: { kind: 'exam', item: Core.normalizeItem({ id, name, count: 1 }).item } });
  const text = [
    '돌을 트레이에 올렸다.',
    `${marker('a', '최하급 마정석')}\n${marker('b', '하급 마정석')}`,
    '- System Message: 정산.',
    '잔고가 바뀌었다.',
    marker('w', '원'),
    '다음 장면.'
  ].join('\n\n');
  const paragraphs = positionMarkersByNarrative(text).split(/\n{2,}/);
  const first = paragraphs.findIndex((one) => one.includes('<!--ITEMX2:'));
  assert.ok(paragraphs[first - 1]?.includes('트레이'), paragraphs.join(' / '));
  const last = paragraphs.findLastIndex((one) => one.includes('<!--ITEMX2:'));
  assert.ok(paragraphs[last - 1]?.includes('잔고'), paragraphs.join(' / '));
});

test('a sold item card says how it left, and a count change reads with separators', async () => {
  const Renderer = await import('../src/render/renderer.js');
  const view = {
    ...Core.normalizeItem({ id: 'stone', name: '하급 마정석', count: 1 }).item,
    possession: 'removed',
    location: 'unknown',
    count: 0,
    removedReason: '정산 창구 매각'
  };
  const html = Renderer.renderMarkerPayload(
    {
      event: { kind: 'patch', patch: { id: 'stone', action: 'transfer' } },
      view,
      previous: { ...view, possession: 'owned', count: 3 }
    },
    { inline: true, motion: 'off' }
  );
  assert.match(html, /양도 · 정산 창구 매각/);
  assert.doesNotMatch(html, /위치 불명/);
  const money = { ...Core.normalizeItem({ id: 'krw', name: '원', count: 5380000 }).item, currency: true };
  assert.match(Renderer.changesHtml({ ...money, count: 5000000 }, money), /5,000,000.*5,380,000/);
});
