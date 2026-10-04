import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { itemExam, seedChat, documentOf } from './helpers/ledger.mjs';
import {
  setHost,
  Core,
  Ledger,
  Pipeline,
  Presentation,
  Replay,
  Session,
  Aux,
  Anchors,
  Document
} from './helpers/modules.mjs';

const sword = (name = '검', extra = {}) => itemExam({ id: 'sword', name, possession: 'owned', count: 1, ...extra });
const shield = () => itemExam({ id: 'shield', name: '방패', possession: 'owned', count: 1 });
const patch = (fields) => ({ kind: 'patch', patch: { id: 'sword', op: 'merge', fields } });
const items = (chat) => {
  const state = Replay.fold(chat, documentOf(chat));
  return state.item.registry.order.map((id) => state.item.registry.items[id]);
};
const names = (chat) => items(chat).map((item) => item.name);

const settingsDoc = (id, extra = {}) => ({
  v: 1,
  global: {},
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: false,
      ...extra
    }
  }
});

test('message text carries only short anchors; the document carries the events', () => {
  const chat = seedChat([{ data: '검을 얻었다.', events: [sword()] }]);
  const text = chat.message[0].data;
  assert.match(text, /^검을 얻었다\.\n\n<!--ix:[0-9a-z]{4,12}-->$/);
  assert.doesNotMatch(text, /ITEMX2|CODEX2|base64/);
  assert.deepEqual(names(chat), ['검']);
});

test('a reroll that drops the anchor makes the event inactive', () => {
  const chat = seedChat([
    { data: '검을 얻었다.', events: [sword()] },
    { data: '방패를 얻었다.', events: [shield()] }
  ]);
  assert.deepEqual(names(chat), ['검', '방패']);
  chat.message[1] = { ...chat.message[1], data: '아무것도 없었다.' };
  assert.deepEqual(names(chat), ['검']);
  // The row stays in the document; bringing the same text back reactivates it.
  assert.equal(Object.keys(documentOf(chat).events).length, 2);
});

test('a deleted message takes its events with it', () => {
  const chat = seedChat([
    { data: '검', events: [sword()] },
    { data: '방패', events: [shield()] }
  ]);
  chat.message.splice(0, 1);
  assert.deepEqual(names(chat), ['방패']);
});

test('an anchor counts in whichever message carries it, so a chat copy with new ids keeps its events', () => {
  const chat = seedChat([{ data: '검', events: [sword()] }, { data: '평범' }]);
  chat.message[1] = { ...chat.message[1], data: chat.message[0].data };
  chat.message[0] = { ...chat.message[0], data: '' };
  assert.deepEqual(names(chat), ['검']);
  const copy = { ...chat, message: chat.message.map((one, index) => ({ ...one, chatId: `copy${index}` })) };
  assert.deepEqual(names(copy), ['검']);
});

test('deleting an earlier message keeps later events in current message order', () => {
  const chat = seedChat([
    { data: '검', events: [sword('검')] },
    { data: '대화' },
    { data: '개명', events: [patch({ name: '명검' })] }
  ]);
  assert.deepEqual(names(chat), ['명검']);
  chat.message.splice(1, 1);
  assert.deepEqual(names(chat), ['명검']);
  // Without its exam the rename has nothing to rename.
  chat.message.splice(0, 1);
  assert.deepEqual(names(chat), []);
});

test('a user edit that keeps the anchor keeps the event', () => {
  const chat = seedChat([{ data: '검을 얻었다.', events: [sword()] }]);
  const key = Anchors.anchorKeys(chat.message[0].data)[0];
  chat.message[0] = { ...chat.message[0], data: `완전히 고쳐 쓴 문장. ${Anchors.anchor(key)}` };
  assert.deepEqual(names(chat), ['검']);
});

