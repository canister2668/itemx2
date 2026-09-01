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
  const Risuai = {
    pluginStorage: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
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
      return { ok: true, text: async () => '//@name itemx2\n//@version 1.9.0-beta.6\n' };
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
  assert.equal(JSON.parse(localStorage.get('itemx2:update-check')).latest, '1.9.0-beta.6');
  assert.equal(typeof replacers.afterRequest, 'function');
  assert.equal(typeof replacers.beforeRequest, 'function');
  assert.equal(typeof handlers.display, 'function');

  const raw = '런타임 검을 얻었다.\n\n전투가 끝난 뒤 일행은 다음 장소로 떠났다.\n\n<itemExam><id>runtime_blade</id><name>런타임 검</name><type>장검</type><emoji>⚔️</emoji><internalrarity>epic</internalrarity><displayrarity>에픽</displayrarity><power>2200-3100</power><durability>100/100</durability><possession>owned</possession><location>inventory</location><visual><theme>oriental</theme><affinity>lightning</affinity></visual><trivia>실제 훅 검증.</trivia></itemExam>';
  const cleaned = await replacers.afterRequest(raw, 'main');
  assert.equal(cleaned.includes('<itemExam>'), false);
  assert.match(cleaned, /<!--ITEMX2:/);
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
  const display = await handlers.display(cleaned);
  assert.match(display, /itemx-card/);
  assert.ok(display.indexOf('itemx-card') < display.indexOf('전투가 끝난 뒤'));
  assert.equal(display.includes('<itemExam>'), false);

  const mixed = '새로운 검결을 깨우쳤다.\n<skillExam><id>hidden_form</id><name>월영참</name><type>active</type><status>equipped</status><mastery>30</mastery></skillExam>\n\n[Status: 정상]';
  const mixedCleaned = await replacers.afterRequest(mixed, 'main');
  assert.equal(mixedCleaned.includes('<skillExam>'), false);
  assert.match(mixedCleaned, /<!--CODEX2:/);
  assert.ok(mixedCleaned.indexOf('<!--CODEX2:') < mixedCleaned.indexOf('[Status: 정상]'));
  const trailerNameHit = await replacers.afterRequest('새 기술을 익혔다.\n<skillExam><id>trailer_form</id><name>월영참</name><type>active</type><status>learned</status></skillExam>\n\n[Status: 월영참 CD 18초]', 'main');
  assert.ok(trailerNameHit.indexOf('<!--CODEX2:') < trailerNameHit.indexOf('[Status: 월영참'));

  storage.set('skillsEnabled:char-a', '0');
  const disabledSkill = await replacers.afterRequest('기술을 익혔다.<skillExam><id>off_skill</id><name>비활성 기술</name><type>active</type></skillExam>', 'main');
  assert.equal(disabledSkill.includes('skillExam'), false);
  assert.equal(disabledSkill.includes('<!--CODEX2:'), false);
  const selectiveRequest = await replacers.beforeRequest([{ role: 'user', content: '계속한다.' }], 'main');
  assert.equal(selectiveRequest[0].content.includes('<skillExam>'), false);
  assert.match(selectiveRequest[0].content, /<monsterExam>/);
  storage.set('encountersEnabled:char-a', '0');
  const disabledMonster = await replacers.afterRequest('적이 나타났다.<monsterExam><id>off_enemy</id><name>비활성 적</name><relation>hostile</relation><status>active</status></monsterExam>', 'main');
  assert.equal(disabledMonster.includes('monsterExam'), false);
  assert.equal(disabledMonster.includes('<!--CODEX2:'), false);
  storage.set('mainOutput:char-a', '0');
  const outputOff = await replacers.afterRequest('잔여 태그.<itemExam><id>off_item</id><name>비활성 검</name><type>검</type></itemExam><skillExam><id>off_again</id><name>비활성 기술</name><type>active</type></skillExam>', 'main');
  assert.equal(/itemExam|skillExam|ITEMX2:|CODEX2:/.test(outputOff), false);
  storage.set('mainOutput:char-a', '1');

  const brokenMixed = '적이 나타났다.\n<monsterExam><id>broken\n\n검을 얻었다.\n<itemExam><id>second_blade</id><name>두 번째 검</name><type>장검</type><possession>owned</possession><location>inventory</location></itemExam>\n\n[Status: HP 12]\n<state>keep</state>';
  const brokenCleaned = await replacers.afterRequest(brokenMixed, 'main');
  assert.equal(brokenCleaned.includes('monsterExam'), false);
  assert.match(brokenCleaned, /<!--ITEMX2:/);
  assert.match(brokenCleaned, /\[Status: HP 12\]/);
  assert.match(brokenCleaned, /<state>keep<\/state>/);
});

test('Home route stays idle until a chat exists instead of reading chatPage', async () => {
  const bootOrder = [], intervals = [];
  const Risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    safeLocalStorage: { getItem: async () => null, setItem: async () => {} },
    getCurrentCharacterIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCurrentChatIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
    getCharacter: async () => null,
    registerSetting: async () => { bootOrder.push('setting'); return { id: 'setting' }; },
    requestPluginPermission: async () => { bootOrder.push('permission'); return true; },
    getRootDocument: async () => { bootOrder.push('root-document'); return null; },
    addRisuScriptHandler: async () => { bootOrder.push('script-handler'); },
    addRisuReplacer: async () => { bootOrder.push('replacer'); },
    unregisterUIPart: async () => {},
    onUnload: async () => {},
    hideContainer: async () => {}
  };
  const sandbox = vm.createContext({
    console, Buffer, TextEncoder, TextDecoder, structuredClone, setTimeout, clearTimeout,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: () => {},
    Risuai, document: { head: {}, body: {} }
  });
  await vm.runInContext(await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8'), sandbox);
  assert.deepEqual(bootOrder, ['setting', 'script-handler', 'script-handler']);
  assert.deepEqual(intervals.map((row) => row.ms), [1200, 4500, 30 * 60 * 1000]);
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
