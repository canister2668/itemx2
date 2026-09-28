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
