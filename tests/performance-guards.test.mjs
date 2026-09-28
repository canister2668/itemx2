import test from 'node:test';
import { pendingAnchor, withMainStyle } from './helpers/ledger.mjs';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { rt, setHost, Session, Presentation, Panel } from './helpers/modules.mjs';
import { workQueue } from '../src/kernel.js';
import { configureHooks } from '../src/hooks.js';

const noop = () => {};
configureHooks({ process: noop, output: noop, display: noop, before: noop, after: noop, listener: noop });

test('post-commit remount quiet period lasts 1200 ms and never blocks a different context', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 10_000 });
  const fake = createFakeHost({ character: { chaId: 'guard' }, chat: { id: 'same', message: [], scriptstate: {} } });
  setHost(fake.api);
  Session.setActiveContextKey('guard:same');
  // Each pass that gets past the quiet period asks for the main document.
  const installs = () => fake.state.calls.filter((call) => call === 'getRootDocument').length;
  workQueue.remember('host-settling', 'guard:same');
  await Panel.ensureRootInventory();
  assert.equal(installs(), 0);
  t.mock.timers.tick(1199);
  await Panel.ensureRootInventory();
  assert.equal(installs(), 0);
  t.mock.timers.tick(1);
  await Panel.ensureRootInventory();
  assert.equal(installs(), 1);
  workQueue.remember('host-settling', 'guard:same');
  fake.state.chat.id = 'other';
  await Panel.ensureRootInventory();
  assert.equal(installs(), 2, 'a different chat is never held back by another chat commit');
  assert.equal(Session.activeContextKey(), 'guard:other');
});

test('marker and detail HTML caches retain their 64 and 60 entry limits', async () => {
  await withMainStyle(createFakeHost({ document: true }));
  for (let i = 0; i < 75; i++) {
    const item = rt.core.normalizeItem({ id: 'cache' + i, name: 'cache ' + i, count: 1 }).item;
    await rt.displayHandler(pendingAnchor({ event: { kind: 'exam', item }, view: item }));
    rt.itemDetailHtml(item);
  }
  assert.equal(Presentation.markerHtmlCacheSize(), 64);
  assert.equal(Panel.detailHtmlCacheSize(), 60);
});

test('portrait caches keep the 24 image, 16 MiB and 64 thumbnail limits', async () => {
  let run = 0;
  for (const [count, image] of [
    [70, 'data:image/png;base64,AA=='],
    [12, 'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024)]
  ]) {
    const fake = createFakeHost();
    fake.api.readImage = async () => image;
    setHost(fake.api);
    Session.setActiveContextKey(`cache-${++run}`);
    const assets = Array.from({ length: count }, (_, i) => ['Face' + i, `asset${run}-${i}`, 'png']);
    const monsters = Object.fromEntries(
      assets.map(([portrait], i) => [
        'm' + i,
        { id: 'm' + i, name: portrait, portrait, status: 'active', relation: 'hostile' }
      ])
    );
    await rt.loadCodexPortraits(
      { chaId: `cache-${run}`, additionalAssets: assets },
      { message: [] },
      { monsters: { order: Object.keys(monsters), entries: monsters } },
      { moduleAssetsEnabled: false }
    );
    const stats = rt.portraitCacheStats();
    assert.ok(stats.images > 0);
    assert.ok(stats.images <= 24);
    assert.ok(stats.imageBytes <= 16 * 1024 * 1024);
    assert.ok(stats.thumbnails <= 64);
  }
});
