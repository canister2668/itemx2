import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

// Layers, lowest first: engine / render (pure) -> host adapter and stores ->
// logic (ledger, pipeline, aux, portraits) -> ui -> main (composition).
const root = new URL('../', import.meta.url).pathname;
const files = (await readdir(join(root, 'src'), { recursive: true }))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `src/${f}`);
const sources = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, await readFile(join(root, f), 'utf8')]))
);
const imports = (file) =>
  [...sources[file].matchAll(/^import [^;]*? from '(\.[^']+)'/gm)].map((m) =>
    relative(root, resolve(root, dirname(file), m[1]))
  );
const layer = (file) =>
  file === 'src/main.js' || file === 'src/index.js'
    ? 'main'
    : file.startsWith('src/ui/')
      ? 'ui'
      : file.startsWith('src/engine/') || file.startsWith('src/render/')
        ? 'pure'
        : 'logic';

test('no module below the UI imports the UI or the composition root', () => {
  const offenders = files.flatMap((file) =>
    layer(file) === 'ui' || layer(file) === 'main'
      ? []
      : imports(file)
          .filter((dep) => ['ui', 'main'].includes(layer(dep)))
          .map((dep) => `${file} -> ${dep}`)
  );
  assert.deepEqual(offenders, []);
});

test('pure engine and render modules depend only on each other and the text catalog', () => {
  const allowed = new Set(['src/i18n.js', 'src/config.js']);
  const offenders = files.flatMap((file) =>
    layer(file) !== 'pure'
      ? []
      : imports(file)
          .filter((dep) => layer(dep) !== 'pure' && !allowed.has(dep) && !dep.endsWith('.json'))
          .map((dep) => `${file} -> ${dep}`)
  );
  assert.deepEqual(offenders, []);
});

test('only the host adapter names the RisuAI global', () => {
  const offenders = files.filter((file) => file !== 'src/host.js' && /\bRisuai\b/.test(sources[file]));
  assert.deepEqual(offenders, []);
});

test('drawer view state never leaves the UI layer', () => {
  const offenders = files.filter((file) => layer(file) !== 'ui' && imports(file).includes('src/ui/view-state.js'));
  // main.js composes unload and may clear the open flag; nothing else below it.
  assert.deepEqual(
    offenders.filter((file) => file !== 'src/main.js'),
    []
  );
});

test('the store layer (anchors, document, replay) depends on the pure engine only', () => {
  const offenders = files.flatMap((file) =>
    !file.startsWith('src/store/')
      ? []
      : imports(file)
          .filter((dep) => !dep.startsWith('src/engine/') && !dep.startsWith('src/store/'))
          .map((dep) => `${file} -> ${dep}`)
  );
  assert.deepEqual(offenders, []);
});