test('manual rows follow the message they were made after, wherever it now is', () => {
  const doc = Document.emptyDocument();
  doc.manual.push({ id: 'm1', a: 'm0', d: 'item', e: patch({ name: '수동 이름' }), l: '수동', s: 99, t: 0 });
  const chat = seedChat(
    [
      { data: '검', events: [sword('검')] },
      { data: '다시 감정', events: [patch({ name: '감정된 이름' })] }
    ],
    { doc }
  );
  // Manual after m0, then m1's patch: the later message wins.
  assert.deepEqual(names(chat), ['감정된 이름']);
  // Moving the anchoring message to the end moves the manual row with it:
  // the patch now runs before the exam, the manual rename after it.
  chat.message = [chat.message[1], chat.message[0]];
  assert.deepEqual(names(chat), ['수동 이름']);
  chat.message = [chat.message[1], chat.message[0]];
  // A row whose message is gone still happened: it runs last.
  chat.message[0] = { ...chat.message[0], chatId: 'other' };
  const replaced = seedChat([{ chatId: 'x', data: '검', events: [sword('검')] }], { doc: documentOf(chat) });
  assert.deepEqual(names(replaced), ['수동 이름']);
});

test('manual rows made before any message run first', () => {
  const doc = Document.emptyDocument();
  doc.manual.push({ id: 'm1', a: '', d: 'item', e: sword('처음'), l: '수동', s: 1, t: 0 });
  const chat = seedChat([{ data: '개명', events: [patch({ name: '나중' })] }], { doc });
  assert.deepEqual(names(chat), ['나중']);
});

test('stored anchors and old markers never reach the model', async () => {
  const text = `본문 <!--ix:abcd1--> 그리고 <!--ITEMX2@i0_0_abc:eyJ9--> 끝 <!--CODEX2:eyJ2IjoxfQ-->`;
  const safe = await Pipeline.processHandler(text);
  assert.doesNotMatch(safe, /<!--/);
  assert.match(safe, /본문/);
  const fake = createFakeHost({ character: { chaId: 'strip', name: 'T' }, settings: settingsDoc('strip') });
  setHost(fake.api);
  Session.resetSession('strip:chat');
  const request = await Pipeline.beforeRequest([{ role: 'assistant', content: text }], 'model');
  assert.ok(request.every((message) => !/<!--(?:ix:|ITEMX2|CODEX2)/.test(message.content)));
});

test('a malformed document is surfaced, never replaced', () => {
  const chat = { message: [], scriptstate: { [Document.DOCUMENT_KEY]: '{"v":1,"events":[]}' } };
  assert.throws(() => Ledger.project({ chat, key: 'k' }), /invalid/);
});

test('aux guards live in the document and survive cache loss', async () => {
  const doc = Document.emptyDocument();
  const chat = seedChat(
    [
      { role: 'user', data: '줍는다', chatId: 'u' },
      { role: 'char', data: '검을 주웠다.', chatId: 'reply' }
    ],
    { doc }
  );
  const fake = createFakeHost({
    chat,
    character: { chaId: 'guard', name: 'T' },
    settings: settingsDoc('guard', { auxOutput: 'always' }),
    llm: async () => 'NONE'
  });
  setHost(fake.api);
  Session.resetSession('guard:chat');
  const first = await Aux.recoverAuxiliaryOutputNow({ force: false });
  assert.equal(first.status, 'ok');
  assert.deepEqual(first.events, []);
  assert.equal(fake.state.llmCalls.length, 1);
  const guard = documentOf(fake.state.chat).guards.aux.reply;
  assert.equal(guard.state, 'none');
  assert.ok(guard.k);
  // Drop the cache: the guard is authoritative data, so no second model call.
  delete fake.state.chat.scriptstate[Document.CACHE_KEY];
  assert.equal((await Aux.recoverAuxiliaryOutputNow({ force: false })).reason, 'guarded');
  assert.equal(fake.state.llmCalls.length, 1);
});

