import test from 'node:test';
import assert from 'node:assert/strict';
import { rt, uiState, setHost, Style } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';

const LOADED = {
  key: 'c0:ch0',
  enabled: true,
  mainOutput: true,
  auxOutput: 'off',
  rarityMode: 'itemx',
  itemsEnabled: true,
  skillsEnabled: true,
  encountersEnabled: false,
  lorebookEncounterEnabled: false,
  moduleAssetsEnabled: true,
  effectsLevel: 'full',
  debugEnabled: false,
  fontScale: 'small',
  skin: 'dark',
  character: { name: 'T' },
  // One message still carrying a marker of 2.3: its removal control renders.
  chat: { message: [{ chatId: 'a', data: 'text <!--ITEMX2@i0_0_abc-->' }], scriptstate: {} },
  snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
  codexSnapshot: {
    skills: { order: [], entries: {} },
    monsters: { order: [], entries: {} },
    history: { skill: {}, monster: {} },
    fingerprint: 'b'
  }
};

// The action table serves the whole drawer, not the settings body alone: the
// power control lives in the header now. Render the panel the router sees.
function drawerSettings(rt) {
  return rt.rootInventoryHtml(LOADED, true, 'settings');
}

test('the drawer dispatches settings from one ordered table', async () => {
  const hooks = rt.rootSettingActions().map((a) => a.hook);
  assert.equal(hooks.length, 39);
  assert.equal(new Set(hooks).size, hooks.length, 'duplicate hook would shadow a later control');
  for (const action of rt.rootSettingActions()) assert.equal(typeof action.run, 'function');
});

// Dispatch is first-match-wins, so the order is behaviour, not decoration.
test('the table keeps the dispatch order the chain had', async () => {
  const hooks = rt.rootSettingActions().map((a) => a.hook);
  const expected = [
    'itemx2-setting-connect',
    'itemx2-setting-aux-run',
    'itemx2-position-lb',
    'itemx2-position-lm',
    'itemx2-position-lt',
    'itemx2-position-rb',
    'itemx2-position-rm',
    'itemx2-position-rt',
    'itemx2-setting-toggle',
    'itemx2-setting-domain-items',
    'itemx2-setting-domain-skills',
    'itemx2-setting-domain-encounters',
    'itemx2-setting-debug',
    'itemx2-setting-debug-clear',
    'itemx2-setting-main',
    'itemx2-seg-aux-off',
    'itemx2-seg-aux-missing',
    'itemx2-seg-aux-always',
    'itemx2-seg-rarity-world',
    'itemx2-seg-rarity-itemx',
    'itemx2-seg-fx-full',
    'itemx2-seg-fx-lite',
    'itemx2-seg-fx-off',
    'itemx2-seg-skin-dark',
    'itemx2-seg-skin-frost',
    'itemx2-seg-skin-hanji',
    'itemx2-setting-lorebook',
    'itemx2-setting-lorebook-scan',
    'itemx2-setting-module-assets',
    'itemx2-setting-font-small',
    'itemx2-setting-font-medium',
    'itemx2-setting-font-large',
    'itemx2-setting-storage-cleanup',
    'itemx2-setting-cleanup',
    'itemx2-setting-old-markers',
    'itemx2-setting-old-markers-cancel',
    'itemx2-setting-storage-cleanup-cancel',
    'itemx2-setting-cleanup-cancel',
    'itemx2-setting-rebuild'
  ];
  assert.deepEqual([...hooks], expected);
});

