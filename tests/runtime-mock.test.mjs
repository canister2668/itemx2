import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('API v3 runtime processes, commits, injects and renders one real turn', async () => {
  let chat = { id: 'chat-a', message: [], scriptstate: {} };
  let updateRequest = null;
  const handlers = {}, replacers = {}, storage = new Map(), localStorage = new Map(), bootOrder = [];
  let settingReads = 0;
  const Risuai = {
    pluginStorage: { getItem: async (key) => { settingReads += 1; return storage.get(key) ?? null; }, setItem: async (key, value) => storage.set(key, value) },
    safeLocalStorage: { getItem: async (key) => localStorage.get(key) ?? null, setItem: async (key, value) => localStorage.set(key, value) },
    getCurrentCharacterIndex: async () => 0,
    getCurrentChatIndex: async () => 0,
    getCharacter: async () => ({ chaId: 'char-a', name: '시험 봇' }),
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_ci, _hi, value) => { chat = structuredClone(value); },
    addRisuScriptHandler: async (mode, fn) => { handlers[mode] = fn; },
    removeRisuScriptHandler: async () => {},
    requestPluginPermission: async (permission) => { bootOrder.push(`permission:${permission}`); return true; },
    addRisuReplacer: async (mode, fn) => { replacers[mode] = fn; },
    removeRisuReplacer: async () => {},
    registerButton: async (arg) => { bootOrder.push(`button:${arg.location}`); return { id: 'button' }; },
    registerSetting: async () => { bootOrder.push('setting'); return { id: 'setting' }; },
    unregisterUIPart: async () => {},
    getRootDocument: async () => null,
    nativeFetch: async (url, options) => {
      updateRequest = { url, options };
      return { ok: true, text: async () => '//@name itemx2\n//@version 1.9.0-beta.28\n' };
    },
    onUnload: async () => {},
    showContainer: async () => {},
    hideContainer: async () => {}
  };
  const sandbox = vm.createContext({ console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {}, Risuai, document: { head: {}, body: {} } });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(bootOrder, ['setting', 'permission:replacer']);
  assert.equal(updateRequest.options.headers.Range, 'bytes=0-2047');
  assert.equal(JSON.parse(localStorage.get('itemx2:update-check')).latest, '1.9.0-beta.28');
  assert.equal(typeof replacers.afterRequest, 'function');
  assert.equal(typeof replacers.beforeRequest, 'function');
  assert.equal(typeof handlers.display, 'function');
  assert.equal(typeof handlers.process, 'function');
  const hypaInput = await handlers.process('서사 유지<sys>keep</sys><state>alive</state>\n<!--ITEMX2@c1:YWJj-->\n<skillExam><id>hidden</id><name>숨은 기술</name></skillExam>\n[itemx: stale]');
  assert.match(hypaInput, /서사 유지/);
  assert.match(hypaInput, /<sys>keep<\/sys>/);
  assert.match(hypaInput, /<state>alive<\/state>/);
  assert.equal(/ITEMX2@|skillExam|\[itemx:/i.test(hypaInput), false, 'Hypa pre-token process output must contain no owned transport');
  const auxiliaryRequest = await replacers.beforeRequest([{ role: 'assistant', content: '보조 서사<!--CODEX2@c2:YWJj--><sys>keep</sys>' }], 'translate');
  assert.equal(auxiliaryRequest[0].content, '보조 서사<sys>keep</sys>', 'non-main requests are sanitized without protocol injection');
  const preloadedSettingReads = settingReads;

  const raw = '런타임 검을 얻었다.\n\n전투가 끝난 뒤 일행은 다음 장소로 떠났다.\n\n<itemExam><id>runtime_blade</id><name>런타임 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>epic</internalrarity><displayrarity>에픽</displayrarity><power>2200-3100</power><durability>100/100</durability><possession>owned</possession><location>inventory</location><visual><theme>oriental</theme><affinity>lightning</affinity></visual><trivia>실제 훅 검증.</trivia></itemExam>';
  const cleaned = await replacers.afterRequest(raw, 'main');
  assert.equal(cleaned.includes('<itemExam>'), false);
  assert.match(cleaned, /<!--ITEMX2:/);
  const tokenizedStoredMessage = await handlers.process(cleaned);
  assert.match(tokenizedStoredMessage, /런타임 검을 얻었다/);
  assert.equal(tokenizedStoredMessage.includes('<!--ITEMX2:'), false, 'stored display marker is removed before Hypa tokenization');
  // The inventory poll can still see the pre-commit chat between the final
  // response hook and the host's first display pass. That stale rebuild must
  // not clear the just-produced marker or the card appears only after editing.
  await replacers.beforeRequest([{ role: 'user', content: '커밋 전 경합을 재현한다.' }], 'main');
  const immediateDisplay = await handlers.display(cleaned);
  assert.match(immediateDisplay, /itemx-card/);
  chat.message.push({ role: 'char', data: cleaned });
  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.equal(chat.scriptstate.$__itemx2_state, undefined);

  const request = await replacers.beforeRequest([{ role: 'assistant', content: cleaned }, { role: 'user', content: '검을 살핀다.' }], 'main');
  assert.equal(request[0].role, 'system');
  assert.match(request[0].content, /runtime_blade/);
  assert.equal(request[1].content.includes('<!--ITEMX2:'), false);
  const continuationRequest = await replacers.beforeRequest([{ role: 'system', content: '원래 지침' }, { role: 'assistant', content: '이어 쓸 문장' }], 'main');
  assert.equal(continuationRequest.at(-1).role, 'system', 'a trailing protocol turn lets Risu Google formatting finish on user instead of model');
  assert.equal(continuationRequest.at(-2).role, 'assistant');
  assert.match(continuationRequest.at(-1).content, /ITEMX/);
  const googleInput = structuredClone(continuationRequest);
  if (googleInput[0]?.role === 'system') googleInput.shift();
  const googleRoles = [];
  for (const message of googleInput) {
    if (message.role === 'system') {
      if (googleRoles.at(-1) !== 'user') googleRoles.push('user');
    } else googleRoles.push(message.role === 'assistant' ? 'model' : 'user');
  }
  assert.equal(googleRoles.at(-1), 'user', 'upstream Risu Google conversion must not emit a request ending in model');
  const multimodalTail = await replacers.beforeRequest([
    { role: 'user', content: '이미지를 본다.' },
    { role: 'system', content: '후행 이미지 문맥', multimodals: [{ type: 'image', base64: 'data:image/png;base64,AA==' }] }
  ], 'main');
  assert.equal(multimodalTail.at(-1).role, 'system');
  assert.equal(multimodalTail.at(-1).multimodals, undefined, 'protocol guard itself must remain a plain text turn');
  assert.equal(/<!--(?:ITEMX2|CODEX2)(?::|@)|<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b/i.test(request.slice(1).map((one) => one.content).join('\n')), false);
  const display = await handlers.display(cleaned);
  assert.match(display, /itemx-card/);
  assert.ok(display.indexOf('itemx-card') < display.indexOf('전투가 끝난 뒤'));
  assert.equal(display.includes('<itemExam>'), false);

  const mixed = '새로운 검결을 깨우쳤다.\n<skillExam><id>hidden_form</id><name>월영참</name><type>active</type><status>equipped</status><mastery>30</mastery></skillExam>\n\n[Status: 정상]';
  const mixedCleaned = await replacers.afterRequest(mixed, 'main');
  assert.equal(mixedCleaned.includes('<skillExam>'), false);
  assert.match(mixedCleaned, /<!--CODEX2:/);
  assert.ok(mixedCleaned.indexOf('<!--CODEX2:') < mixedCleaned.indexOf('[Status: 정상]'));
  const mixedDisplay = await handlers.display(mixedCleaned);
  assert.match(mixedDisplay, /itemx2-inline-skill/);
  assert.match(mixedDisplay, /NEW SKILL ARCHIVED/);
  assert.match(mixedDisplay, /월영참/);
  const trailerNameHit = await replacers.afterRequest('새 기술을 익혔다.\n<skillExam><id>trailer_form</id><name>월영참</name><type>active</type><status>learned</status></skillExam>\n\n[Status: 월영참 CD 18초]', 'main');
  assert.ok(trailerNameHit.indexOf('<!--CODEX2:') < trailerNameHit.indexOf('[Status: 월영참'));

  await replacers.beforeRequest([{ role: 'user', content: '설정 캐시를 확인한다.' }], 'main');
  await replacers.afterRequest('설정 캐시 확인 완료.', 'main');
  assert.equal(settingReads, preloadedSettingReads, 'preloaded per-character settings must not be re-read on every model hook');

  const brokenMixed = '적이 나타났다.\n<monsterExam><id>broken\n\n검을 얻었다.\n<itemExam><id>second_blade</id><name>두 번째 검</name><type>장검</type><possession>owned</possession><location>inventory</location></itemExam>\n\n[Status: HP 12]\n<state>keep</state>';
  const brokenCleaned = await replacers.afterRequest(brokenMixed, 'main');
  assert.equal(brokenCleaned.includes('monsterExam'), false);
  assert.match(brokenCleaned, /<!--ITEMX2:/);
  assert.match(brokenCleaned, /\[Status: HP 12\]/);
  assert.match(brokenCleaned, /<state>keep<\/state>/);
});