test('output is anchored at the hook, rendered from pending, and committed once at the listener', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const fake = createFakeHost({
    chat: { id: 'chat', message: [{ chatId: 'u', role: 'user', data: '검을 줍는다.' }], scriptstate: {} },
    character: { chaId: 'flow', name: 'T' },
    settings: settingsDoc('flow')
  });
  setHost(fake.api);
  Session.resetSession('flow:chat');
  const tags =
    '검을 얻었다.\n\n<itemExam><id>blade</id><name>검</name><type>검</type><possession>owned</possession></itemExam>';
  const output = await Pipeline.processOutput(tags, 'main');
  const again = await Pipeline.processOutput(tags, 'main');
  assert.equal(output, again, 'every pass over one response agrees on its anchors');
  assert.match(output, /^검을 얻었다\.\n\n<!--ix:[0-9a-z]{5,12}-->$/);
  assert.equal(fake.state.writes, 0);
  // Before the commit the display hook renders the pending record.
  assert.match(await Presentation.displayHandler(output), /itemx2-card|itemx-card|검/);
  fake.state.chat.message.push({ chatId: 'reply', role: 'char', data: output });
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  t.mock.timers.tick(2000);
  await Pipeline.scheduleCommittedOutputSync();
  assert.equal(fake.state.writes, 1);
  const doc = documentOf(fake.state.chat);
  const [key] = Anchors.anchorKeys(output);
  assert.equal(doc.events[key].c, 'reply');
  assert.equal(doc.events[key].e.item.id, 'blade');
  assert.equal(fake.state.chat.message[1].data, output, 'the commit does not rewrite the message');
  t.mock.timers.tick(2000);
  await Pipeline.scheduleCommittedOutputSync();
  assert.equal(fake.state.writes, 1);
  assert.deepEqual(names(fake.state.chat), ['검']);
});

test('raw tags the output hook never saw are anchored by the commit', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const fake = createFakeHost({
    chat: {
      id: 'chat',
      message: [
        { chatId: 'u', role: 'user', data: '줍는다' },
        {
          chatId: 'reply',
          role: 'char',
          data: '검을 얻었다.\n\n<itemExam><id>blade</id><name>검</name><possession>owned</possession></itemExam>'
        }
      ],
      scriptstate: {}
    },
    character: { chaId: 'raw', name: 'T' },
    settings: settingsDoc('raw')
  });
  setHost(fake.api);
  Session.resetSession('raw:chat');
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
  assert.match(fake.state.chat.message[1].data, /^검을 얻었다\.\n\n<!--ix:[0-9a-z]+-->$/);
  assert.deepEqual(names(fake.state.chat), ['검']);
});

test('the commit and rebuild never serialize the chat for provenance on read', async () => {
  const chat = seedChat([{ data: '검', events: [sword()] }]);
  const fake = createFakeHost({ chat, character: { chaId: 'cost', name: 'T' }, settings: settingsDoc('cost') });
  setHost(fake.api);
  Session.resetSession('cost:chat');
  const original = JSON.stringify;
  let calls = 0;
  JSON.stringify = (...args) => {
    if (args[0] && typeof args[0] === 'object' && Array.isArray(args[0].message)) calls += 1;
    return original(...args);
  };
  try {
    await Ledger.rebuildCurrent();
    await Ledger.cachedOrRebuildCurrent();
  } finally {
    JSON.stringify = original;
  }
  assert.equal(calls, 0);
});

test('clean-up removes anchors, old markers and the ITEMX document', () => {
  const chat = seedChat([{ data: '검 <!--ITEMX2@x-->', events: [sword()] }], {
    scriptstate: { 'itemx:log': '{}', other: 'keep' }
  });
  const cleaned = Ledger.cleanChatPluginData(chat);
  assert.equal(cleaned.chat.message[0].data.trim(), '검');
  assert.equal(cleaned.removedMarkers, 2);
  // Keys of ITEMX 2.0 – 2.3 are not 2.5 data and stay untouched.
  assert.deepEqual(Object.keys(cleaned.chat.scriptstate), ['itemx:log', 'other']);
  void Core;
});

test('streamed output flushes reuse the request projection and read no chat', async () => {
  const fake = createFakeHost({
    chat: { id: 'chat', message: [{ chatId: 'u', role: 'user', data: '줍는다' }], scriptstate: {} },
    character: { chaId: 'stream', name: 'T' },
    settings: settingsDoc('stream')
  });
  setHost(fake.api);
  Session.resetSession('stream:chat');
  await Pipeline.beforeRequest([{ role: 'user', content: '줍는다' }], 'model');
  const reads = fake.state.reads;
  let text = '검을';
  for (const chunk of [
    ' 얻었다.',
    '\n\n<itemExam><id>blade</id><name>검</name>',
    '<possession>owned</possession></itemExam>'
  ]) {
    text += chunk;
    await Pipeline.processOutput(text, 'main');
  }
  assert.equal(fake.state.reads, reads);
  assert.equal(fake.state.writes, 0);
});
