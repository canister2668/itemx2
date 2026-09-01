import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function bootWithOutput(data, options = {}) {
  let chat = { id: 'chat-guard', isStreaming: false, message: [...(options.prefixMessages || []), { role: 'char', data, metadata: { bgContinue: false } }], scriptstate: { ...(options.scriptstate || {}) } };
  let modelCalls = 0, chatWrites = 0;
  const prompts = [];
  const storage = new Map(), handlers = {}, replacers = {}, intervals = [];
  const Risuai = {
    pluginStorage: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => 0,
    getCurrentChatIndex: async () => 0,
    getCharacter: async () => ({ chaId: 'char-guard', name: 'Guard Bot' }),
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_ci, _hi, value) => {
      chatWrites += 1; chat = structuredClone(value);
      if (options.postWriteWhitespace) chat.message.at(-1).data += options.postWriteWhitespace;
    },
    addRisuScriptHandler: async (mode, fn) => { handlers[mode] = fn; },
    removeRisuScriptHandler: async () => {},
    addRisuReplacer: async (mode, fn) => { replacers[mode] = fn; },
    removeRisuReplacer: async () => {},
    registerSetting: async () => ({ id: 'setting' }),
    unregisterUIPart: async () => {},
    getRootDocument: async () => null,
    runLLMModel: async (request) => {
      modelCalls += 1; prompts.push(request?.messages?.[0]?.content || '');
      if (options.failFirst && modelCalls === 1) throw new Error('temporary aux failure');
      if (Array.isArray(options.modelOutputs)) return options.modelOutputs[modelCalls - 1] ?? 'NONE';
      if (options.modelOutput != null) return options.modelOutput;
      return handlers.output ? handlers.output('NONE') : 'NONE';
    },
    onUnload: async () => {},
    hideContainer: async () => {}
  };
  const sandboxSetTimeout = (fn, ms) => {
    const timer = setTimeout(fn, ms);
    if (ms > 1000) timer.unref();
    return timer;
  };
  let now = Date.now();
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const sandbox = vm.createContext({ console, Buffer, TextEncoder, TextDecoder, structuredClone, Date: FakeDate, setTimeout: sandboxSetTimeout, clearTimeout, setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: () => {}, Risuai, document: { head: {}, body: {} } });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  if (!options.deferSettle) {
    now += 2000;
    await intervals.find(({ ms }) => ms === 4500).fn();
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  return {
    get modelCalls() { return modelCalls; }, get chatWrites() { return chatWrites; }, storage, prompts,
    chat: () => structuredClone(chat),
    setLatestData: (value) => { chat.message.at(-1).data = value; },
    advance: (ms) => { now += ms; }, intervals
  };
}

test('automatic auxiliary skips empty and visibly truncated committed outputs', async () => {
  const empty = await bootWithOutput('');
  const truncated = await bootWithOutput('<Thoughts>unfinished reasoning and no committed narrative');
  assert.equal(empty.modelCalls, 0);
  assert.equal(truncated.modelCalls, 0);
  assert.equal(empty.chatWrites, 0);
  assert.equal(truncated.chatWrites, 0);
});

test('missing mode still reviews partially tagged output for omitted sibling items', async () => {
  const payload = Buffer.from(JSON.stringify({ v: 2, event: { kind: 'exam', item: { id: 'tagged_blade', name: '태그된 검', itemType: '검', emoji: '⚔️', rarity: 'rare', displayRarity: '레어', possession: 'owned', location: 'inventory', count: 1, theme: 'oriental', effects: [], augments: [] } } })).toString('base64url');
  const result = await bootWithOutput(`검과 물약을 함께 얻었다.\n<!--ITEMX2:${payload}-->`);
  assert.equal(result.modelCalls, 1);
  assert.match(result.prompts[0], /Recover every settled change omitted by the main output/);
  assert.match(result.prompts[0], /Enabled domains: items, skills, encounters/);
});

test('catch-up sanitizes committed raw ITEMX transport before auxiliary review', async () => {
  const raw = '원시 검을 얻었다.\n<itemExam><id>raw_blade</id><name>원시 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>rare</internalrarity><possession>owned</possession><location>inventory</location></itemExam>';
  const result = await bootWithOutput(raw);
  const latest = result.chat();
  assert.equal(latest.message[0].data.includes('<itemExam>'), false);
  assert.match(latest.message[0].data, /<!--ITEMX2@i0_0_[a-f0-9]{8}:[A-Za-z0-9_-]+-->/);
  assert.match(latest.scriptstate.$__itemx2_message_events, /raw_blade/);
  assert.ok(JSON.parse(latest.scriptstate.$__itemx2_state).registry.items.raw_blade);
  assert.equal(result.modelCalls, 1);
});

