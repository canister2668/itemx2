import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf } from './helpers/ledger.mjs';
import { setHost, Pipeline, Session, Style, Presentation } from './helpers/modules.mjs';

// 2.4.1 rerender reduction changes only *when* work happens during streaming.
// The committed text, the ledger and the final display HTML of a streamed
// response must stay byte-identical to the 2.4.0 baseline recorded here.
const FIXTURE = new URL('./fixtures/streaming-equivalence.json', import.meta.url);
const UPDATE = process.env.ITEMX_UPDATE_STREAMING_FIXTURE === '1';

const RESPONSE =
  '검을 뽑았다. <itemExam><id>blade</id><name>검</name><type>검</type><rarity>epic</rarity><affinity>fire</affinity><possession>owned</possession></itemExam>' +
  ' 기합과 함께 <skillExam><id>s</id><name>검법</name><status>equipped</status><level>7</level><mastery>75</mastery></skillExam>' +
  ' 상대가 쓰러졌다. <monsterExam><id>m</id><name>상대</name><relation>hostile</relation><status>defeated</status><outcome>승리</outcome></monsterExam> 끝.';

const settingsDoc = (id) => ({
  v: 1,
  global: { badgePosition: 'rm' },
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: true,
      encountersEnabled: true,
      lorebookEncounterEnabled: false
    }
  }
});

async function run(id, chunks) {
  const fake = createFakeHost({
    document: true,
    chat: { id: 'chat', message: [{ chatId: 'user', role: 'user', data: '싸운다.' }], scriptstate: {} },
    character: { chaId: id, name: 'Test' },
    settings: settingsDoc(id)
  });
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession(`${id}:chat`);
  const flushes = [];
  let output = '';
  for (const size of chunks) {
    output = await Pipeline.outputFallback(RESPONSE.slice(0, size));
    flushes.push(await Presentation.displayHandler(output));
  }
  fake.state.chat.message.push({ chatId: 'reply', role: 'char', data: output });
  await Pipeline.catchUpLatestOutput({ syncUi: false });
  const committed = fake.state.chat.message.at(-1).data;
  return {
    committed,
    // 2.5 adds the frozen card payload, the commit time and state entries to the
    // ledger; the events themselves are compared with the 2.4 baseline.
    events: Object.fromEntries(
      Object.entries(documentOf(fake.state.chat).events).map(([key, { v, p, vd, pd, t: committedAt, ...row }]) => {
        assert.ok(v || vd, `frozen view of ${key}`);
        void p;
        void pd;
        assert.ok(Number.isFinite(committedAt), `commit time of ${key}`);
        return [key, row];
      })
    ),
    entries: documentOf(fake.state.chat).states.length,
    display: await Presentation.displayHandler(committed),
    lastFlush: flushes.at(-1)
  };
}

const step = (n) =>
  Array.from({ length: Math.ceil(RESPONSE.length / n) }, (_, i) => Math.min(RESPONSE.length, (i + 1) * n));
const SCENARIOS = { whole: [RESPONSE.length], stream7: step(7), stream41: step(41) };

test('streamed responses commit and display exactly as the 2.4 baseline', async () => {
  const actual = {};
  for (const [name, chunks] of Object.entries(SCENARIOS)) actual[name] = await run('eq', chunks);
  // Chunking never changes the result.
  for (const name of ['stream7', 'stream41']) {
    assert.equal(actual[name].committed, actual.whole.committed);
    assert.equal(actual[name].display, actual.whole.display);
  }
  for (const one of Object.values(actual)) {
    assert.equal(one.entries, 1, 'the committed response leaves one state entry');
    delete one.entries;
  }
  if (UPDATE || !existsSync(FIXTURE)) writeFileSync(FIXTURE, JSON.stringify(actual, null, 1));
  const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
});
