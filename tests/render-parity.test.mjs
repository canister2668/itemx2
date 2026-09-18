import { runtimeSource, styleSources } from '../scripts/runtime-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const src = () => runtimeSource();

const LOADED = {
  key: 'c0:ch0', enabled: true, mainOutput: true, auxOutput: 'off', rarityMode: 'itemx',
  itemsEnabled: true, skillsEnabled: true, encountersEnabled: false,
  lorebookEncounterEnabled: false, moduleAssetsEnabled: true, effectsEnabled: true,
  debugEnabled: false, fontScale: 'small', skin: 'dark',
  character: { name: '테스트' }, chat: { message: [], scriptstate: {} },
  snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
  codexSnapshot: {
    skills: { order: [], entries: {} }, monsters: { order: [], entries: {} },
    history: { skill: {}, monster: {} }, fingerprint: 'b'
  }
};

function renderSettings(rt, which) {
  const skin = rt.SETTINGS_SKINS[which];
  return rt.settingsPanelHtml(LOADED, skin, {
    connection: { ready: false, hook: ['훅', 'warn'], dom: ['화면', 'warn'], listener: ['커밋', 'warn'] },
    chips: '', permissionLabel: '허용', styleLabel: '고정',
    domainControls: rt.settingsDomainControls(LOADED, skin),
    fontChoices: rt.settingsFontChoices(LOADED, skin),
    positionChoices: rt.settingsPositionChoices(skin),
    manager: '', debugPanel: '', ...rt.settingsStorageParts(LOADED)
  });
}

const cardTitles = (html) =>
  [...html.matchAll(/<section class="itemx2-root-setting-card"><span><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);

// Every historical settings regression (2.0.23, 2.0.25, 2.0.26) came from editing
// one of two parallel templates. There is now exactly one.
test('the settings panel has a single renderer', async () => {
  const source = await src();
  assert.equal((source.match(/function settingsPanelHtml\(/g) || []).length, 1);
  assert.equal((source.match(/const settings = `<div class="itemx2-root-settings">/g) || []).length, 0);
  assert.equal((source.match(/const settingsContent = `<div class="itemx-settings">/g) || []).length, 0);
  assert.equal((source.match(/settingsPanelHtml\(loaded, skin, \{/g) || []).length, 1);
});

test('both skins render the same controls in the same order', async () => {
  const rt = await presentationRuntime();
  const drawer = cardTitles(renderSettings(rt, 'native'));
  const fallback = cardTitles(renderSettings(rt, 'frame'));
  // The fallback exists because main-document access was refused, so it swaps the
  // drawer's single connect action for the two repair actions. Nothing else differs.
  assert.deepEqual(drawer.slice(0, 1), ['Risu 연결']);
  assert.deepEqual(fallback.slice(0, 2), ['모델 처리 권한', '본문 카드 스타일']);
  assert.deepEqual(drawer.slice(1), fallback.slice(2), 'the two skins drifted apart');
});

test('each skin binds every control its own way and never both', async () => {
  const rt = await presentationRuntime();
  const drawer = renderSettings(rt, 'native');
  const fallback = renderSettings(rt, 'frame');
  // The backup card carries both hooks because the backup screen is opened from
  // the drawer and the fallback alike; everything else is skin-specific.
  assert.deepEqual(
    (drawer.match(/data-action="([^"]*)"/g) || []).map((x) => x.slice(13, -1)),
    ['backup'],
    'the drawer routes by class, not by attribute'
  );
  assert.ok(!/class="[^"]*itemx2-setting-toggle/.test(fallback), 'the fallback routes by attribute, not class');
  for (const action of ['toggle', 'effects', 'module-assets', 'lorebook-scan', 'rebuild', 'storage-cleanup'])
    assert.ok(fallback.includes(`data-action="${action}"`), `fallback lost ${action}`);
  // The drawer's router looks these up by class, including its three aliases.
  for (const hook of ['toggle', 'main', 'lorebook', 'cleanup', 'effects', 'rebuild', 'storage-cleanup'])
    assert.ok(drawer.includes(`itemx2-setting-${hook}`), `drawer lost itemx2-setting-${hook}`);
});

test('every control is a real button with an explicit type', async () => {
  const rt = await presentationRuntime();
  for (const which of ['native', 'frame']) {
    const html = renderSettings(rt, which);
    const buttons = html.match(/<button[^>]*>/g) || [];
    assert.ok(buttons.length > 15, `${which} rendered too few controls`);
    for (const button of buttons) assert.match(button, /type="button"/, `${which}: ${button.slice(0, 80)}`);
  }
});

test('the settings surface is styled in both documents', async () => {
  const source = await src();
  // The fallback renders the drawer's markup, so the surface cannot live in a
  // drawer-only stylesheet any more.
  assert.match(source, /const ITEMX_SETTINGS_STYLE = `/);
  assert.match(source, /\$\{ITEMX_SETTINGS_STYLE\}/);
  assert.match(source, /document.head.innerHTML = fallbackDocumentHead\(\)/);
  const iframeStyle = source.slice(source.indexOf('function fallbackDocumentHead'));
  assert.ok(iframeStyle.includes('${ITEMX_SETTINGS_STYLE}'), 'the iframe must include the shared surface');
  // The radio-tab mechanism that hides the pane stays with the drawer.
  assert.ok(!/const ITEMX_SETTINGS_STYLE = `[^`]*itemx2-root-settings\{[^}]*display:none/.test(source));
});

test('both renderers carry one irreversible-actions zone', async () => {
  const rt = await presentationRuntime();
  for (const which of ['native', 'frame'])
    assert.equal((renderSettings(rt, which).match(/itemx2-danger-zone/g) || []).length, 1);
});

test('the freeze banner is rendered from one shared function', async () => {
  const source = await src();
  assert.equal((source.match(/function frozenBannerHtml\(/g) || []).length, 1);
  assert.ok(source.includes('${frozenBannerHtml(true)}'));
  assert.match(source, /root.innerHTML = rootInventoryHtml\(loaded, true, tab\)/);
});

test('the iframe shell layer never reaches the shipped chat scope', async () => {
  const shell = await styleSources().then(styles => styles.shell);
  const cardsCss = await styleSources().then(styles => styles.cards);
  const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  assert.ok(shell.includes('.stage '), 'shell.css must own the iframe stage layout');
  assert.ok(!cardsCss.includes('.lab-title'), 'preview chrome leaked into the shipped card surface');
  for (const dead of ['.itemx2-never-stage', '.itemx2-never-note', '.itemx2-never-lab'])
    assert.ok(bundle.includes(dead), `build must neutralise ${dead}`);
});

test('the build no longer reads the design mockup', async () => {
  const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('itemx-multi-affinity-demo'), 'mockup must not be a build input');
  assert.ok(build.includes('styleSources()'), 'card styling must come from src/');
});
