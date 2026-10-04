import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { itemExam, seedChat, documentOf } from './helpers/ledger.mjs';
import { setHost, Ledger, Pipeline, Replay, Session, Anchors, Document } from './helpers/modules.mjs';

// 2.5 state entries: the host may hold only the newest messages of a chat.

const own = (id, name = id, extra = {}) => itemExam({ id, name, possession: 'owned', count: 1, ...extra });
const take = (id, quantity = 1) => ({ kind: 'patch', patch: { id, action: 'consume', quantity } });
const drop = (id) => ({ kind: 'patch', patch: { id, op: 'remove' } });

// turns: [[events of the reply], ...] → user / reply pairs with send times.
function chatOf(turns) {
  const messages = turns.flatMap((events, index) => [
    { role: 'user', data: `입력 ${index}`, chatId: `u${index}`, time: 1000 + index * 10 },
    { role: 'char', data: `응답 ${index}`, chatId: `a${index}`, time: 1005 + index * 10, events }
  ]);
  return seedChat(messages);
}

const withDoc = (chat, doc) => ({
  ...chat,
  scriptstate: { ...chat.scriptstate, [Document.DOCUMENT_KEY]: JSON.stringify(doc) }
});

// Stamps every entry, as commits over the full chat do.
function stamped(chat) {
  const doc = documentOf(chat);
  assert.ok(Ledger.stampFrom(doc, chat, 0));
  return withDoc(chat, doc);
}

// What the host hands a plugin after opening the chat: the newest `n` messages.
const windowOf = (chat, n) => ({
  ...chat,
  message: chat.message.slice(-n),
  messageOffset: Math.max(0, chat.message.length - n),
  messagesFullyLoaded: chat.message.length <= n
});

function owned(chat) {
  const state = Replay.fold(chat, documentOf(chat));
  return state.item.registry.order.filter((id) => state.item.registry.items[id].possession === 'owned');
}

const loot = [[own('ring')], [], [own('key')], [own('pouch')], [], [own('books')], [own('wand')], [], [own('owl')]];
const tail = (chat, count) => ({
  ...chat,
  message: [
    ...chat.message,
    ...chatOf(Array.from({ length: count }, () => [])).message.map((one, index) => ({
      ...one,
      chatId: `t${index}`,
      time: 5000 + index
    }))
  ]
});

test('any window size gives the state of the full chat once entries exist', () => {
  const full = stamped(tail(chatOf(loot), 5));
  const expected = owned(full);
  assert.deepEqual(expected, ['ring', 'key', 'pouch', 'books', 'wand', 'owl']);
  for (const size of [12, 4, 1]) assert.deepEqual(owned(windowOf(full, size)), expected, `window ${size}`);
  // Without entries the window replays only what it sees: the 2.4 failure.
  assert.deepEqual(owned(windowOf(tail(chatOf(loot), 5), 12)), ['owl']);
});

test('rerolling or deleting the newest tagged reply falls back to the reply before it', () => {
  const full = stamped(chatOf(loot));
  const rerolled = {
    ...full,
    message: [...full.message.slice(0, -1), { role: 'char', chatId: 'new', data: '다른 응답', time: 9999 }]
  };
  assert.deepEqual(owned(rerolled), ['ring', 'key', 'pouch', 'books', 'wand']);
  assert.deepEqual(owned(windowOf(rerolled, 3)), ['ring', 'key', 'pouch', 'books', 'wand']);
  const deleted = { ...full, message: full.message.slice(0, -2) };
  assert.deepEqual(owned(windowOf(deleted, 2)), ['ring', 'key', 'pouch', 'books', 'wand']);
});

test('an edit of the newest reply that removes a card anchor is honoured', () => {
  const chat = stamped(chatOf([[own('ring')], [own('owl'), own('cage')]]));
  const last = chat.message.at(-1);
  const keys = Anchors.anchorKeys(last.data);
  const edited = {
    ...chat,
    message: [...chat.message.slice(0, -1), { ...last, data: last.data.replace(Anchors.anchor(keys[1]), '') }]
  };
  assert.deepEqual(owned(edited), ['ring', 'owl']);
  assert.deepEqual(owned(windowOf(edited, 1)), ['ring', 'owl']);
});

