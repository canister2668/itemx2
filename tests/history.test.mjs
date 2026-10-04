import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, setHost, Document, Replay } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { anchored, documentOf } from './helpers/ledger.mjs';

const p = rt;
const h = { ...rt, policy: rt.history };
const { core, codex } = p;
const exam = (id, type = 'elixir', more = {}) => ({
  kind: 'exam',
  item: core.normalizeItem({ id, name: id, type, possession: 'owned', location: 'inventory', count: 1, ...more }).item
});
const patch = (id, action, more = {}) => ({ kind: 'patch', patch: { id, action, fields: {}, ...more } });
function chatOf(events) {
  return {
    id: 'history-chat',
    scriptstate: {},
    message: events.flatMap((events, index) => [
      { role: 'user', data: '진행', chatId: `u${index}` },
      {
        role: 'char',
        data:
          '응답 ' +
          events.map((event) => (event.domain ? codex.marker({ v: 1, event }) : core.marker({ v: 2, event }))).join(''),
        chatId: `a${index}`
      }
    ])
  };
}
// Record preferences live in the ledger document; fixtures set `chat.prefs`.
function loaded(chat) {
  const doc = Document.emptyDocument();
  if (chat.prefs) doc.prefs = h.policy.preferences(chat.prefs);
  const stored = { ...chat, scriptstate: { ...chat.scriptstate, [Document.DOCUMENT_KEY]: JSON.stringify(doc) } };
  return {
    ...h.project({ key: 'test:history-chat', character: { name: '검증' }, chat: anchored(stored) }),
    enabled: true,
    effectsLevel: 'full',
    rarityMode: 'world'
  };
}
const row = (value, id = 'pill') => h.policy.entries(value, 'item').find((x) => x.entity.id === id);

test('spent consumables hide immediately; partial consumption and damaged weapons stay usable', () => {
  const chat = chatOf([
    [exam('pill'), exam('stack', 'potion', { count: 3 }), exam('blade', 'weapon')],
    [
      patch('pill', 'consume', { quantity: 1 }),
      patch('stack', 'consume', { quantity: 1 }),
      { kind: 'patch', patch: { id: 'blade', op: 'merge', fields: { durability: '0/100' } } }
    ]
  ]);
  const value = loaded(chat);
  assert.equal(row(value).closed, true);
  assert.equal(row(value).automatic, true);
  assert.equal(row(value).remaining, 10);
  assert.equal(row(value, 'stack').entity.count, 2);
  assert.equal(row(value, 'stack').closed, false);
  assert.equal(row(value, 'blade').closed, false);
  assert.deepEqual(
    Array.from(h.rootPageItems(value), (x) => x.id),
    ['stack', 'blade']
  );
  assert.equal(h.rootInventoryHtml(value).includes('>pill<'), false);
});

test('weapon destruction and lost consumables never auto-archive', () => {
  const chat = chatOf([
    [exam('blade', 'weapon'), exam('pill')],
    [
      patch('blade', 'destroy', { quantity: 'all' }),
      patch('pill', 'transfer', { quantity: 'all', destination: 'guild' })
    ],
    ...Array.from({ length: 21 }, () => [])
  ]);
  const value = loaded(chat);
  assert.equal(row(value, 'blade').closed, true);
  assert.equal(row(value, 'blade').archived, false);
  assert.equal(row(value).automatic, false);
  assert.equal(row(value).archived, false);
});

test('countdown ignores pending input, streaming, rerolls and repeated inspections; deletion rolls it back', () => {
  const chat = chatOf([
    [exam('pill')],
    [patch('pill', 'consume', { quantity: 1 })],
    ...Array.from({ length: 9 }, () => [])
  ]);
  assert.equal(row(loaded(chat)).remaining, 1);
  chat.message.push({ role: 'user', data: '다음' }, { role: 'char', data: '부분 출력', isStreaming: true });
  assert.equal(row(loaded(chat)).remaining, 1);
  chat.message.at(-1).isStreaming = false;
  assert.equal(row(loaded(chat)).archived, true);
  chat.message.at(-1).data = '리롤된 응답';
  assert.equal(row(loaded(chat)).age, 10);
  assert.equal(row(loaded(chat)).age, 10);
  chat.message.splice(-2);
  assert.equal(row(loaded(chat)).archived, false);
});

