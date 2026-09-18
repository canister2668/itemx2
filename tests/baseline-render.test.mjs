import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// A permanent before/after oracle, kept in Git rather than duplicating a 750 KB
// release bundle. It intentionally compares HTML byte-for-byte, not screenshots.
const baseline = execFileSync('git', ['show', '22fde72:dist/itemx2.plugin.js'], { cwd: new URL('../', import.meta.url), maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
test('structural changes preserve the 2.2.0 drawer HTML', async () => {
  const old = await presentationRuntime({}, '', baseline);
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
    assert.equal(next.rootInventoryHtml(input, open, tab).replace(/<!--ITEMX2-SEARCH-START-->[\s\S]*?<!--ITEMX2-SEARCH-END-->/g, ''), old.rootInventoryHtml(input, open, tab), `${enabled}/${tab}/${open}`);
  }
});
