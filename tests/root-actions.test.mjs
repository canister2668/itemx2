import { runtimeSource, styleSources } from '../scripts/runtime-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const LOADED = {
  key: 'c0:ch0', enabled: true, mainOutput: true, auxOutput: 'off', rarityMode: 'itemx',
  itemsEnabled: true, skillsEnabled: true, encountersEnabled: false,
  lorebookEncounterEnabled: false, moduleAssetsEnabled: true, effectsEnabled: true,
  debugEnabled: false, fontScale: 'small', skin: 'dark',
  character: { name: 'T' }, chat: { message: [], scriptstate: {} },
  snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
  codexSnapshot: {
    skills: { order: [], entries: {} }, monsters: { order: [], entries: {} },
    history: { skill: {}, monster: {} }, fingerprint: 'b'
  }
};

// The action table serves the whole drawer, not the settings body alone: the
// power control lives in the header now. Render the panel the router sees.
function drawerSettings(rt) {
  return rt.rootInventoryHtml(LOADED, true, 'settings');
}

function settingsBodyOnly(rt) {
  const skin = rt.SETTINGS_SKINS.native;
  return rt.settingsPanelHtml(LOADED, skin, {
    connection: { ready: false }, chips: '', permissionLabel: '', styleLabel: '',
    domainControls: rt.settingsDomainControls(LOADED, skin),
    fontChoices: rt.settingsFontChoices(LOADED, skin),
    positionChoices: rt.settingsPositionChoices(skin),
    manager: '', debugPanel: '', ...rt.settingsStorageParts(LOADED)
  });
}

test('the drawer dispatches settings from one ordered table', async () => {
  const rt = await presentationRuntime();
  const hooks = rt.rootSettingActions().map((a) => a.hook);
  assert.equal(hooks.length, 33);
  assert.equal(new Set(hooks).size, hooks.length, 'duplicate hook would shadow a later control');
  for (const action of rt.rootSettingActions()) assert.equal(typeof action.run, 'function');
});

// Dispatch is first-match-wins, so the order is behaviour, not decoration.
test('the table keeps the dispatch order the chain had', async () => {
  const rt = await presentationRuntime();
  const hooks = rt.rootSettingActions().map((a) => a.hook);
  const expected = [
    'itemx2-setting-connect', 'itemx2-setting-aux-run',
    'itemx2-position-lb', 'itemx2-position-lm', 'itemx2-position-lt',
    'itemx2-position-rb', 'itemx2-position-rm', 'itemx2-position-rt',
    'itemx2-setting-toggle',
    'itemx2-setting-domain-items', 'itemx2-setting-domain-skills', 'itemx2-setting-domain-encounters',
    'itemx2-setting-debug', 'itemx2-setting-debug-clear', 'itemx2-setting-main',
    'itemx2-seg-aux-off', 'itemx2-seg-aux-missing', 'itemx2-seg-aux-always',
    'itemx2-seg-rarity-world', 'itemx2-seg-rarity-itemx',
    'itemx2-seg-skin-dark', 'itemx2-seg-skin-frost', 'itemx2-seg-skin-hanji',
    'itemx2-setting-effects', 'itemx2-setting-lorebook', 'itemx2-setting-lorebook-scan',
    'itemx2-setting-module-assets',
    'itemx2-setting-font-small', 'itemx2-setting-font-medium', 'itemx2-setting-font-large',
    'itemx2-setting-storage-cleanup', 'itemx2-setting-cleanup', 'itemx2-setting-rebuild'
  ];
  assert.deepEqual([...hooks], expected);
});

// This cross-check was impossible while dispatch was a hand-written chain: a
// control could be rendered with no branch to catch it, or a branch could point
// at a class nothing rendered any more, and only a user would find out.
test('every rendered drawer control has a table row', async () => {
  const rt = await presentationRuntime();
  const html = drawerSettings(rt);
  const rendered = new Set(
    [...html.matchAll(/class="([^"]*)"/g)]
      .flatMap((m) => m[1].trim().split(/\s+/))
      .filter((c) => /^itemx2-(setting-|seg-|position-)/.test(c))
  );
  // State classes and controls routed before the settings table are not rows.
  const NOT_ROWS = new Set([
    'itemx2-setting-on', 'itemx2-setting-cleanup-armed', 'itemx2-setting-font-small',
    'itemx2-setting-font-medium', 'itemx2-setting-font-large', 'itemx2-setting-backup',
    'itemx2-position-choice', 'itemx2-position-on', 'itemx2-position-screen', 'itemx2-position-hint',
    'itemx2-position-map', 'itemx2-position-grid', 'itemx2-seg-btn', 'itemx2-seg-on'
  ]);
  const hooks = new Set(rt.rootSettingActions().map((a) => a.hook));
  const orphaned = [...rendered].filter((c) => !hooks.has(c) && !NOT_ROWS.has(c));
  assert.deepEqual(orphaned, [], 'rendered control with no action row');
});