test('deleting an older message keeps what later entries hold', () => {
  const full = stamped(chatOf(loot));
  const older = { ...full, message: full.message.filter((one) => one.chatId !== 'a2' && one.chatId !== 'u2') };
  assert.deepEqual(owned(older), ['ring', 'key', 'pouch', 'books', 'wand', 'owl']);
  assert.deepEqual(owned(windowOf(older, 6)), ['ring', 'key', 'pouch', 'books', 'wand', 'owl']);
});

test('an entry is judged unloaded by send time even after older deletions shifted indexes', () => {
  const full = stamped(tail(chatOf(loot), 3));
  // Five early messages are deleted later: stored absolute indexes are now too large.
  const shifted = { ...full, message: full.message.slice(5) };
  for (const size of [6, 7, 8]) assert.deepEqual(owned(windowOf(shifted, size)), owned(shifted), `window ${size}`);
});

test('a chat copy with regenerated message ids keeps the state of every window', () => {
  const full = stamped(tail(chatOf(loot), 4));
  const copy = { ...full, message: full.message.map((one, index) => ({ ...one, chatId: `copy${index}` })) };
  assert.deepEqual(owned(windowOf(copy, 3)), owned(full));
});

test('manual rows keep their order against replies across entries and deletes', () => {
  const chat = chatOf([[own('potion', '물약', { itemType: '소모품', count: 2 })], [take('potion')]]);
  const doc = documentOf(chat);
  // After the consume (count 1) the user sets the count by hand.
  doc.seq += 1;
  doc.manual.push({
    id: 'm1',
    a: 'a1',
    d: 'item',
    e: { kind: 'patch', patch: { id: 'potion', op: 'merge', fields: { count: 10 } } },
    l: '수동',
    s: doc.seq,
    t: 2000
  });
  const full = withDoc(chat, doc);
  const count = (one) => Replay.fold(one, documentOf(one)).item.registry.items.potion.count;
  assert.equal(count(full), 10);
  const entries = stamped(full);
  assert.equal(count(entries), 10);
  assert.equal(count(windowOf(entries, 1)), 10);
  // The manual row was made after the reply: deleting that reply keeps the edit.
  const deleted = { ...entries, message: entries.message.slice(0, -1) };
  assert.equal(count(deleted), 10);
  // A manual drop made after the newest entry applies on top of it in any window.
  const later = documentOf(entries);
  later.seq += 1;
  later.manual.push({ id: 'm2', a: 'a1', d: 'item', e: drop('potion'), l: '삭제', s: later.seq, t: 3000 });
  assert.deepEqual(owned(windowOf(withDoc(entries, later), 1)), []);
});

test('a window that cannot ground the state never writes an entry', () => {
  const chat = chatOf(loot);
  const doc = documentOf(chat);
  assert.equal(Replay.restampEntries(windowOf(chat, 4), doc, 2), null);
  assert.deepEqual(doc.states, []);
  assert.equal(Replay.stampStart(windowOf(chat, 4), doc), -1);
  assert.ok(Replay.stampStart(chat, doc) >= 0);
});

test('old cards render from their frozen payload outside the replayed window', () => {
  const full = stamped(tail(chatOf(loot), 2));
  const doc = documentOf(full);
  const key = Anchors.anchorKeys(full.message[1].data)[0];
  assert.equal(doc.events[key].v.name, 'ring');
  const loaded = Ledger.project({ key: 'k', chat: windowOf(full, 2) });
  assert.equal(loaded.views.has(`e:${key}`), false);
  assert.equal(Ledger.anchorPayload(key, loaded).view.name, 'ring');
});

const settingsDoc = (id) => ({
  v: 1,
  global: {},
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: false
    }
  }
});

