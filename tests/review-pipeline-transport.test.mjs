import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf, seedChat, itemExam } from './helpers/ledger.mjs';
import { setHost, Anchors, Ledger, Pipeline, Presentation, Session, Settings, Transport } from './helpers/modules.mjs';
import { resetPendingRestore } from '../src/pending-store.js';
import { DOCUMENT_KEY } from '../src/store/document.js';

const settingsDoc = (id, extra = {}) => ({
  v: 1,
  global: { badgePosition: 'rm' },
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
const exam = (id, name, count = 1) =>
  `[itemx: id=${id} | name=${name} | type=소모품 | emoji=🧪 | rarity=normal | display=커먼 | possession=owned | location=inventory | count=${count}]`;
const status = '[아이템: 회복약 3개]';

function setup(id, { chat = { id: 'chat', message: [], scriptstate: {} }, extra = {} } = {}) {
  const fake = createFakeHost({ chat, character: { chaId: id, name: 'Test' }, settings: settingsDoc(id, extra) });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  resetPendingRestore();
  Pipeline.markCatchUpDirty();
  return fake;
}

async function reply(fake, user, text) {
  fake.state.chat.message.push({ chatId: `u-${user}`, role: 'user', data: user });
  // The request hook projects the chat as it stands before the reply.
  await Pipeline.beforeRequest([{ role: 'user', content: user }], 'model');
  const output = await Pipeline.processOutput(text, 'main');
  fake.state.chat.message.push({ chatId: `r-${user}`, role: 'char', data: output });
  return output;
}

// 1 (a) ---------------------------------------------------------------------
test('with ITEMX off for the bot, output, request and display leave the text alone', async () => {
  const fake = setup('off1', { extra: { enabled: false } });
  await Settings.settingsFor(fake.state.character, { refresh: true });
  await Ledger.rebuildCurrent();
  assert.equal(Transport.itemxDisabled(), true);
  const text = `상태창\n${status}\n\n${exam('potion', '회복약', 3)}\n\n\`\`\`\n코드\n\`\`\``;
  assert.equal(await Pipeline.processOutput(text, 'main'), text);
  assert.equal(await Pipeline.outputFallback(text), text);
  assert.equal(Transport.hasRawTransport(text), false);
  assert.equal(await Presentation.displayHandler(text), text);
  assert.equal(await Pipeline.processHandler(text), text);
  for (const type of ['model', 'emotion']) {
    const request = await Pipeline.beforeRequest([{ role: 'assistant', content: text }], type);
    assert.equal(request.length, 1, 'no protocol is injected');
    assert.equal(request[0].content, text);
  }
  // Its own anchors are still kept out of the request.
  const anchored = await Pipeline.beforeRequest(
    [{ role: 'assistant', content: `${status}\n\n<!--ix:abcde-->` }],
    'model'
  );
  assert.equal(anchored[0].content.trim(), status);
  // Turning the bot on again restores the normal handling.
  await Settings.changeSettings(fake.state.character, { enabled: true });
  assert.equal(Transport.itemxDisabled(), false);
  assert.equal(Transport.hasRawTransport(text), true);
});

// 1 (b) ---------------------------------------------------------------------
test('a Korean [아이템: …] line is a transport only with an id= or name= field', async () => {
  const fake = setup('alias');
  assert.equal(Transport.hasRawTransport(`서술.\n${status}`), false);
  assert.equal(Transport.hasRawTransport('[아이템: id=potion | name=회복약]'), true);
  assert.equal(Transport.hasRawTransport('[아이템: 이름=회복약 | type=소모품]'), true);
  assert.equal(Transport.requestSafeText(`서술.\n${status}`), `서술.\n${status}`);
  assert.equal(Anchors.stripTransport(`서술.\n${status}\n${exam('a', '검')}`).includes(status), true);
  // Beside a real tag the status line still survives, in output and request.
  const text = `상태창\n${status}\n\n물약을 얻었다.\n\n[아이템: id=potion | name=회복약 | type=소모품 | possession=owned | location=inventory | count=3]`;
  const output = await reply(fake, '물약', text);
  assert.equal(output.includes(status), true, output);
  assert.equal(Anchors.anchorKeys(output).length, 1);
  assert.doesNotMatch(output, /id=potion/);
  assert.equal(Transport.requestSafeText(text).includes(status), true);
  assert.doesNotMatch(Transport.requestSafeText(text), /id=potion/);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(Object.values(documentOf(fake.state.chat).events)[0].e.item.id, 'potion');
  assert.equal(fake.state.chat.message.at(-1).data.includes(status), true);
});

// 2 -------------------------------------------------------------------------
test('processOutput returns the original text when it fails, so the tags stay recoverable', async () => {
  const fake = setup('throw', {
    chat: {
      id: 'chat',
      message: [{ chatId: 'u', role: 'user', data: '물약' }],
      scriptstate: { [DOCUMENT_KEY]: '{"v":2,"events":"broken","manual":[]}' }
    }
  });
  const text = `물약을 얻었다.\n\n${exam('potion', '회복약', 3)}`;
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await Pipeline.processOutput(text, 'main'), text);
  } finally {
    console.error = original;
  }
  assert.equal(fake.state.writes, 0);
});