test('Home route stays idle until a chat exists instead of reading chatPage', async () => {
  const bootOrder = [], intervals = [];
  let settingHandler = null;
  const api = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCurrentChatIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCharacter: async () => null,
    registerSetting: async (_name, onClick) => { settingHandler = onClick; bootOrder.push('setting'); return { id: 'setting' }; },
    requestPluginPermission: async () => { bootOrder.push('permission'); return true; },
    getRootDocument: async () => { bootOrder.push('root-document'); return null; },
    addRisuScriptHandler: async () => { bootOrder.push('script-handler'); },
    addRisuReplacer: async () => { bootOrder.push('replacer'); },
    unregisterUIPart: async () => {},
    onUnload: async () => {},
    hideContainer: async () => {}
  };
  const Risuai = new Proxy(api, {
    get(target, property) {
      if (property in target) return target[property];
      return async () => { throw new Error(`API method ${String(property)} not found`); };
    }
  });
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: () => {},
    Risuai, document: { head: {}, body: {} }
  });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  assert.deepEqual(bootOrder, ['setting', 'script-handler', 'script-handler', 'script-handler']);
  assert.deepEqual(intervals.map((row) => row.ms), [1200, 4500, 30 * 60 * 1000]);
  await assert.doesNotReject(() => settingHandler(), 'upstream web Risu must tolerate missing alertNormal/alertError APIs');
});