test('a commit stamps the entry, and a later commit stamps a 2.4 chat that has none', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const old = chatOf([[own('ring')], [own('key')], []]);
  const fake = createFakeHost({
    chat: { id: 'chat', ...old },
    character: { chaId: 'st', name: 'T' },
    settings: settingsDoc('st')
  });
  setHost(fake.api);
  Session.resetSession('st:chat');
  // A 2.4 chat: anchors and events, no entries. The next commit pass stamps it.
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
  assert.equal(documentOf(fake.state.chat).states.length, 1);
  // A new reply with a card commits and stamps in the same write.
  fake.state.chat.message.push({ role: 'user', data: '줍는다', chatId: 'u9', time: 9000 });
  await Pipeline.beforeRequest([{ role: 'user', content: '줍는다' }], 'main');
  const out = await Pipeline.processOutput(
    '부엉이를 샀다. <itemExam><id>owl</id><name>부엉이</name><type>기타</type><possession>owned</possession></itemExam>',
    'main'
  );
  fake.state.chat.message.push({ role: 'char', data: out, chatId: 'a9', time: 9005 });
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 2);
  assert.equal(documentOf(fake.state.chat).states.length, 2);
  assert.deepEqual(owned(windowOf(fake.state.chat, 1)), ['ring', 'key', 'owl']);
  // Nothing new: no further write.
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 2);
});

test('a backup restore is the root of every later window', async () => {
  const full = stamped(chatOf(loot));
  const doc = documentOf(full);
  doc.root = { x: Replay.fold(full, doc), m: [], i: full.message.length - 1, t: 9 };
  doc.root.x = { item: doc.root.x.item, codex: doc.root.x.codex, notes: {} };
  doc.events = {};
  doc.states = [];
  const restored = withDoc(
    { ...full, message: full.message.map((one) => ({ ...one, data: Anchors.stripAnchors(one.data) })) },
    doc
  );
  const more = tail(restored, 3);
  assert.deepEqual(owned(more), ['ring', 'key', 'pouch', 'books', 'wand', 'owl']);
  assert.deepEqual(owned(windowOf(more, 2)), ['ring', 'key', 'pouch', 'books', 'wand', 'owl']);
});

// Regressions found in review of the first 2.5 implementation.

test('a restore stays the root after earlier messages are deleted', () => {
  const chat = chatOf([[own('ring')], []]);
  const doc = documentOf(chat);
  doc.root = {
    x: { item: Replay.fold(chat, doc).item, codex: Replay.fold(chat, doc).codex, notes: {} },
    m: [],
    w: chat.message.at(-1).time,
    i: chat.message.length - 1,
    t: 2
  };
  doc.events = {};
  const restored = withDoc(
    { ...chat, message: chat.message.map((one) => ({ ...one, data: Anchors.stripAnchors(one.data) })) },
    doc
  );
  const shortened = { ...restored, message: restored.message.slice(2) };
  const added = chatOf([[], [own('owl')]]);
  const later = {
    ...shortened,
    scriptstate: {
      ...shortened.scriptstate,
      [Document.DOCUMENT_KEY]: JSON.stringify({ ...documentOf(shortened), events: documentOf(added).events, seq: 10 })
    },
    message: [...shortened.message, ...added.message.slice(2).map((one) => ({ ...one, time: one.time + 5000 }))]
  };
  assert.deepEqual(owned(later), ['ring', 'owl']);
  const doc2 = documentOf(later);
  assert.ok(Ledger.stampFrom(doc2, later, later.message.length - 1));
  assert.deepEqual(owned(windowOf(withDoc(later, doc2), 1)), ['ring', 'owl']);
});

test('a continue after an older deletion keeps what the reply already held', () => {
  const chat = stamped(chatOf([[own('ring')], [own('owl')]]));
  const deleted = { ...chat, message: chat.message.slice(2) };
  // The continue adds a card to the newest reply.
  const extra = chatOf([[own('cage')]]);
  const doc = documentOf(deleted);
  Object.assign(doc.events, documentOf(extra).events);
  const key = Anchors.anchorKeys(extra.message[1].data)[0];
  const last = deleted.message.at(-1);
  const continued = {
    ...deleted,
    message: [...deleted.message.slice(0, -1), { ...last, data: `${last.data} ${Anchors.anchor(key)}` }]
  };
  assert.ok(Ledger.stampFrom(doc, continued, continued.message.length - 1));
  assert.deepEqual(owned(withDoc(continued, doc)), ['ring', 'owl', 'cage']);
});

