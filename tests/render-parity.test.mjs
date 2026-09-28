import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rt, Style } from './helpers/modules.mjs';

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
  character: { name: '테스트' },
  chat: { message: [], scriptstate: {} },
  snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
  codexSnapshot: {
    skills: { order: [], entries: {} },
    monsters: { order: [], entries: {} },
    history: { skill: {}, monster: {} },
    fingerprint: 'b'
  }
};

function renderSettings(rt, which) {
  const skin = rt.SETTINGS_SKINS[which];
  return rt.settingsPanelHtml(LOADED, skin, {
    connection: { ready: false, hook: ['훅', 'warn'], dom: ['화면', 'warn'], listener: ['커밋', 'warn'] },
    chips: '',
    permissionLabel: '허용',
    styleLabel: '고정',
    domainControls: rt.settingsDomainControls(LOADED, skin),
    fontChoices: rt.settingsFontChoices(LOADED, skin),
    positionChoices: rt.settingsPositionChoices(skin),
    manager: '',
    debugPanel: '',
    ...rt.settingsStorageParts(LOADED)
  });
}

const cardTitles = (html) =>
  [...html.matchAll(/<section class="itemx2-root-setting-card"><span><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);

test('both skins render the same controls in the same order', async () => {
  const drawer = cardTitles(renderSettings(rt, 'native'));
  const fallback = cardTitles(renderSettings(rt, 'frame'));
  // The fallback exists because main-document access was refused, so it swaps the
  // drawer's single connect action for the two repair actions. Nothing else differs.
  assert.deepEqual(drawer.slice(0, 1), ['Risu 연결']);
  assert.deepEqual(fallback.slice(0, 2), ['모델 처리 권한', '본문 카드 스타일']);
  assert.deepEqual(drawer.slice(1), fallback.slice(2), 'the two skins drifted apart');
});

test('each skin binds every control its own way and never both', async () => {
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
  for (const action of ['module-assets', 'lorebook-scan', 'rebuild', 'storage-cleanup'])
    assert.ok(fallback.includes(`data-action="${action}"`), `fallback lost ${action}`);
  assert.ok(fallback.includes('data-seg="fx"'), 'fallback lost the effect level segment');
  // The drawer's router looks these up by class, including its three aliases.
  for (const hook of ['main', 'lorebook', 'cleanup', 'rebuild', 'storage-cleanup'])
    assert.ok(drawer.includes(`itemx2-setting-${hook}`), `drawer lost itemx2-setting-${hook}`);
  for (const level of ['full', 'lite', 'off'])
    assert.ok(drawer.includes(`itemx2-seg-fx-${level}`), `drawer lost itemx2-seg-fx-${level}`);
});

test('every control is a real button with an explicit type', async () => {
  for (const which of ['native', 'frame']) {
    const html = renderSettings(rt, which);
    const buttons = html.match(/<button[^>]*>/g) || [];
    assert.ok(buttons.length > 15, `${which} rendered too few controls`);
    for (const button of buttons) assert.match(button, /type="button"/, `${which}: ${button.slice(0, 80)}`);
  }
});

test('the settings surface is styled in both documents', () => {
  // The fallback renders the drawer's markup, so the surface cannot live in a
  // drawer-only stylesheet any more.
  assert.ok(
    Style.fallbackDocumentHead().includes(Style.ITEMX_SETTINGS_STYLE),
    'the iframe must include the shared surface'
  );
  const main = Style.mainStyleText();
  for (const rule of Style.dedupeCss(Style.prefixRisuClasses(Style.ITEMX_SETTINGS_STYLE)).split('\n'))
    assert.ok(main.includes(rule), rule.slice(0, 80));
  // The radio-tab mechanism that hides the pane stays with the drawer.
  assert.ok(!/itemx2-root-settings\{[^}]*display:none/.test(Style.ITEMX_SETTINGS_STYLE));
});

test('both renderers carry one irreversible-actions zone', async () => {
  for (const which of ['native', 'frame'])
    assert.equal((renderSettings(rt, which).match(/itemx2-danger-zone/g) || []).length, 1);
});

test('the iframe shell layer never reaches the shipped chat scope', async () => {
  const shell = await readFile(new URL('../src/styles/shell.css', import.meta.url), 'utf8');
  const cardsCss = await readFile(new URL('../src/styles/cards.css', import.meta.url), 'utf8');
  assert.ok(shell.includes('.stage '), 'shell.css must own the iframe stage layout');
  assert.ok(!cardsCss.includes('.lab-title'), 'preview chrome leaked into the shipped card surface');
  assert.equal(/\.stage\b|\.demo-note\b|\.lab\b/.test(Style.mainStyleText()), false);
});

// Search costs panel height, and the panel is short. It hides behind a header
// button and opens through the same CSS-only control the tabs use, so showing it
// needs no round trip to the host document.
test('search is a header toggle, not a permanent bar', async () => {
  const html = rt.rootInventoryHtml(LOADED, true, 'inventory');
  assert.match(
    html,
    /<input class="itemx2-root-control itemx2-search-toggle" id="itemx2-search-toggle" type="checkbox">/
  );
  assert.match(html, /<label class="itemx-ph-btn itemx2-search-open" for="itemx2-search-toggle"/);
  assert.match(html, /itemx2-search-controls/);
  // The toggle sits beside the layer so the checked sibling selector can reach in.
  assert.ok(
    html.indexOf('itemx2-search-toggle') < html.indexOf('itemx2-root-layer'),
    'the toggle must precede the layer it reveals'
  );
});

test('the power control is not duplicated in settings', async () => {
  const skin = rt.SETTINGS_SKINS.native;
  const body = rt.settingsPanelHtml(LOADED, skin, {
    connection: { ready: false },
    chips: '',
    permissionLabel: '',
    styleLabel: '',
    domainControls: '',
    fontChoices: '',
    positionChoices: '',
    manager: '',
    debugPanel: '',
    ...rt.settingsStorageParts(LOADED)
  });
  assert.equal(/itemx2-setting-toggle/.test(body), false, 'two elements would leave one dead');
});

test('the settings tab has no search affordance', async () => {
  const html = rt.rootInventoryHtml(LOADED, true, 'settings');
  assert.equal(/itemx2-search-controls/.test(html), false);
});

test('the search bar is hidden until the toggle is checked', async () => {
  // The sheet is authored unprefixed; prefixRisuClasses rewrites it for the main
  // document at install time, so assert both the rule and that rewriting.
  const main = Style.mainStyleText();
  assert.match(main, /\.x-risu-itemx2-search-controls\{display:none/);
  assert.match(
    main,
    /\.x-risu-itemx2-search-toggle:checked~\.x-risu-itemx2-root-layer \.x-risu-itemx2-search-controls\{display:flex\}/
  );
  assert.match(rt.style, /\.itemx2-search-toggle:checked~\.itemx2-root-layer \.itemx2-search-controls\{display:flex\}/);
});

// The header actions row was sized for exactly two buttons. Adding a third
// pushed the close button outside the panel's rounded frame, and the search
// control - a label, not a button - missed the border-box rule its neighbours
// had, so it measured wider than them.
test('the header actions row is sized by its contents, not a button count', async () => {
  const css = await readFile(new URL('../src/styles/presentation.css', import.meta.url), 'utf8');
  const box = css.slice(
    css.indexOf('.itemx2-panel-actions {'),
    css.indexOf('}', css.indexOf('.itemx2-panel-actions {'))
  );
  assert.match(box, /flex:\s*0 0 auto/);
  assert.equal(/width:\s*\d+px/.test(box), false, 'a fixed width cannot survive another header button');
});

test('every header control gets the same box', async () => {
  const css = await readFile(new URL('../src/styles/presentation.css', import.meta.url), 'utf8');
  const start = css.indexOf('.itemx2-panel-actions > button');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.match(css.slice(start, start + 120), /\.itemx2-panel-actions > label/);
  assert.match(rule, /box-sizing:\s*border-box/);
  assert.match(rule, /flex:\s*0 0 36px/);
});

test('the header renders exactly the three controls, all with one class', async () => {
  const html = rt.rootInventoryHtml(LOADED, true, 'inventory');
  const actions = html.slice(html.indexOf('itemx2-panel-actions'), html.indexOf('</header>'));
  const controls = actions.match(/<(button|label)[^>]*class="itemx-ph-btn/g) || [];
  assert.equal(controls.length, 4, 'power, search, history and close');
  // Power decides whether the plugin runs at all and is toggled per bot, so it
  // sits in the header rather than behind a scroll in settings.
  assert.match(actions, /itemx2-sw-power itemx2-setting-toggle/);
  assert.equal(
    actions.indexOf('itemx2-sw-power') < actions.indexOf('itemx2-root-close'),
    true,
    'power must not sit beside close, where a mistap stops recording'
  );
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
  const style = await readFile(new URL('../src/ui/style.js', import.meta.url), 'utf8');
  const blocks = narrowPanelBlocks(style);
  assert.equal(blocks.length, 1, 'two narrow-screen panel rules will shadow each other');
  const box = blocks[0].match(/root-panel\{([^}]*)\}/)[1];
  // A gutter the size of the badge is 15% of a phone, and the panel has its own
  // close button while it is open.
  assert.match(box, /width:calc\(100vw - 16px\)/);
  assert.match(box, /height:min\(900px,88svh\)/);
  assert.equal(/dvh/.test(box), false, 'dvh resizes the panel every time the URL bar animates');
  assert.equal(/100vw - 6[0-9]px/.test(box), false, 'the badge gutter must not come back');
});

test('the drawer sits against the edge on a narrow screen', async () => {
  const style = await readFile(new URL('../src/ui/style.js', import.meta.url), 'utf8');
  const block = narrowPanelBlocks(style)[0];
  for (const side of ['left:8px', 'right:8px', 'bottom:8px']) assert.ok(block.includes(side), side);
  assert.equal(/(left|right):5[0-9]px/.test(block), false, 'no badge-sized offset should survive');
});