test('auxiliary applies exam and same-batch equip patch in order', async () => {
  const output = '<itemExam><id>new_blade</id><name>새 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>rare</internalrarity><possession>owned</possession><location>inventory</location></itemExam>\n<itemPatch><id>new_blade</id><action>equip</action><slot>main_hand</slot></itemPatch>';
  const result = await bootWithOutput('새 검을 주워 즉시 오른손에 장비했다.', { modelOutput: output });
  const state = JSON.parse(result.chat().scriptstate.$__itemx2_state);
  assert.equal(state.registry.items.new_blade.location, 'equipped');
  assert.equal(state.registry.items.new_blade.slot, 'main_hand');
  assert.equal(result.chatWrites, 1);
});

test('periodic catch-up does not treat its own auxiliary marker as a fresh output', async () => {
  const output = '<itemExam><id>missing_blade</id><name>누락된 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>rare</internalrarity><possession>owned</possession><location>inventory</location></itemExam>';
  const result = await bootWithOutput('지훈은 누락된 검을 주워 품에 넣었다.', { modelOutput: output });
  assert.equal(result.modelCalls, 1);
  assert.equal(result.chatWrites, 1);
  await result.intervals.find(({ ms }) => ms === 4500).fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  assert.equal(result.modelCalls, 1);
  assert.equal(result.chatWrites, 1);
});

test('periodic catch-up ignores host-added trailing whitespace after auxiliary commit', async () => {
  const output = '<itemExam><id>stable_blade</id><name>안정된 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>rare</internalrarity><possession>owned</possession><location>inventory</location></itemExam>';
  const result = await bootWithOutput('지훈은 안정된 검을 손에 넣었다.', { modelOutput: output, postWriteWhitespace: '\n\n\n\n' });
  assert.equal(result.modelCalls, 1);
  await result.intervals.find(({ ms }) => ms === 4500).fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  assert.equal(result.modelCalls, 1);
});

test('automatic auxiliary waits for two unchanged observations after streaming chunks stop', async () => {
  const result = await bootWithOutput('첫 스트리밍 청크', { deferSettle: true });
  const timer = result.intervals.find(({ ms }) => ms === 4500);
  assert.equal(result.modelCalls, 0);
  result.setLatestData('첫 스트리밍 청크와 두 번째 청크');
  result.advance(2000); await timer.fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  assert.equal(result.modelCalls, 0);
  result.setLatestData('첫 스트리밍 청크와 두 번째 청크, 마지막 청크.');
  result.advance(2000); await timer.fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  assert.equal(result.modelCalls, 0);
  result.advance(2000); await timer.fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  assert.equal(result.modelCalls, 1);
});

test('failed catch-up is retried after bounded backoff instead of being stamped complete', async () => {
  const result = await bootWithOutput('누락 감정이 필요한 완결 서술.', { failFirst: true });
  assert.equal(result.modelCalls, 1);
  result.advance(11000);
  await result.intervals.find(({ ms }) => ms === 4500).fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  assert.equal(result.modelCalls, 2);
});

test('zero-event automatic auxiliary remembers the guard without rewriting chat', async () => {
  const result = await bootWithOutput('완결된 서술이지만 새 아이템 사건은 없다.');
  assert.equal(result.modelCalls, 1);
  assert.equal(result.chatWrites, 0);
  assert.ok([...result.storage.keys()].some((key) => key.startsWith('auxZero:')));
});

test('auxiliary regeneration receives the triggering turn and recent visible narrative, not hidden thoughts or legacy ITEMX state', async () => {
  const result = await bootWithOutput(
    '<Thoughts>음검을 만들 계획만 세운다.</Thoughts>\n\n지훈은 검대의 음검 모야를 뽑아 냉기와 공명시켰다.',
    {
      prefixMessages: [
        { role: 'char', data: '고검총에서 양검은 파괴되었고 음검은 행방을 알 수 없었다.' },
        { role: 'user', data: '당신은 어느 고급진 처소에서 눈을뜬다. (음검발견)' }
      ],
      scriptstate: { '$__itemx_anchor': 'LEGACY_ITEMX_MUST_NOT_LEAK', weapon_state: '오른손에 차가운 검을 들었다' }
    }
  );
  assert.equal(result.modelCalls, 1);
  const prompt = result.prompts[0];
  assert.match(prompt, /TRIGGERING USER TURN:\n당신은 어느 고급진 처소에서 눈을뜬다\. \(음검발견\)/);
  assert.match(prompt, /RECENT NARRATIVE CONTEXT[\s\S]*양검은 파괴되었고 음검은 행방을 알 수 없었다/);
  assert.match(prompt, /COMMITTED ASSISTANT OUTPUT \(visible narrative only\):[\s\S]*음검 모야를 뽑아 냉기와 공명시켰다/);
  assert.doesNotMatch(prompt, /음검을 만들 계획만 세운다/);
  assert.doesNotMatch(prompt, /LEGACY_ITEMX_MUST_NOT_LEAK/);
  assert.match(prompt, /weapon_state = 오른손에 차가운 검을 들었다/);
});