test('entries a reroll left behind are dropped while the chat is fully loaded', () => {
  const chat = stamped(chatOf([[own('ring')], [own('owl')]]));
  const rerolled = {
    ...chat,
    message: [...chat.message.slice(0, -1), { role: 'char', chatId: 'new', data: '조용한 응답', time: 9999 }]
  };
  const doc = documentOf(rerolled);
  assert.equal(Replay.stampStart(rerolled, doc), rerolled.message.length);
  assert.ok(Ledger.stampFrom(doc, rerolled, rerolled.message.length));
  assert.equal(Replay.stampStart(rerolled, doc), -1);
  assert.deepEqual(owned(windowOf(withDoc(rerolled, doc), 1)), ['ring']);
});

test('a manual row of a deleted message keeps its place in time in every view', () => {
  const chat = chatOf([[own('potion', '물약', { itemType: '소모품', count: 2 })], [], [take('potion')]]);
  const doc = documentOf(chat);
  doc.seq += 1;
  // Made after reply a1 (time 1015), before the consume in a2 (time 1025).
  doc.manual.push({
    id: 'm1',
    a: 'a1',
    d: 'item',
    e: { kind: 'patch', patch: { id: 'potion', op: 'merge', fields: { count: 10 } } },
    l: '수동',
    s: doc.seq,
    t: 1018
  });
  const withRow = withDoc(chat, doc);
  const deleted = { ...withRow, message: withRow.message.filter((one) => one.chatId !== 'a1') };
  const count = (one) => Replay.fold(one, documentOf(one)).item.registry.items.potion.count;
  assert.equal(count(withRow), 9);
  assert.equal(count(deleted), 9);
  const entries = stamped(deleted);
  assert.equal(count(entries), 9);
  assert.equal(count(windowOf(entries, 1)), 9);
});

test('a one-message window counts turns like the full chat', () => {
  const chat = stamped(chatOf([[own('ring')], []]));
  assert.equal(Replay.fold(windowOf(chat, 1), documentOf(chat)).turn, Replay.fold(chat, documentOf(chat)).turn);
});

test('a card the replay can no longer apply loses its frozen face', () => {
  const chat = stamped(chatOf([[own('potion', '물약', { itemType: '소모품', count: 2 }), take('potion')]]));
  const last = chat.message.at(-1);
  const [exam] = Anchors.anchorKeys(last.data);
  const edited = {
    ...chat,
    message: [...chat.message.slice(0, -1), { ...last, data: last.data.replace(Anchors.anchor(exam), '') }]
  };
  const doc = documentOf(edited);
  assert.ok(Ledger.stampFrom(doc, edited, edited.message.length - 1));
  const consume = Anchors.anchorKeys(edited.message.at(-1).data)[0];
  assert.equal(doc.events[consume].v, undefined);
});

test('drawer evidence names the card anchor, which a chat copy keeps', () => {
  const chat = stamped(chatOf([[own('ring')], []]));
  const copy = { ...chat, message: chat.message.map((one, index) => ({ ...one, chatId: `copy${index}` })) };
  const loaded = Ledger.project({ key: 'k', chat: windowOf(copy, 2) });
  const evidence = Ledger.presentationRecord('item', 'ring', loaded).evidence;
  assert.ok(evidence.key);
  assert.ok(copy.message.some((one) => Anchors.anchorKeys(one.data).includes(evidence.key)));
});