test('no table row points at a class the drawer never renders', async () => {
  const rt = await presentationRuntime();
  const html = drawerSettings(rt);
  // Font and position choices come from helpers the fixture renders separately.
  const missing = [...rt.rootSettingActions().map((a) => a.hook)].filter(
    (hook) => !html.includes(hook) && !/itemx2-setting-debug(-clear)?$/.test(hook)
  );
  assert.deepEqual(missing, [], 'action row with nothing to click');
});

test('the router dispatches through the table, not a coordinate chain', async () => {
  const source = await runtimeSource();
  assert.match(source, /for \(const action of rootSettingActions\(\)\) \{\s*if \(!\(await eventHitsMainClass\(event, action\.hook\)\)\) continue;/);
  // The chain was 24 copies of the same four-way comparison.
  const router = source.slice(source.indexOf('const routeControls = async'), source.indexOf("fail('native setting click'"));
  const comparisons = (router.match(/event\.clientX [<>]=? rect\.left/g) || []).length;
  assert.ok(comparisons <= 8, `router still hand-compares ${comparisons} rects`);
});

test('a hidden control cannot be hit at the origin', async () => {
  const source = await runtimeSource();
  // A collapsed <details> reports a zero rect; without this guard a click at
  // (0,0) would match every hidden control at once.
  const helper = source.slice(source.indexOf('async function eventHitsMainClass'));
  assert.match(helper.slice(0, 400), /rect\.width > 0 &&\s*rect\.height > 0/);
});

// Dispatch itself: lay the controls out as a column of 30px rows in a fake main
// document and check a click lands on exactly the intended row.
function fakeMainDoc(hooks, offset = 0) {
  const rects = new Map(
    hooks.map((hook, i) => [
      hook,
      { left: 0, right: 100, top: offset + i * 30, bottom: offset + i * 30 + 28, width: 100, height: 28 }
    ])
  );
  return {
    rects,
    doc: {
      async querySelector(selector) {
        const hook = selector.replace(/^\.(x-risu-)?/, '');
        const rect = rects.get(hook);
        return rect ? { getBoundingClientRect: async () => rect } : null;
      }
    }
  };
}

async function dispatch(rt, event) {
  for (const action of rt.rootSettingActions()) {
    if (!(await rt.eventHitsMainClass(event, action.hook))) continue;
    return action.hook;
  }
  return null;
}

test('a click resolves to exactly one action row', async () => {
  const rt = await presentationRuntime();
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  const { doc } = fakeMainDoc(hooks);
  rt.runtime.mainDoc = doc;
  for (const [index, hook] of hooks.entries()) {
    const hit = await dispatch(rt, { clientX: 50, clientY: index * 30 + 14 });
    assert.equal(hit, hook, `click on row ${index} resolved to ${hit}`);
  }
});

test('a click in the gutter between controls resolves to nothing', async () => {
  const rt = await presentationRuntime();
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  rt.runtime.mainDoc = fakeMainDoc(hooks).doc;
  assert.equal(await dispatch(rt, { clientX: 50, clientY: 29 }), null);
  assert.equal(await dispatch(rt, { clientX: 400, clientY: 14 }), null);
});

test('a collapsed control is not hit at the origin', async () => {
  const rt = await presentationRuntime();
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  // Lay the panel out below the origin so nothing legitimately covers (0,0).
  const { doc, rects } = fakeMainDoc(hooks, 100);
  // A closed <details> reports an all-zero rect for the controls inside it.
  rects.set('itemx2-setting-debug', { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
  rt.runtime.mainDoc = doc;
  assert.equal(await dispatch(rt, { clientX: 0, clientY: 0 }), null);
  // and the rest of the panel still dispatches normally
  assert.equal(await dispatch(rt, { clientX: 50, clientY: 114 }), hooks[0]);
});
