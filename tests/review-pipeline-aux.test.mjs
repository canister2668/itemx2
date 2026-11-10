import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf, seedChat, itemExam } from './helpers/ledger.mjs';
import { setHost, Aux, Codex, Ledger, Portraits, Session, Transport } from './helpers/modules.mjs';
import { workQueue } from '../src/kernel.js';
import { t } from '../src/i18n.js';
import { ITEMX_AUX_TIMEOUT_MS } from '../src/config.js';
import { setUpdateState, updateState } from '../src/connection.js';
import { checkForUpdate, resetUpdateCheck } from '../src/update-check.js';
import { DOCUMENT_KEY } from '../src/store/document.js';

let unique = 0;
const potionTag =
  '[itemx: id=red_potion | name=붉은 물약 | type=소모품 | emoji=🧪 | rarity=normal | display=일반 | possession=owned | location=inventory | count=1]';

function bot({
  mode = 'missing',
  reply = '완결된 서술. 방 안은 조용했다.',
  llm = async () => 'NONE',
  chat = null
} = {}) {
  const id = `aux-review-${++unique}`;
  const fake = createFakeHost({
    chat: chat || {
      id: 'chat',
      message: [
        { chatId: 'u', role: 'user', data: '둘러본다' },
        { chatId: 'reply', role: 'char', data: reply }
      ],
      scriptstate: {}
    },
    character: { chaId: id, name: 'T' },
    settings: {
      v: 1,
      global: {},
      characters: {
        [id]: { enabled: true, auxOutput: mode, itemsEnabled: true, skillsEnabled: false, encountersEnabled: false }
      }
    },
    llm
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  workQueue.forget('aux-provider');
  return fake;
}

// 8 (b) ---------------------------------------------------------------------
test('"missing" mode calls the model only for a reply without records that reads like a change', async () => {
  const quiet = bot();
  const skipped = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(skipped.status, 'skip');
  assert.equal(skipped.reason, 'no-cue');
  assert.equal(quiet.state.llmCalls.length, 0);
  assert.equal(quiet.state.writes, 0);

  const cue = bot({ reply: '바닥에서 붉은 물약 하나를 주웠다.', llm: async () => potionTag });
  const recovered = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(recovered.status, 'ok');
  assert.equal(recovered.events.length, 1);
  assert.equal(cue.state.llmCalls.length, 1);
  assert.equal(Object.values(documentOf(cue.state.chat).events)[0].e.item.id, 'red_potion');

  // The reply already produced a record: nothing is missing.
  const recorded = bot({
    chat: {
      id: 'chat',
      ...seedChat([
        { role: 'user', data: '줍는다', chatId: 'u' },
        {
          role: 'char',
          data: '바닥에서 붉은 물약 하나를 주웠다.',
          chatId: 'reply',
          events: [itemExam({ id: 'red_potion', name: '붉은 물약', type: '소모품', possession: 'owned', count: 1 })]
        }
      ])
    },
    llm: async () => potionTag
  });
  const settled = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(settled.reason, 'no-cue');
  assert.equal(recorded.state.llmCalls.length, 0);
  assert.equal(recorded.state.writes, 0);
});

test('"always" mode still reviews a quiet reply, and a manual run ignores the mode', async () => {
  const always = bot({ mode: 'always' });
  assert.equal((await Aux.recoverAuxiliaryOutputNow()).status, 'ok');
  assert.equal(always.state.llmCalls.length, 1);
  const manual = bot();
  assert.equal((await Aux.recoverAuxiliaryOutputNow({ force: true })).status, 'ok');
  assert.equal(manual.state.llmCalls.length, 1);
});

test('"missing" mode keeps the once-per-item appraisal of gear the reply shows', async () => {
  const fake = bot({
    chat: {
      id: 'chat',
      ...seedChat([
        { role: 'user', data: '줍는다', chatId: 'u' },
        {
          role: 'char',
          data: '낡은 철검을 손에 넣었다.',
          chatId: 'reply',
          events: [itemExam({ id: 'old_sword', name: '낡은 철검', type: '무기', possession: 'owned', count: 1 })]
        }
      ])
    },
    llm: async () => 'NONE'
  });
  const first = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(first.status, 'ok');
  assert.equal(fake.state.llmCalls.length, 1, 'the appraisal, not the recovery');
  assert.doesNotMatch(fake.state.llmCalls[0].messages[0].content, /auxiliary regeneration pass/);
  assert.deepEqual(documentOf(fake.state.chat).guards.aux.reply.appraisalTried, ['old_sword']);
  const again = await Aux.recoverAuxiliaryOutputNow();
  assert.equal(again.status, 'skip');
  assert.equal(fake.state.llmCalls.length, 1);
});

test('the recovery cue reads only the enabled domains', () => {
  const on = { itemsEnabled: true, skillsEnabled: true, encountersEnabled: true };
  assert.equal(Aux.recoveryCue('검을 얻었다.', on), true);
  assert.equal(Aux.recoveryCue('She picked up the coin.', on), true);
  assert.equal(Aux.recoveryCue('새로운 주문을 익혔다.', { skillsEnabled: true }), true);
  assert.equal(Aux.recoveryCue('고블린이 덮쳐 왔다.', { encountersEnabled: true }), true);
  assert.equal(Aux.recoveryCue('고블린이 덮쳐 왔다.', { itemsEnabled: true }), false);
  assert.equal(Aux.recoveryCue('두 사람은 창밖을 보며 이야기를 나눴다.', on), false);
  assert.equal(Aux.recoveryCue('', on), false);
});

// 8 (c) ---------------------------------------------------------------------
test('auxiliary texts state the real timeout and do not name a host', () => {
  const minutes = ITEMX_AUX_TIMEOUT_MS / 60000;
  assert.equal(Number.isInteger(minutes), true);
  assert.equal(t('aux.039').includes(`${minutes}분`), true);
  assert.doesNotMatch(t('aux.039'), /90초/);
  assert.doesNotMatch(t('aux.022'), /PocketRisu/);
});

// 9 -------------------------------------------------------------------------
test('an auxiliary result that arrives while the next reply streams is written after the stream', async () => {
  let answer, started;
  const requested = new Promise((resolve) => (started = resolve));
  const fake = bot({
    mode: 'always',
    reply: '바닥에서 붉은 물약 하나를 주웠다.',
    llm: () =>
      new Promise((resolve) => {
        answer = resolve;
        started();
      })
  });
  const running = Aux.recoverAuxiliaryOutputNow();
  await requested;
  // The reader sends the next message; its reply starts streaming.
  fake.state.chat.message.push({ chatId: 'u2', role: 'user', data: '마신다' });
  fake.state.chat.message.push({ chatId: 'r2', role: 'char', data: '물약을', isStreaming: true });
  answer(potionTag);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(fake.state.writes, 0, 'nothing is written into a streaming chat');
  fake.state.chat.message[3] = { chatId: 'r2', role: 'char', data: '물약을 마셨다.' };
  const result = await running;
  assert.equal(result.status, 'ok');
  assert.equal(result.events.length, 1);
  const doc = documentOf(fake.state.chat);
  assert.equal(Object.values(doc.events)[0].c, 'reply');
  assert.equal(doc.guards.aux.reply.state, 'complete');
  assert.match(fake.state.chat.message[1].data, /<!--ix:/);
  assert.equal(fake.state.chat.message[3].data, '물약을 마셨다.');
  assert.equal(fake.state.llmCalls.length, 1);
});

test('a write refused by a streaming chat says so, not the backup message', async () => {
  const fake = bot();
  fake.state.chat.isStreaming = true;
  const ctx = { characterIndex: 0, chatIndex: 0, character: fake.state.character, key: Session.activeContextKey() };
  await assert.rejects(
    () => Ledger.writeDocument(ctx, () => ({})),
    (error) => error.code === 'CHAT_STREAMING' && error.message === t('ledger.busy') && !/백업/.test(error.message)
  );
  assert.doesNotMatch(t('aux.held'), /백업/);
});

// 10 ------------------------------------------------------------------------
test('emotion images of the bot are not offered or chosen as an encounter portrait', async () => {
  const character = {
    chaId: `emo-${++unique}`,
    additionalAssets: [
      ['wolf_default', 'asset-wolf', 'webp'],
      ['serious', 'asset-own-serious', 'webp']
    ],
    emotionImages: [
      ['neutral', 'emo-neutral'],
      ['normal', 'emo-normal'],
      ['serious', 'emo-serious']
    ]
  };
  const all = Portraits.combinedPortraitAssets(character, []);
  assert.equal(
    all.some((row) => row.name === 'neutral'),
    true,
    'the catalog itself still resolves a named emotion image'
  );
  const offered = Portraits.protocolPortraitAssets(character, []).map((row) => row.name);
  assert.deepEqual(offered, ['wolf_default', 'serious'], 'an additional asset of the same name stays');
  const protocol = Transport.protocolForSettings(
    { itemsEnabled: false, skillsEnabled: false, encountersEnabled: true, rarityMode: 'world' },
    character,
    [],
    { narrative: '<img="neutral">', entities: [] }
  );
  const names = protocol.match(/AVAILABLE PORTRAIT ASSET NAMES[^\n]*/)?.[0] || '';
  assert.match(names, /wolf_default ;; serious$/);
  assert.doesNotMatch(names, /neutral|normal/);
  // Default selection: an encounter that happens to be called "normal".
  const entity = { id: 'normal', name: 'Normal', aliases: [], portrait: 'NONE' };
  assert.equal(Codex.assetForEntity(all, entity)?.id, 'emo-normal', 'the engine alone would pick the emotion image');
  assert.equal(Portraits.entityPortraitAsset(all, entity, '', character), null);
  // A portrait the record names is still looked up in the whole catalog.
  assert.equal(
    Portraits.entityPortraitAsset(all, { ...entity, portrait: 'neutral' }, '', character)?.id,
    'emo-neutral'
  );
});

test('a standing pose of an outfit is not the default portrait', () => {
  const catalog = (names) =>
    Codex.assetCatalog({ additionalAssets: names.map((name) => [name, `id:${name}`, 'webp']) }, 100);
  const reimu = { id: 'reimu', name: '레이무', aliases: [], portrait: 'NONE' };
  const pick = (names, entity = reimu, narrative = '') =>
    Portraits.entityPortraitAsset(catalog(names), entity, narrative)?.name ?? null;
  // The case of the report: no plain standing asset.
  assert.equal(
    Codex.assetForEntity(catalog(['reimu_smile', 'reimu_swimsuit_standing']), reimu)?.name,
    'reimu_swimsuit_standing'
  );
  assert.equal(pick(['reimu_smile', 'reimu_swimsuit_standing']), 'reimu_smile');
  assert.equal(pick(['reimu_swimsuit_standing', 'reimu_default', 'reimu_angry']), 'reimu_default');
  assert.equal(pick(['hakurei_reimu_default', 'hakurei_reimu_swimsuit_standing']), 'hakurei_reimu_default');
  assert.equal(pick(['reimu_swimsuit-standing', 'reimu_smile']), 'reimu_smile');
  // A plain standing portrait is still the first choice.
  assert.equal(pick(['reimu_smile', 'reimu_standing', 'reimu_swimsuit_standing']), 'reimu_standing');
  assert.equal(pick(['hakurei_reimu_angry', 'hakurei_reimu_standing']), 'hakurei_reimu_standing');
  // A longer name is not a pose: nothing shorter belongs to the same encounter.
  assert.equal(
    pick(['goblin_archer_standing', 'goblin_archer_attack'], { id: 'goblin', name: '고블린' }),
    'goblin_archer_standing'
  );
  const king = { id: 'goblin_king', name: '고블린 왕', aliases: [] };
  assert.equal(pick(['goblin_smile', 'goblin_king_standing', 'goblin_king_angry'], king), 'goblin_king_standing');
  // The only asset there is stays usable, and a named portrait is authoritative.
  assert.equal(pick(['reimu_swimsuit_standing']), 'reimu_swimsuit_standing');
  assert.equal(
    pick(['reimu_smile', 'reimu_swimsuit_standing'], { ...reimu, portrait: 'reimu_swimsuit_standing' }),
    'reimu_swimsuit_standing'
  );
});

test('with more than twenty encounters the active and the newest get their portraits', async () => {
  const reads = [];
  const fake = createFakeHost();
  fake.api.readImage = async (id) => (reads.push(id), 'data:image/png;base64,AAAA');
  setHost(fake.api);
  Session.resetSession('portrait-batch');
  const chaId = `batch-${++unique}`;
  const character = { chaId, additionalAssets: Array.from({ length: 30 }, (_, i) => [`M${i}`, `asset-${i}`, 'png']) };
  const entries = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [
      `m${i}`,
      { id: `m${i}`, name: `상대${i}`, portrait: `M${i}`, status: i === 2 ? 'active' : 'ended', active: i === 2 }
    ])
  );
  const snapshot = { monsters: { order: Object.keys(entries), entries } };
  const result = await Portraits.loadCodexPortraits(character, { message: [] }, snapshot, {
    moduleAssetsEnabled: false
  });
  assert.equal(Object.keys(result).length, 20);
  assert.ok(result.m29, 'the newest encounter');
  assert.ok(result.m2, 'an old encounter that is still active');
  assert.equal(result.m0, undefined);
  assert.equal(result.m10, undefined);
  assert.ok(result.m11);
});