test('a card inserted between earlier cards replays the message instead of resuming', () => {
  const chat = stamped(chatOf([[own('potion', '물약', { itemType: '소모품', count: 2 }), take('potion')]]));
  const set = chatOf([[{ kind: 'patch', patch: { id: 'potion', op: 'merge', fields: { count: 10 } } }]]);
  const doc = documentOf(chat);
  Object.assign(doc.events, documentOf(set).events);
  const inserted = Anchors.anchorKeys(set.message[1].data)[0];
  const last = chat.message.at(-1);
  const [exam, consume] = Anchors.anchorKeys(last.data);
  const data = last.data.replace(Anchors.anchor(consume), `${Anchors.anchor(inserted)}\n\n${Anchors.anchor(consume)}`);
  const edited = { ...chat, message: [...chat.message.slice(0, -1), { ...last, data }] };
  assert.deepEqual(Anchors.anchorKeys(data), [exam, inserted, consume]);
  assert.ok(Ledger.stampFrom(doc, edited, edited.message.length - 1));
  const count = (one) => Replay.fold(one, documentOf(one)).item.registry.items.potion.count;
  assert.equal(count(withDoc(edited, doc)), 9);
});

test('a continue of a reply with a manual edit after it replays like a chat without entries', () => {
  const chat = chatOf([[own('potion', '물약', { itemType: '소모품', count: 2 })]]);
  const doc = documentOf(chat);
  doc.seq += 1;
  doc.manual.push({
    id: 'm1',
    a: 'a0',
    d: 'item',
    e: { kind: 'patch', patch: { id: 'potion', op: 'merge', fields: { count: 10 } } },
    l: '수동',
    s: doc.seq,
    t: 1008
  });
  const entries = stamped(withDoc(chat, doc));
  const extra = chatOf([[take('potion')]]);
  const next = documentOf(entries);
  Object.assign(next.events, documentOf(extra).events);
  const key = Anchors.anchorKeys(extra.message[1].data)[0];
  const last = entries.message.at(-1);
  const continued = {
    ...entries,
    message: [...entries.message.slice(0, -1), { ...last, data: `${last.data} ${Anchors.anchor(key)}` }]
  };
  const count = (one) => Replay.fold(one, documentOf(one)).item.registry.items.potion.count;
  const plain = { ...next, states: [] };
  const without = count(withDoc(continued, plain));
  assert.ok(Ledger.stampFrom(next, continued, continued.message.length - 1));
  assert.equal(count(withDoc(continued, next)), without);
});

test('a partial window drops an entry that should stand inside it', () => {
  const chat = stamped(chatOf([[own('ring')], [own('owl')]]));
  const rerolled = {
    ...chat,
    message: [...chat.message.slice(0, -1), { role: 'char', chatId: 'new', data: '조용한 응답', time: 9999 }]
  };
  const partial = windowOf(rerolled, 2);
  const doc = documentOf(partial);
  assert.equal(Replay.stampStart(partial, doc), partial.message.length);
  assert.ok(Ledger.stampFrom(doc, partial, partial.message.length));
  assert.deepEqual(owned(windowOf(withDoc(rerolled, doc), 1)), ['ring']);
});

test('a restore before the window still counts the unloaded turns after it', () => {
  const chat = chatOf([[own('ring')], [], [], [], [], []]);
  const doc = documentOf(chat);
  doc.root = {
    x: { item: Replay.fold(chat, doc).item, codex: Replay.fold(chat, doc).codex, notes: {} },
    m: [],
    w: chat.message[1].time,
    i: 1,
    t: 1
  };
  doc.events = {};
  const restored = withDoc(
    { ...chat, message: chat.message.map((one) => ({ ...one, data: Anchors.stripAnchors(one.data) })) },
    doc
  );
  const full = Replay.fold(restored, documentOf(restored)).turn;
  assert.equal(Replay.fold(windowOf(restored, 1), documentOf(restored)).turn, full);
});