test('legacy removed pill is categorized without changing source or guessing lost equipment', () => {
  const chat = chatOf([
    [exam('pill', 'elixir', { possession: 'removed', count: 0, trivia: '소생시키기 위해 복용되었다.' })]
  ]);
  const before = JSON.stringify(chat);
  assert.equal(row(loaded(chat)).automatic, true);
  assert.equal(JSON.stringify(chat), before);
  assert.equal(h.policy.consumable({ itemType: 'weapon', name: '단약검' }), false);
});

test('pin preserves only the record; new acquire starts active and new loss gets a fresh cycle', () => {
  const chat = chatOf([
    [exam('pill')],
    [patch('pill', 'consume', { quantity: 1 })],
    ...Array.from({ length: 10 }, () => [])
  ]);
  let value = loaded(chat),
    old = row(value);
  chat.prefs = { after: 10, keep: { 'item:pill': true } };
  value = loaded(chat);
  assert.equal(row(value).archived, false);
  assert.equal(row(value).entity.possession, 'removed');
  chat.prefs = { after: 10, archived: { 'item:pill': old.cycle } };
  chat.message.push(
    ...chatOf([[patch('pill', 'acquire', { quantity: 1 })]]).message.map((x) => ({ ...x, chatId: 'again' + x.chatId }))
  );
  assert.equal(row(loaded(chat)).closed, false);
  chat.message.push(
    ...chatOf([[patch('pill', 'consume', { quantity: 1 })]]).message.map((x) => ({
      ...x,
      chatId: 'spentagain' + x.chatId
    }))
  );
  const current = row(loaded(chat));
  assert.equal(current.age, 0);
  assert.notEqual(current.cycle, old.cycle);
  assert.equal(current.archived, false);
});

test('sealed skills stay in the active list while lost skills and resolved encounters have separate history', () => {
  const events = codex.extractResponse(
    '<skillExam><id>sealed</id><name>봉인</name><type>sealed</type><status>sealed</status></skillExam><skillExam><id>lost</id><name>망각</name><status>lost</status></skillExam><monsterExam><id>foe</id><name>적</name><relation>hostile</relation><status>defeated</status></monsterExam>'
  ).events;
  const value = loaded(chatOf([events, ...Array.from({ length: 20 }, () => [])]));
  assert.deepEqual(
    Array.from(h.codexEntries(value, 'skill'), (x) => x.id),
    ['sealed']
  );
  assert.equal(h.codexEntries(value, 'monster').length, 0);
  assert.equal(h.policy.entries(value, 'skill').find((x) => x.entity.id === 'lost').archived, false);
  assert.equal(h.policy.entries(value, 'monster')[0].archived, false);
});

test('a projection from a state entry keeps lifecycle metadata and turn ages of the full chat', () => {
  const chat = anchored(
    chatOf([[exam('pill')], [patch('pill', 'consume', { quantity: 1 })], ...Array.from({ length: 6 }, () => [])])
  );
  const doc = documentOf(chat);
  Replay.restampEntries(chat, doc, 0);
  assert.equal(doc.states.length, 2);
  const stamped = { ...chat, scriptstate: { ...chat.scriptstate, [Document.DOCUMENT_KEY]: JSON.stringify(doc) } };
  const full = h.project({ key: 'k', chat: stamped });
  // The host keeps only the newest four messages in memory.
  const windowed = {
    ...stamped,
    message: stamped.message.slice(-4),
    messageOffset: stamped.message.length - 4,
    messagesFullyLoaded: false
  };
  const value = h.project({ key: 'k', chat: windowed });
  assert.deepEqual(
    JSON.parse(JSON.stringify(value.snapshot.history)),
    JSON.parse(JSON.stringify(full.snapshot.history))
  );
  assert.equal(row(value).closed, true);
  assert.equal(row(value).age, row(full).age);
  assert.equal(stamped.scriptstate[Document.DOCUMENT_KEY], JSON.stringify(doc));
});

test('old tombstones stay out of ordinary model anchors even when pinned and never erase original markers', () => {
  const chat = chatOf([
    [exam('pill')],
    [patch('pill', 'consume', { quantity: 1 })],
    ...Array.from({ length: 11 }, () => [])
  ]);
  chat.prefs = { after: 0, keep: { 'item:pill': true } };
  const value = loaded(chat),
    before = JSON.stringify(chat);
  assert.equal(core.anchor(h.policy.requestSnapshot(value, '평범한 대화')).includes('name=pill'), false);
  const mentioned = core.anchor(h.policy.requestSnapshot(value, 'pill의 약효를 논한다'));
  assert.match(mentioned, /possession=removed/);
  assert.equal(mentioned.includes('durability='), false);
  assert.equal(JSON.stringify(chat), before);
  assert.equal(h.cleanChatPluginData(anchored(chat)).chat.scriptstate[Document.DOCUMENT_KEY], undefined);
});