// 3 -------------------------------------------------------------------------
test('code fences of the story survive a reply with tags; a fence that only wrapped tags goes', async () => {
  const fake = setup('fence');
  const block = '```\nHP 10 / 10\n\nMP 5\n```';
  const text = `서술 문단.\n\n${block}\n\n물약을 얻었다.\n\n\`\`\`xml\n${exam('potion', '회복약', 3)}\n\`\`\`\n\n끝.`;
  const output = await reply(fake, '물약', text);
  assert.equal(output.includes(block), true, output);
  assert.equal((output.match(/```/g) || []).length, 2, output);
  assert.doesNotMatch(output, /```xml/);
  assert.equal(Anchors.anchorKeys(output).length, 1);
  assert.equal(Anchors.stripTransport(text).includes(block), true);
  assert.doesNotMatch(Anchors.stripTransport(text), /```xml/);
  // An empty fenced block without any tag is story text.
  const empty = `a\n\n\`\`\`\n\`\`\`\n\n${exam('b', '검')}`;
  assert.equal(Anchors.stripTransport(empty).includes('```\n```'), true);
});

test('a card is never placed inside a code fence or an HTML block', async () => {
  const fake = setup('place');
  const fenced = `검을 얻었다.\n\n\`\`\`\n상태창\n\n철검 장착\n\n${exam('sword', '철검')}\n\`\`\`\n\n끝.`;
  const first = await reply(fake, '검', fenced);
  const [key] = Anchors.anchorKeys(first);
  assert.ok(key, first);
  assert.ok(first.indexOf(`<!--ix:${key}-->`) < first.indexOf('```'), first);
  assert.equal((first.match(/```/g) || []).length, 2);
  const html = `방패를 얻었다.\n\n<div class="status">\n\n강철 방패 장착\n\n${exam('shield', '강철 방패')}\n\n</div>\n\n끝.`;
  const second = await reply(fake, '방패', html);
  const [other] = Anchors.anchorKeys(second);
  assert.ok(other, second);
  assert.ok(second.indexOf(`<!--ix:${other}-->`) < second.indexOf('<div'), second);
  // A name written only inside the block does not pull the card into it.
  const marker = second.replace(`<!--ix:${other}-->`, '').replace('방패를 얻었다.', '무언가를 얻었다.');
  const pieces = marker.split(/(\n{2,})/);
  assert.deepEqual(
    Transport.enclosedPieces(pieces).filter((_, index) => index % 2 === 0),
    [false, true, true, true, false]
  );
});

// 4 -------------------------------------------------------------------------
test('raw detection agrees with the parsers about inline code, so an idle pass writes nothing', async () => {
  const tag = '<itemExam><id>a</id><name>검</name><possession>owned</possession></itemExam>';
  assert.equal(Transport.hasRawTransport(`문법은 \`\`${tag}\`\` 이다.`), false);
  assert.equal(Transport.hasRawTransport(`문법은 \`${tag}\` 이다.`), false);
  assert.equal(Transport.hasRawTransport('예: `[itemx: id=a | name=검]` 처럼.'), false);
  assert.equal(Transport.hasRawTransport('예: ``[itemx: id=a | name=검]`` 처럼.'), false);
  assert.equal(Transport.hasRawTransport(`서술.\n${tag}`), true);
  // The parsers leave each of those mentions in place, beside a real tag too.
  const state = { registry: (await import('../src/engine/core.js')).newRegistry(), codex: null };
  const Codex = await import('../src/engine/codex.js');
  state.codex = Codex.snapshot();
  const mention = '예: `[itemx: id=fake | name=가짜 | possession=owned | location=inventory]` 처럼.';
  const parsed = Transport.anchorize(`${mention}\n\n${exam('real', '진짜')}`, {
    state,
    settings: { itemsEnabled: true },
    seed: 's',
    doc: { events: {} }
  });
  assert.equal(parsed.content.includes(mention), true, parsed.content);
  assert.deepEqual(
    parsed.records.map((record) => record.event.item.id),
    ['real']
  );

  const fake = setup('quoted', {
    chat: {
      id: 'chat',
      message: [
        { chatId: 'u', role: 'user', data: '설명해줘' },
        { chatId: 'r', role: 'char', data: `문법은 \`\`${tag}\`\` 이다.` }
      ],
      scriptstate: {}
    }
  });
  for (let pass = 0; pass < 3; pass += 1) await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 0);
  assert.equal(fake.state.chat.message[1].data.includes(tag), true);
});

// 5 -------------------------------------------------------------------------
test('the idle watchdog reads the chat only when something may have changed', async () => {
  const fake = setup('idle', {
    chat: {
      id: 'chat',
      message: [
        { chatId: 'u', role: 'user', data: '안녕' },
        { chatId: 'r', role: 'char', data: '조용한 하루였다.' }
      ],
      scriptstate: {}
    }
  });
  const tick = async () => {
    const before = fake.state.reads;
    await Pipeline.catchUpTick();
    return fake.state.reads - before;
  };
  assert.ok((await tick()) > 0, 'the first tick after load runs');
  // The auxiliary settle window needs a second sighting; ticks run until then.
  for (let i = 0; i < 6 && Pipeline.catchUpPending(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await tick();
  }
  assert.equal(Pipeline.catchUpPending(), false);
  assert.equal(await tick(), 0);
  assert.equal(await tick(), 0);
  // An output flush.
  await Pipeline.outputFallback('새 응답');
  assert.equal(Pipeline.catchUpPending(), true);
  assert.ok((await tick()) > 0);
  for (let i = 0; i < 6 && Pipeline.catchUpPending(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await tick();
  }
  assert.equal(await tick(), 0);
  // The host's commit listener.
  await Pipeline.scheduleCommittedOutputSync();
  for (let i = 0; i < 6 && Pipeline.catchUpPending(); i += 1) await tick();
  assert.equal(await tick(), 0);
  // A rebuilt projection (deleted message, edited anchors, browser resume).
  await Ledger.rebuildCurrent();
  assert.equal(Pipeline.catchUpPending(), true);
  await tick();
  assert.equal(await tick(), 0);
  // Changed settings.
  await Settings.changeSettings(fake.state.character, { skillsEnabled: true });
  assert.equal(Pipeline.catchUpPending(), true);
  await tick();
  assert.equal(await tick(), 0);
  // Another chat.
  Session.setActiveContextKey('idle:other');
  assert.equal(Pipeline.catchUpPending(), true);
});

test('a commit that failed keeps the watchdog awake', async () => {
  const fake = setup('idle2');
  await reply(fake, '검', `검을 얻었다.\n\n${exam('blade', '검')}`);
  fake.state.onWrite = () => {
    throw new Error('rejected');
  };
  const original = console.error;
  console.error = () => {};
  try {
    await Pipeline.catchUpTick();
  } finally {
    console.error = original;
  }
  assert.equal(Pipeline.catchUpPending(), true);
  fake.state.onWrite = null;
  await Pipeline.catchUpTick();
  assert.equal(Object.keys(documentOf(fake.state.chat).events).length, 1);
});

// 6 -------------------------------------------------------------------------
test('cards of a reply whose commit was skipped land with the next reply, once', async () => {
  const fake = setup('orphan');
  // Reply N is parsed, its commit never runs (auxiliary call in flight,
  // scrolling, the next reply already streaming).
  await reply(fake, '물약', `물약을 얻었다.\n\n${exam('potion', '회복약', 3)}`);
  assert.equal(Object.keys(documentOf(fake.state.chat).events).length, 0);
  await reply(
    fake,
    '사용',
    `하나를 마셨다.\n\n[itemx: id=potion | action=consume | quantity=1]\n\n검도 얻었다.\n\n${exam('blade', '검')}`
  );
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  let doc = documentOf(fake.state.chat);
  const rows = Object.values(doc.events);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.filter((row) => row.c === 'r-물약').length, 1);
  assert.deepEqual(rows.filter((row) => row.c === 'r-사용').length, 2);
  // The state record of the newest reply holds reply N's item, applied once.
  const state = doc.states.at(-1).x.item.registry.items;
  assert.equal(state.potion.count, 2);
  assert.equal(state.blade.count, 1);
  assert.equal(doc.states.length, 2, 'both replies have their state entry');
  assert.equal(Session.pendingEntries('orphan:chat').length, 0);
  // Later passes change nothing.
  const writes = fake.state.writes;
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, writes);
  doc = documentOf(fake.state.chat);
  assert.equal(Object.keys(doc.events).length, 3);
  const loaded = await Ledger.rebuildCurrent();
  assert.equal(loaded.snapshot.registry.items.potion.count, 2);
});

test('a reply committed in time is not committed again as an orphan', async () => {
  const fake = setup('orphan2');
  await reply(fake, '물약', `물약을 얻었다.\n\n${exam('potion', '회복약', 3)}`);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  await reply(fake, '사용', '하나를 마셨다.\n\n[itemx: id=potion | action=consume | quantity=1]');
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const doc = documentOf(fake.state.chat);
  assert.equal(Object.keys(doc.events).length, 2);
  assert.equal(doc.states.at(-1).x.item.registry.items.potion.count, 2);
});

test('an uncommitted card further back than the orphan window, or of a replaced reply, is left alone', async () => {
  const fake = setup('orphan3');
  await reply(fake, '물약', `물약을 얻었다.\n\n${exam('potion', '회복약', 3)}`);
  for (let i = 0; i < 13; i += 1) {
    fake.state.chat.message.push({ chatId: `u${i}`, role: 'user', data: '계속' });
    fake.state.chat.message.push({ chatId: `r${i}`, role: 'char', data: '조용했다.' });
  }
  // A reply that was parsed and then rerolled away: its anchor stands nowhere.
  await Pipeline.processOutput(`도끼를 얻었다.\n\n${exam('axe', '도끼')}`, 'main');
  await reply(fake, '검', `검을 얻었다.\n\n${exam('blade', '검')}`);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const ids = Object.values(documentOf(fake.state.chat).events).map((row) => row.e.item.id);
  assert.deepEqual(ids, ['blade']);
});

// 7 -------------------------------------------------------------------------
test('a rebuild between two streaming flushes does not apply the reply twice', async () => {
  const chat = seedChat([
    { role: 'user', data: '시작', chatId: 'u0' },
    {
      role: 'char',
      data: '물약 셋을 받았다.',
      chatId: 'r0',
      events: [itemExam({ id: 'potion', name: '회복약', possession: 'owned', location: 'inventory', count: 3 })]
    },
    { role: 'user', data: '전부 마신다', chatId: 'u1' }
  ]);
  const fake = setup('stream', { chat: { id: 'chat', ...chat } });
  const partial = '전부 들이켰다.\n\n[itemx: id=potion | action=consume | quantity=all]';
  const first = await Pipeline.processOutput(partial, 'main');
  const [key] = Anchors.anchorKeys(first);
  assert.ok(key, first);
  // The host writes the flush into the chat; a slow flush lets the drawer rebuild.
  fake.state.chat.message.push({ chatId: 'r1', role: 'char', data: first, isStreaming: true });
  const rebuilt = await Ledger.rebuildCurrent();
  assert.equal(rebuilt.snapshot.registry.items.potion.count, 0, 'the projection shows the pending card');
  const second = await Pipeline.processOutput(`${partial}\n\n병이 비었다.`, 'main');
  assert.deepEqual(Anchors.anchorKeys(second), [key], second);
  const third = await Pipeline.processOutput(`${partial}\n\n병이 비었다.\n\n${exam('bottle', '빈 병')}`, 'main');
  assert.equal(Anchors.anchorKeys(third)[0], key);
  assert.equal(Anchors.anchorKeys(third).length, 2);
  // The finished reply commits one consume and leaves the stack empty.
  fake.state.chat.message[3] = { chatId: 'r1', role: 'char', data: third };
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const doc = documentOf(fake.state.chat);
  assert.equal(doc.events[key].e.patch.action, 'consume');
  const items = doc.states.at(-1).x.item.registry.items;
  assert.equal(items.potion.count, 0);
  assert.equal(items.bottle.count, 1);
});
