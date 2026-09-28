import test from 'node:test';
import assert from 'node:assert/strict';
import { anchored } from './helpers/ledger.mjs';
import { createFakeHost, settle } from './helpers/fake-host.mjs';
import { loadBundle } from './helpers/bundle.mjs';
import { rt, setHost, Session, Style, uiState } from './helpers/modules.mjs';
import { on } from '../src/events.js';

// Intervals and page listeners of one bundle instance, recorded.
function lifecycleGlobals() {
  const intervals = new Map(),
    listeners = [],
    docListeners = [];
  let serial = 0;
  const document = {
    visibilityState: 'visible',
    addEventListener: (type, handler) => docListeners.push({ type, handler }),
    removeEventListener: (type, handler) =>
      docListeners.splice(
        docListeners.findIndex((l) => l.handler === handler),
        1
      )
  };
  return {
    intervals,
    listeners,
    docListeners,
    fire: (type) => [...listeners, ...docListeners].filter((l) => l.type === type).forEach((l) => l.handler()),
    globals: {
      setInterval: (fn, ms) => (intervals.set(++serial, ms), serial),
      clearInterval: (id) => intervals.delete(id),
      addEventListener: (type, handler) => listeners.push({ type, handler }),
      removeEventListener: (type, handler) =>
        listeners.splice(
          listeners.findIndex((l) => l.handler === handler),
          1
        ),
      document
    }
  };
}

test('watchdogs arm at their mode interval and nothing rearms after unload', async () => {
  const life = lifecycleGlobals();
  const host = createFakeHost({ document: true });
  await loadBundle(host.api, life.globals);
  await settle(30);
  // The mutation observer makes the remount watchdog a slow safety net.
  assert.deepEqual(
    [...life.intervals.values()].sort((a, b) => a - b),
    [10000, 45000, 30 * 60 * 1000]
  );
  await host.state.unload();
  assert.equal(life.intervals.size, 0);
});

test('a backgrounded tab resumes once, rebinds hooks without model calls, and unload unbinds', async () => {
  const life = lifecycleGlobals();
  const host = createFakeHost({ document: true });
  await loadBundle(host.api, life.globals);
  await settle(30);
  const adds = () => host.state.calls.filter((call) => call === 'addRisuScriptHandler:display').length;
  const before = adds();
  life.fire('pageshow');
  await settle(120);
  assert.equal(adds(), before, 'a visible tab that never went away does not recover');
  life.fire('pagehide');
  life.fire('pageshow');
  life.fire('focus');
  life.fire('visibilitychange');
  await settle(150);
  assert.equal(adds(), before + 1, 'one coalesced recovery rebinds the hooks once');
  assert.equal(host.state.llmCalls.length, 0, 'resume never regenerates auxiliary output');
  await host.state.unload();
  assert.equal(life.listeners.length, 0);
  assert.equal(life.docListeners.length, 0);
});

test('closing reflects native class removal even when the settings bridge fails', async () => {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  fake.dom
    .body()
    .setHtml('<div class="x-risu-itemx2-root-drawer x-risu-itemx2-is-open" x-itemx2-drawer="owner"></div>');
  const [drawer] = await (await fake.api.getRootDocument()).querySelectorAll('[x-itemx2-drawer="owner"]');
  uiState.rootDrawer = drawer;
  uiState.rootOpen = true;
  fake.api.unwarpSafeArray = async () => {
    throw new Error('bridge');
  };
  await rt.setRootOpen(false);
  assert.equal(uiState.rootOpen, false);
  assert.equal(fake.dom.root.find('.x-risu-itemx2-is-open').length, 0);
  uiState.rootDrawer = null;
});

test('a committed output sync announces one UI sync after the rebuild', async () => {
  const fake = createFakeHost({ character: { chaId: 'sync' } });
  setHost(fake.api);
  Session.resetSession('sync:chat');
  let synced = 0;
  const off = on('chat-synced', () => synced++);
  await rt.scheduleCommittedOutputSync();
  assert.equal(synced, 1);
  off();
});

test('automatic lore scan invalidates on source edits, source removal and encounter removal', async () => {
  const exam = rt.codex.extractResponse(
    '<monsterExam><id>reimu</id><name>Reimu</name><type>미분류</type><status>active</status></monsterExam>'
  );
  const lorebook = [{ id: 'lore', key: 'Reimu', content: '[ITEMX-PUBLIC]\n종류: 무녀' }];
  const fake = createFakeHost({
    character: { chaId: 'lore' },
    chat: anchored({
      id: 'chat',
      message: [{ role: 'char', chatId: 'm0', data: `레이무와 싸웠다.\n${exam.content}` }],
      scriptstate: {}
    }),
    lorebook
  });
  setHost(fake.api);
  Session.resetSession('lore:chat');
  let scans = 0;
  const scan = async (options) => {
    scans++;
    return rt.scanLorebookEncounters(options);
  };
  const writes = () => fake.state.writes;
  const changed = async (options = { silent: true }) => (await scan(options))?.changed;
  assert.equal(await changed(), true);
  assert.equal(writes(), 1);
  assert.equal(await changed(), false, 'an unchanged source is not scanned again');
  lorebook[0].content = '[ITEMX-PUBLIC]\n종류: 인간';
  assert.equal(await changed(), true);
  lorebook.length = 0;
  assert.equal(await changed(), true, 'a removed source removes its enrichment');
  lorebook.push({ id: 'new-module', key: 'Reimu', content: '[ITEMX-PUBLIC]\n종류: 무녀' });
  assert.equal(await changed(), true);
  const loaded = await rt.rebuildCurrent();
  await rt.commitManualEvents(
    loaded,
    [{ domain: 'monster', kind: 'patch', manual: true, patch: { id: 'reimu', action: null, op: 'purge', fields: {} } }],
    'purge',
    undefined,
    false
  );
  assert.equal(writes(), 5);
  assert.equal(await changed(), true, 'a removed encounter drops its enrichment');
  assert.equal(writes(), 6);
  assert.equal(await changed({ refresh: true, silent: true }), false);
  assert.equal(scans, 7);
});
