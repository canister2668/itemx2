import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const srcDir = new URL('../src/', import.meta.url);
const sources = async () => {
  const names = (await readdir(srcDir)).filter((n) => /\.(js|css)$/.test(n));
  return Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await readFile(new URL(n, srcDir), 'utf8')]))
  );
};

// A v3 plugin is an iframe laid over the host page. backdrop-filter has to blur
// what is *behind* that iframe, so the compositor snapshots the viewport
// uncompressed - width x height x 4 bytes - and keeps the previous frame beside
// the new one. A phone has no dedicated VRAM and shares system RAM, so iOS kills
// the tab outright and Android grinds. It is also exactly what a generator adds
// to a popup or a bar to make it look nicer, which is why this is pinned.
test('no backdrop-filter anywhere in the plugin', async () => {
  const files = await sources();
  const offenders = Object.entries(files)
    .filter(([, text]) => /backdrop-filter|backdropFilter/i.test(text))
    .map(([name]) => name);
  assert.deepEqual(offenders, [], 'backdrop-filter blurs the host page behind the iframe');
  const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  assert.equal(/backdrop-filter|backdropFilter/i.test(bundle), false, 'it must not reach the shipped bundle either');
});

// Blurring an element only rasterises that element. It is far cheaper than a
// backdrop snapshot, but a blurred sticky or fixed layer recomposites on every
// scrolled frame, which is the same bill charged continuously.
test('nothing blurred is also pinned to the viewport', async () => {
  const css = (await sources())['style.css'];
  const bad = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g))
    if (/blur\(/.test(body) && /position:\s*(fixed|sticky)/.test(body)) bad.push(selector.trim().slice(0, 60));
  assert.deepEqual(bad, [], 'a blurred fixed layer repaints every frame while scrolling');
});

// Promoting a layer costs memory that is never reclaimed while the rule applies.
// A handful is deliberate; a sweep of them is a generator being decorative.
test('layer promotion stays deliberate', async () => {
  const files = await sources();
  const total = Object.values(files).reduce(
    (sum, text) => sum + (text.match(/will-change/g) || []).length,
    0
  );
  assert.ok(total <= 4, `will-change used ${total} times; each one pins a layer in memory`);
});
