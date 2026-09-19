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
  for (const action of ['effects', 'module-assets', 'lorebook-scan', 'rebuild', 'storage-cleanup'])
    assert.ok(fallback.includes(`data-action="${action}"`), `fallback lost ${action}`);
  // The drawer's router looks these up by class, including its three aliases.
  for (const hook of ['main', 'lorebook', 'cleanup', 'effects', 'rebuild', 'storage-cleanup'])
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

// Search costs panel height, and the panel is short. It hides behind a header
// button and opens through the same CSS-only control the tabs use, so showing it
// needs no round trip to the host document.
test('search is a header toggle, not a permanent bar', async () => {
  const rt = await presentationRuntime();
  const html = rt.rootInventoryHtml(LOADED, true, 'inventory');
  assert.match(html, /<input class="itemx2-root-control itemx2-search-toggle" id="itemx2-search-toggle" type="checkbox">/);
  assert.match(html, /<label class="itemx-ph-btn itemx2-search-open" for="itemx2-search-toggle"/);
  assert.match(html, /itemx2-search-controls/);
  // The toggle sits beside the layer so the checked sibling selector can reach in.
  assert.ok(
    html.indexOf('itemx2-search-toggle') < html.indexOf('itemx2-root-layer'),
    'the toggle must precede the layer it reveals'
  );
});

test('the power control is not duplicated in settings', async () => {
  const rt = await presentationRuntime();
  const skin = rt.SETTINGS_SKINS.native;
  const body = rt.settingsPanelHtml(LOADED, skin, {
    connection: { ready: false }, chips: '', permissionLabel: '', styleLabel: '',
    domainControls: '', fontChoices: '', positionChoices: '', manager: '', debugPanel: '',
    ...rt.settingsStorageParts(LOADED)
  });
  assert.equal(/itemx2-setting-toggle/.test(body), false, 'two elements would leave one dead');
});

test('the settings tab has no search affordance', async () => {
  const rt = await presentationRuntime();
  const html = rt.rootInventoryHtml(LOADED, true, 'settings');
  assert.equal(/itemx2-search-controls/.test(html), false);
});

test('the search bar is hidden until the toggle is checked', async () => {
  // The sheet is authored unprefixed; prefixRisuClasses rewrites it for the main
  // document at install time, so assert both the rule and that rewriting.
  const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  assert.match(bundle, /\.itemx2-search-controls\{display:none/);
  assert.match(
    bundle,
    /\.itemx2-search-toggle:checked~\.itemx2-root-layer \.itemx2-search-controls\{display:flex\}/
  );
  const rt = await presentationRuntime();
  assert.match(rt.style, /\.itemx2-search-toggle:checked~\.itemx2-root-layer \.itemx2-search-controls\{display:flex\}/);
});

// The header actions row was sized for exactly two buttons. Adding a third
// pushed the close button outside the panel's rounded frame, and the search
// control - a label, not a button - missed the border-box rule its neighbours
// had, so it measured wider than them.
test('the header actions row is sized by its contents, not a button count', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  const box = css.slice(css.indexOf('.itemx2-panel-actions {'), css.indexOf('}', css.indexOf('.itemx2-panel-actions {')));
  assert.match(box, /flex:\s*0 0 auto/);
  assert.equal(/width:\s*\d+px/.test(box), false, 'a fixed width cannot survive another header button');
});

test('every header control gets the same box', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  const start = css.indexOf('.itemx2-panel-actions > button');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.match(css.slice(start, start + 120), /\.itemx2-panel-actions > label/);
  assert.match(rule, /box-sizing:\s*border-box/);
  assert.match(rule, /flex:\s*0 0 36px/);
});

test('the header renders exactly the three controls, all with one class', async () => {
  const rt = await presentationRuntime();
  const html = rt.rootInventoryHtml(LOADED, true, 'inventory');
  const actions = html.slice(html.indexOf('itemx2-panel-actions'), html.indexOf('</header>'));
  const controls = actions.match(/<(button|label)[^>]*class="itemx-ph-btn/g) || [];
  assert.equal(controls.length, 4, 'power, search, history and close');
  // Power decides whether the plugin runs at all and is toggled per bot, so it
  // sits in the header rather than behind a scroll in settings.
  assert.match(actions, /itemx2-sw-power itemx2-setting-toggle/);
  assert.equal(actions.indexOf('itemx2-sw-power') < actions.indexOf('itemx2-root-close'), true,
    'power must not sit beside close, where a mistap stops recording');
  // It carries both hooks because one header serves the drawer and the fallback.
  assert.match(actions, /data-action="toggle"/);
});

// One narrow-screen block owns the panel box. A second block competing with it
// is how the earlier widening silently lost: it was written before this one and
// carried the same specificity, so this one won and kept the old gutter.
const narrowPanelBlocks = (css) => {
  const out = [];
  for (const match of css.matchAll(/@media\s*\(max-width:(\d+)px\)\{/g)) {
    const body = css.slice(match.index + match[0].length, css.indexOf('}}', match.index) + 1);
    if (body.includes('root-panel{')) out.push(body);
  }
  return out;
};

test('the narrow-screen panel box is declared once and uses the screen', async () => {
  const style = await readFile(new URL('../src/style.js', import.meta.url), 'utf8');
  const blocks = narrowPanelBlocks(style);
  assert.equal(blocks.length, 1, 'two narrow-screen panel rules will shadow each other');
  const box = blocks[0].match(/root-panel\{([^}]*)\}/)[1];
  // A gutter the size of the badge is 15% of a phone, and the panel has its own
  // close button while it is open.
  assert.match(box, /width:calc\(100vw - 16px\)/);
  assert.match(box, /height:min\(900px,88dvh\)/);
  assert.equal(/100vw - 6[0-9]px/.test(box), false, 'the badge gutter must not come back');
});

test('the drawer sits against the edge on a narrow screen', async () => {
  const style = await readFile(new URL('../src/style.js', import.meta.url), 'utf8');
  const block = narrowPanelBlocks(style)[0];
  for (const side of ['left:8px', 'right:8px', 'bottom:8px']) assert.ok(block.includes(side), side);
  assert.equal(/(left|right):5[0-9]px/.test(block), false, 'no badge-sized offset should survive');
});