test('self-contained compact refs render on first display without hydrated chat state', async () => {
  const handlers = {};
  const Risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCurrentChatIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCharacter: async () => null,
    registerSetting: async () => ({ id: 'setting' }),
    addRisuScriptHandler: async (mode, fn) => { handlers[mode] = fn; },
    removeRisuScriptHandler: async () => {}, unregisterUIPart: async () => {}, onUnload: async () => {}, hideContainer: async () => {}
  };
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, Risuai, document: { head: {}, body: {} }
  });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  const view = { id: 'first_entry_blade', name: '첫 진입 검', itemType: '장검', emoji: '⚔️', rarity: 'epic', displayRarity: '에픽', possession: 'owned', location: 'inventory', count: 1, theme: 'oriental', affinity: 'lightning', effects: [], augments: [] };
  const code = Buffer.from(JSON.stringify({ v: 2, view })).toString('base64url');
  const rendered = handlers.display(`검을 확인했다.\n<!--ITEMX2@i0_0_deadbeef:${code}-->`);
  assert.match(rendered, /itemx-card/);
  assert.match(rendered, /첫 진입 검/);
  assert.doesNotMatch(rendered, /기록 복원 중/);
  const legacyFallback = handlers.display('<!--ITEMX2@i0_0_deadbeef-->');
  assert.match(legacyFallback, /기록 복원 중/);

  const repairedView = { ...view, name: '최종 +12 검', augments: [{ name: '+12강화', desc: '보띿빛 오라' }] };
  const repairedCode = Buffer.from(JSON.stringify({ v: 2, view: repairedView })).toString('base64url');
  const coalesced = handlers.display(`감정과 보완이 이어졌다.\n<!--ITEMX2@i0_0_exam:${code}-->\n<!--ITEMX2@i0_1_patch:${repairedCode}-->`);
  assert.equal((coalesced.match(/data-itemx-id="first_entry_blade"/g) || []).length, 1);
  assert.match(coalesced, /최종 \+12 검/);
  assert.match(coalesced, /\+12강화/);

  const otherView = { ...view, id: 'other_blade', name: '다른 검' };
  const otherCode = Buffer.from(JSON.stringify({ v: 2, view: otherView })).toString('base64url');
  const separate = handlers.display(`두 검을 감정했다.\n<!--ITEMX2@i0_0_first:${code}-->\n<!--ITEMX2@i0_1_other:${otherCode}-->`);
  assert.equal((separate.match(/data-itemx-id=/g) || []).length, 2);

  const laterChange = handlers.display(`첫 감정.\n<!--ITEMX2@i0_0_exam:${code}-->\n\n이후 전투에서 별도로 강화됐다.\n<!--ITEMX2@i0_1_later:${repairedCode}-->`);
  assert.equal((laterChange.match(/data-itemx-id="first_entry_blade"/g) || []).length, 2);
});