test('failed consume cannot create a history entry and OFF never expires a spent item', () => {
  const chat = chatOf([[exam('pill')], [patch('pill', 'consume', { quantity: 9 })]]);
  assert.equal(row(loaded(chat)).closed, false);
  assert.equal(loaded(chat).snapshot.history.pill, undefined);
  chat.message.push(
    ...chatOf([[patch('pill', 'consume', { quantity: 1 })], ...Array.from({ length: 20 }, () => [])]).message
  );
  chat.prefs = { after: 0 };
  assert.equal(row(loaded(chat)).archived, false);
});

test('record preferences write only their own field once and refuse streaming or another chat', async () => {
  let chat = anchored(chatOf([[exam('pill')], [patch('pill', 'consume', { quantity: 1 })]]));
  chat.id = 'one';
  chat.scriptstate.unrelated = 'keep me';
  const withoutLedger = (value) => {
    const copy = structuredClone(value);
    delete copy.scriptstate[Document.DOCUMENT_KEY];
    delete copy.scriptstate[Document.CACHE_KEY];
    return JSON.stringify(copy);
  };
  const before = withoutLedger(chat);
  const eventsBefore = documentOf(chat).events;
  const fake = createFakeHost({ chat, character: { chaId: 'history' } });
  setHost(fake.api);
  const api = rt;
  const value = { ...loaded(chat), chat, key: 'history:one' };
  await api.saveHistoryPreference(value, (prefs) => {
    prefs.keep['item:pill'] = true;
  });
  assert.equal(fake.state.writes, 1);
  chat = fake.state.chat;
  assert.equal(documentOf(chat).prefs.keep['item:pill'], true);
  assert.deepEqual(documentOf(chat).events, eventsBefore);
  assert.equal(withoutLedger(chat), before);
  fake.state.chat.isStreaming = true;
  await assert.rejects(() => api.saveHistoryPreference(value, () => {}), /응답이 끝난/);
  fake.state.chat.isStreaming = false;
  fake.state.chat.id = 'two';
  await assert.rejects(() => api.saveHistoryPreference(value, () => {}), /채팅이 변경/);
  assert.equal(fake.state.writes, 1);
});

test('recovered skills and new encounters return to the normal list without changing old facts', () => {
  const first = codex.extractResponse(
    '<skillExam><id>s</id><name>잊은 기술</name><status>lost</status></skillExam><monsterExam><id>m</id><name>상대</name><relation>hostile</relation><status>ended</status></monsterExam>'
  );
  const next = codex.extractResponse(
    '<skillPatch><id>s</id><action>learn</action></skillPatch><monsterPatch><id>m</id><action>encounter</action></monsterPatch>',
    first.snapshot
  );
  const chat = chatOf([first.events, next.events]);
  const value = loaded(chat);
  assert.equal(h.codexEntries(value, 'skill').length, 1);
  assert.equal(h.codexEntries(value, 'monster').length, 1);
  assert.equal(value.codexSnapshot.history.skill.s, undefined);
  assert.equal(value.codexSnapshot.history.monster.m, undefined);
});

test('ended encounters remain through two completed inputs, expire on third, and rewind with chat', () => {
  const events = codex.extractResponse(
    '<monsterExam><id>foe</id><name>상대</name><status>defeated</status></monsterExam>'
  ).events;
  const chat = chatOf([events, [], [], []]);
  for (const turns of [0, 1, 2, 3, 2]) {
    const value = loaded({ ...chat, message: chat.message.slice(0, 2 + turns * 2) });
    assert.equal(h.codexEntries(value, 'monster').length, turns <= 2 ? 1 : 0);
    const record = h.policy.entries(value, 'monster')[0];
    assert.equal(record.entity.status, 'defeated');
    assert.equal(record.closed, true);
    assert.equal(record.age, turns);
  }
  const pending = {
    ...chat,
    message: chat.message
      .slice(0, 6)
      .concat({ role: 'user', data: '진행' }, { role: 'char', data: '출력 중', isStreaming: true })
  };
  assert.equal(h.codexEntries(loaded(pending), 'monster').length, 1);
  const value = loaded(pending),
    record = h.policy.entries(value, 'monster')[0];
  pending.prefs = { archived: { 'monster:foe': record.cycle } };
  assert.equal(h.codexEntries(loaded(pending), 'monster').length, 0, 'manual archive overrides the grace period');
});
