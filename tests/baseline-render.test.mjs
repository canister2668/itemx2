import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// A permanent before/after oracle, kept in Git rather than duplicating a 750 KB
// release bundle. It intentionally compares HTML byte-for-byte, not screenshots.
const baseline = execFileSync('git', ['show', '22fde72:dist/itemx2.plugin.js'], { cwd: new URL('../', import.meta.url), maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('structural changes preserve the 2.2.0 drawer HTML', async () => {
  // Release labels are expected to change; keep every other rendered byte in
  // the historical oracle intact instead of dropping the header comparison.
  const relabeled = baseline.replace(/const (ITEMX_PLUGIN_VERSION|ITEMX_VERSION_LABEL) = "2\.2\.0";/g,
    (_, name) => `const ${name} = ${JSON.stringify(version)};`);
  assert.equal((baseline.match(/const (ITEMX_PLUGIN_VERSION|ITEMX_VERSION_LABEL) = "2\.2\.0";/g) || []).length, 2);
  const old = await presentationRuntime({}, '', relabeled);
  const next = await presentationRuntime();
  const loaded = {
    key: 'c:chat', enabled: true, mainOutput: true, auxOutput: 'off', rarityMode: 'itemx',
    itemsEnabled: true, skillsEnabled: true, encountersEnabled: true,
    lorebookEncounterEnabled: false, moduleAssetsEnabled: true, effectsEnabled: true,
    debugEnabled: false, fontScale: 'small', skin: 'dark',
    character: { name: 'Test' }, chat: { message: [], scriptstate: {} },
    snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
    codexSnapshot: { skills: { order: [], entries: {} }, monsters: { order: [], entries: {} }, history: { skill: {}, monster: {} }, fingerprint: 'b' }
  };
  for (const enabled of [true, false]) for (const tab of ['inventory', 'skills', 'bestiary', 'settings']) for (const open of [true, false]) {
    const input = { ...loaded, enabled };
    // Search arrived in 2.3.0 and is not in the oracle. It is three pieces - the
    // toggle, the header button that flips it and the bar itself - so all three
    // come out before comparing, or the oracle would reject its own addition.
    const withoutSearch = (html) =>
      html
        .replace(/<!--ITEMX2-SEARCH-START-->[\s\S]*?<!--ITEMX2-SEARCH-END-->/g, '')
        .replace(/<input class="itemx2-root-control itemx2-search-toggle"[^>]*>/g, '')
        .replace(/<label class="itemx-ph-btn itemx2-search-open"[^>]*>[\s\S]*?<\/label>/g, '');
    assert.equal(
      withoutSearch(next.rootInventoryHtml(input, open, tab)),
      old.rootInventoryHtml(input, open, tab),
      `${enabled}/${tab}/${open}`
    );
  }
});
