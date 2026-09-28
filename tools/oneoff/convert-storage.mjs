/* Offline-only import and differential verification. Never run by the plugin. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const anchor = '  try {\n    await loadBadgePosition();';
async function runtime(source) {
  const sandbox = vm.createContext({ console, Buffer, TextEncoder, TextDecoder, setTimeout, clearTimeout, setInterval, clearInterval, Risuai: {} });
  const expose = `globalThis.api = { core: ITEMXCore, codex: ITEMXCodex, history: ITEMXHistory, backupState, rootInventoryHtml, ${source.includes('const ITEMXStorage') ? 'storage: ITEMXStorage, settings: ITEMXSettings,' : ''} }; return;`;
  assert.ok(source.includes(anchor));
  await vm.runInContext(source.replace(anchor, expose + anchor), sandbox);
  return sandbox.api;
}
const before = await runtime(execFileSync('git', ['show', 'f0ef889:dist/itemx2.plugin.js'], { maxBuffer: 4e6 }).toString());
const after = await runtime(await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8'));
const stable = value => JSON.parse(JSON.stringify(value, (key, val) => ['updatedAt', 'fingerprint', 'rev'].includes(key) ? undefined : val));
const results = [];
for (const chat of input.chats) {
  const original = structuredClone(chat);
  let legacyOnly = !Object.keys(chat.scriptstate).some(key => key.startsWith('$__itemx2'));
  if (legacyOnly && chat.scriptstate.$__itemx_snapshot) {
    const old = JSON.parse(chat.scriptstate.$__itemx_snapshot);
    const registry = after.core.newRegistry();
    for (const item of old.items || []) after.core.applyEvent(registry, { kind: 'exam', item: { ...item, count: item.count ?? 1 } });
    chat.scriptstate.$__itemx2_checkpoint = JSON.stringify({ v: 2, boundary: chat.message.length - 1, sealedThroughId: chat.message.at(-1)?.chatId || '', item: { registry, history: {} }, codex: { ...after.codex.snapshot(), history: { skill: {}, monster: {} } }, rows: [], manual: [] });
  }
  const persisted = after.storage.persist(chat, { legacy: true });
  const zeroRing = typeof input.settings['auxZeroRing:v1'] === 'string' ? JSON.parse(input.settings['auxZeroRing:v1']) : input.settings['auxZeroRing:v1'] || {};
  const zero = Object.entries(zeroRing).find(([key]) => key.endsWith(':' + chat.id))?.[1]?.history;
  if (zero) persisted.scriptstate['itemx:cache'] = JSON.stringify({ ...after.storage.cache(persisted), auxZero: zero });
  const savedCache = persisted.scriptstate['itemx:cache'];
  const restored = after.storage.hydrate(persisted);
  const oldState = before.backupState({ chat, character: { name: 'conversion' } });
  const newState = after.backupState({ chat: restored, character: { name: 'conversion' } });
  assert.deepEqual(stable(newState.snapshot.registry), stable(oldState.snapshot.registry), `item replay differs: ${chat.id}`);
  assert.deepEqual(stable(newState.snapshot.history), stable(oldState.snapshot.history), `item lifecycle differs: ${chat.id}`);
  for (const field of ['skills', 'monsters', 'history']) assert.deepEqual(stable(newState.codexSnapshot[field]), stable(oldState.codexSnapshot[field]), `codex ${field} differs: ${chat.id}`);
  // The exact HTML gate also covers nonempty, real inventories from every chat.
  const settings = { enabled: true, mainOutput: true, auxOutput: 'off', rarityMode: 'world', itemsEnabled: true, skillsEnabled: true, encountersEnabled: true, effectsEnabled: true, fontScale: 'small', skin: 'dark', character: { name: 'conversion' }, chat: restored, key: chat.id };
  for (const tab of ['inventory', 'skills', 'bestiary']) assert.equal(after.rootInventoryHtml({ ...settings, ...newState }, true, tab).replace(/<!--ITEMX2-SEARCH-START-->[\s\S]*?<!--ITEMX2-SEARCH-END-->/g, ''), before.rootInventoryHtml({ ...settings, ...oldState }, true, tab), `render differs: ${chat.id}/${tab}`);
  const log = persisted.scriptstate['itemx:log'];
  delete persisted.scriptstate['itemx:cache'];
  const uncached = after.backupState({ chat: after.storage.hydrate(persisted), character: { name: 'conversion' } });
  assert.deepEqual(stable(uncached.snapshot.registry), stable(newState.snapshot.registry), `cache loss: ${chat.id}`);
  assert.deepEqual(stable(uncached.codexSnapshot.skills), stable(newState.codexSnapshot.skills), `cache loss: ${chat.id}`);
  persisted.scriptstate['itemx:cache'] = savedCache;
  assert.equal(persisted.scriptstate['itemx:log'], log);
  assert.deepEqual(stable(persisted.message), stable(original.message));
  results.push({ id: chat.id, scriptstate: persisted.scriptstate, rows: JSON.parse(log).rows.length, importedLegacySnapshot: legacyOnly });
}
const settings = after.settings.migrate(input.settings);
await writeFile(process.argv[3], JSON.stringify({ chats: results, settings, verified: { chats: results.length, renderComparisons: results.length * 3, replayEqual: true, cacheLossEqual: true } }), { mode: 0o600 });
console.log(JSON.stringify({ chats: results.length, events: results.reduce((n, chat) => n + chat.rows, 0), renderComparisons: results.length * 3 }));
