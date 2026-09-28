import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeHost, settle } from './helpers/fake-host.mjs';
import { loadBundle } from './helpers/bundle.mjs';

const source = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('the bundle declares the itemx2 plugin on API v3 with its update URL', () => {
  const header = source.slice(0, source.indexOf('\n\n'));
  assert.deepEqual(header.split('\n'), [
    '//@name itemx2',
    '//@api 3.0',
    `//@version ${version}`,
    '//@update-url https://raw.githubusercontent.com/canister2668/itemx2/refs/heads/main/dist/itemx2.plugin.js',
    `//@display-name ITEMX · v${version}`,
    '//@description World Inventory & Encounter Archive'
  ]);
  assert.match(source, /GNU General Public License/);
  assert.match(source, /Source: https:\/\/github\.com\/canister2668\/itemx2/);
});

test('a started plugin registers every hook and its setting, and unload removes them all', async () => {
  const host = createFakeHost();
  await loadBundle(host.api);
  await settle(20);
  assert.deepEqual(Object.keys(host.state.handlers).sort(), ['display', 'output', 'process']);
  assert.deepEqual(Object.keys(host.state.replacers).sort(), ['afterRequest', 'beforeRequest']);
  assert.equal(host.state.listeners.length, 1);
  assert.ok(host.state.uiParts.includes('setting'));
  // onUnload is registered before anything that can fail or wait.
  assert.equal(host.state.calls[0], 'onUnload');
  await host.state.unload();
  assert.deepEqual(host.state.handlers, {});
  assert.deepEqual(host.state.replacers, {});
  assert.equal(host.state.listeners.length, 0);
  assert.deepEqual(host.state.uiParts, []);
});

test('the preview page runs the plugin renderer', async () => {
  const preview = await readFile(new URL('../dist/itemx2-preview.html', import.meta.url), 'utf8');
  assert.match(preview, /ITEMXRenderer\.renderCard/);
  assert.match(preview, /ITEMXRenderer\.renderTile/);
});
