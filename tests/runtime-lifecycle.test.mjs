import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
const loreSource = await readFile(new URL('../src/lorebook.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}

test('root ensure coalesces concurrent checks and stops after unload', async () => {
  let release,
    calls = 0;
  const runtime = {};
  const ensure = vm.runInNewContext(
    section('  let rootEnsurePromise = null;', '  async function ensureRootInventoryNow()') + '\nensureRootInventory;',
    {
      runtime,
      ensureRootInventoryNow: () => {
        calls++;
        return new Promise((resolve) => {
          release = resolve;
        });
      }
    }
  );
  const a = ensure(),
    b = ensure();
  assert.equal(a, b);
  assert.equal(calls, 1);
  release();
  await a;
  const c = ensure();
  assert.equal(calls, 2);
  release();
  await c;
  runtime.unloading = true;
  await ensure();
  assert.equal(calls, 2);
});

test('watchdog replaces its timer only when mode changes and cannot rearm after unload', () => {
  const intervals = new Map();
  let sequence = 0;
  const runtime = { activeContextKey: 'chat' };
  const arm = vm.runInNewContext(
    section('  function armRemountWatchdog()', '  try {\n    await loadBadgePosition') + '\narmRemountWatchdog;',
    {
      runtime,
      ensureRootInventory: async () => {},
      setInterval: (_fn, ms) => {
        const id = ++sequence;
        intervals.set(id, ms);
        return id;
      },
      clearInterval: (id) => intervals.delete(id)
    }
  );
  arm();
  arm();
  assert.deepEqual([...intervals.values()], [1200]);
  runtime.hostObserver = {};
  arm();
  assert.deepEqual([...intervals.values()], [10000]);
  runtime.hostObserver = null;
  arm();
  assert.deepEqual([...intervals.values()], [1200]);
  runtime.activeContextKey = '';
  arm();
  assert.deepEqual([...intervals.values()], [10000]);
  intervals.clear();
  runtime.unloading = true;
  arm();
  assert.equal(intervals.size, 0);
});

test('closing reflects native class removal even when settings bridge fails', async () => {
  const runtime = { rootOpen: true, rootDrawer: { getParent: async () => true, removeClass: async () => {} } };
  const sandbox = vm.createContext({
    runtime,
    invalidateHostSettingsVisibility: () => {},
    syncHostSettingsVisibility: async () => {
      throw Error('bridge');
    }
  });
  const setOpen = vm.runInContext(
    section('  async function setRootOpen(open)', '  async function resetRuntimeForContext') + '\nsetRootOpen;',
    sandbox
  );
  await setOpen(false);
  assert.equal(runtime.rootOpen, false);
});

test('committed sync enriches encounters after auxiliary recovery and syncs UI once', async () => {
  const calls = [],
    runtime = {};
  const sync = vm.runInNewContext(
    section('  function scheduleCommittedOutputSync()', '  function armCatchUpWatchdog()') +
      '\nscheduleCommittedOutputSync;',
    {
      runtime,
      catchUpLatestOutput: async () => calls.push('aux'),
      rebuildCurrent: async () => {
        calls.push('rebuild');
        return { encountersEnabled: true, lorebookEncounterEnabled: true };
      },
      scanLorebookEncounters: async () => calls.push('lore'),
      ensureRootInventory: async () => calls.push('ui'),
      fail: (where, error) => {
        throw error;
      }
    }
  );
  await sync();
  assert.deepEqual(calls, ['aux', 'rebuild', 'lore', 'ui']);
});

test('automatic lore scan invalidates on source edits, source removal and encounter removal', async () => {
  const lore = vm.runInNewContext(loreSource + '\nITEMXLorebook;');
  let scans = 0,
    writes = 0;
  let entries = [{ id: 'lore', key: 'Reimu', content: '[ITEMX-PUBLIC]\n종류: 무녀' }];
  const base = {
    monsters: { order: ['reimu'], entries: { reimu: { id: 'reimu', name: 'Reimu', kind: '미분류', aliases: [] } } }
  };
  let chat = { message: [], scriptstate: {} };
  const runtime = { detailHtmlCache: new Map(), generation: 0 };
  const scan = vm.runInNewContext(
    section('  async function scanLorebookEncounters(', '  async function notifyUser(') + '\nscanLorebookEncounters;',
    {
      runtime,
      context: async () => ({ key: 'a', characterIndex: 0, chatIndex: 0 }),
      lorebookEntries: async () => entries,
      enqueue: async (_key, task) => task(),
      Risuai: {
        getChatFromIndex: async () => chat,
        setChatToIndex: async (_a, _b, value) => {
          writes++;
          chat = value;
        }
      },
      buildMessageEventLookup: () => ({}),
      rebuildCodexWithLedger: () => base,
      encounterRegistryFingerprint: (value) => JSON.stringify(value),
      ITEMXCore: { fnv1a: (value) => value, clone: structuredClone },
      ITEMXLorebook: {
        ...lore,
        scan: (...args) => {
          scans++;
          return lore.scan(...args);
        }
      },
      ITEMX_LORE_KEY: '$__itemx2_lore_enrichment',
      rebuildCurrent: async () => {},
      debugRecord: () => {},
      notifyUser: async () => {}
    }
  );
  await scan({ silent: true });
  assert.equal(writes, 1);
  await scan({ silent: true });
  assert.equal(scans, 1);
  entries[0].content = '[ITEMX-PUBLIC]\n종류: 인간';
  await scan({ silent: true });
  assert.equal(writes, 2);
  entries = [];
  await scan({ silent: true });
  assert.equal(writes, 3);
  entries = [{ id: 'new-module', key: 'Reimu', content: '[ITEMX-PUBLIC]\n종류: 무녀' }];
  await scan({ silent: true });
  assert.equal(writes, 4);
  base.monsters = { order: [], entries: {} };
  await scan({ silent: true });
  assert.equal(writes, 5);
  await scan({ silent: true });
  assert.equal(scans, 5);
  await scan({ refresh: true, silent: true });
  assert.equal(scans, 6);
});