// 11 ------------------------------------------------------------------------
test('a prune that removed nothing is not repeated until the document gains events', async () => {
  const exam = itemExam({ id: 'ring', name: '반지', possession: 'owned', count: 1 });
  const base = seedChat([
    { role: 'user', data: '시작', chatId: 'u0' },
    { role: 'char', data: '반지를 얻었다.', chatId: 'r0', events: [exam], keys: ['ringk'] }
  ]);
  const doc = documentOf(base);
  doc.events.ringk.pad = 'x'.repeat(16 * 1024 * 1024);
  const chat = { id: 'chat', ...base, scriptstate: { [DOCUMENT_KEY]: JSON.stringify(doc) } };
  const id = `prune-${++unique}`;
  const character = { chaId: id, name: 'T' };
  const fake = createFakeHost({
    chat,
    character,
    settings: { v: 1, global: {}, characters: { [id]: { enabled: true } } }
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  const ctx = { characterIndex: 0, chatIndex: 0, character, key: `${id}:chat` };
  // An old-form frozen card: a prune rewrites it in the compact form.
  const oldForm = (target) => {
    delete target.events.ringk.vd;
    target.events.ringk.v = { ...exam.item };
    target.events.ringk.p = null;
  };
  const form = () => {
    const row = documentOf(fake.state.chat).events.ringk;
    return row.vd ? 'compact' : row.v ? 'old' : 'none';
  };
  await Ledger.writeDocument(ctx, (target) => (oldForm(target), {}));
  assert.equal(form(), 'compact', 'the first write over the limit prunes');
  await Ledger.writeDocument(ctx, (target) => (oldForm(target), {}));
  assert.equal(form(), 'old', 'nothing new: the prune is skipped');
  // A new event: the prune runs again.
  await Ledger.writeDocument(ctx, (target) => {
    oldForm(target);
    target.seq += 1;
    return {};
  });
  assert.equal(form(), 'compact');
  // A message more or less also makes it run again.
  await Ledger.writeDocument(ctx, (target) => (oldForm(target), {}));
  assert.equal(form(), 'old');
  fake.state.chat.message.push({ chatId: 'u1', role: 'user', data: '다음' });
  await Ledger.writeDocument(ctx, (target) => (oldForm(target), {}));
  assert.equal(form(), 'compact');
});

// 12 ------------------------------------------------------------------------
test('a failed update check is tried once more on a later chat entry, never a third time', async () => {
  let requests = 0,
    fail = true;
  const fake = createFakeHost();
  fake.api.nativeFetch = async () => {
    requests += 1;
    if (fail) throw new Error('offline');
    return { ok: true, text: async () => '//@name itemx2\n//@version 99.0.0\n' };
  };
  setHost(fake.api);
  Session.resetSession('update:chat');
  setUpdateState({ checking: false, checkedAt: 0, latest: '', available: false });
  resetUpdateCheck();
  await checkForUpdate();
  assert.equal(requests, 1);
  assert.equal(updateState().latest, '');
  fail = false;
  await checkForUpdate();
  assert.equal(requests, 2);
  assert.equal(updateState().available, true);
  await checkForUpdate();
  assert.equal(requests, 2, 'an answered check is not repeated');

  resetUpdateCheck();
  setUpdateState({ checking: false, checkedAt: 0, latest: '', available: false });
  fail = true;
  for (let i = 0; i < 4; i += 1) await checkForUpdate();
  assert.equal(requests, 4, 'at most two requests per load');
  assert.equal(updateState().checking, false);
});