test('legacy bare refs are upgraded once from the per-chat event ledger', async () => {
  const handlers = {}, replacers = {};
  const view = { id: 'legacy_blade', name: '복원된 옛 검', itemType: '장검', emoji: '⚔️', rarity: 'rare', displayRarity: '레어', possession: 'owned', location: 'inventory', count: 1, theme: 'oriental', affinity: 'lightning', effects: [], augments: [] };
  const item = { ...view, required: '', power: '', durability: '', cost: '', slot: '', affinity2: '', condition: '', trivia: '' };
  const ref = 'i0_0_deadbeef';
  const ledger = [{ ref, domain: 'item', payload: { v: 2, event: { kind: 'exam', item }, view } }];
  let chat = { id: 'legacy-chat', message: [{ role: 'char', data: `옛 검을 확인했다.\n<!--ITEMX2@${ref}-->` }], scriptstate: { $__itemx2_message_events: JSON.stringify(ledger) } };
  let writes = 0;
  const Risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => 0,
    getCurrentChatIndex: async () => 0,
    getCharacter: async () => ({ chaId: 'legacy-char', name: '옛 봇' }),
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_ci, _hi, value) => { writes += 1; chat = structuredClone(value); },
    registerSetting: async () => ({ id: 'setting' }),
    addRisuScriptHandler: async (mode, fn) => { handlers[mode] = fn; },
    removeRisuScriptHandler: async () => {},
    requestPluginPermission: async () => true,
    addRisuReplacer: async (mode, fn) => { replacers[mode] = fn; },
    removeRisuReplacer: async () => {},
    getRootDocument: async () => null,
    unregisterUIPart: async () => {}, onUnload: async () => {}, hideContainer: async () => {}
  };
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, Risuai, document: { head: {}, body: {} }
  });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  assert.equal(writes, 1);
  assert.match(chat.message[0].data, /<!--ITEMX2@i0_0_deadbeef:[A-Za-z0-9_-]+-->/);
  const rendered = handlers.display(chat.message[0].data);
  assert.match(rendered, /itemx-card/);
  assert.match(rendered, /복원된 옛 검/);
});