test('auxiliary treats the first confirmed already-owned player skill as a discovery event', async () => {
  const result = await bootWithOutput(
    '동료는 챗붕이 [보법]을 실전에서 오랫동안 사용해 온 고수라고 확인했다.',
    { modelOutput: '<skillExam><id>footwork</id><name>보법</name><glyph>💨</glyph><type>passive</type><status>learned</status><description>실전에서 오랫동안 익힌 이동 기술.</description></skillExam>' }
  );
  assert.equal(result.modelCalls, 1);
  assert.equal(result.chatWrites, 1);
  assert.match(result.prompts[0], /first explicit confirmation that the player character owns, uses, has mastered, has equipped/);
  assert.match(result.prompts[0], /Do not put an NPC or opponent's technique into the player skill registry/);
  const ledger = JSON.parse(result.chat().scriptstate.$__itemx2_message_events);
  const skill = ledger.find((row) => row.domain === 'codex' && row.payload?.event?.domain === 'skill');
  assert.equal(skill.payload.event.entity.id, 'footwork');
  assert.equal(skill.payload.event.entity.name, '보법');
});

test('detailed multi-item appraisal keeps safe partials and repairs them in one batch with one chat write', async () => {
  const initial = [
    '<itemExam><id>abyssal_apocalypse</id><name>+12 심연의 묵시록</name><type>한손검</type><emoji>❔</emoji><internalrarity>epic</internalrarity><power>1500-3999</power><required>레벨 100</required><durability>350/350</durability><cost>150000000</cost><possession>owned</possession><location>inventory</location></itemExam>',
    '<itemExam><id>plain_ore</id><name>무쇠 광석</name><type>재료</type><emoji>❔</emoji><internalrarity>normal</internalrarity><possession>owned</possession><location>inventory</location></itemExam>'
  ].join('\n');
  const repair = '<itemPatch><id>abyssal_apocalypse</id><op>merge</op><power>4850-5320</power><effects><effect><effectname>심연의 포식</effectname><effectdesc>적중 시 생명력을 흡수한다.</effectdesc></effect><effect><effectname>종말의 전조</effectname><effectdesc>치명타 시 파동을 일으킨다.</effectdesc></effect><effect><effectname>완전한 결속</effectname><effectdesc>소유자와 결속한다.</effectdesc></effect></effects><augments><augment><augmentname>+12 강화</augmentname><augmentdesc>물리 피해 +185%, 관통 +35%</augmentdesc></augment></augments></itemPatch>';
  const narrative = '+12 심연의 묵시록을 얻었다.\n공격력: 4,850~5,320\n강화: +12, 물리 피해 +185%, 관통 +35%\n특수 효과: [심연의 포식] [종말의 전조] [완전한 결속]\n\n무쇠 광석 세 덩이를 얻었다.';
  const result = await bootWithOutput(narrative, { modelOutputs: [initial, repair] });
  const state = JSON.parse(result.chat().scriptstate.$__itemx2_state).registry.items;
  assert.equal(result.modelCalls, 2);
  assert.equal(result.chatWrites, 1);
  assert.equal(state.abyssal_apocalypse.power, '4850-5320');
  assert.deepEqual(state.abyssal_apocalypse.effects.map((one) => one.name), ['심연의 포식', '종말의 전조', '완전한 결속']);
  assert.equal(state.abyssal_apocalypse.augments[0].name, '+12 강화');
  assert.equal(state.abyssal_apocalypse.required, '');
  assert.equal(state.abyssal_apocalypse.durability, '');
  assert.equal(state.abyssal_apocalypse.cost, '');
  assert.equal(state.abyssal_apocalypse.emoji, '🗡️');
  assert.equal(state.plain_ore.emoji, '🧱');
  assert.match(result.prompts[1], /id=abyssal_apocalypse/);
  assert.doesNotMatch(result.prompts[1], /id=plain_ore/);
});

test('failed partial repair commits once as partial_final and does not auto-retry', async () => {
  const initial = '<itemExam><id>scarred_blade</id><name>상흔의 검</name><type>장검</type><emoji>❔</emoji><internalrarity>epic</internalrarity><power>1500-3999</power><possession>owned</possession><location>inventory</location></itemExam>';
  const narrative = '상흔의 검을 감정했다.\n공격력: 4,200~4,600\n특수 효과: [핏빛 상흔]';
  const result = await bootWithOutput(narrative, { modelOutputs: [initial, 'NONE'] });
  assert.equal(result.modelCalls, 2);
  assert.equal(result.chatWrites, 1);
  const history = JSON.parse(result.chat().scriptstate.$__itemx2_aux_processed);
  assert.equal(Object.values(history)[0].state, 'partial_final');
  await result.intervals.find(({ ms }) => ms === 4500).fn();
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  assert.equal(result.modelCalls, 2);
});