test('rebuilding a reply after an older deletion keeps the settled past, with or without manual rows', () => {
  const potion = own('potion', '물약', { itemType: '소모품', count: 2 });
  const setTen = { kind: 'patch', patch: { id: 'potion', op: 'merge', fields: { count: 10 } } };
  const count = (one) => Replay.fold(one, documentOf(one)).item.registry.items.potion.count;
  // A: ring. B: potion, with a manual count after it.
  const chat = chatOf([[own('ring')], [potion]]);
  const doc = documentOf(chat);
  doc.seq += 1;
  doc.manual.push({ id: 'm1', a: 'a1', d: 'item', e: setTen, l: '수동', s: doc.seq, t: 1018 });
  const entries = stamped(withDoc(chat, doc));
  const deleted = { ...entries, message: entries.message.slice(2) };
  // B continues with a consume.
  const extra = chatOf([[take('potion')]]);
  const next = documentOf(deleted);
  Object.assign(next.events, documentOf(extra).events);
  const key = Anchors.anchorKeys(extra.message[1].data)[0];
  const last = deleted.message.at(-1);
  const continued = {
    ...deleted,
    message: [...deleted.message.slice(0, -1), { ...last, data: `${last.data} ${Anchors.anchor(key)}` }]
  };
  assert.ok(Ledger.stampFrom(next, continued, continued.message.length - 1));
  const result = withDoc(continued, next);
  assert.deepEqual(owned(result), ['ring', 'potion']);
  assert.equal(count(result), 10);
  assert.deepEqual(owned(windowOf(result, 1)), ['ring', 'potion']);

  // B: potion then consume; a set card is inserted between them after A is gone.
  const second = stamped(chatOf([[own('ring')], [potion, take('potion')]]));
  const gone = { ...second, message: second.message.slice(2) };
  const set = chatOf([[setTen]]);
  const doc2 = documentOf(gone);
  Object.assign(doc2.events, documentOf(set).events);
  const inserted = Anchors.anchorKeys(set.message[1].data)[0];
  const tail2 = gone.message.at(-1);
  const [, consume] = Anchors.anchorKeys(tail2.data);
  const data = tail2.data.replace(Anchors.anchor(consume), `${Anchors.anchor(inserted)}\n\n${Anchors.anchor(consume)}`);
  const edited = { ...gone, message: [...gone.message.slice(0, -1), { ...tail2, data }] };
  assert.ok(Ledger.stampFrom(doc2, edited, edited.message.length - 1));
  const result2 = withDoc(edited, doc2);
  assert.deepEqual(owned(result2), ['ring', 'potion']);
  assert.equal(count(result2), 9);
});

test('stored entries share their base state with the entry before them', () => {
  const chat = stamped(chatOf(loot));
  const doc = documentOf(chat);
  assert.ok(doc.states[0].b.x, 'the oldest entry keeps its full base');
  assert.ok(
    doc.states.slice(1).every((entry) => entry.b && !entry.b.x),
    'later bases are shared'
  );
});

test('an edit in a narrow window after an older deletion rebuilds from the stored base', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const chat = stamped(chatOf([[own('ring')], [own('potion'), own('owl')]]));
  const deleted = { ...chat, message: chat.message.slice(2) };
  const purged = documentOf(deleted);
  assert.ok(Ledger.stampFrom(purged, deleted, deleted.message.length));
  const last = deleted.message.at(-1);
  const [, owl] = Anchors.anchorKeys(last.data);
  const edited = withDoc(
    {
      ...deleted,
      message: [...deleted.message.slice(0, -1), { ...last, data: last.data.replace(Anchors.anchor(owl), '') }]
    },
    purged
  );
  const narrow = { id: 'chat', ...windowOf(edited, 1) };
  const fake = createFakeHost({ chat: narrow, character: { chaId: 'nw', name: 'T' }, settings: settingsDoc('nw') });
  setHost(fake.api);
  Session.resetSession('nw:chat');
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
  assert.deepEqual(owned(fake.state.chat), ['ring', 'potion']);
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
});

test('removing the last card of the newest reply after an older deletion keeps the settled past', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const chat = stamped(chatOf([[own('ring')], [own('potion')]]));
  const deleted = { ...chat, message: chat.message.slice(2) };
  const purged = documentOf(deleted);
  assert.ok(Ledger.stampFrom(purged, deleted, deleted.message.length));
  const last = deleted.message.at(-1);
  const edited = withDoc(
    { ...deleted, message: [...deleted.message.slice(0, -1), { ...last, data: Anchors.stripAnchors(last.data) }] },
    purged
  );
  const fake = createFakeHost({
    chat: { id: 'chat', ...edited },
    character: { chaId: 'lc', name: 'T' },
    settings: settingsDoc('lc')
  });
  setHost(fake.api);
  Session.resetSession('lc:chat');
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
  assert.deepEqual(owned(fake.state.chat), ['ring']);
  assert.deepEqual(owned(windowOf(fake.state.chat, 1)), ['ring']);
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
});