test('only the newest event message keeps an inline display view', async () => {
  const handlers = {}, replacers = {};
  const makePayload = (id, name) => {
    const view = { id, name, itemType: '장검', emoji: '⚔️', rarity: 'rare', displayRarity: '레어', possession: 'owned', location: 'inventory', count: 1, theme: 'oriental', affinity: '', effects: [], augments: [] };
    const item = { ...view, required: '', power: '', durability: '', cost: '', slot: '', affinity2: '', condition: '', trivia: '' };
    return { v: 2, event: { kind: 'exam', item }, view };
  };
  const oldRef = 'i0_0_oldbeef', newRef = 'i1_0_newbeef';
  const oldPayload = makePayload('old_blade', '오래된 검'), newPayload = makePayload('new_blade', '새 검');
  const inline = (payload) => Buffer.from(JSON.stringify({ v: 2, view: payload.view })).toString('base64url');
  const ledger = [
    { ref: oldRef, domain: 'item', payload: oldPayload },
    { ref: newRef, domain: 'item', payload: newPayload }
  ];
  let chat = {
    id: 'hybrid-ref-chat',
    message: [
      { role: 'char', data: `첫 기록\n<!--ITEMX2@${oldRef}:${inline(oldPayload)}-->` },
      { role: 'char', data: `최신 기록\n<!--ITEMX2@${newRef}-->` }
    ],
    scriptstate: { $__itemx2_message_events: JSON.stringify(ledger) }
  };
  let writes = 0;
  const Risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => 0,
    getCurrentChatIndex: async () => 0,
    getCharacter: async () => ({ chaId: 'hybrid-char', name: '혼합 봇' }),
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_ci, _hi, value) => { writes += 1; chat = structuredClone(value); },
    registerSetting: async () => ({ id: 'setting' }),
    addRisuScriptHandler: async (mode, fn) => { handlers[mode] = fn; },
    removeRisuScriptHandler: async () => {},
    requestPluginPermission: async () => true,
    addRisuReplacer: async (mode, fn) => { replacers[mode] = fn; },
    removeRisuReplacer: async () => {},
    getRootDocument: async () => null,
    unregisterUIPart: async () => {}, onUnload: async () => {}, hideContainer: async () => {}
  };
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, Risuai, document: { head: {}, body: {} }
  });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  assert.equal(writes, 1);
  assert.equal(chat.message[0].data, `첫 기록\n<!--ITEMX2@${oldRef}-->`);
  assert.match(chat.message[1].data, new RegExp(`<!--ITEMX2@${newRef}:[A-Za-z0-9_-]+-->`));
  const request = await replacers.beforeRequest(chat.message.map((message) => ({ role: 'assistant', content: message.data })), 'main');
  assert.equal(request.some((message) => String(message.content || '').includes('ITEMX2@')), false);
});

test('chat cleanup removes ITEMX and CODEX transports while preserving unrelated chat state', async () => {
  const Risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCurrentChatIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCharacter: async () => null,
    registerSetting: async () => ({ id: 'setting' }),
    addRisuScriptHandler: async () => {}, removeRisuScriptHandler: async () => {},
    unregisterUIPart: async () => {}, onUnload: async () => {}, hideContainer: async () => {}
  };
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, Risuai, document: { head: {}, body: {} }
  });
  const built = await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8');
  const instrumented = built.replace(
    '  async function cachedOrRebuildCurrent() {',
    '  globalThis.__itemxCleanChatForTest = cleanChatPluginData;\n  async function cachedOrRebuildCurrent() {'
  );
  assert.notEqual(instrumented, built);
  await vm.runInContext(instrumented, sandbox);
  const payload = Buffer.from(JSON.stringify({ v: 2, event: { kind: 'exam', item: { id: 'x', name: '검' } } })).toString('base64url');
  const cleaned = sandbox.__itemxCleanChatForTest({
    message: [{ role: 'char', data: `본문\n<!--ITEMX2:${payload}-->\n<!--CODEX2@c0_0_deadbeef:${payload}-->\n<state>보존</state>` }],
    scriptstate: {
      $__itemx2_state: '{}', $__itemx2_chat_id: 'id', $__itemx2_codex_state: '{}',
      $__itemx2_manual_events: '[]', $__itemx2_message_events: '[]', $__itemx2_aux_processed: '{}',
      unrelated: 'keep'
    }
  });
  assert.equal(cleaned.removedMarkers, 2);
  assert.equal(cleaned.removedStateKeys, 6);
  assert.doesNotMatch(cleaned.chat.message[0].data, /ITEMX2|CODEX2/);
  assert.match(cleaned.chat.message[0].data, /<state>보존<\/state>/);
  assert.equal(JSON.stringify(cleaned.chat.scriptstate), JSON.stringify({ unrelated: 'keep' }));
});
