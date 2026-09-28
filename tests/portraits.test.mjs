import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost, settle } from './helpers/fake-host.mjs';
import { rt, setHost, Session, Style, uiState } from './helpers/modules.mjs';
import { dispatch } from '../src/kernel.js';
import { pendingAnchor } from './helpers/ledger.mjs';

const monster = (extra = {}) => ({
  id: 'mayuri',
  name: '마유리',
  portrait: 'Mayuri',
  glyph: '🪓',
  status: 'active',
  relation: 'hostile',
  ...extra
});
const marker = (entity) => pendingAnchor({ event: { domain: 'monster', kind: 'exam', entity }, view: entity });
let unique = 0;
const character = (ext = 'png', count = 1) => {
  const chaId = `portrait-${++unique}`;
  return {
    chaId,
    additionalAssets:
      count === 1
        ? [['Mayuri', `assets/${chaId}.png`, ext]]
        : Array.from({ length: count }, (_, i) => [`M${i}`, `assets/${chaId}-${i}.png`, ext])
  };
};

test('list, detail and inline portraits share one image read', async () => {
  const reads = [];
  const fake = createFakeHost({ document: true });
  fake.api.readImage = async (id) => (reads.push(id), [0, 0, 0, 20, 102, 116, 121, 112, 97, 118, 105, 102]);
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  const who = character('avif');
  Session.resetSession('murim');
  const entity = monster();
  const loaded = {
    key: 'murim',
    character: who,
    chat: { message: [] },
    codexSnapshot: { monsters: { order: ['mayuri'], entries: { mayuri: entity } } }
  };
  const list = await rt.loadCodexPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded);
  assert.match(list.mayuri, /^data:image\/avif;base64,/);
  // The checked bestiary detail is hydrated from the entity, not from a list copy.
  fake.dom
    .body()
    .setHtml(
      '<input class="x-risu-itemx2-monster-entry-choice" checked><div class="x-risu-itemx2-monster-detail"><span class="x-risu-itemx2-codex-detail-index">0</span></div><div class="x-risu-itemx2-root-monster-detail-body-0"></div>'
    );
  uiState.query = '';
  assert.equal(await rt.hydrateCheckedCodexDetail('monster', loaded), true);
  const detail = fake.dom.root.find('.x-risu-itemx2-root-monster-detail-body-0')[0].html();
  assert.match(detail, /class="x-risu-itemx-monster-portrait" src="data:image\/avif;base64,/);
  rt.prepareInlinePortraits(loaded, loaded.codexSnapshot, { moduleAssetsEnabled: false });
  await settle(5);
  assert.match(await rt.displayHandler(marker(entity)), /itemx2-inline-icon"><img src="data:image\/avif;base64,/);
  assert.equal(reads.length, 1, 'list, detail and inline share the asset cache');
  const unknown = monster({ id: 'brigands', name: '이름 없는 도적들', portrait: 'NONE' });
  assert.match(await rt.displayHandler(marker(unknown)), /itemx2-inline-icon"><span>🪓/);
});

test('cold concurrent display of pending cards makes no host calls', async () => {
  let hostCalls = 0;
  setHost(new Proxy({}, { get: () => () => (hostCalls++, new Promise(() => {})) }));
  Session.resetSession('murim-cold');
  for (let i = 0; i < 100; i++) {
    const html = await rt.displayHandler(marker(monster()));
    assert.equal(typeof html, 'string', 'display must not wait for any host promise');
    assert.match(html, /마유리/);
  }
  assert.equal(hostCalls, 0);
});

test('portrait preparation coalesces concurrent work and never leaks across chats', async () => {
  let reads = 0;
  const fake = createFakeHost();
  fake.api.readImage = () => (reads++, new Promise(() => {}));
  setHost(fake.api);
  Session.resetSession('murim-stall');
  const ctx = { key: 'murim-stall', character: character('avif'), chat: { message: [] } };
  const snapshot = { monsters: { order: ['mayuri'], entries: { mayuri: monster() } } };
  for (let i = 0; i < 20; i++)
    assert.equal(rt.prepareInlinePortraits(ctx, snapshot, { moduleAssetsEnabled: false }), undefined);
  await settle(5);
  assert.equal(reads, 1, 'only one in-flight image read despite concurrent recovery and rebuild');
  assert.equal(typeof (await rt.displayHandler(marker(monster()))), 'string');
  assert.equal(reads, 1, 'display must not retry a stalled image');
  Session.resetSession('another-chat');
  assert.doesNotMatch(await rt.displayHandler(marker(monster())), /<img/, 'old chat portraits must not leak');
});

test('large originals never enter inline HTML or the inline-only original cache', async () => {
  const full = 'data:image/png;base64,' + 'A'.repeat(300000);
  const fake = createFakeHost();
  fake.api.readImage = async () => full;
  setHost(fake.api);
  Session.resetSession('murim-large');
  const who = character('png');
  const snapshot = { monsters: { order: ['mayuri'], entries: { mayuri: monster() } } };
  const before = rt.portraitCacheStats().images;
  await rt.loadCodexPortraits(who, { message: [] }, snapshot, { moduleAssetsEnabled: false }, true);
  assert.equal(rt.portraitCacheStats().images, before, 'inline preparation must not retain original images');
  const html = await rt.displayHandler(marker(monster()));
  assert.equal(html.includes(full), false);
  assert.match(html, /itemx2-inline-icon"><span>🪓/, 'no thumbnail API: fall back instead of embedding the original');
  const details = await rt.loadCodexPortraits(who, { message: [] }, snapshot, { moduleAssetsEnabled: false });
  assert.equal(details.mayuri, full, 'detail keeps its original portrait');
});

test('history pages load only visible portraits and a late selected record gets its original', async () => {
  const reads = [];
  const fake = createFakeHost();
  fake.api.readImage = async (id) => (reads.push(id), 'data:image/png;base64,AAAA');
  setHost(fake.api);
  Session.resetSession('history');
  const who = character('png', 33);
  const entities = Object.fromEntries(
    Array.from({ length: 33 }, (_, i) => [
      `m${i}`,
      { id: `m${i}`, name: `상대${i}`, portrait: `M${i}`, glyph: '👺', status: 'ended', active: false }
    ])
  );
  const loaded = {
    key: 'history',
    character: who,
    chat: { message: [], scriptstate: {} },
    moduleAssetsEnabled: false,
    snapshot: { registry: { order: [], items: {} } },
    codexSnapshot: { monsters: { order: Object.keys(entities), entries: entities }, history: { monster: {} } }
  };
  uiState.historyView = { open: true, key: 'history', domain: 'monster', filter: 'recent', page: 1, selected: null };
  await rt.prepareHistoryPortraits(loaded);
  assert.equal(reads.length, 16);
  assert.equal(Object.keys(loaded.historyThumbnails).length, 16);
  assert.match(rt.historyHtml(loaded), /<img[^>]+data:image\/png;base64,AAAA/);
  uiState.historyView.selected = 'm32';
  await rt.prepareHistoryPortraits(loaded);
  assert.equal(reads.length, 17);
  assert.equal(reads.at(-1), `assets/${who.chaId}-32.png`);
  assert.equal(loaded.portraits.m32, 'data:image/png;base64,AAAA');
  assert.match(rt.historyHtml(loaded), /class="itemx-monster-portrait" src="data:image\/png;base64,AAAA/);
});

test('a stalled portrait read yields the queue to a host output hook', async () => {
  let release, started;
  const begun = new Promise((resolve) => (started = resolve));
  const fake = createFakeHost();
  fake.api.readImage = () => (started(), new Promise((resolve) => (release = resolve)));
  setHost(fake.api);
  Session.resetSession('ctx');
  const who = character('png');
  const pending = dispatch('portraits', () =>
    rt.loadCodexPortraits(
      who,
      { message: [] },
      { monsters: { order: ['mayuri'], entries: { mayuri: monster() } } },
      { moduleAssetsEnabled: false },
      true
    )
  );
  await begun;
  let handled = false;
  const hook = dispatch('output', () => {
    handled = true;
  });
  await settle(20);
  const before = handled;
  release('data:image/png;base64,AAAA');
  await pending;
  await hook;
  assert.equal(before, true, 'the host hook must run before the image returns');
});

test('all missing portraits share one finite I/O budget', async (t) => {
  let reads = 0;
  const fake = createFakeHost();
  fake.api.readImage = () => (reads++, new Promise(() => {}));
  setHost(fake.api);
  Session.resetSession('ctx-budget');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const who = character('png', 20);
  const entities = Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i, name: 'M' + i, portrait: 'M' + i }));
  let done = false;
  const loading = rt
    .loadCodexPortraits(
      who,
      { message: [] },
      { monsters: { order: entities.map((e) => e.id), entries: Object.fromEntries(entities.map((e) => [e.id, e])) } },
      { moduleAssetsEnabled: false },
      true
    )
    .finally(() => (done = true));
  for (let i = 0; i < 200 && !done; i++) {
    t.mock.timers.tick(100);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(done, true, 'the batch must finish once its budget is spent');
  assert.equal(Object.keys(await loading).length, 0);
  assert.ok(reads <= 4, 'a timeout does not start the remaining image batches');
});