test('an edited reply is found by its remaining card even when another message shares its send time', () => {
  const chat = stamped(chatOf([[own('ring')], [own('potion'), own('owl')]]));
  const deleted = { ...chat, message: chat.message.slice(2) };
  const doc = documentOf(deleted);
  assert.ok(Ledger.stampFrom(doc, deleted, deleted.message.length));
  const last = deleted.message.at(-1);
  const [, owl] = Anchors.anchorKeys(last.data);
  const twin = { role: 'char', chatId: 'twin', data: '같은 시각', time: last.time };
  const edited = {
    ...deleted,
    message: [...deleted.message.slice(0, -1), { ...last, data: last.data.replace(Anchors.anchor(owl), '') }, twin]
  };
  const from = Replay.stampStart(edited, doc);
  assert.equal(from, edited.message.length - 2);
  assert.ok(Ledger.stampFrom(doc, edited, from));
  assert.deepEqual(owned(withDoc(edited, doc)), ['ring', 'potion']);
});

test('a reply without a send time keeps the settled past when its last card is removed', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const untimed = (chat) => ({ ...chat, message: chat.message.map(({ time: _time, ...one }) => (void _time, one)) });
  const chat = stamped(untimed(chatOf([[own('ring')], [own('potion')]])));
  const deleted = { ...chat, message: chat.message.slice(2) };
  const purged = documentOf(deleted);
  assert.ok(Ledger.stampFrom(purged, deleted, deleted.message.length));
  const last = deleted.message.at(-1);
  const edited = withDoc(
    { ...deleted, message: [...deleted.message.slice(0, -1), { ...last, data: Anchors.stripAnchors(last.data) }] },
    purged
  );
  const fake = createFakeHost({
    chat: { id: 'chat', ...edited },
    character: { chaId: 'ut', name: 'T' },
    settings: settingsDoc('ut')
  });
  setHost(fake.api);
  Session.resetSession('ut:chat');
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
  assert.deepEqual(owned(fake.state.chat), ['ring']);
  t.mock.timers.tick(2000);
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  assert.equal(fake.state.writes, 1);
});

test('a card-less reply whose send time is shared is still found by its id', () => {
  const chat = stamped(chatOf([[own('ring')], [own('potion')]]));
  const deleted = { ...chat, message: chat.message.slice(2) };
  const doc = documentOf(deleted);
  assert.ok(Ledger.stampFrom(doc, deleted, deleted.message.length));
  const last = deleted.message.at(-1);
  const twin = { role: 'char', chatId: 'twin', data: '같은 시각', time: last.time };
  const edited = {
    ...deleted,
    message: [...deleted.message.slice(0, -1), { ...last, data: Anchors.stripAnchors(last.data) }, twin]
  };
  const from = Replay.stampStart(edited, doc);
  assert.equal(from, edited.message.length - 2);
  assert.ok(Ledger.stampFrom(doc, edited, from));
  assert.deepEqual(owned(withDoc(edited, doc)), ['ring']);
  assert.equal(Replay.stampStart(edited, doc), -1);
});

test('backup export and import refuse a window that cannot ground the state', async () => {
  const chat = chatOf(loot);
  const narrow = { id: 'chat', ...windowOf(chat, 4) };
  const fake = createFakeHost({ chat: narrow, character: { chaId: 'bk', name: 'T' }, settings: settingsDoc('bk') });
  setHost(fake.api);
  Session.resetSession('bk:chat');
  await assert.rejects(() => Ledger.exportCurrentBackup('bk:chat'), /맨 위까지 스크롤/);
  const backup = JSON.stringify({
    format: 'itemx-codex-backup',
    version: 1,
    after: 10,
    records: { item: [], skill: [], monster: [] }
  });
  await assert.rejects(() => Ledger.prepareBackupImport(backup, 'bk:chat', 'replace'), /맨 위까지 스크롤/);
  assert.equal(fake.state.writes, 0);
});