// This cross-check was impossible while dispatch was a hand-written chain: a
// control could be rendered with no branch to catch it, or a branch could point
// at a class nothing rendered any more, and only a user would find out.
test('every rendered drawer control has a table row', async () => {
  const html = drawerSettings(rt);
  const rendered = new Set(
    [...html.matchAll(/class="([^"]*)"/g)]
      .flatMap((m) => m[1].trim().split(/\s+/))
      .filter((c) => /^itemx2-(setting-|seg-|position-)/.test(c))
  );
  // State classes and controls routed before the settings table are not rows.
  const NOT_ROWS = new Set([
    'itemx2-setting-on',
    'itemx2-setting-cleanup-armed',
    'itemx2-setting-danger',
    'itemx2-setting-font-small',
    'itemx2-setting-font-medium',
    'itemx2-setting-font-large',
    'itemx2-setting-backup',
    'itemx2-position-choice',
    'itemx2-position-on',
    'itemx2-position-screen',
    'itemx2-position-hint',
    'itemx2-position-map',
    'itemx2-position-grid',
    'itemx2-seg-btn',
    'itemx2-seg-on'
  ]);
  const hooks = new Set(rt.rootSettingActions().map((a) => a.hook));
  const orphaned = [...rendered].filter((c) => !hooks.has(c) && !NOT_ROWS.has(c));
  assert.deepEqual(orphaned, [], 'rendered control with no action row');
});

test('no table row points at a class the drawer never renders', async () => {
  // The "no" buttons exist only while a destructive action waits for its yes / no answer.
  uiState.cleanupArmed = true;
  uiState.storageCleanupArmed = true;
  uiState.oldMarkersArmed = true;
  const confirming = drawerSettings(rt);
  uiState.cleanupArmed = false;
  uiState.storageCleanupArmed = false;
  uiState.oldMarkersArmed = false;
  const html = drawerSettings(rt) + confirming;
  // Font and position choices come from helpers the fixture renders separately.
  const missing = [...rt.rootSettingActions().map((a) => a.hook)].filter(
    (hook) => !html.includes(hook) && !/itemx2-setting-debug(-clear)?$/.test(hook)
  );
  assert.deepEqual(missing, [], 'action row with nothing to click');
});

// Dispatch itself: lay the controls out as a column of 30px rows in a fake main
// document and check a click lands on exactly the intended row.
// Installs a fake main document whose controls are rows of the given hooks.
async function fakeMainDoc(hooks, offset = 0) {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  const body = fake.dom.body();
  const rects = new Map();
  for (const [i, hook] of hooks.entries()) {
    const rect = { left: 0, right: 100, top: offset + i * 30, bottom: offset + i * 30 + 28, width: 100, height: 28 };
    rects.set(hook, rect);
  }
  body.setHtml(hooks.map((hook) => `<button class="x-risu-${hook}"></button>`).join(''));
  fake.dom.doc.layout = (node) => rects.get(node.classes[0]?.replace(/^x-risu-/, ''));
  return { rects };
}

async function dispatch(rt, event) {
  for (const action of rt.rootSettingActions()) {
    if (!(await rt.eventHitsMainClass(event, action.hook))) continue;
    return action.hook;
  }
  return null;
}

test('a click resolves to exactly one action row', async () => {
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  await fakeMainDoc(hooks);
  for (const [index, hook] of hooks.entries()) {
    const hit = await dispatch(rt, { clientX: 50, clientY: index * 30 + 14 });
    assert.equal(hit, hook, `click on row ${index} resolved to ${hit}`);
  }
});

test('a click in the gutter between controls resolves to nothing', async () => {
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  await fakeMainDoc(hooks);
  assert.equal(await dispatch(rt, { clientX: 50, clientY: 29 }), null);
  assert.equal(await dispatch(rt, { clientX: 400, clientY: 14 }), null);
});

test('a collapsed control is not hit at the origin', async () => {
  const hooks = [...rt.rootSettingActions().map((a) => a.hook)];
  // Lay the panel out below the origin so nothing legitimately covers (0,0).
  const { rects } = await fakeMainDoc(hooks, 100);
  // A closed <details> reports an all-zero rect for the controls inside it.
  rects.set('itemx2-setting-debug', { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
  assert.equal(await dispatch(rt, { clientX: 0, clientY: 0 }), null);
  // and the rest of the panel still dispatches normally
  assert.equal(await dispatch(rt, { clientX: 50, clientY: 114 }), hooks[0]);
});
