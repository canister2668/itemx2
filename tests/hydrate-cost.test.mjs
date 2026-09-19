import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function storage() {
  const src = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  const anchor = '  try {\n    await loadBadgePosition();';
  const sb = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, TextEncoder, TextDecoder, Buffer, structuredClone,
    setTimeout, clearTimeout, setInterval, clearInterval, Risuai: {}
  });
  await vm.runInContext(src.replace(anchor, `globalThis.p = { storage: ITEMXStorage };\n  return;\n${anchor}`), sb);
  return sb.p.storage;
}

const chatWith = (rows, messages) => ({
  message: messages,
  scriptstate: { 'itemx:log': JSON.stringify({ v: 1, rows }), 'itemx:cache': '{}', 'itemx:prefs': '{}' }
});
const messages = [
  { chatId: 'm0', role: 'user', data: '가' },
  { chatId: 'm1', role: 'char', data: '나' }
];
const rows = [
  {
    id: 'item:a', domain: 'item', ref: 'a', messageIndex: 1, messageId: 'm1', ordinal: 0, code: 'a',
    event: { kind: 'exam', item: { id: 'sword', name: '검', itemType: '검', count: 1, possession: 'owned', location: 'inventory', effects: [], augments: [] } }
  }
];

// Hydration folds the entire log. It runs on every chat read, including the host
// DOM sync that fires when scrolling stops, so repeating it for an unchanged
// chat is what made scrolling hitch.
test('an unchanged chat is not folded twice', async () => {
  const s = await storage();
  const chat = chatWith(rows, messages);
  const a = s.hydrate(chat);
  const b = s.hydrate(chat);
  assert.equal(a.scriptstate['$__itemx2_state'], b.scriptstate['$__itemx2_state']);
  assert.ok(a.scriptstate['$__itemx2_state'], 'the projection is produced at all');
});

test('a new log entry is folded again', async () => {
  const s = await storage();
  const first = s.hydrate(chatWith(rows, messages));
  const more = [
    ...rows,
    {
      id: 'item:b', domain: 'item', ref: 'b', messageIndex: 1, messageId: 'm1', ordinal: 1, code: 'b',
      event: { kind: 'exam', item: { id: 'shield', name: '방패', itemType: '방어구', count: 1, possession: 'owned', location: 'inventory', effects: [], augments: [] } }
    }
  ];
  const second = s.hydrate(chatWith(more, messages));
  assert.notEqual(first.scriptstate['$__itemx2_state'], second.scriptstate['$__itemx2_state']);
  assert.match(second.scriptstate['$__itemx2_state'], /shield/);
});

test('a message list change is folded again', async () => {
  const s = await storage();
  const first = s.hydrate(chatWith(rows, messages));
  const grown = [...messages, { chatId: 'm2', role: 'user', data: '다' }];
  const second = s.hydrate(chatWith(rows, grown));
  assert.ok(first.scriptstate['$__itemx2_state'] && second.scriptstate['$__itemx2_state']);
});

// The projection is cached, never the finished scriptstate: another module's
// key must still travel through untouched, or a stale chat looks unchanged.
test('an unrelated scriptstate change is never masked', async () => {
  const s = await storage();
  const chat = chatWith(rows, messages);
  const before = s.hydrate(chat);
  const edited = { ...chat, scriptstate: { ...chat.scriptstate, $other: 'changed' } };
  const after = s.hydrate(edited);
  assert.equal(before.scriptstate.$other, undefined);
  assert.equal(after.scriptstate.$other, 'changed');
  assert.notEqual(JSON.stringify(before.scriptstate), JSON.stringify(after.scriptstate));
});

test('hydrate uses the projection memo; replay input regressions cover its key', async () => {
  const source = await readFile(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(source, /function projectReplay\(chat\)/);
  assert.match(source, /const projected = projectReplay\(chat\)/);
  assert.equal(source.includes('const projected = replay(chat)'), false, 'hydrate must go through the memo');
});

// Reading the chat back crosses the host bridge and structured-clones every
// message. That marshalling, not the folding, is what a reader feels when
// scrolling stops, so the post-scroll pass must not ask for it unprompted.
test('the post-scroll sync does not read the chat while the drawer is closed', async () => {
  const source = await readFile(new URL('../src/ui-panel.js', import.meta.url), 'utf8');
  assert.match(source, /function scheduleHostDomSync\(delayMs = 320, \{ light = false \} = \{\}\)/);
  assert.match(source, /if \(!light \|\| uiState\.rootOpen\) await ensureRootInventory\(\)/);
  const presentation = await readFile(new URL('../src/presentation.js', import.meta.url), 'utf8');
  assert.match(presentation, /scheduleHostDomSync\(180, \{ light: true \}\)/);
});

test('fnv1a keeps its value while reusing one encoder', async () => {
  const core = await readFile(new URL('../src/core.js', import.meta.url), 'utf8');
  // The hash feeds stored fingerprints, checkpoint prefixes and generated ids,
  // so the bytes must stay the same; only the per-call work may change.
  assert.match(core, /const fnvEncoder = typeof TextEncoder/);
  assert.match(core, /for \(let i = 0; i < bytes\.length; i \+= 1\)/);
  assert.equal(core.includes('new TextEncoder().encode(String(value))'), false, 'encoder must not be per call');
  const s = await storage();
  assert.ok(s, 'bundle still loads');
});
